import crypto from 'node:crypto';
import { Router } from 'express';
import type { PoolClient } from 'pg';
import { paymentIntentSchema, paymentOtpSchema } from '@gnm/shared';
import { env } from '../config/env';
import { query, withTransaction } from '../db/pool';
import { requireAdmin } from '../middleware/auth';
import { requireDeviceSecret } from '../middleware/deviceSecret';
import { audit } from '../services/auditService';
import {
  NormalizedOutcome,
  ProviderError,
  ProviderId,
  allProviderHealth,
  getProvider,
  outcomeFromStatuses
} from '../services/payments';

export const paymentsRouter = Router();

// Statuses fetched with a subsequent poll can trigger a Wave reconciliation once
// the record is at least this stale, covering delayed/lost webhooks.
const RECONCILE_AFTER_MS = 15_000;

function createReference() {
  return `GNM-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function otpHash(reference: string, otp: string) {
  return crypto.createHmac('sha256', env.jwtSecret).update(`${reference}:${otp}`).digest('hex');
}

function toE164Gambia(localDigits?: string | null) {
  if (!localDigits) return undefined;
  const digits = String(localDigits).replace(/\D/g, '');
  if (digits.length === 7 || digits.length === 9) return `+220${digits}`;
  return undefined;
}

function lowerCaseHeaders(headers: Record<string, unknown>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers || {})) {
    out[key.toLowerCase()] = Array.isArray(value) ? value.join(',') : value == null ? undefined : String(value);
  }
  return out;
}

async function loadPaymentConfig() {
  const rows = (await query(
    "SELECT config_key,config_value FROM app_config WHERE config_key IN ('subscription_price','currency','wave_payment_enabled','aps_payment_enabled','org_pricing')"
  )).rows;
  return Object.fromEntries(rows.map((row) => [row.config_key, row.config_value])) as Record<string, unknown>;
}

interface OrgQuote { seats: number; amount: number; }

/**
 * Resolve the server-authoritative total for an organisation purchase. The
 * client only ever sends a seat count; the price comes from `org_pricing`.
 * Returns a string error message when the seat count is not purchasable.
 */
function quoteOrgSeats(rawSeats: unknown, orgPricing: unknown): OrgQuote | string {
  const seats = Math.floor(Number(rawSeats));
  if (!Number.isInteger(seats) || seats < 1) return 'Choose how many devices this organisation code should cover.';
  const pricing = (orgPricing && typeof orgPricing === 'object' ? orgPricing : {}) as Record<string, any>;
  const tiers = (pricing.tiers && typeof pricing.tiers === 'object' ? pricing.tiers : {}) as Record<string, unknown>;
  const customUnit = Number(pricing.custom_unit || 0);
  const minSeats = Number(pricing.custom_min_seats || 2);
  const maxSeats = Number(pricing.custom_max_seats || 500);
  if (seats > maxSeats) return `Organisation codes cover at most ${maxSeats} devices. Contact OceanBrown for a larger plan.`;
  if (tiers[String(seats)] != null) {
    const amount = Number(tiers[String(seats)]);
    if (Number.isFinite(amount) && amount > 0) return { seats, amount };
  }
  if (customUnit > 0 && seats >= minSeats) return { seats, amount: customUnit * seats };
  return 'That organisation size is not available. Choose 5, 10, 15, or a custom size.';
}

/** Grant paid access to exactly one device. Never creates or unblocks a device. */
async function unlockDevice(client: PoolClient, deviceId: string) {
  await client.query(
    `UPDATE devices SET
       status = CASE WHEN status = 'blocked' THEN status ELSE 'active' END,
       access_source = CASE WHEN status = 'blocked' THEN access_source ELSE 'paid' END,
       subscribed_at = COALESCE(subscribed_at, NOW()),
       updated_at = NOW()
     WHERE id = $1`,
    [deviceId]
  );
}

const ORG_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function generateOrgCode() {
  const bytes = crypto.randomBytes(8);
  let body = '';
  for (let i = 0; i < 8; i += 1) body += ORG_CODE_ALPHABET[bytes[i] % 32];
  return `GNM-${body.slice(0, 4)}-${body.slice(4, 8)}`;
}

/**
 * A successful organisation payment mints one multi-seat access code instead of
 * unlocking the buyer's device. Idempotent: a payment that already has a code
 * returns the same one, so a replayed webhook never issues a second.
 */
async function issueCodeForPayment(client: PoolClient, payment: any): Promise<string> {
  const existing = await client.query('SELECT code FROM access_codes WHERE payment_id=$1 LIMIT 1', [payment.id]);
  if (existing.rowCount) return existing.rows[0].code;
  const meta = (payment.metadata_json || {}) as Record<string, unknown>;
  const seats = Math.max(1, Math.floor(Number(meta.seats) || 1));
  let code = '';
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = generateOrgCode();
    const r = await client.query(
      `INSERT INTO access_codes (code, seats, source, status, label, payment_id, created_by)
       VALUES ($1,$2,'purchase','active',$3,$4,'system')
       ON CONFLICT (code) DO NOTHING RETURNING code`,
      [candidate, seats, `Purchased · ${payment.reference}`, payment.id]
    );
    if (r.rowCount) { code = r.rows[0].code; break; }
  }
  if (!code) throw Object.assign(new Error('Could not allocate an organisation code'), { status: 500 });
  await client.query(
    `UPDATE payments SET provider_metadata_json = COALESCE(provider_metadata_json,'{}'::jsonb) || jsonb_build_object('issued_code', $2::text) WHERE id=$1`,
    [payment.id, code]
  );
  return code;
}

interface OutcomeInput {
  outcome: NormalizedOutcome;
  paymentStatus: string | null;
  checkoutStatus: string | null;
  providerTransactionId: string | null;
  providerSessionId: string | null;
  amount: string | null;
  currency: string | null;
  clientReference: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  rawSafe?: Record<string, unknown>;
}

type ApplyResult =
  | { applied: true; status: string; unlocked: boolean; issuedCode?: string | null }
  | { applied: false; reason: 'amount_mismatch' | 'currency_mismatch' | 'reference_mismatch' };

/**
 * Single monotonic state machine for both webhook and reconciliation paths.
 * A payment that already reached `success` can never be downgraded, and only
 * the payment's own device is ever unlocked.
 */
async function applyOutcome(client: PoolClient, paymentRef: string, input: OutcomeInput): Promise<ApplyResult> {
  const found = await client.query('SELECT * FROM payments WHERE reference = $1 FOR UPDATE', [paymentRef]);
  const payment = found.rows[0];
  if (!payment) throw Object.assign(new Error('Payment not found'), { status: 404 });

  // Correlation checks — reject a well-signed event that does not match the order.
  if (input.clientReference && input.clientReference !== payment.reference) {
    return { applied: false, reason: 'reference_mismatch' };
  }
  if (input.currency && String(input.currency).toUpperCase() !== String(payment.currency).toUpperCase()) {
    return { applied: false, reason: 'currency_mismatch' };
  }
  if (input.amount != null && Number(input.amount) !== Number(payment.amount)) {
    return { applied: false, reason: 'amount_mismatch' };
  }

  const alreadySuccess = payment.status === 'success';
  let nextStatus = payment.status as string;
  let unlocked = false;
  let issuedCode: string | null = null;

  if (input.outcome === 'completed' && input.paymentStatus === 'succeeded' && input.checkoutStatus === 'complete') {
    nextStatus = 'success';
  } else if (!alreadySuccess && input.outcome === 'failed') {
    nextStatus = 'failed';
  } else if (!alreadySuccess && input.outcome === 'expired') {
    nextStatus = 'expired';
  } else if (!alreadySuccess && input.outcome === 'pending') {
    nextStatus = 'pending';
  }

  const updated = await client.query(
    `UPDATE payments SET
       status = CASE WHEN status = 'success' THEN 'success' ELSE $2 END,
       checkout_status = COALESCE($3, checkout_status),
       payment_status = COALESCE($4, payment_status),
       wave_transaction_id = COALESCE($5, wave_transaction_id),
       external_reference = COALESCE($5, external_reference),
       wave_checkout_session_id = COALESCE($6, wave_checkout_session_id),
       last_provider_error_code = $7,
       last_provider_error_message = $8,
       provider_metadata_json = COALESCE($9::jsonb, provider_metadata_json),
       paid_at = CASE WHEN status = 'success' OR $2 = 'success' THEN COALESCE(paid_at, NOW()) ELSE paid_at END,
       expired_at = CASE WHEN $2 = 'expired' THEN COALESCE(expired_at, NOW()) ELSE expired_at END,
       updated_at = NOW()
     WHERE reference = $1
     RETURNING *`,
    [
      paymentRef,
      nextStatus,
      input.checkoutStatus,
      input.paymentStatus,
      input.providerTransactionId,
      input.providerSessionId,
      input.errorCode,
      input.errorMessage,
      input.rawSafe ? JSON.stringify(input.rawSafe) : null
    ]
  );

  if (!alreadySuccess && updated.rows[0].status === 'success') {
    const meta = (updated.rows[0].metadata_json || {}) as Record<string, unknown>;
    if (meta.kind === 'org') {
      issuedCode = await issueCodeForPayment(client, updated.rows[0]);
    } else {
      await unlockDevice(client, updated.rows[0].device_id);
      unlocked = true;
    }
  }

  return { applied: true, status: updated.rows[0].status, unlocked, issuedCode };
}

paymentsRouter.post('/payments/create-intent', requireDeviceSecret, async (req, res, next) => {
  try {
    if (env.nodeEnv === 'production' && !env.paymentProviderIntegrationReady) {
      return res.status(503).json({ message: 'Live payments are not available yet. Please try again later or contact OceanBrown support.' });
    }
    const b = paymentIntentSchema.parse(req.body);
    const provider = b.provider as ProviderId;
    const paymentConfig = await loadPaymentConfig();
    const providerEnabled = paymentConfig[`${provider}_payment_enabled`] === true;
    if (!providerEnabled) return res.status(403).json({ message: `${provider === 'wave' ? 'Wave' : 'APS'} payments are not currently available.` });

    const configuredCurrency = String(paymentConfig.currency || 'GMD').toUpperCase();

    // Organisation purchases mint a multi-seat code instead of unlocking the
    // buyer's device. The seat count comes from the client; the price does not.
    const meta = (b.metadata || {}) as Record<string, unknown>;
    const isOrg = meta.kind === 'org';
    let requiredAmount = Number(paymentConfig.subscription_price ?? 25);
    if (isOrg) {
      const quote = quoteOrgSeats(meta.seats, paymentConfig.org_pricing);
      if (typeof quote === 'string') return res.status(400).json({ message: quote });
      requiredAmount = quote.amount;
      meta.seats = quote.seats;
    }

    const device = await query('SELECT status FROM devices WHERE id=$1 LIMIT 1', [b.deviceId]);
    if (!device.rowCount) return res.status(404).json({ message: 'Device not registered' });
    // A buyer with their own access can still purchase seats for other people.
    if (!isOrg && device.rows[0]?.status === 'active') return res.status(409).json({ message: 'This device already has full access. No payment is required.' });

    // The server is the sole authority on price and currency. The client value is
    // only accepted when it exactly matches.
    if (b.amount !== requiredAmount || String(b.currency).toUpperCase() !== configuredCurrency) {
      return res.status(400).json({ message: `Payment amount must be D${requiredAmount} ${configuredCurrency}` });
    }

    const existing = await query('SELECT * FROM payments WHERE device_id=$1 AND idempotency_key=$2 LIMIT 1', [b.deviceId, b.idempotencyKey]);
    if (existing.rowCount) {
      const p = existing.rows[0];
      return res.json({ data: { reference: p.reference, provider: p.provider, amount: p.amount, currency: p.currency, status: p.status, checkoutUrl: p.checkout_url || null, testOtp: null } });
    }

    const ref = createReference();

    // --- Test mode: no provider call. Locally generated OTP unlocks the device.
    // This path is impossible in production (env.ts throws if PAYMENT_TEST_MODE).
    if (env.paymentTestMode) {
      const testOtp = String(crypto.randomInt(1000, 10000));
      const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const r = await query(
        `INSERT INTO payments (provider, reference, internal_reference, client_reference, device_id, feature_key, amount, currency, status, checkout_url, metadata_json, otp_hash, otp_expires_at, idempotency_key)
         VALUES ($1,$2,$2,$2,$3,$4,$5,$6,'pending',NULL,$7,$8,$9,$10) RETURNING *`,
        [provider, ref, b.deviceId, b.featureKey, b.amount, b.currency, JSON.stringify({ ...meta, customerPhone: b.customerPhone || null, mode: 'test' }), otpHash(ref, testOtp), otpExpiresAt, b.idempotencyKey]
      );
      await query("UPDATE devices SET status=CASE WHEN status='blocked' THEN status ELSE 'pending_payment' END,updated_at=NOW() WHERE id=$1", [b.deviceId]);
      const p = r.rows[0];
      return res.status(201).json({ data: { reference: p.reference, provider: p.provider, amount: p.amount, currency: p.currency, status: p.status, checkoutUrl: null, testOtp } });
    }

    // --- Live mode: create a provider checkout session.
    await query(
      `INSERT INTO payments (provider, reference, internal_reference, client_reference, device_id, feature_key, amount, currency, status, metadata_json, idempotency_key)
       VALUES ($1,$2,$2,$2,$3,$4,$5,$6,'creating',$7,$8)`,
      [provider, ref, b.deviceId, b.featureKey, b.amount, b.currency, JSON.stringify({ ...meta, mode: 'live' }), b.idempotencyKey]
    );

    try {
      const restrictPayerMobile = env.waveEnablePayerRestriction ? toE164Gambia(b.customerPhone) : undefined;
      const checkout = await getProvider(provider).createCheckout({
        reference: ref,
        amount: b.amount,
        amountString: String(b.amount),
        currency: String(b.currency).toUpperCase(),
        successUrl: env.waveSuccessUrl,
        errorUrl: env.waveErrorUrl,
        restrictPayerMobile
      });
      const r = await query(
        `UPDATE payments SET
           status='pending',
           wave_checkout_session_id=$2,
           checkout_url=$3,
           checkout_status=$4,
           payment_status=$5,
           provider_metadata_json=$6::jsonb,
           updated_at=NOW()
         WHERE reference=$1 RETURNING *`,
        [ref, checkout.providerSessionId, checkout.checkoutUrl, checkout.checkoutStatus, checkout.paymentStatus, JSON.stringify(checkout.rawSafe)]
      );
      await query("UPDATE devices SET status=CASE WHEN status='blocked' THEN status ELSE 'pending_payment' END,updated_at=NOW() WHERE id=$1", [b.deviceId]);
      const p = r.rows[0];
      return res.status(201).json({ data: { reference: p.reference, provider: p.provider, amount: p.amount, currency: p.currency, status: p.status, checkoutUrl: p.checkout_url || null, testOtp: null } });
    } catch (error) {
      const providerError = error instanceof ProviderError ? error : null;
      await query(
        `UPDATE payments SET
           status = $2,
           last_provider_error_code = $3,
           last_provider_error_message = $4,
           updated_at = NOW()
         WHERE reference = $1`,
        [ref, providerError?.retryable ? 'pending' : 'failed', providerError?.code || 'provider_error', providerError?.message || 'Provider request failed']
      );
      if (providerError) return res.status(providerError.status).json({ message: 'The payment provider could not start this checkout. No charge was made.', code: providerError.code });
      throw error;
    }
  } catch (e) { next(e); }
});

paymentsRouter.post('/payments/verify-otp', requireDeviceSecret, async (req, res, next) => {
  try {
    if (!env.paymentTestMode) return res.status(404).json({ message: 'Test OTP verification is disabled' });
    const b = paymentOtpSchema.parse(req.body);
    const r = await query('SELECT * FROM payments WHERE reference=$1 AND device_id=$2', [b.reference, b.deviceId]);
    const payment = r.rows[0];
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.status === 'success') return res.json({ data: { reference: payment.reference, status: payment.status } });
    if (payment.otp_attempts >= 5) return res.status(429).json({ message: 'Too many OTP attempts. Start a new payment.' });
    const suppliedHash = otpHash(payment.reference, b.otp);
    const confirmed = await query(
      `UPDATE payments SET status='success',otp_attempts=otp_attempts+1,paid_at=NOW(),external_reference=$2,payment_status='succeeded',checkout_status='complete',updated_at=NOW()
       WHERE reference=$1 AND status IN ('pending','creating') AND otp_attempts<5 AND otp_expires_at>NOW() AND otp_hash=$3 RETURNING *`,
      [payment.reference, `TEST-${payment.reference}`, suppliedHash]
    );
    if (!confirmed.rowCount) {
      await query("UPDATE payments SET otp_attempts=otp_attempts+1,updated_at=NOW() WHERE reference=$1 AND status IN ('pending','creating') AND otp_attempts<5", [payment.reference]);
      return res.status(400).json({ message: 'The OTP is invalid or has expired' });
    }
    await withTransaction((client) => unlockDevice(client, confirmed.rows[0].device_id));
    res.json({ data: { reference: confirmed.rows[0].reference, status: 'success' } });
  } catch (e) { next(e); }
});

paymentsRouter.get('/payments/:reference/status', requireDeviceSecret, async (req, res, next) => {
  try {
    const deviceId = String(req.query.deviceId || '');
    const r = await query('SELECT * FROM payments WHERE reference=$1 AND device_id=$2', [req.params.reference, deviceId]);
    if (!r.rowCount) return res.status(404).json({ message: 'Payment not found' });
    let payment = r.rows[0];

    // Delayed-webhook fallback: reconcile straight from the provider once stale.
    const stale = Date.now() - new Date(payment.updated_at).getTime() > RECONCILE_AFTER_MS;
    if (['creating', 'pending'].includes(payment.status) && payment.provider === 'wave' && payment.wave_checkout_session_id && stale && !env.paymentTestMode) {
      try {
        const checkout = await getProvider('wave').fetchCheckout(payment.wave_checkout_session_id);
        await withTransaction((client) => applyOutcome(client, payment.reference, {
          outcome: outcomeFromStatuses(checkout.checkoutStatus, checkout.paymentStatus),
          paymentStatus: checkout.paymentStatus,
          checkoutStatus: checkout.checkoutStatus,
          providerTransactionId: checkout.providerTransactionId,
          providerSessionId: checkout.providerSessionId,
          amount: checkout.amount,
          currency: checkout.currency,
          clientReference: checkout.clientReference,
          errorCode: checkout.errorCode,
          errorMessage: checkout.errorMessage,
          rawSafe: checkout.rawSafe
        }));
        payment = (await query('SELECT * FROM payments WHERE reference=$1', [payment.reference])).rows[0];
      } catch {
        // Reconciliation is best-effort; return the last known state.
      }
    }

    const providerMeta = (payment.provider_metadata_json || {}) as Record<string, unknown>;
    const paymentMeta = (payment.metadata_json || {}) as Record<string, unknown>;
    res.json({
      data: {
        reference: payment.reference,
        status: payment.status,
        feature_key: payment.feature_key,
        checkout_url: payment.checkout_url,
        checkout_status: payment.checkout_status,
        payment_status: payment.payment_status,
        amount: payment.amount,
        currency: payment.currency,
        kind: paymentMeta.kind === 'org' ? 'org' : 'individual',
        seats: paymentMeta.kind === 'org' ? Number(paymentMeta.seats) || null : null,
        issued_code: (providerMeta.issued_code as string) || null
      }
    });
  } catch (e) { next(e); }
});

// --- Wave webhook: Wave-Signature header, {id,type,data} envelope. -------------
paymentsRouter.post('/payments/webhook/wave', async (req: any, res, next) => {
  try {
    const event = getProvider('wave').verifyAndParseWebhook(req.rawBody as Buffer | undefined, lowerCaseHeaders(req.headers));
    if (!event || !event.id) return res.status(401).json({ message: 'Invalid or expired webhook signature' });

    const result = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO payment_webhook_events(provider,event_id,payment_reference,event_type)
         VALUES ('wave',$1,$2,$3) ON CONFLICT(provider,event_id) DO NOTHING RETURNING id`,
        [event.id, event.clientReference || '', event.eventType]
      );
      if (!inserted.rowCount) return { duplicate: true, matched: true, status: null as string | null };

      const reference = event.clientReference;
      if (!reference) return { duplicate: false, matched: false, status: null };
      const paymentRow = await client.query('SELECT reference FROM payments WHERE reference=$1 OR wave_checkout_session_id=$2 LIMIT 1', [reference, event.providerSessionId]);
      if (!paymentRow.rowCount) return { duplicate: false, matched: false, status: null };

      const applied = await applyOutcome(client, paymentRow.rows[0].reference, {
        outcome: event.outcome,
        paymentStatus: event.paymentStatus,
        checkoutStatus: event.checkoutStatus,
        providerTransactionId: event.providerTransactionId,
        providerSessionId: event.providerSessionId,
        amount: event.amount,
        currency: event.currency,
        clientReference: event.clientReference,
        errorCode: event.errorCode,
        errorMessage: event.errorMessage,
        rawSafe: event.rawSafe
      });
      if (!applied.applied) {
        throw Object.assign(new Error(`Wave webhook rejected: ${applied.reason}`), { status: 422 });
      }
      await client.query(
        `UPDATE payments SET webhook_event_id=$2 WHERE reference=$1`,
        [paymentRow.rows[0].reference, event.id]
      );
      return { duplicate: false, matched: true, status: applied.status, unlocked: applied.unlocked, issuedCode: applied.issuedCode || null, reference: paymentRow.rows[0].reference };
    });

    if (result.matched && !result.duplicate && (result as any).reference) {
      await query(
        `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, new_value_json)
         VALUES (NULL,'wave_webhook_processed','payment',$1,$2)`,
        [(result as any).reference, JSON.stringify({ eventId: event.id, eventType: event.eventType, status: result.status, unlocked: (result as any).unlocked || false, issuedCode: (result as any).issuedCode || null })]
      );
    }
    return res.json({ ok: true, ...result });
  } catch (e) { next(e); }
});

// --- APS webhook: interim scheme, kept fully separate from Wave. ---------------
paymentsRouter.post('/payments/webhook/aps', async (req: any, res, next) => {
  try {
    const event = getProvider('aps').verifyAndParseWebhook(req.rawBody as Buffer | undefined, lowerCaseHeaders(req.headers));
    if (!event || !event.id) return res.status(401).json({ message: 'Invalid or expired webhook signature' });
    const result = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO payment_webhook_events(provider,event_id,payment_reference,event_type)
         VALUES ('aps',$1,$2,$3) ON CONFLICT(provider,event_id) DO NOTHING RETURNING id`,
        [event.id, event.clientReference || '', event.eventType]
      );
      if (!inserted.rowCount) return { duplicate: true, matched: true };
      if (!event.clientReference) return { duplicate: false, matched: false };
      const paymentRow = await client.query('SELECT reference FROM payments WHERE reference=$1 LIMIT 1', [event.clientReference]);
      if (!paymentRow.rowCount) return { duplicate: false, matched: false };
      const applied = await applyOutcome(client, paymentRow.rows[0].reference, {
        outcome: event.outcome,
        paymentStatus: event.paymentStatus,
        checkoutStatus: event.checkoutStatus,
        providerTransactionId: event.providerTransactionId,
        providerSessionId: event.providerSessionId,
        amount: event.amount,
        currency: event.currency,
        clientReference: event.clientReference,
        errorCode: event.errorCode,
        errorMessage: event.errorMessage,
        rawSafe: event.rawSafe
      });
      if (!applied.applied) throw Object.assign(new Error(`APS webhook rejected: ${applied.reason}`), { status: 422 });
      return { duplicate: false, matched: true, status: applied.status };
    });
    return res.json({ ok: true, ...result });
  } catch (e) { next(e); }
});

paymentsRouter.get('/admin/payments', requireAdmin, async (_req, res, next) => {
  try {
    res.json({
      data: (await query(
        `SELECT id,provider,reference,external_reference,wave_transaction_id,wave_checkout_session_id,device_id,feature_key,amount,currency,
                status,checkout_status,payment_status,last_provider_error_code,created_at,updated_at,paid_at
         FROM payments ORDER BY created_at DESC LIMIT 200`
      )).rows
    });
  } catch (e) { next(e); }
});

paymentsRouter.get('/admin/payments/health', requireAdmin, async (_req, res, next) => {
  try {
    const config = await loadPaymentConfig();
    const health = allProviderHealth();
    res.json({
      data: {
        testMode: env.paymentTestMode,
        integrationReady: env.paymentProviderIntegrationReady,
        wave: { ...health.wave, enabled: config.wave_payment_enabled === true },
        aps: { ...health.aps, enabled: config.aps_payment_enabled === true }
      }
    });
  } catch (e) { next(e); }
});

paymentsRouter.post('/admin/payments/:id/confirm-manual', requireAdmin, async (req, res, next) => {
  try {
    if (!env.paymentTestMode || env.paymentProviderIntegrationReady) {
      return res.status(403).json({ message: 'Manual payment confirmation is disabled outside test mode' });
    }
    const found = await query('SELECT reference FROM payments WHERE id=$1', [req.params.id]);
    if (!found.rowCount) return res.status(404).json({ message: 'Payment not found' });
    const outcome = await withTransaction((client) => applyOutcome(client, found.rows[0].reference, {
      outcome: 'completed',
      paymentStatus: 'succeeded',
      checkoutStatus: 'complete',
      providerTransactionId: 'ADMIN-MANUAL',
      providerSessionId: null,
      amount: null,
      currency: null,
      clientReference: found.rows[0].reference,
      errorCode: null,
      errorMessage: null
    }));
    await audit(req, 'manual_payment_confirmed', 'payment', String(req.params.id), null, outcome);
    res.json({ data: outcome });
  } catch (e) { next(e); }
});

import crypto from 'node:crypto';
import { Router } from 'express';
import type { PoolClient } from 'pg';
import { paymentIntentSchema } from '@gnm/shared';
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
    // Test mode exercises the full checkout flow against a local simulator, so it
    // does not require the wallet to be switched on in Admin.
    const providerEnabled = env.paymentTestMode || paymentConfig[`${provider}_payment_enabled`] === true;
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
      return res.json({ data: { reference: p.reference, provider: p.provider, amount: p.amount, currency: p.currency, status: p.status, checkoutUrl: p.checkout_url || null } });
    }

    const ref = createReference();
    const mode = env.paymentTestMode ? 'test' : 'live';

    await query(
      `INSERT INTO payments (provider, reference, internal_reference, client_reference, device_id, feature_key, amount, currency, status, metadata_json, idempotency_key)
       VALUES ($1,$2,$2,$2,$3,$4,$5,$6,'creating',$7,$8)`,
      [provider, ref, b.deviceId, b.featureKey, b.amount, b.currency, JSON.stringify({ ...meta, mode }), b.idempotencyKey]
    );

    try {
      // Test mode takes the identical flow but skips the outbound provider call;
      // the checkout URL is a local simulator page that stands in for the
      // provider's hosted page. Impossible in production (env.ts throws on boot).
      let checkout: { providerSessionId: string; checkoutUrl: string; checkoutStatus: string; paymentStatus: string; rawSafe: Record<string, unknown> };
      if (env.paymentTestMode) {
        const base = (env.publicApiBaseUrl || `${req.protocol}://${req.get('host')}/api`).replace(/\/+$/, '');
        checkout = {
          providerSessionId: `cos-sim-${ref}`,
          checkoutUrl: `${base}/payments/simulate/${ref}`,
          checkoutStatus: 'open',
          paymentStatus: 'processing',
          rawSafe: { simulated: true }
        };
      } else {
        const restrictPayerMobile = env.waveEnablePayerRestriction ? toE164Gambia(b.customerPhone) : undefined;
        checkout = await getProvider(provider).createCheckout({
          reference: ref,
          amount: b.amount,
          amountString: String(b.amount),
          currency: String(b.currency).toUpperCase(),
          successUrl: env.waveSuccessUrl,
          errorUrl: env.waveErrorUrl,
          restrictPayerMobile
        });
      }
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
      return res.status(201).json({ data: { reference: p.reference, provider: p.provider, amount: p.amount, currency: p.currency, status: p.status, checkoutUrl: p.checkout_url || null } });
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

// --- Test-mode simulator: stands in for the provider's hosted checkout page so
// the app flow is byte-identical in testing and production. Disabled outside
// test mode (env.ts refuses to boot with PAYMENT_TEST_MODE in production).
function escapeHtml(value: string) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function simulatePage(p: any) {
  const ref = escapeHtml(p.reference);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test checkout</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0e2946;color:#fff;margin:0;display:grid;place-items:center;min-height:100vh}
.c{background:#12324f;border:1px solid #21456a;border-radius:16px;padding:28px;max-width:360px;width:calc(100% - 32px);text-align:center}
h1{font-size:1.15rem;margin:0 0 6px}.m{opacity:.8;font-size:.9rem;margin:0 0 20px}.a{font-size:2rem;font-weight:800;margin:8px 0 22px}
button{width:100%;min-height:52px;border:0;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;margin-top:10px}
.ok{background:#0a7d52;color:#fff}.no{background:transparent;color:#9fc4e8;border:1px solid #21456a}
code{opacity:.65;font-size:.75rem;word-break:break-all}</style></head>
<body><div class="c"><h1>Test checkout</h1><p class="m">Simulator — stands in for the Wave hosted page. No money moves.</p>
<div class="a">D${escapeHtml(String(p.amount))} ${escapeHtml(String(p.currency || 'GMD'))}</div>
<form method="post"><button class="ok" name="outcome" value="completed">Approve payment</button>
<button class="no" name="outcome" value="failed">Decline</button></form>
<p style="margin-top:18px"><code>${ref}</code></p></div></body></html>`;
}

function simulateDonePage(outcome: string) {
  const ok = outcome === 'completed';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Done</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0e2946;color:#fff;margin:0;display:grid;place-items:center;min-height:100vh;text-align:center}
.c{max-width:340px;padding:24px}h1{font-size:1.1rem}p{opacity:.8}</style></head>
<body><div class="c"><h1>${ok ? 'Payment approved' : 'Payment declined'}</h1>
<p>Return to the GNM app — it will ${ok ? 'unlock automatically' : 'let you try again'} within a few seconds.</p></div></body></html>`;
}

paymentsRouter.get('/payments/simulate/:reference', async (req, res, next) => {
  try {
    if (!env.paymentTestMode) return res.status(404).type('text/plain').send('Not found');
    const r = await query('SELECT reference, amount, currency, status FROM payments WHERE reference=$1', [req.params.reference]);
    if (!r.rowCount) return res.status(404).type('text/plain').send('Payment not found');
    res.type('html').send(simulatePage(r.rows[0]));
  } catch (e) { next(e); }
});

paymentsRouter.post('/payments/simulate/:reference', async (req, res, next) => {
  try {
    if (!env.paymentTestMode) return res.status(404).json({ message: 'Not found' });
    const decision = String((req.body && req.body.outcome) || req.query.outcome || 'completed');
    const outcome: NormalizedOutcome = decision === 'failed' ? 'failed' : 'completed';
    const found = await query('SELECT reference FROM payments WHERE reference=$1', [req.params.reference]);
    if (!found.rowCount) return res.status(404).json({ message: 'Payment not found' });
    const reference = found.rows[0].reference as string;
    const applied = await withTransaction((client) => applyOutcome(client, reference, {
      outcome,
      paymentStatus: outcome === 'completed' ? 'succeeded' : 'cancelled',
      checkoutStatus: outcome === 'completed' ? 'complete' : 'expired',
      providerTransactionId: `SIM-${reference}`,
      providerSessionId: `cos-sim-${reference}`,
      amount: null,
      currency: null,
      clientReference: reference,
      errorCode: outcome === 'failed' ? 'simulated_decline' : null,
      errorMessage: outcome === 'failed' ? 'Payment declined in the test simulator' : null
    }));
    if (String(req.headers.accept || '').includes('text/html')) {
      return res.type('html').send(simulateDonePage(outcome));
    }
    res.json({ data: applied });
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

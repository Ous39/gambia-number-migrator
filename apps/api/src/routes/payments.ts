import crypto from 'node:crypto';
import { Router } from 'express';
import { paymentIntentSchema, paymentOtpSchema } from '@gnm/shared';
import { env } from '../config/env';
import { query, withTransaction } from '../db/pool';
import { requireAdmin } from '../middleware/auth';
import { audit } from '../services/auditService';

export const paymentsRouter = Router();

function createReference() {
  return `GNM-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function otpHash(reference: string, otp: string) {
  return crypto.createHmac('sha256', env.jwtSecret).update(`${reference}:${otp}`).digest('hex');
}

function secureEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyWebhook(req: any, provider: 'wave' | 'aps') {
  const configured = provider === 'wave' ? env.waveWebhookSecret : env.apsWebhookSecret;
  const timestamp = String(req.header('x-webhook-timestamp') || '');
  const eventId = String(req.header('x-webhook-id') || '');
  const supplied = String(req.header('x-webhook-signature') || '').replace(/^sha256=/, '');
  const timestampMs = Number(timestamp) * 1000;
  if (!configured || !eventId || !supplied || !Number.isFinite(timestampMs)) return null;
  if (Math.abs(Date.now() - timestampMs) > env.webhookToleranceSeconds * 1000) return null;
  const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});
  const expected = crypto.createHmac('sha256', configured).update(`${timestamp}.${rawBody}`).digest('hex');
  return secureEqual(supplied, expected) ? { eventId } : null;
}

async function markDevicePaymentState(deviceId: string, status: 'pending_payment' | 'active') {
  await query(
    `INSERT INTO devices (id, status, subscribed_at) VALUES ($1,$2,CASE WHEN $2::text='active' THEN NOW() ELSE NULL END)
     ON CONFLICT (id) DO UPDATE SET status=CASE WHEN devices.status='blocked' THEN devices.status ELSE EXCLUDED.status END,
     access_source=CASE WHEN devices.status='blocked' THEN devices.access_source WHEN EXCLUDED.status='active' THEN 'paid' ELSE devices.access_source END,
     subscribed_at=CASE WHEN EXCLUDED.status='active' THEN NOW() ELSE devices.subscribed_at END, updated_at=NOW()`,
    [deviceId, status]
  );
}

async function applyPaymentStatus(reference: string, status: string, externalReference?: string | null) {
  const allowed = ['pending', 'success', 'failed', 'cancelled'];
  if (!allowed.includes(status)) throw Object.assign(new Error('Unsupported payment status'), { status: 400 });
  const r = await query(
    `UPDATE payments SET status=CASE WHEN payments.status='success' THEN 'success' ELSE $1 END, external_reference=COALESCE($2, external_reference),
     paid_at=CASE WHEN payments.status='success' OR $1='success' THEN COALESCE(paid_at,NOW()) ELSE paid_at END, updated_at=NOW()
     WHERE reference=$3 RETURNING *`, [status, externalReference || null, reference]
  );
  if (!r.rowCount) throw Object.assign(new Error('Payment not found'), { status: 404 });
  if (status === 'success') await markDevicePaymentState(r.rows[0].device_id, 'active');
  return r;
}

paymentsRouter.post('/payments/create-intent', async (req, res, next) => {
  try {
    const b = paymentIntentSchema.parse(req.body);
    const configured = await query("SELECT config_value FROM app_config WHERE config_key='subscription_price' LIMIT 1");
    const requiredAmount = Number(configured.rows[0]?.config_value ?? 100);
    const device = await query('SELECT status,access_source FROM devices WHERE id=$1 LIMIT 1', [b.deviceId]);
    if (device.rows[0]?.status === 'active') return res.status(409).json({ message: 'This device already has full access. No payment is required.' });
    if (b.amount !== requiredAmount || b.currency !== 'GMD') return res.status(400).json({ message: `Payment amount must be D${requiredAmount} GMD` });
    const existing = await query(
      'SELECT * FROM payments WHERE device_id=$1 AND idempotency_key=$2 LIMIT 1',
      [b.deviceId, b.idempotencyKey]
    );
    if (existing.rowCount) {
      const payment = existing.rows[0];
      return res.json({ data: { reference: payment.reference, provider: payment.provider, amount: payment.amount, currency: payment.currency, status: payment.status, testOtp: null } });
    }
    const ref = createReference();
    const testOtp = env.paymentTestMode ? String(crypto.randomInt(1000, 10000)) : null;
    const otpHashValue = testOtp ? otpHash(ref, testOtp) : null;
    const otpExpiresAt = testOtp ? new Date(Date.now() + 5 * 60 * 1000) : null;
    const r = await query(
      `INSERT INTO payments (provider, reference, device_id, feature_key, amount, currency, status, checkout_url, metadata_json, otp_hash, otp_expires_at, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',NULL,$7,$8,$9,$10) RETURNING *`,
      [b.provider, ref, b.deviceId, b.featureKey, b.amount, b.currency,
       JSON.stringify({ ...(b.metadata || {}), customerPhone: b.customerPhone || null }), otpHashValue, otpExpiresAt, b.idempotencyKey]
    );
    await markDevicePaymentState(b.deviceId, 'pending_payment');
    const payment = r.rows[0];
    res.status(201).json({ data: { reference: payment.reference, provider: payment.provider, amount: payment.amount, currency: payment.currency, status: payment.status, testOtp } });
  } catch (e) { next(e); }
});

paymentsRouter.post('/payments/verify-otp', async (req, res, next) => {
  try {
    if (!env.paymentTestMode) return res.status(404).json({ message: 'Test OTP verification is disabled' });
    const b = paymentOtpSchema.parse(req.body);
    const r = await query('SELECT * FROM payments WHERE reference=$1', [b.reference]);
    const payment = r.rows[0];
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.status === 'success') return res.json({ data: { reference: payment.reference, status: payment.status } });
    if (payment.otp_attempts >= 5) return res.status(429).json({ message: 'Too many OTP attempts. Start a new payment.' });
    const suppliedHash = otpHash(payment.reference, b.otp);
    const confirmed = await query(`UPDATE payments SET status='success',otp_attempts=otp_attempts+1,paid_at=NOW(),external_reference=$2,updated_at=NOW()
      WHERE reference=$1 AND status='pending' AND otp_attempts<5 AND otp_expires_at>NOW() AND otp_hash=$3 RETURNING *`, [payment.reference, `TEST-${payment.reference}`, suppliedHash]);
    if (!confirmed.rowCount) {
      await query("UPDATE payments SET otp_attempts=otp_attempts+1,updated_at=NOW() WHERE reference=$1 AND status='pending' AND otp_attempts<5", [payment.reference]);
      return res.status(400).json({ message: 'The OTP is invalid or has expired' });
    }
    await markDevicePaymentState(confirmed.rows[0].device_id, 'active');
    res.json({ data: { reference: confirmed.rows[0].reference, status: 'success' } });
  } catch (e) { next(e); }
});

paymentsRouter.get('/payments/:reference/status', async (req, res, next) => {
  try {
    const r = await query('SELECT reference, status, feature_key, checkout_url, amount, currency FROM payments WHERE reference=$1', [req.params.reference]);
    if (!r.rowCount) return res.status(404).json({ message: 'Payment not found' });
    res.json({ data: r.rows[0] });
  } catch (e) { next(e); }
});

for (const provider of ['wave', 'aps'] as const) {
  paymentsRouter.post(`/payments/webhook/${provider}`, async (req, res, next) => {
    try {
      const verification = verifyWebhook(req, provider);
      if (!verification) return res.status(401).json({ message: 'Invalid or expired webhook signature' });
      const reference = String(req.body.reference || '');
      const result = await withTransaction(async (client) => {
        const inserted = await client.query(
          `INSERT INTO payment_webhook_events(provider,event_id,payment_reference)
           VALUES ($1,$2,$3) ON CONFLICT(provider,event_id) DO NOTHING RETURNING id`,
          [provider, verification.eventId, reference]
        );
        if (!inserted.rowCount) return { duplicate: true, reference };
        const allowed = ['pending', 'success', 'failed', 'cancelled', 'expired', 'under_review'];
        const status = String(req.body.status || '');
        if (!allowed.includes(status)) throw Object.assign(new Error('Unsupported payment status'), { status: 400 });
        const updated = await client.query(
          `UPDATE payments SET
             status=CASE WHEN payments.status='success' THEN 'success' ELSE $1 END,
             external_reference=COALESCE($2,external_reference),
             paid_at=CASE WHEN payments.status='success' OR $1='success' THEN COALESCE(paid_at,NOW()) ELSE paid_at END,
             updated_at=NOW()
           WHERE reference=$3 RETURNING *`,
          [status, req.body.externalReference || null, reference]
        );
        if (!updated.rowCount) throw Object.assign(new Error('Payment not found'), { status: 404 });
        if (status === 'success') {
          await client.query(
            `INSERT INTO devices(id,status,subscribed_at) VALUES($1,'active',NOW())
             ON CONFLICT(id) DO UPDATE SET status=CASE WHEN devices.status='blocked' THEN devices.status ELSE 'active' END,
             access_source=CASE WHEN devices.status='blocked' THEN devices.access_source ELSE 'paid' END,
             subscribed_at=NOW(),updated_at=NOW()`,
            [updated.rows[0].device_id]
          );
        }
        return { duplicate: false, reference };
      });
      res.json({ ok: true, ...result });
    } catch (e) { next(e); }
  });
}

paymentsRouter.get('/admin/payments', requireAdmin, async (_req, res, next) => {
  try { res.json({ data: (await query('SELECT id,provider,reference,external_reference,device_id,feature_key,amount,currency,status,created_at,updated_at,paid_at FROM payments ORDER BY created_at DESC LIMIT 200')).rows }); } catch (e) { next(e); }
});

paymentsRouter.post('/admin/payments/:id/confirm-manual', requireAdmin, async (req, res, next) => {
  try {
    if (!env.paymentTestMode) {
      return res.status(403).json({ message: 'Manual payment confirmation is disabled outside test mode' });
    }
    const found = await query('SELECT reference FROM payments WHERE id=$1', [req.params.id]);
    if (!found.rowCount) return res.status(404).json({ message: 'Payment not found' });
    const r = await applyPaymentStatus(found.rows[0].reference, 'success', 'ADMIN-MANUAL');
    await audit(req, 'manual_payment_confirmed', 'payment', String(req.params.id), null, r.rows[0]);
    res.json({ data: r.rows[0] });
  } catch (e) { next(e); }
});

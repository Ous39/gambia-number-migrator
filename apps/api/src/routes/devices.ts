import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db/pool';
import { requireAdmin } from '../middleware/auth';
import { requireDeviceSecret } from '../middleware/deviceSecret';
import { audit } from '../services/auditService';
import crypto from 'node:crypto';

export const devicesRouter = Router();

const registerSchema = z.object({
  fingerprint: z.string().min(8).max(200),
  deviceName: z.string().max(200).nullable().optional(),
  deviceModel: z.string().max(200).nullable().optional(),
  osName: z.string().max(100).nullable().optional(),
  osVersion: z.string().max(100).nullable().optional(),
  platform: z.string().max(50).nullable().optional(),
  appVersion: z.string().max(50).nullable().optional()
});

const trialSchema = z.object({ count: z.number().int().positive().max(100000) });

async function getConfigValue<T>(key: string, fallback: T): Promise<T> {
  const row = await query('SELECT config_value FROM app_config WHERE config_key=$1 LIMIT 1', [key]);
  if (!row.rowCount) return fallback;
  return row.rows[0].config_value as T;
}

function publicDevice(row: any, extra: Record<string, unknown> = {}) {
  return {
    id: row.id,
    status: row.status,
    trialContactsUsed: row.trial_contacts_used,
    subscribedAt: row.subscribed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    accessSource: row.access_source || (row.status === 'active' ? 'paid' : 'trial'),
    promotionalAccessGrantedAt: row.promotional_access_granted_at || null,
    supportCode: `GNM-${crypto.createHash('sha256').update(String(row.id)).digest('hex').slice(0, 8).toUpperCase()}`,
    ...extra
  };
}

/**
 * Registers a privacy-safe device reference. This endpoint never receives contacts,
 * contact names, phone numbers, or a phonebook.
 */
devicesRouter.post('/devices/register', async (req, res, next) => {
  try {
    const b = registerSchema.parse(req.body);
    const ip = String(req.ip || req.socket.remoteAddress || '').replace(/^::ffff:/, '').slice(0, 64);

    const result = await withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('gnm-free-access-campaign'))");
      const existing = await client.query('SELECT id FROM devices WHERE id=$1 LIMIT 1', [b.fingerprint]);
      const deviceSecret = existing.rowCount ? undefined : crypto.randomBytes(32).toString('hex');
      const deviceSecretHash = deviceSecret ? crypto.createHash('sha256').update(deviceSecret).digest('hex') : null;
      const saved = await client.query(
      `INSERT INTO devices (id, device_name, device_model, os_name, os_version, platform, last_ip, app_version, device_secret_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET
         device_name=EXCLUDED.device_name,
         device_model=EXCLUDED.device_model,
         os_name=EXCLUDED.os_name,
         os_version=EXCLUDED.os_version,
         platform=EXCLUDED.platform,
         last_ip=EXCLUDED.last_ip,
         app_version=EXCLUDED.app_version,
         updated_at=NOW()
       RETURNING *`,
      [b.fingerprint, b.deviceName || null, b.deviceModel || null, b.osName || null, b.osVersion || null, b.platform || null, ip, b.appVersion || null, deviceSecretHash]
      );
      const configRows = await client.query("SELECT config_key,config_value FROM app_config WHERE config_key IN ('free_access_mode','free_access_user_limit')");
      const campaign = Object.fromEntries(configRows.rows.map((row) => [row.config_key, row.config_value]));
      const mode = String(campaign.free_access_mode || 'off');
      const limit = Math.max(1, Number(campaign.free_access_user_limit || 100));
      const device = saved.rows[0];
      if (!['active','blocked'].includes(device.status) && device.access_source !== 'campaign') {
        const campaignCount = Number((await client.query("SELECT COUNT(*)::int AS count FROM devices WHERE access_source='campaign'")).rows[0]?.count || 0);
        if (mode === 'all' || (mode === 'first_n' && campaignCount < limit)) {
          const granted = await client.query("UPDATE devices SET status='active',access_source='campaign',promotional_access_granted_at=COALESCE(promotional_access_granted_at,NOW()),updated_at=NOW() WHERE id=$1 RETURNING *", [b.fingerprint]);
          return { device: granted.rows[0], deviceSecret, granted: true, campaignMode: mode, campaignCount: campaignCount + 1, campaignLimit: limit };
        }
      }
      return { device, deviceSecret, granted: false };
    });

    if (result.granted) {
      // Not an admin-initiated action, so req.admin is absent and audit() records admin_id=null —
      // this is the device-registration path, the only place campaign slots are actually consumed.
      await audit(req, 'campaign_access_granted', 'device', result.device.id, undefined, {
        mode: result.campaignMode,
        campaignCount: result.campaignCount,
        campaignLimit: result.campaignMode === 'first_n' ? result.campaignLimit : null,
      }).catch(() => undefined);
    }

    const freeTrialLimit = Number(await getConfigValue('free_trial_limit', 0));
    const subscriptionPrice = Number(await getConfigValue('subscription_price', 25));
    const currency = await getConfigValue('currency', 'GMD');
    const freeAccessMode = String(await getConfigValue('free_access_mode', 'off'));
    const freeAccessUserLimit = Number(await getConfigValue('free_access_user_limit', 100));
    res.set('Cache-Control', 'no-store');
    res.json({ data: publicDevice(result.device, { freeTrialLimit, subscriptionPrice, currency, freeAccessMode, freeAccessUserLimit }), ...(result.deviceSecret ? { deviceSecret: result.deviceSecret } : {}) });
  } catch (e) {
    next(e);
  }
});

devicesRouter.get('/devices/:fingerprint/status', async (req, res, next) => {
  try {
    const r = await query('SELECT * FROM devices WHERE id=$1 LIMIT 1', [req.params.fingerprint]);
    if (!r.rowCount) return res.status(404).json({ message: 'Device not registered' });
    const freeTrialLimit = Number(await getConfigValue('free_trial_limit', 0));
    const subscriptionPrice = Number(await getConfigValue('subscription_price', 25));
    const currency = await getConfigValue('currency', 'GMD');
    res.set('Cache-Control', 'no-store');
    res.json({ data: publicDevice(r.rows[0], { freeTrialLimit, subscriptionPrice, currency }) });
  } catch (e) {
    next(e);
  }
});

devicesRouter.post('/devices/:fingerprint/trial-increment', requireDeviceSecret, async (req, res, next) => {
  try {
    const b = trialSchema.parse(req.body);
    const r = await query('SELECT * FROM devices WHERE id=$1 LIMIT 1', [req.params.fingerprint]);
    if (!r.rowCount) return res.status(404).json({ message: 'Device not registered' });
    const device = r.rows[0];
    if (device.status === 'active') return res.json({ data: { canProceed: true, status: 'active', trialContactsUsed: device.trial_contacts_used } });
    if (device.status === 'blocked') return res.status(403).json({ message: 'Device is blocked' });

    const limit = Number(await getConfigValue('free_trial_limit', 0));
    const updated = await query(`UPDATE devices SET trial_contacts_used=trial_contacts_used+$2, updated_at=NOW()
      WHERE id=$1 AND status='trial' AND trial_contacts_used+$2<=$3 RETURNING *`, [req.params.fingerprint, b.count, limit]);
    if (!updated.rowCount) return res.status(403).json({ message: 'Premium unlock required', data: { canProceed: false, trialContactsUsed: device.trial_contacts_used, freeTrialLimit: limit } });
    res.json({ data: { canProceed: true, status: updated.rows[0].status, trialContactsUsed: updated.rows[0].trial_contacts_used, freeTrialLimit: limit } });
  } catch (e) {
    next(e);
  }
});

devicesRouter.get('/admin/devices', requireAdmin, async (_req, res, next) => {
  try {
    const rows = await query(`SELECT d.*, p.reference AS payment_reference, p.provider AS payment_provider, p.amount AS payment_amount, p.currency AS payment_currency, p.status AS payment_status, p.paid_at
      FROM devices d LEFT JOIN LATERAL (SELECT reference,provider,amount,currency,status,paid_at FROM payments WHERE device_id=d.id ORDER BY created_at DESC LIMIT 1) p ON TRUE
      ORDER BY d.updated_at DESC LIMIT 500`);
    res.json({ data: rows.rows.map((row) => publicDevice(row, {
      deviceName: row.device_name,
      deviceModel: row.device_model,
      platform: row.platform,
      osName: row.os_name,
      osVersion: row.os_version,
      appVersion: row.app_version,
      lastIp: row.last_ip,
      paymentReference: row.payment_reference,
      paymentProvider: row.payment_provider,
      paymentAmount: row.payment_amount,
      paymentCurrency: row.payment_currency,
      paymentStatus: row.payment_status,
      paidAt: row.paid_at
    })) });
  } catch (e) {
    next(e);
  }
});

devicesRouter.post('/admin/devices/:id/block', requireAdmin, async (req, res, next) => {
  try {
    const r = await query("UPDATE devices SET status='blocked',access_source='blocked', updated_at=NOW() WHERE id=$1 RETURNING *", [req.params.id]);
    await audit(req, 'device_blocked', 'device', String(req.params.id), null, r.rows[0]);
    res.json({ data: r.rows[0] ? publicDevice(r.rows[0]) : null });
  } catch (e) {
    next(e);
  }
});

devicesRouter.post('/admin/devices/:id/unblock', requireAdmin, async (req, res, next) => {
  try {
    const r = await query("UPDATE devices SET status='trial',access_source='trial', updated_at=NOW() WHERE id=$1 RETURNING *", [req.params.id]);
    await audit(req, 'device_unblocked', 'device', String(req.params.id), null, r.rows[0]);
    res.json({ data: r.rows[0] ? publicDevice(r.rows[0]) : null });
  } catch (e) {
    next(e);
  }
});

devicesRouter.post('/admin/devices/:id/reset-trial-usage', requireAdmin, async (req, res, next) => {
  try {
    const before = await query('SELECT * FROM devices WHERE id=$1 LIMIT 1', [req.params.id]);
    if (!before.rowCount) return res.status(404).json({ message: 'Device not found' });
    if (before.rows[0].status !== 'trial') return res.status(409).json({ message: 'Trial usage can only be reset for a trial device.' });
    const r = await query('UPDATE devices SET trial_contacts_used=0, updated_at=NOW() WHERE id=$1 RETURNING *', [req.params.id]);
    await audit(req, 'trial_usage_reset', 'device', String(req.params.id), before.rows[0], r.rows[0]);
    res.json({ data: publicDevice(r.rows[0]) });
  } catch (e) {
    next(e);
  }
});

devicesRouter.post('/admin/devices/:id/restore-paid-access', requireAdmin, async (req, res, next) => {
  try {
    const payment = await query("SELECT reference FROM payments WHERE device_id=$1 AND status='success' ORDER BY paid_at DESC NULLS LAST, created_at DESC LIMIT 1", [req.params.id]);
    if (!payment.rowCount) return res.status(409).json({ message: 'Paid access cannot be restored because no successful payment exists for this device.' });
    const before = await query('SELECT * FROM devices WHERE id=$1', [req.params.id]);
    const r = await query("UPDATE devices SET status='active',access_source='paid', subscribed_at=COALESCE(subscribed_at,NOW()), updated_at=NOW() WHERE id=$1 AND status<>'blocked' RETURNING *", [req.params.id]);
    if (!r.rowCount) return res.status(409).json({ message: 'Unblock this device before restoring paid access.' });
    await audit(req, 'paid_access_restored', 'device', String(req.params.id), before.rows[0], { ...r.rows[0], paymentReference: payment.rows[0].reference });
    res.json({ data: publicDevice(r.rows[0], { paymentReference: payment.rows[0].reference }) });
  } catch (e) { next(e); }
});

import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db/pool';
import { env } from '../config/env';
import { requireAdmin } from '../middleware/auth';
import { audit } from '../services/auditService';
import { providerHealth, ProviderId } from '../services/payments';
import { FALLBACK_APP_CONFIG, isDbUnavailable, withApiFallback } from '../utils/fallbacks';

/**
 * A provider may only be switched ON when the backend can prove it is safe to
 * take live money: test mode off, integration flag on, credentials + signing +
 * webhook secret present, currency confirmed and matching, and HTTPS endpoints.
 * Returns a human-readable reason when blocked, or null when allowed.
 */
function providerEnableBlockReason(id: ProviderId, effectiveCurrency: string): string | null {
  if (env.paymentTestMode) return 'Turn PAYMENT_TEST_MODE off before enabling a live wallet.';
  if (!env.paymentProviderIntegrationReady) return 'Set PAYMENT_PROVIDER_INTEGRATION_READY=true on the backend first.';
  const health = providerHealth(id);
  if (!health.configured) return `Backend ${id.toUpperCase()} configuration is incomplete: ${health.missing.join(', ')}.`;
  if (id === 'wave') {
    if (!env.waveCurrency) return 'WAVE_CURRENCY is not set on the backend.';
    if (env.waveCurrency !== String(effectiveCurrency).toUpperCase()) {
      return `WAVE_CURRENCY (${env.waveCurrency}) does not match the app currency (${effectiveCurrency}).`;
    }
  }
  if (env.publicApiBaseUrl && !/^https:\/\//i.test(env.publicApiBaseUrl)) {
    return 'The production API base URL must use HTTPS.';
  }
  return null;
}

export const appConfigRouter = Router();
const configSchema = z.record(z.unknown()).superRefine((value, ctx) => {
  const allowedKeys = new Set(['subscription_price','currency','free_trial_limit','support_email','support_phone','support_whatsapp','privacy_policy_url','terms_url','play_store_url','app_store_url','free_access_mode','free_access_user_limit','maintenance_mode','minimum_app_version','pricing','announcement_message','rules_about_note','default_feature_unlock_settings','wave_payment_enabled','aps_payment_enabled','cleanup_enabled','cleanup_available_from','cleanup_available_until']);
  for (const key of Object.keys(value)) if (!allowedKeys.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'Unknown configuration key' });
  if ('subscription_price' in value) {
    const price = Number(value.subscription_price);
    if (!Number.isFinite(price) || price <= 0 || price > 100000) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['subscription_price'], message: 'Contact Migration Pass price must be between D1 and D100,000' });
  }
  if ('free_access_mode' in value && !['off', 'all', 'first_n'].includes(String(value.free_access_mode))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['free_access_mode'], message: 'Free access mode must be off, all, or first_n' });
  }
  if ('free_access_user_limit' in value) {
    const limit = Number(value.free_access_user_limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000000) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['free_access_user_limit'], message: 'Free-user limit must be between 1 and 1,000,000' });
  }
  if ('free_trial_limit' in value) {
    const limit = Number(value.free_trial_limit);
    if (!Number.isInteger(limit) || limit < 0 || limit > 10000) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['free_trial_limit'], message: 'Free trial limit must be between 0 and 10,000' });
  }
  if ('currency' in value && value.currency !== 'GMD') ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['currency'], message: 'Currency must be GMD' });
  for (const key of ['privacy_policy_url', 'terms_url', 'play_store_url', 'app_store_url'] as const) {
    const raw = String(value[key] || '');
    if (raw && !/^https:\/\//i.test(raw)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'Use a full HTTPS URL' });
  }
  if ('announcement_message' in value && String(value.announcement_message).length > 500) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['announcement_message'], message: 'Announcement must be 500 characters or fewer' });
  if ('rules_about_note' in value && String(value.rules_about_note).length > 500) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rules_about_note'], message: 'Rules & About note must be 500 characters or fewer' });
  for (const key of ['wave_payment_enabled', 'aps_payment_enabled'] as const) {
    if (key in value && typeof value[key] !== 'boolean') ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'Payment provider setting must be true or false' });
  }
  if ('cleanup_enabled' in value && typeof value.cleanup_enabled !== 'boolean') ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cleanup_enabled'], message: 'Cleanup enabled must be true or false' });
  for (const key of ['cleanup_available_from', 'cleanup_available_until'] as const) {
    const raw = String(value[key] || '');
    if (raw && !Number.isFinite(Date.parse(raw))) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'Cleanup schedule must be a valid date and time' });
  }
  if (value.cleanup_available_from && value.cleanup_available_until && Date.parse(String(value.cleanup_available_from)) > Date.parse(String(value.cleanup_available_until))) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cleanup_available_until'], message: 'Cleanup closing time must be after opening time' });
});

async function configObject() {
  const rows = (await query('SELECT config_key, config_value FROM app_config ORDER BY config_key')).rows;
  return Object.fromEntries(rows.map((r) => [r.config_key, r.config_value]));
}
appConfigRouter.get('/app-config', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.json({ data: await configObject() });
  } catch (e) {
    if (isDbUnavailable(e)) {
      return res.json(withApiFallback(FALLBACK_APP_CONFIG, 'PostgreSQL is not reachable. Returned local fallback app config for mobile testing.'));
    }
    next(e);
  }
});
appConfigRouter.put('/admin/app-config', requireAdmin, async (req, res, next) => {
  try {
    const body = configSchema.parse(req.body);

    // Guard live-payment activation with backend configuration health.
    const enabling = (['wave', 'aps'] as ProviderId[]).filter((id) => body[`${id}_payment_enabled`] === true);
    if (enabling.length) {
      const current = await configObject();
      const effectiveCurrency = String(body.currency ?? current.currency ?? 'GMD');
      for (const id of enabling) {
        const reason = providerEnableBlockReason(id, effectiveCurrency);
        if (reason) {
          return res.status(400).json({ message: `Cannot enable ${id.toUpperCase()} payments. ${reason}` });
        }
      }
    }

    await withTransaction(async (client) => {
      for (const [key, value] of Object.entries(body)) {
        await client.query(`INSERT INTO app_config (config_key, config_value) VALUES ($1,$2)
          ON CONFLICT (config_key) DO UPDATE SET config_value=$2, updated_at=NOW()`, [key, JSON.stringify(value)]);
      }
    });
    await audit(req, 'app_config_updated', 'app_config', undefined, undefined, body);
    res.json({ data: await configObject() });
  } catch (e) { next(e); }
});

appConfigRouter.get('/admin/free-access-stats', requireAdmin, async (_req, res, next) => {
  try {
    const config = await configObject();
    const counts = (await query(`SELECT
      COUNT(*) FILTER (WHERE access_source='campaign')::int AS promotional_users,
      COUNT(*) FILTER (WHERE access_source='paid')::int AS paid_users,
      COUNT(*)::int AS total_devices
      FROM devices`)).rows[0];
    const limit = Math.max(1, Number(config.free_access_user_limit || 100));
    const lastChange = (await query(
      `SELECT audit_logs.created_at, admins.full_name, admins.username
       FROM audit_logs LEFT JOIN admins ON admins.id = audit_logs.admin_id
       WHERE audit_logs.action = 'app_config_updated'
       ORDER BY audit_logs.created_at DESC LIMIT 1`
    )).rows[0];
    res.set('Cache-Control', 'no-store');
    res.json({
      data: {
        ...counts,
        remaining_promotional_places: Math.max(0, limit - Number(counts.promotional_users || 0)),
        configLastChangedAt: lastChange?.created_at || null,
        configLastChangedBy: lastChange ? (lastChange.full_name || lastChange.username || 'Unknown admin') : null,
      },
    });
  } catch (e) { next(e); }
});

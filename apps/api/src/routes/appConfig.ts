import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';
import { requireAdmin } from '../middleware/auth';
import { audit } from '../services/auditService';
import { FALLBACK_APP_CONFIG, isDbUnavailable, withApiFallback } from '../utils/fallbacks';

export const appConfigRouter = Router();
const configSchema = z.record(z.unknown()).superRefine((value, ctx) => {
  if ('subscription_price' in value) {
    const price = Number(value.subscription_price);
    if (!Number.isFinite(price) || price <= 0 || price > 100000) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['subscription_price'], message: 'Contact Migration Pass price must be between D1 and D100,000' });
  }
});

async function configObject() {
  const rows = (await query('SELECT config_key, config_value FROM app_config ORDER BY config_key')).rows;
  return Object.fromEntries(rows.map((r) => [r.config_key, r.config_value]));
}
appConfigRouter.get('/app-config', async (_req, res, next) => {
  try { res.json({ data: await configObject() }); } catch (e) {
    if (isDbUnavailable(e)) {
      return res.json(withApiFallback(FALLBACK_APP_CONFIG, 'PostgreSQL is not reachable. Returned local fallback app config for mobile testing.'));
    }
    next(e);
  }
});
appConfigRouter.put('/admin/app-config', requireAdmin, async (req, res, next) => {
  try {
    const body = configSchema.parse(req.body);
    for (const [key, value] of Object.entries(body)) {
      await query(`INSERT INTO app_config (config_key, config_value) VALUES ($1,$2)
        ON CONFLICT (config_key) DO UPDATE SET config_value=$2, updated_at=NOW()`, [key, JSON.stringify(value)]);
    }
    await audit(req, 'app_config_updated', 'app_config', undefined, undefined, body);
    res.json({ data: await configObject() });
  } catch (e) { next(e); }
});

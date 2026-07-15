import { Router } from 'express';
import { query } from '../db/pool';
import { isDbUnavailable } from '../utils/fallbacks';
export const healthRouter = Router();
healthRouter.get('/health', async (_req, res, next) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true, service: 'gambia-number-migrator-api', database: 'connected', timestamp: new Date().toISOString() });
  } catch (e) {
    if (isDbUnavailable(e)) {
      return res.status(200).json({ ok: true, service: 'gambia-number-migrator-api', database: 'disconnected', warning: 'API is running but PostgreSQL is not reachable on port 5434. Start Docker/PostgreSQL or run RUN_THIS_FIRST.bat.', timestamp: new Date().toISOString() });
    }
    next(e);
  }
});

import { Router } from 'express';
import { query } from '../db/pool';
import { requireAdmin } from '../middleware/auth';
import { mapTransition } from '../utils/mapRows';
export const dashboardRouter = Router();
dashboardRouter.get('/admin/dashboard', requireAdmin, async (_req, res, next) => {
  try {
    const [rules, activeRules, operators, paymentsToday, latestVersion, transition, logs] = await Promise.all([
      query('SELECT COUNT(*)::int count FROM migration_rules'),
      query("SELECT COUNT(*)::int count FROM migration_rules WHERE status='active'"),
      query("SELECT COUNT(*)::int count FROM operators WHERE status='active'"),
      query("SELECT COUNT(*)::int count FROM payments WHERE created_at::date = CURRENT_DATE"),
      query('SELECT * FROM rules_versions ORDER BY version_number DESC LIMIT 1'),
      query('SELECT * FROM transition_settings ORDER BY updated_at DESC LIMIT 1'),
      query('SELECT action, entity_type, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 10')
    ]);
    res.json({ data: { totalRules: rules.rows[0].count, activeRules: activeRules.rows[0].count, operators: operators.rows[0].count, paymentsToday: paymentsToday.rows[0].count, appVersion: '2.8.0', lastRulesPublishDate: latestVersion.rows[0]?.published_at || null, currentTransitionSettings: transition.rows[0] ? mapTransition(transition.rows[0]) : null, recentActivity: logs.rows } });
  } catch (e) { next(e); }
});

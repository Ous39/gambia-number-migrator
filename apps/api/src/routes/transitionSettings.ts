import { Router } from 'express';
import { transitionSettingsSchema } from '@gnm/shared';
import { query } from '../db/pool';
import { requireAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { audit } from '../services/auditService';
import { mapTransition } from '../utils/mapRows';
import { DEFAULT_TRANSITION_SETTINGS, isDbUnavailable, withApiFallback } from '../utils/fallbacks';

export const transitionSettingsRouter = Router();
async function getSettingsRow() {
  return (await query('SELECT * FROM transition_settings ORDER BY updated_at DESC LIMIT 1')).rows[0];
}
transitionSettingsRouter.get('/transition-settings', async (_req, res, next) => {
  try {
    const row = await getSettingsRow();
    res.json({ data: row ? mapTransition(row) : DEFAULT_TRANSITION_SETTINGS });
  } catch (e) {
    if (isDbUnavailable(e)) {
      return res.json(withApiFallback(DEFAULT_TRANSITION_SETTINGS, 'PostgreSQL is not reachable. Returned local fallback transition settings for mobile testing.'));
    }
    next(e);
  }
});
transitionSettingsRouter.get('/admin/transition-settings', requireAdmin, async (_req, res, next) => {
  try { const row = await getSettingsRow(); res.json({ data: row ? mapTransition(row) : DEFAULT_TRANSITION_SETTINGS }); } catch (e) { next(e); }
});
transitionSettingsRouter.put('/admin/transition-settings', requireAdmin, validateBody(transitionSettingsSchema), async (req, res, next) => {
  try {
    const old = await getSettingsRow();
    const b = req.body;
    const r = old ? await query(`UPDATE transition_settings SET transition_start_date=$1, transition_end_date=$2, default_update_mode=$3, allow_replace_mode=$4, show_transition_notice=$5, show_cleanup_recommendation=$6, transition_banner_message=$7, after_transition_message=$8, cleanup_recommendation_message=$9, updated_by=$10, updated_at=NOW()
      WHERE id=$11 RETURNING *`, [b.transitionStartDate, b.transitionEndDate, b.defaultUpdateMode, b.allowReplaceMode, b.showTransitionNotice, b.showCleanupRecommendation, b.transitionBannerMessage, b.afterTransitionMessage, b.cleanupRecommendationMessage, req.admin?.adminId, old.id]) : await query(`INSERT INTO transition_settings (transition_start_date,transition_end_date,default_update_mode,allow_replace_mode,show_transition_notice,show_cleanup_recommendation,transition_banner_message,after_transition_message,cleanup_recommendation_message,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [b.transitionStartDate,b.transitionEndDate,b.defaultUpdateMode,b.allowReplaceMode,b.showTransitionNotice,b.showCleanupRecommendation,b.transitionBannerMessage,b.afterTransitionMessage,b.cleanupRecommendationMessage,req.admin?.adminId]);
    await audit(req, 'transition_settings_updated', 'transition_settings', old?.id || r.rows[0].id, old, r.rows[0]);
    res.json({ data: mapTransition(r.rows[0]) });
  } catch (e) { next(e); }
});

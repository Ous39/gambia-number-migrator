import { Router } from 'express';
import { detectOperator, findAmbiguousRuleConflict, getMigrationRulesApprovalIssues, migrationRuleSchema } from '@gnm/shared';
import { z } from 'zod';
import { query } from '../db/pool';
import { requireAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { audit } from '../services/auditService';
import { buildRulesPayload, latestPublishedRules } from '../services/rulePayload';
import { mapRule } from '../utils/mapRows';
import { DEFAULT_RULES_PAYLOAD, isDbUnavailable, withApiFallback } from '../utils/fallbacks';

export const migrationRulesRouter = Router();

async function allRules() {
  return (await query(`SELECT mr.*, o.name operator_name, o.code operator_code FROM migration_rules mr JOIN operators o ON o.id=mr.operator_id ORDER BY mr.priority DESC, mr.created_at DESC`)).rows.map(mapRule);
}

async function assertOperatorPrefix(operatorId: string, newPrefix: string) {
  const operator = await query('SELECT new_prefix,status FROM operators WHERE id=$1', [operatorId]);
  if (!operator.rowCount) throw Object.assign(new Error('Operator not found'), { status: 400 });
  if (operator.rows[0].new_prefix !== newPrefix) throw Object.assign(new Error(`Rule prefix must match the operator prefix ${operator.rows[0].new_prefix}`), { status: 400 });
}

migrationRulesRouter.get('/migration-rules', async (_req, res, next) => {
  try {
    res.json({ data: await latestPublishedRules() });
  } catch (e) {
    if (isDbUnavailable(e)) {
      return res.json(withApiFallback(DEFAULT_RULES_PAYLOAD, 'PostgreSQL is not reachable. No unverified migration rules were returned.'));
    }
    next(e);
  }
});

migrationRulesRouter.get('/admin/migration-rules', requireAdmin, async (_req, res, next) => {
  try { res.json({ data: await allRules() }); } catch (e) { next(e); }
});

migrationRulesRouter.get('/admin/migration-rules/status', requireAdmin, async (_req, res, next) => {
  try {
    const counts = await query(`SELECT COUNT(*)::int total,
      COUNT(*) FILTER (WHERE status='active')::int active,
      COUNT(*) FILTER (WHERE status='inactive')::int inactive FROM migration_rules`);
    const published = await query(`SELECT version_number, published_at,
      COALESCE(jsonb_array_length(rules_json->'rules'),0)::int rule_count
      FROM rules_versions WHERE status='published' ORDER BY version_number DESC LIMIT 1`);
    const draft = await buildRulesPayload();
    const approvalIssues = getMigrationRulesApprovalIssues(draft);
    res.json({ data: { totalRules: counts.rows[0].total, activeRules: counts.rows[0].active, inactiveRules: counts.rows[0].inactive,
      publishedVersion: published.rows[0]?.version_number || null, publishedAt: published.rows[0]?.published_at || null, publishedRuleCount: published.rows[0]?.rule_count || 0,
      approvalIssues, readyToPublish: approvalIssues.length === 0 } });
  } catch (e) { next(e); }
});

migrationRulesRouter.post('/admin/migration-rules/disable-non-production', requireAdmin, async (req, res, next) => {
  try {
    const oldRows = (await query(`SELECT id, rule_name, notes, status FROM migration_rules
      WHERE status='active' AND (rule_name ~* '\\m(sample|demo|fallback)\\M' OR COALESCE(notes,'') ~* '\\m(sample|demo|fallback)\\M')`)).rows;
    const updated = await query(`UPDATE migration_rules SET status='inactive', updated_at=NOW()
      WHERE status='active' AND (rule_name ~* '\\m(sample|demo|fallback)\\M' OR COALESCE(notes,'') ~* '\\m(sample|demo|fallback)\\M') RETURNING id,rule_name`);
    await audit(req, 'non_production_rules_disabled', 'migration_rule', undefined, oldRows, updated.rows);
    res.json({ data: { disabledCount: updated.rowCount || 0, rules: updated.rows } });
  } catch (e) { next(e); }
});

migrationRulesRouter.post('/admin/migration-rules', requireAdmin, validateBody(migrationRuleSchema), async (req, res, next) => {
  try {
    const b = req.body;
    await assertOperatorPrefix(b.operatorId, b.newPrefix);
    const r = await query(`INSERT INTO migration_rules (operator_id, rule_name, rule_type, prefix_value, range_from, range_to, exact_number, new_prefix, priority, status, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [b.operatorId, b.ruleName, b.ruleType, b.prefixValue, b.rangeFrom, b.rangeTo, b.exactNumber, b.newPrefix, b.priority, b.status, b.notes]);
    await audit(req, 'rule_created', 'migration_rule', r.rows[0].id, null, r.rows[0]);
    res.status(201).json({ data: r.rows[0] });
  } catch (e) { next(e); }
});

migrationRulesRouter.put('/admin/migration-rules/:id', requireAdmin, validateBody(migrationRuleSchema), async (req, res, next) => {
  try {
    const old = (await query('SELECT * FROM migration_rules WHERE id=$1', [req.params.id])).rows[0];
    if (!old) return res.status(404).json({ message: 'Migration rule not found' });
    const b = req.body;
    await assertOperatorPrefix(b.operatorId, b.newPrefix);
    const r = await query(`UPDATE migration_rules SET operator_id=$1, rule_name=$2, rule_type=$3, prefix_value=$4, range_from=$5, range_to=$6, exact_number=$7, new_prefix=$8, priority=$9, status=$10, notes=$11, updated_at=NOW()
      WHERE id=$12 RETURNING *`, [b.operatorId, b.ruleName, b.ruleType, b.prefixValue, b.rangeFrom, b.rangeTo, b.exactNumber, b.newPrefix, b.priority, b.status, b.notes, req.params.id]);
    await audit(req, 'rule_updated', 'migration_rule', String(req.params.id), old, r.rows[0]);
    res.json({ data: r.rows[0] });
  } catch (e) { next(e); }
});

migrationRulesRouter.delete('/admin/migration-rules/:id', requireAdmin, async (req, res, next) => {
  try {
    const r = await query(`UPDATE migration_rules SET status='inactive', updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ message: 'Migration rule not found' });
    await audit(req, 'rule_disabled', 'migration_rule', String(req.params.id), null, r.rows[0]);
    res.json({ data: r.rows[0] });
  } catch (e) { next(e); }
});

migrationRulesRouter.post('/admin/migration-rules/test', requireAdmin, async (req, res, next) => {
  try {
    const { oldNumber } = z.object({ oldNumber: z.string().min(3) }).parse(req.body);
    const payload = await buildRulesPayload();
    res.json({ data: detectOperator(oldNumber, payload) });
  } catch (e) { next(e); }
});

migrationRulesRouter.post('/admin/migration-rules/publish', requireAdmin, async (req, res, next) => {
  try {
    const payload = await buildRulesPayload();
    const approvalIssues = getMigrationRulesApprovalIssues(payload);
    if (approvalIssues.length) return res.status(400).json({ message: approvalIssues[0], errors: approvalIssues });
    const conflict = findAmbiguousRuleConflict(payload.rules);
    if (conflict) return res.status(400).json({ message: `Conflicting rules overlap at equal priority: ${conflict.first.ruleName} and ${conflict.second.ruleName}. Adjust their priority or ranges.` });
    const r = await query('INSERT INTO rules_versions (version_number, rules_json, published_by, status) VALUES ($1,$2,$3,$4) RETURNING *', [payload.versionNumber, JSON.stringify(payload), req.admin?.adminId, 'published']);
    await audit(req, 'rule_published', 'rules_version', r.rows[0].id, null, payload);
    res.json({ data: payload });
  } catch (e) { next(e); }
});

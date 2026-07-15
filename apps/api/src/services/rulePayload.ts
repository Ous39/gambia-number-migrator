import type { PublishedRulesPayload } from '@gnm/shared';
import { query } from '../db/pool';
import { mapOperator, mapRule } from '../utils/mapRows';

export async function buildRulesPayload(): Promise<PublishedRulesPayload> {
  const operators = (await query('SELECT * FROM operators ORDER BY name')).rows.map(mapOperator);
  const rules = (await query(`SELECT mr.*, o.name as operator_name, o.code as operator_code
    FROM migration_rules mr JOIN operators o ON o.id = mr.operator_id
    WHERE mr.status = 'active' AND o.status = 'active'
    ORDER BY mr.priority DESC, mr.created_at ASC`)).rows.map(mapRule);
  const latest = await query('SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM rules_versions');
  return { versionNumber: Number(latest.rows[0].next_version), publishedAt: new Date().toISOString(), operators, rules };
}

export async function latestPublishedRules(): Promise<PublishedRulesPayload> {
  const latest = await query('SELECT * FROM rules_versions WHERE status = $1 ORDER BY version_number DESC LIMIT 1', ['published']);
  if (latest.rowCount) return latest.rows[0].rules_json as PublishedRulesPayload;
  return buildRulesPayload();
}

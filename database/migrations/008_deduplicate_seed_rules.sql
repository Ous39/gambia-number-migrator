DELETE FROM migration_rules newer
USING migration_rules older
WHERE newer.operator_id = older.operator_id
  AND newer.rule_name = older.rule_name
  AND (newer.created_at > older.created_at OR (newer.created_at = older.created_at AND newer.id::text > older.id::text));

CREATE UNIQUE INDEX IF NOT EXISTS ux_migration_rule_operator_name
ON migration_rules(operator_id, rule_name);

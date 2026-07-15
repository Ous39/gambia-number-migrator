UPDATE migration_rules
SET status = 'inactive', updated_at = NOW()
WHERE rule_name LIKE 'Sample %' AND notes LIKE 'Demo only.%';

UPDATE rules_versions
SET status = 'retired'
WHERE status = 'published' AND rules_json::text LIKE '%Sample %';

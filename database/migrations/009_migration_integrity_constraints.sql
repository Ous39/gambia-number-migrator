UPDATE operators SET status='disabled' WHERE new_prefix !~ '^[0-9]{2}$';
UPDATE migration_rules SET status='inactive', updated_at=NOW() WHERE new_prefix !~ '^[0-9]{2}$';

ALTER TABLE operators DROP CONSTRAINT IF EXISTS ck_operators_new_prefix;
ALTER TABLE operators ADD CONSTRAINT ck_operators_new_prefix CHECK (new_prefix ~ '^[0-9]{2}$');

ALTER TABLE migration_rules DROP CONSTRAINT IF EXISTS ck_rules_new_prefix;
ALTER TABLE migration_rules ADD CONSTRAINT ck_rules_new_prefix CHECK (new_prefix ~ '^[0-9]{2}$');

ALTER TABLE migration_rules DROP CONSTRAINT IF EXISTS ck_rules_prefix_value;
ALTER TABLE migration_rules ADD CONSTRAINT ck_rules_prefix_value CHECK (prefix_value IS NULL OR prefix_value ~ '^[0-9]{1,7}$');

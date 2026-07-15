CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  new_prefix TEXT NOT NULL,
  color TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS migration_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES operators(id),
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('prefix','range','exact','exception')),
  prefix_value TEXT,
  range_from TEXT,
  range_to TEXT,
  exact_number TEXT,
  new_prefix TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_active_exact_rule ON migration_rules(exact_number) WHERE exact_number IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_rules_operator ON migration_rules(operator_id);
CREATE INDEX IF NOT EXISTS idx_rules_type_status ON migration_rules(rule_type, status);

CREATE TABLE IF NOT EXISTS rules_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number INTEGER NOT NULL UNIQUE,
  rules_json JSONB NOT NULL,
  published_by UUID REFERENCES admins(id),
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'published'
);

CREATE TABLE IF NOT EXISTS transition_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transition_start_date DATE NOT NULL,
  transition_end_date DATE NOT NULL,
  default_update_mode TEXT NOT NULL CHECK (default_update_mode IN ('duplicate','replace')),
  allow_replace_mode BOOLEAN NOT NULL DEFAULT TRUE,
  show_transition_notice BOOLEAN NOT NULL DEFAULT TRUE,
  show_cleanup_recommendation BOOLEAN NOT NULL DEFAULT TRUE,
  transition_banner_message TEXT NOT NULL,
  after_transition_message TEXT NOT NULL,
  cleanup_recommendation_message TEXT NOT NULL,
  updated_by UUID REFERENCES admins(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  reference TEXT UNIQUE NOT NULL,
  external_reference TEXT,
  device_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GMD',
  status TEXT NOT NULL DEFAULT 'pending',
  checkout_url TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_value_json JSONB,
  new_value_json JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

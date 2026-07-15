CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  device_name TEXT,
  device_model TEXT,
  os_name TEXT,
  os_version TEXT,
  platform TEXT,
  last_ip TEXT,
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','pending_payment','active','blocked')),
  trial_contacts_used INTEGER NOT NULL DEFAULT 0,
  subscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_updated_at ON devices(updated_at);

INSERT INTO app_config (config_key, config_value)
VALUES
  ('free_trial_limit', '0'),
  ('subscription_price', '100'),
  ('currency', '"GMD"')
ON CONFLICT (config_key) DO NOTHING;

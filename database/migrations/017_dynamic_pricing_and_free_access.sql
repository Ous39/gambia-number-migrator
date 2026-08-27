-- v2.8.6: live pricing and controlled promotional access.
ALTER TABLE devices ADD COLUMN IF NOT EXISTS access_source TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS promotional_access_granted_at TIMESTAMPTZ;

UPDATE devices
SET access_source = CASE
  WHEN status = 'active' THEN 'paid'
  WHEN status = 'blocked' THEN 'blocked'
  ELSE 'trial'
END
WHERE access_source = 'trial';

ALTER TABLE devices DROP CONSTRAINT IF EXISTS ck_devices_access_source;
ALTER TABLE devices ADD CONSTRAINT ck_devices_access_source
  CHECK (access_source IN ('trial','paid','campaign','admin','blocked'));

CREATE INDEX IF NOT EXISTS idx_devices_access_source ON devices(access_source);

INSERT INTO app_config(config_key, config_value) VALUES
  ('free_access_mode', '"off"'::jsonb),
  ('free_access_user_limit', '100'::jsonb)
ON CONFLICT(config_key) DO NOTHING;

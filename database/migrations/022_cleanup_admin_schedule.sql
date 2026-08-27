INSERT INTO app_config(config_key, config_value) VALUES
  ('cleanup_enabled', 'false'::jsonb),
  ('cleanup_available_from', '""'::jsonb),
  ('cleanup_available_until', '""'::jsonb)
ON CONFLICT(config_key) DO NOTHING;

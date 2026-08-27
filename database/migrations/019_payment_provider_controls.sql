-- Payment providers are opt-in. A wallet must be contractually and
-- technically approved in Admin before the mobile app can display or use it.
INSERT INTO app_config(config_key, config_value) VALUES
  ('wave_payment_enabled', 'false'::jsonb),
  ('aps_payment_enabled', 'false'::jsonb)
ON CONFLICT(config_key) DO NOTHING;

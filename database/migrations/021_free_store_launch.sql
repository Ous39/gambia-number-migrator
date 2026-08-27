INSERT INTO app_config (config_key, config_value)
VALUES
  ('subscription_price', '25'::jsonb),
  ('free_access_mode', '"all"'::jsonb),
  ('wave_payment_enabled', 'false'::jsonb),
  ('aps_payment_enabled', 'false'::jsonb),
  ('announcement_message', '"GNM is free during the launch campaign. No payment is required."'::jsonb)
ON CONFLICT (config_key) DO UPDATE
SET config_value = EXCLUDED.config_value,
    updated_at = NOW();

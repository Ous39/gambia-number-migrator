UPDATE app_config
SET config_value = '100'::jsonb, updated_at = NOW()
WHERE config_key = 'subscription_price' AND config_value = '50'::jsonb;

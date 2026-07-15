UPDATE app_config
SET config_value = CASE
      WHEN jsonb_typeof(config_value) = 'object' THEN jsonb_set(config_value, '{bulk_unlock}', '100'::jsonb)
      ELSE '{"bulk_unlock":100,"currency":"GMD"}'::jsonb
    END,
    updated_at = NOW()
WHERE config_key = 'pricing'
  AND COALESCE(config_value->>'bulk_unlock', '') <> '100';

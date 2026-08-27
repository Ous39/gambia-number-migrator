-- v2.12.0: make every price config agree on D25 GMD.
-- Migration 021 already set subscription_price = 25, but the `pricing` JSON blob
-- was pinned to bulk_unlock = 100 by migration 006 and never updated. Nothing in
-- the app currently reads `pricing` for charging (the payment path uses
-- `subscription_price`), so this is a consistency/clarity fix, not a behaviour
-- change. Forward-only and idempotent.

UPDATE app_config
SET config_value = jsonb_build_object(
      'bulk_unlock', (SELECT (config_value #>> '{}')::int FROM app_config WHERE config_key = 'subscription_price'),
      'currency', COALESCE((SELECT config_value #>> '{}' FROM app_config WHERE config_key = 'currency'), 'GMD')
    ),
    updated_at = NOW()
WHERE config_key = 'pricing'
  AND COALESCE(config_value ->> 'bulk_unlock', '') <> (
    SELECT config_value #>> '{}' FROM app_config WHERE config_key = 'subscription_price'
  );

-- Ensure the row exists at all (older installs seeded only via 002/seed).
INSERT INTO app_config (config_key, config_value)
VALUES ('pricing', '{"bulk_unlock":25,"currency":"GMD"}'::jsonb)
ON CONFLICT (config_key) DO NOTHING;

-- Align the historical default in case an install never ran 021 for any reason.
UPDATE app_config
SET config_value = '25'::jsonb, updated_at = NOW()
WHERE config_key = 'subscription_price' AND config_value = '100'::jsonb;

-- v2.13.0: organisation access codes.
-- A paid or admin-issued code unlocks full access on up to `seats` devices.
-- Redeeming a code is not a purchase, so it is allowed in the App Store /
-- Google Play build; the "buy seats" flow lives only in the direct/web channel
-- and rides the existing Wave/APS enable gate.
-- Forward-only and idempotent. No column is dropped and no row is deleted.

CREATE TABLE IF NOT EXISTS access_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,
  seats           INTEGER NOT NULL CHECK (seats >= 1 AND seats <= 100000),
  redeemed_count  INTEGER NOT NULL DEFAULT 0 CHECK (redeemed_count >= 0),
  source          TEXT NOT NULL CHECK (source IN ('admin','purchase')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  label           TEXT,
  payment_id      UUID REFERENCES payments(id),
  created_by      TEXT,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_access_codes_status ON access_codes(status);
CREATE INDEX IF NOT EXISTS idx_access_codes_payment ON access_codes(payment_id) WHERE payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS access_code_redemptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id       UUID NOT NULL REFERENCES access_codes(id),
  device_id     TEXT NOT NULL,
  redeemed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (code_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_access_code_redemptions_device ON access_code_redemptions(device_id);

-- Devices unlocked by an organisation code are tracked distinctly from
-- 'paid' (individual pass) and 'admin' (manual grant).
ALTER TABLE devices DROP CONSTRAINT IF EXISTS ck_devices_access_source;
ALTER TABLE devices ADD CONSTRAINT ck_devices_access_source
  CHECK (access_source IN ('trial','paid','campaign','admin','blocked','code'));

-- Default organisation seat pricing. Unit amounts are in GMD and the server is
-- the sole authority on the total; the client only picks a seat count.
INSERT INTO app_config(config_key, config_value) VALUES
  ('org_pricing',
   '{"tiers":{"5":100,"10":190,"15":270},"custom_unit":20,"custom_min_seats":2,"custom_max_seats":500}'::jsonb)
ON CONFLICT(config_key) DO NOTHING;

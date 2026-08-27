-- v2.12.0: real Wave Checkout integration.
-- Forward-only and idempotent. Adds columns the generic payments table cannot
-- represent (Wave keeps checkout_status and payment_status as separate
-- lifecycles). No column is dropped and no row is deleted, so this is safe to
-- run against the existing production database.

ALTER TABLE payments ADD COLUMN IF NOT EXISTS internal_reference TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS client_reference TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS wave_checkout_session_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS wave_transaction_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS checkout_status TEXT;          -- Wave: open | complete | expired
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_status TEXT;           -- Wave: processing | cancelled | succeeded
ALTER TABLE payments ADD COLUMN IF NOT EXISTS last_provider_error_code TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS last_provider_error_message TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS webhook_event_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;
-- checkout_url, paid_at, created_at, updated_at, idempotency_key already exist.

CREATE UNIQUE INDEX IF NOT EXISTS ux_payments_wave_session
  ON payments(wave_checkout_session_id)
  WHERE wave_checkout_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_client_reference ON payments(client_reference);

-- Widen the status CHECK to the values the Wave/reconciliation state machine
-- uses. Existing rows already satisfy this set.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS ck_payments_status;
ALTER TABLE payments ADD CONSTRAINT ck_payments_status CHECK (
  status IN ('not_started','creating','pending','awaiting_provider_action',
             'awaiting_otp','success','failed','cancelled','expired','under_review')
);

-- Record the event type alongside the existing dedup key.
ALTER TABLE payment_webhook_events ADD COLUMN IF NOT EXISTS event_type TEXT;

-- Backfill correlation columns for historical rows.
UPDATE payments SET internal_reference = reference WHERE internal_reference IS NULL;
UPDATE payments SET client_reference   = reference WHERE client_reference   IS NULL;

-- Idempotency-key uniqueness already exists (migration 014). Nothing to change.

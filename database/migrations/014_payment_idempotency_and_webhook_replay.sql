-- v2.8.0: payment retries and provider callbacks are safe to repeat.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_payments_device_idempotency
  ON payments(device_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('wave', 'aps')),
  event_id TEXT NOT NULL,
  payment_reference TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_received
  ON payment_webhook_events(received_at DESC);

ALTER TABLE payments DROP CONSTRAINT IF EXISTS ck_payments_status;
ALTER TABLE payments ADD CONSTRAINT ck_payments_status CHECK (
  status IN ('not_started','creating','pending','awaiting_provider_action',
             'awaiting_otp','success','failed','cancelled','expired','under_review')
);

-- v2.8.5: real audience targeting, notification controls, and Expo receipt tracking.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS receipt_ok_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_failed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_checked_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE notifications ADD CONSTRAINT notifications_audience_check
    CHECK (audience IN ('all', 'trial', 'subscribed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS notification_push_tickets (
  ticket_id TEXT PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  push_token_id UUID NOT NULL REFERENCES device_push_tokens(id) ON DELETE CASCADE,
  receipt_status TEXT NOT NULL DEFAULT 'pending',
  receipt_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notification_push_tickets_pending
  ON notification_push_tickets(notification_id, receipt_status);


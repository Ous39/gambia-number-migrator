CREATE TABLE IF NOT EXISTS device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL UNIQUE, platform TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT NOT NULL, message TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT 'all', data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft', sent_count INTEGER NOT NULL DEFAULT 0, failed_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES admins(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_device ON device_push_tokens(device_id, active);
CREATE INDEX IF NOT EXISTS idx_notifications_sent ON notifications(status, sent_at DESC);

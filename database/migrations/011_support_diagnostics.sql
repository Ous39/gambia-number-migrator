ALTER TABLE devices ADD COLUMN IF NOT EXISTS app_version VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_devices_updated_at ON devices(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_device_created ON payments(device_id, created_at DESC);

INSERT INTO devices (id, status, access_source)
SELECT DISTINCT p.device_id, 'trial', 'trial'
FROM payments p
LEFT JOIN devices d ON d.id = p.device_id
WHERE d.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Idempotent: ADD CONSTRAINT has no IF NOT EXISTS form in PostgreSQL, so check
-- the constraint catalogue first. This lets 020 rerun safely whether the FK
-- was already added by a prior run of this same migration, or was applied
-- manually/out-of-band before schema_migrations recorded it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_payments_device'
      AND conrelid = 'payments'::regclass
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT fk_payments_device
      FOREIGN KEY (device_id) REFERENCES devices(id);
  END IF;
END $$;

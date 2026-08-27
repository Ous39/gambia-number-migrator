-- v2.12.0: public "Updates" feed for the website (stable slugs + summary + publish date).
-- Forward-only and idempotent. No drops.

ALTER TABLE website_announcements ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE website_announcements ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE website_announcements ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Backfill a stable slug for existing rows: slugified title + short id suffix.
UPDATE website_announcements
SET slug = LEFT(
    regexp_replace(lower(coalesce(title, 'update')), '[^a-z0-9]+', '-', 'g'),
    80
  ) || '-' || LEFT(id::text, 8)
WHERE slug IS NULL;

-- Existing published rows get a publish date from their creation time.
UPDATE website_announcements
SET published_at = created_at
WHERE published_at IS NULL AND status = 'published';

CREATE UNIQUE INDEX IF NOT EXISTS ux_website_announcements_slug
  ON website_announcements(slug)
  WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_website_announcements_published
  ON website_announcements(published_at DESC)
  WHERE status = 'published';

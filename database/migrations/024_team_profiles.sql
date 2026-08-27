ALTER TABLE website_team_members
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS long_bio TEXT,
  ADD COLUMN IF NOT EXISTS portfolio_url TEXT;

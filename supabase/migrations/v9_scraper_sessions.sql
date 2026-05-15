-- v9_scraper_sessions.sql
-- Creates the scraper_sessions table used by the scraper page to log scan history.
-- Without this table the scraper page throws a PostgREST 42P01 (relation does not exist)
-- on every scan, causing a silent 500 error in the scan flow.

CREATE TABLE IF NOT EXISTS scraper_sessions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             text        NOT NULL,
  target_url          text        NOT NULL,
  domain              text,
  page_title          text,
  page_description    text,
  total_assets        integer     DEFAULT 0,
  ai_asset_count      integer     DEFAULT 0,
  overall_ai_score    numeric(5,2),
  scraped_content     jsonb,
  status              text        DEFAULT 'complete'
                                  CHECK (status IN ('pending','complete','error')),
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE scraper_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own scraper sessions"
  ON scraper_sessions FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own scraper sessions"
  ON scraper_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE INDEX IF NOT EXISTS scraper_sessions_user_idx
  ON scraper_sessions(user_id, created_at DESC);

-- ══════════════════════════════════════════════════════════════════════════════
-- Aiscern — Row Level Security (RLS) Hardening Migration
-- Run in Supabase SQL Editor after all schema migrations
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Enable RLS on all user-facing tables ─────────────────────────────────────

ALTER TABLE IF EXISTS profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scan_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_feedback    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS api_keys         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scraper_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS forensic_scans   ENABLE ROW LEVEL SECURITY;

-- ── Drop existing policies (idempotent re-run) ────────────────────────────────

DROP POLICY IF EXISTS "profiles_own"           ON profiles;
DROP POLICY IF EXISTS "profiles_service"       ON profiles;
DROP POLICY IF EXISTS "scans_own"              ON scans;
DROP POLICY IF EXISTS "scans_service"          ON scans;
DROP POLICY IF EXISTS "scan_history_own"       ON scan_history;
DROP POLICY IF EXISTS "user_settings_own"      ON user_settings;
DROP POLICY IF EXISTS "user_feedback_own"      ON user_feedback;
DROP POLICY IF EXISTS "api_keys_own"           ON api_keys;
DROP POLICY IF EXISTS "scraper_sessions_own"   ON scraper_sessions;
DROP POLICY IF EXISTS "forensic_scans_own"     ON forensic_scans;

-- ── Profiles ──────────────────────────────────────────────────────────────────
-- Users can read/update their own profile only.
-- Service role can do anything (for admin functions).

CREATE POLICY "profiles_own" ON profiles
  FOR ALL
  USING     (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_service" ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Scans ────────────────────────────────────────────────────────────────────

CREATE POLICY "scans_own" ON scans
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "scans_service" ON scans
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Scan History ─────────────────────────────────────────────────────────────

CREATE POLICY "scan_history_own" ON scan_history
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── User Settings ────────────────────────────────────────────────────────────

CREATE POLICY "user_settings_own" ON user_settings
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── User Feedback ────────────────────────────────────────────────────────────

CREATE POLICY "user_feedback_own" ON user_feedback
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── API Keys ─────────────────────────────────────────────────────────────────

CREATE POLICY "api_keys_own" ON api_keys
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Scraper Sessions ─────────────────────────────────────────────────────────

CREATE POLICY "scraper_sessions_own" ON scraper_sessions
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Forensic Scans ───────────────────────────────────────────────────────────

CREATE POLICY "forensic_scans_own" ON forensic_scans
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Verify RLS is enabled ─────────────────────────────────────────────────────
-- Run this to confirm: should return true for all tables
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles','scans','scan_history','user_settings',
    'user_feedback','api_keys','scraper_sessions','forensic_scans'
  )
ORDER BY tablename;

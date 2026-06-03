-- ══════════════════════════════════════════════════════════════════════════════
-- Aiscern — Fix Admin Login: Create Missing Tables
-- Run in Supabase SQL Editor → Dashboard > SQL Editor > New Query
--
-- ROOT CAUSE: auth.ts requires admin_sessions and admin_audit_log tables,
-- but neither exists in any previous migration. Login always fails at
-- verifyAdminSession() because it queries admin_sessions and gets null.
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. admin_sessions ────────────────────────────────────────────────────────
-- Required by createAdminSession() and verifyAdminSession() in lib/auth.ts.
-- Without this table, every login silently inserts nothing, and every
-- subsequent session check returns false (line 117: if (!row) return false).

CREATE TABLE IF NOT EXISTS admin_sessions (
  id            BIGSERIAL    PRIMARY KEY,
  session_token TEXT         NOT NULL UNIQUE,
  ip_address    TEXT,
  user_agent    TEXT,
  expires_at    TIMESTAMPTZ  NOT NULL,
  revoked_at    TIMESTAMPTZ  DEFAULT NULL,   -- populated by revokeAdminSession()
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token      ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_revoked    ON admin_sessions(revoked_at)
  WHERE revoked_at IS NOT NULL;

-- RLS: service role only (same pattern as other admin tables in hardening.sql)
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only - admin_sessions" ON admin_sessions;
CREATE POLICY "Service role only - admin_sessions" ON admin_sessions
  USING (auth.role() = 'service_role');


-- ── 2. admin_audit_log ───────────────────────────────────────────────────────
-- Referenced by:
--   • lib/auth.ts            → login_success events
--   • lib/admin-middleware.ts → action audit trail
--   • app/api/audit-log/route.ts → queried first, falls back to admin_activity_logs
--
-- Note: hardening.sql created admin_activity_logs (different name/schema).
-- The code uses admin_audit_log (singular "log") everywhere.

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id         BIGSERIAL   PRIMARY KEY,
  action     TEXT        NOT NULL,
  admin_ip   TEXT,
  metadata   JSONB       DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action     ON admin_audit_log(action);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only - admin_audit_log" ON admin_audit_log;
CREATE POLICY "Service role only - admin_audit_log" ON admin_audit_log
  USING (auth.role() = 'service_role');


-- ── 3. Cleanup: expire old/orphaned sessions ─────────────────────────────────
-- Optional helper function to purge expired sessions. Can be called manually
-- or scheduled via pg_cron in Supabase.

CREATE OR REPLACE FUNCTION purge_expired_admin_sessions()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM admin_sessions
  WHERE expires_at < NOW() - INTERVAL '7 days';
$$;


-- ── 4. Verify ────────────────────────────────────────────────────────────────
-- Run this block after to confirm tables exist:
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('admin_sessions', 'admin_audit_log')
ORDER BY tablename;

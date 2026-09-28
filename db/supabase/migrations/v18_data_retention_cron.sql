-- =============================================================================
-- Aiscern v18 — Data Retention Cron (Module F.2)
-- Run in Supabase SQL Editor (service role).
--
-- Adds a nightly pg_cron job that purges scans rows older than each user's
-- configured data_retention_days (from user_settings, v17). Users set to
-- -1 (Forever) are explicitly excluded.
--
-- pg_cron must be enabled on the Supabase project:
--   Dashboard → Database → Extensions → pg_cron → Enable
-- =============================================================================

-- ── Function: purge old scans per user's retention setting ───────────────────
CREATE OR REPLACE FUNCTION purge_scans_by_retention()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM scans s
  WHERE EXISTS (
    SELECT 1
    FROM   user_settings us
    WHERE  us.user_id              = s.user_id
      AND  us.data_retention_days != -1          -- -1 = Forever, skip
      AND  s.created_at < NOW() - (us.data_retention_days || ' days')::INTERVAL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION purge_scans_by_retention() TO service_role;

-- ── Schedule: run at 03:00 UTC nightly (after the daily-scan-count reset) ────
SELECT cron.schedule(
  'aiscern-data-retention',
  '0 3 * * *',
  $$ SELECT purge_scans_by_retention(); $$
);

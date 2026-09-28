-- =============================================================================
-- Aiscern v29 — Data retention purge must wait for MotherDuck archival
--
-- v18_data_retention_cron.sql purges `scans` rows once they're older than
-- the user's data_retention_days setting. Now that completed scans are
-- archived to MotherDuck asynchronously (Inngest: archiveScanToMotherDuck,
-- fired on 'scan/completed'), a row could theoretically get purged by the
-- nightly cron before the archive job has run — permanently losing it.
--
-- Fix: only purge rows where archived_at IS NOT NULL (successfully archived)
-- OR the row is old enough that we've given up waiting (>7 days unarchived
-- almost certainly means MotherDuck was never configured / down long-term —
-- don't hold data hostage forever for an archive that may never come).
-- =============================================================================

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
  )
  AND (
    s.archived_at IS NOT NULL                    -- safely archived to MotherDuck, OR
    OR s.created_at < NOW() - INTERVAL '7 days'   -- old enough we stop waiting on the archive job
  );
END;
$$;

GRANT EXECUTE ON FUNCTION purge_scans_by_retention() TO service_role;

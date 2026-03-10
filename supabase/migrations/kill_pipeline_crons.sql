-- ================================================================
-- PIPELINE MIGRATION: Kill all Supabase pipeline jobs
-- Pipeline is now on Cloudflare Workers (cf-pipeline/)
-- Run this when DB is accessible
-- ================================================================

-- 1. Unschedule all pipeline cron jobs
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN (
  'detectai-orchestrator',
  'detectai-pipeline-scheduler',
  'detectai-stale-recovery',
  'detectai-hf-push'
);

-- 2. Verify they are gone
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM cron.job WHERE jobname LIKE 'detectai-%';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Still % detectai cron jobs remaining!', v_count;
  ELSE
    RAISE NOTICE 'All detectai cron jobs removed successfully';
  END IF;
END $$;

-- 3. Clear the backlog of pipeline_jobs to relieve IO pressure immediately
TRUNCATE TABLE pipeline_jobs;
TRUNCATE TABLE pipeline_metrics;

-- 4. Add a note to pipeline_schedule marking migration
UPDATE pipeline_schedule
SET next_run_at = '9999-01-01'::timestamptz,
    last_run_at = now()
WHERE id = (SELECT id FROM pipeline_schedule LIMIT 1);

-- Done - Supabase pipeline fully stopped
SELECT 'Pipeline migration complete. Cloudflare Workers now handles all scraping + HF push.' AS status;

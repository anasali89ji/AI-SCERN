-- ══════════════════════════════════════════════════════════════════════════════
-- Aiscern — scans table: ensure status column exists + backfill
-- Run in Supabase SQL Editor
--
-- Problem: status column may not exist on older installs, causing silent
-- INSERT failures (swallowed by try/catch) and SELECT queries returning 0 rows.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Add status column if it doesn't exist
ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'complete';

-- 2. Add other optional columns referenced by the insert code
ALTER TABLE scans ADD COLUMN IF NOT EXISTS content_preview  TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS model_used       TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS model_version    TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS signals          JSONB;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS processing_time  INTEGER;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS metadata         JSONB;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS anon_id          TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS file_name        TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS file_size        INTEGER;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS r2_key           TEXT;

-- 3. Backfill any existing rows that have NULL status
UPDATE scans SET status = 'complete' WHERE status IS NULL;

-- 4. Index for the (user_id, status, created_at) query pattern
CREATE INDEX IF NOT EXISTS idx_scans_user_status_created
  ON scans(user_id, status, created_at DESC);

-- 5. Verify: should show your scan rows
SELECT COUNT(*) AS total_scans, status
FROM scans
GROUP BY status;

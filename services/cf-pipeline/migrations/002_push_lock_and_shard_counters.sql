-- ============================================================
-- Aiscern Pipeline — D1 Migration 002
-- BUG-FIX #1: hf_shard_counters — permanent part# counter
--   (Never trimmed. Replaces COUNT(hf_push_log) which reset on log trim.)
-- BUG-FIX #2: push_lock — distributed push mutex
--   (Only 1 worker may push at a time; 55s TTL auto-expires stale locks.)
--
-- Run: wrangler d1 execute detectai-pipeline --file=migrations/002_push_lock_and_shard_counters.sql
--      wrangler d1 execute detectai-pipeline --file=migrations/002_push_lock_and_shard_counters.sql --remote
-- ============================================================

-- BUG-FIX #1: shard part# counter — one row per (repo × media_type × language)
-- UNIQUE constraint + INSERT OR IGNORE + UPDATE SET part_number + 1 gives atomic increment
CREATE TABLE IF NOT EXISTS hf_shard_counters (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  repo         TEXT    NOT NULL,
  media_type   TEXT    NOT NULL,
  language     TEXT    NOT NULL,
  part_number  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(repo, media_type, language)
);

CREATE INDEX IF NOT EXISTS idx_hf_shard_counters_key
  ON hf_shard_counters(repo, media_type, language);

-- BUG-FIX #2: push lock — soft mutex, 1 row max (id CHECK id=1)
CREATE TABLE IF NOT EXISTS push_lock (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  locked_by  TEXT,
  locked_at  TIMESTAMP
);

-- Ensure hf_push_log has columns added in v8.1
-- (safe if columns already exist — D1 ignores duplicate ADD COLUMN errors)
-- Extends the log schema with shard tracking fields
ALTER TABLE hf_push_log ADD COLUMN media_type  TEXT;
ALTER TABLE hf_push_log ADD COLUMN language    TEXT;
ALTER TABLE hf_push_log ADD COLUMN shard_path  TEXT;
ALTER TABLE hf_push_log ADD COLUMN sha256_hash TEXT;
ALTER TABLE hf_push_log ADD COLUMN repo        TEXT;

-- Index for the adaptive cleanup query (BUG-FIX #3)
CREATE INDEX IF NOT EXISTS idx_hf_push_log_status_time
  ON hf_push_log(status, created_at DESC);

-- Index for dataset_items push queue (W20 SELECT unpushed ORDER BY quality)
CREATE INDEX IF NOT EXISTS idx_dataset_items_unpushed
  ON dataset_items(hf_pushed_at, quality_score DESC, created_at ASC)

-- ============================================================
-- Aiscern Pipeline — D1 Migration 001
-- Adds source_cursors table (MISSING — root cause of zero scrapes)
-- Run: wrangler d1 execute detectai-pipeline --file=migrations/001_source_cursors.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS source_cursors (
  source_name     TEXT PRIMARY KEY,
  next_offset     INTEGER NOT NULL DEFAULT 0,
  total_fetched   INTEGER NOT NULL DEFAULT 0,
  total_inserted  INTEGER NOT NULL DEFAULT 0,
  error_count     INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  last_updated    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_source_cursors_updated
  ON source_cursors(last_updated DESC);

-- Migration v2: Bug fix tables (v8.1)
-- Run: wrangler d1 execute detectai-pipeline --file=migrations/v2_bug_fixes.sql

-- BUG-FIX #1: Dedicated shard counter — never trimmed, monotonically increasing
CREATE TABLE IF NOT EXISTS hf_shard_counters (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  repo        TEXT NOT NULL,
  media_type  TEXT NOT NULL,
  language    TEXT NOT NULL,
  part_number INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(repo, media_type, language)
);

-- BUG-FIX #2: Push lock — prevents multiple workers pushing simultaneously
CREATE TABLE IF NOT EXISTS push_lock (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  locked_by  TEXT,
  locked_at  TIMESTAMP
);

-- Minor fix #8: Permanent content hash bloom filter — survives row deletion after HF push
CREATE TABLE IF NOT EXISTS content_hash_bloom (
  hash       TEXT PRIMARY KEY,
  first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index to make bloom lookup fast
CREATE INDEX IF NOT EXISTS idx_bloom_hash ON content_hash_bloom(hash);

-- DETECTAI Pipeline v6 — D1 Schema Migration
-- Run once via Cloudflare D1 console or wrangler d1 execute

-- Add media_type + language + shard_path + sha256 columns to hf_push_log
ALTER TABLE hf_push_log ADD COLUMN media_type  TEXT;
ALTER TABLE hf_push_log ADD COLUMN language    TEXT DEFAULT 'en';
ALTER TABLE hf_push_log ADD COLUMN shard_path  TEXT;
ALTER TABLE hf_push_log ADD COLUMN sha256_hash TEXT;

-- Index for shard-count queries (used to get next part number per group)
CREATE INDEX IF NOT EXISTS idx_hf_push_log_repo_type_lang
  ON hf_push_log(repo, media_type, language);

-- Full D1 schema (for fresh installs)
-- Run this block if starting from scratch:

CREATE TABLE IF NOT EXISTS dataset_items (
  id               TEXT PRIMARY KEY,
  media_type       TEXT NOT NULL CHECK(media_type IN ('text','image','audio','video')),
  source_name      TEXT NOT NULL,
  hf_dataset_id    TEXT NOT NULL,
  label            TEXT NOT NULL CHECK(label IN ('ai','human')),
  confidence       REAL DEFAULT 0.5,
  content_text     TEXT,
  content_url      TEXT,
  content_preview  TEXT,
  content_hash     TEXT UNIQUE NOT NULL,
  quality_score    REAL DEFAULT 0.5,
  language         TEXT DEFAULT 'en',
  word_count       INTEGER,
  char_count       INTEGER,
  sentence_count   INTEGER,
  duration_seconds REAL,
  sample_rate      INTEGER,
  resolution_w     INTEGER,
  resolution_h     INTEGER,
  file_format      TEXT,
  has_face         INTEGER DEFAULT 0,
  has_speech       INTEGER DEFAULT 0,
  is_synthetic     INTEGER DEFAULT 0,
  split            TEXT DEFAULT 'train' CHECK(split IN ('train','val','test')),
  hf_row_index     INTEGER,
  hf_config        TEXT DEFAULT 'default',
  hf_split         TEXT DEFAULT 'train',
  hf_pushed_at     TIMESTAMP,
  worker_id        TEXT,
  metadata         TEXT,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dataset_items_media_type ON dataset_items(media_type);
CREATE INDEX IF NOT EXISTS idx_dataset_items_label      ON dataset_items(label);
CREATE INDEX IF NOT EXISTS idx_dataset_items_language   ON dataset_items(language);
CREATE INDEX IF NOT EXISTS idx_dataset_items_quality    ON dataset_items(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_dataset_items_pushed     ON dataset_items(hf_pushed_at);
CREATE INDEX IF NOT EXISTS idx_dataset_items_type_lang  ON dataset_items(media_type, language);

CREATE TABLE IF NOT EXISTS pipeline_state (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  total_scraped INTEGER DEFAULT 0,
  total_pushed  INTEGER DEFAULT 0,
  last_scrape_at TIMESTAMP,
  last_push_at  TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO pipeline_state (id) VALUES (1);

CREATE TABLE IF NOT EXISTS hf_push_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_count  INTEGER DEFAULT 0,
  commit_id   TEXT,
  repo        TEXT,
  status      TEXT DEFAULT 'success',
  media_type  TEXT,
  language    TEXT DEFAULT 'en',
  shard_path  TEXT,
  sha256_hash TEXT,
  error       TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

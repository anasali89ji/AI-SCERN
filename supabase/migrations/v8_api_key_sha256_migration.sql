-- v8_api_key_sha256_migration.sql
-- Zero-downtime migration from djb2 → SHA-256 API key hashing.
--
-- Strategy: add sha256_hash column alongside existing key_hash (djb2).
-- The application performs dual-lookup (SHA-256 first, djb2 fallback)
-- and auto-populates sha256_hash on every successful djb2 login.
-- Once all active keys have been migrated (sha256_hash IS NOT NULL),
-- the djb2 fallback path and key_hash column can be dropped in v9.

-- Step 1: New columns
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS sha256_hash   TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS hash_version  TEXT DEFAULT 'djb2';

-- Step 2: Fast lookup index — partial index only covers migrated rows
CREATE INDEX IF NOT EXISTS api_keys_sha256_hash_idx
  ON api_keys(sha256_hash)
  WHERE sha256_hash IS NOT NULL;

-- Step 3: Comment for ops awareness
COMMENT ON COLUMN api_keys.sha256_hash IS
  'SHA-256(rawKey) populated on first successful djb2 lookup. NULL = not yet migrated.';
COMMENT ON COLUMN api_keys.hash_version IS
  'djb2 = legacy hash stored in key_hash. sha256 = fully migrated.';

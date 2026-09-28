-- =============================================================================
-- Aiscern v28 — Perceptual Fingerprint + MotherDuck Archive support
--
-- Adds a durable "synth ID" fingerprint to every scan so that:
--   1. Re-uploading the same image (even after recompression/resize/crop)
--      is recognized instantly and linked back to the original scan.
--   2. A background job (Inngest: scan/completed -> archive-to-motherduck)
--      can copy each completed scan's metadata + fingerprint into MotherDuck
--      for durable, fast lookups that outlive the user's Supabase
--      data_retention_days purge window (v18_data_retention_cron.sql).
--
-- perceptual_hash: 64-bit DCT pHash as hex text (survives re-encoding,
--   unlike the existing file_hash/contentHash which is exact-byte SHA-256).
-- phash_int: same hash as a signed bigint, so Postgres can do a fast
--   Hamming-distance prefilter via bit ops before falling back to exact hex
--   comparison. (DuckDB/MotherDuck does the heavier historical matching —
--   see lib/motherduck/archive.ts — this column just lets the *hot* Supabase
--   path do a cheap "was this scanned in the last N days" check too.)
-- archived_at: set once the Inngest job has copied this row to MotherDuck.
--   NULL means "not archived yet" — the retention purge cron should be
--   updated (separately, once MotherDuck is live) to skip rows where this
--   is NULL, so nothing is lost before it's archived.
-- =============================================================================

ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS perceptual_hash TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS phash_int       BIGINT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived_at     TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_scans_perceptual_hash
  ON scans(perceptual_hash) WHERE perceptual_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scans_archived_at
  ON scans(archived_at) WHERE archived_at IS NULL;

COMMENT ON COLUMN scans.perceptual_hash IS
  'Hex-encoded 64-bit DCT perceptual hash of the scanned image. Unlike file_hash (exact SHA-256), this matches recompressed/resized/cropped copies of the same image. NULL for non-image scans.';
COMMENT ON COLUMN scans.phash_int IS
  'perceptual_hash as a signed bigint for fast Hamming-distance prefiltering (fewer than ~10 bits different = likely the same source image).';
COMMENT ON COLUMN scans.archived_at IS
  'Set when this scan has been copied into the MotherDuck long-term archive. NULL scans should not be purged by the data-retention cron.';

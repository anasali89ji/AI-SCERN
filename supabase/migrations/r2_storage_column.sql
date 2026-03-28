-- Aiscern — Migration: add r2_key to scans
-- Files are stored in Cloudflare R2. This column stores the object key
-- so scans can reference their source file without Supabase storage.
--
-- Run this in: Supabase dashboard → SQL Editor

ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS r2_key TEXT DEFAULT NULL;

-- Index for looking up scans by R2 key (e.g. for cleanup jobs)
CREATE INDEX IF NOT EXISTS idx_scans_r2_key ON scans(r2_key)
  WHERE r2_key IS NOT NULL;

-- Also add model_version if not already present
ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS model_version TEXT DEFAULT NULL;

COMMENT ON COLUMN scans.r2_key IS
  'Cloudflare R2 object key for the uploaded file. Format: uploads/{media_type}/{user_id}/{timestamp}-{id}.{ext}';

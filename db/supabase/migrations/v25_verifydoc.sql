-- v25_verifydoc.sql
-- Adds 'document' as a recognized media_type so VerifyDoc scans can be
-- logged to `scans` and included in each plan's `modalities` allowlist.

-- ── 1. Relax the scans.media_type CHECK constraint ───────────────────────────
ALTER TABLE scans DROP CONSTRAINT IF EXISTS scans_media_type_check;
ALTER TABLE scans ADD CONSTRAINT scans_media_type_check
  CHECK (media_type IN ('text','image','audio','video','document'));

-- ── 2. Add 'document' to every plan's modalities array (idempotent) ──────────
UPDATE plan_limits
SET modalities = array_append(modalities, 'document')
WHERE NOT ('document' = ANY(modalities));

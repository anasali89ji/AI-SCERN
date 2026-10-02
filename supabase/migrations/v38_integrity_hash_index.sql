-- ════════════════════════════════════════════════════════════════════════════
-- Module 5.6 — Add missing index on scans.metadata->>integrity_hash
--
-- /api/verify/[hash]/route.ts:28 does .eq('metadata->>integrity_hash', hash)
-- which is a full-table JSONB scan WITHOUT an index. Every verification does
-- a sequential scan of `scans`. This migration adds a GIN index on the
-- metadata JSONB column and a functional index on the integrity_hash path.
-- ════════════════════════════════════════════════════════════════════════════

-- GIN index on the metadata JSONB column (supports ->> operator)
CREATE INDEX IF NOT EXISTS idx_scans_metadata_gin ON scans USING GIN (metadata);

-- Functional index on the specific integrity_hash path (exact match lookup)
CREATE INDEX IF NOT EXISTS idx_scans_integrity_hash
  ON scans ((metadata->>'integrity_hash'))
  WHERE metadata->>'integrity_hash' IS NOT NULL;

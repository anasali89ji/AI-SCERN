-- ════════════════════════════════════════════════════════════════════════════
-- Module 5.1b — Extend site_scan_seals with seal_number + signature
--
-- The site_scan_seals table (from v24) already has a SHA-256 hash.
-- This migration adds a seal_number column so the public verify page can
-- look up either scan type (text/image/audio OR site scan) with one path.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE site_scan_seals ADD COLUMN IF NOT EXISTS seal_number TEXT;
ALTER TABLE site_scan_seals ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE site_scan_seals ADD COLUMN IF NOT EXISTS payload_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_scan_seals_seal_number
  ON site_scan_seals(seal_number) WHERE seal_number IS NOT NULL;

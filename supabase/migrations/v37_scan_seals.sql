-- ════════════════════════════════════════════════════════════════════════════
-- Module 5.1 — scan_seals table (signed, indexed, verifiable seals)
--
-- Format: ASC-<8 base32 chars>-<2 checksum chars> e.g. ASC-7K3X9P2Q-4F
-- 8 base32 chars = 40 bits of entropy (~1 trillion combinations)
-- Checksum = first 2 chars of HMAC-SHA256(seal_body, SEAL_SIGNING_KEY)
--
-- Replaces the broken /api/verify/seal stub that returned valid:true for
-- ANY string ≥8 chars. Now: every scan gets a signed, verifiable seal.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scan_seals (
  seal_number     TEXT PRIMARY KEY,                    -- e.g. 'ASC-7K3X9P2Q-4F'
  scan_id         UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  verification_id UUID,                                  -- optional link to verifications table
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,                          -- NULL = no expiry
  revoked_at      TIMESTAMPTZ,                          -- soft revoke
  revoke_reason   TEXT,
  signature       TEXT NOT NULL,                        -- HMAC-SHA256(scan_id|verdict|confidence, SEAL_SIGNING_KEY)
  payload_hash    TEXT NOT NULL,                        -- SHA-256 of canonicalized scan result
  UNIQUE (scan_id)
);

CREATE INDEX IF NOT EXISTS idx_scan_seals_scan_id ON scan_seals(scan_id);

-- Public can read non-revoked seals; only service role can write
ALTER TABLE scan_seals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scan_seals_public_read ON scan_seals;
CREATE POLICY scan_seals_public_read ON scan_seals
  FOR SELECT USING (revoked_at IS NULL);
-- No INSERT/UPDATE/DELETE policy — service role bypasses RLS

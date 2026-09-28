-- ════════════════════════════════════════════════════════════════════════════
-- AISCERN — Forensic Pipeline Schema Migration
-- Run via: Supabase Dashboard → SQL Editor → paste & run
--          OR: supabase db push (if using Supabase CLI)
-- ════════════════════════════════════════════════════════════════════════════

-- ── forensic_scans: main table for 6-layer cascade results ───────────────────

CREATE TABLE IF NOT EXISTS forensic_scans (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Input
  image_url                TEXT NOT NULL,
  r2_key                   TEXT NOT NULL,
  user_id                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Lifecycle
  status                   TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  -- Layer reports (JSONB arrays — flexible schema, typed by application)
  layers                   JSONB NOT NULL DEFAULT '[]'::jsonb,
  semantic_agents          JSONB NOT NULL DEFAULT '[]'::jsonb,
  provenance               JSONB,

  -- Final output
  final_verdict            JSONB,
  processing_time_ms       INTEGER,

  -- Existing ensemble blending (optional)
  existing_ensemble_result JSONB
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_forensic_scans_user_id
  ON forensic_scans (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_forensic_scans_status
  ON forensic_scans (status);

CREATE INDEX IF NOT EXISTS idx_forensic_scans_created_at
  ON forensic_scans (created_at DESC);

-- GIN index for querying inside JSONB verdict (e.g. final_verdict->>'label')
CREATE INDEX IF NOT EXISTS idx_forensic_scans_verdict
  ON forensic_scans USING GIN (final_verdict);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE forensic_scans ENABLE ROW LEVEL SECURITY;

-- Users can read only their own scans
CREATE POLICY IF NOT EXISTS "forensic_scans_select_own"
  ON forensic_scans
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role (server-side) manages all rows — via service key bypass
-- No explicit USING clause needed; service key bypasses RLS automatically.

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS forensic_scans_touch_updated_at ON forensic_scans;
CREATE TRIGGER forensic_scans_touch_updated_at
  BEFORE UPDATE ON forensic_scans
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- ── forensic_scan_events: lightweight notification bus for frontend polling ───
-- Inngest writes a row here after each major step; frontend polls/subscribes.

CREATE TABLE IF NOT EXISTS forensic_scan_events (
  id          BIGSERIAL PRIMARY KEY,
  scan_id     UUID NOT NULL REFERENCES forensic_scans(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forensic_scan_events_scan_id
  ON forensic_scan_events (scan_id, created_at DESC);

ALTER TABLE forensic_scan_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "forensic_events_select_own"
  ON forensic_scan_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM forensic_scans fs
      WHERE fs.id = forensic_scan_events.scan_id
        AND fs.user_id = auth.uid()
    )
  );

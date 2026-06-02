-- ════════════════════════════════════════════════════════════════════════════
-- AISCERN — Self-Learning Detection Tables
-- Migration: 20260602_signal_learning
--
-- Creates:
--   signal_feedback  — per-signal user feedback entries
--   signal_weights   — learned weights per modality (image / text)
-- ════════════════════════════════════════════════════════════════════════════

-- Signal feedback table
CREATE TABLE IF NOT EXISTS signal_feedback (
  id            bigserial     PRIMARY KEY,
  scan_id       text          NOT NULL,
  modality      text          NOT NULL CHECK (modality IN ('image', 'text')),
  signal_name   text          NOT NULL,
  signal_score  numeric(6,4)  NOT NULL CHECK (signal_score BETWEEN 0 AND 1),
  ground_truth  text          NOT NULL CHECK (ground_truth IN ('AI', 'HUMAN')),
  predicted     text          NOT NULL CHECK (predicted IN ('AI', 'HUMAN', 'UNCERTAIN')),
  was_correct   boolean       NOT NULL,
  created_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signal_feedback_modality_created
  ON signal_feedback (modality, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signal_feedback_signal_name
  ON signal_feedback (signal_name, modality);

-- Learned weights table (one row per modality, updated periodically)
CREATE TABLE IF NOT EXISTS signal_weights (
  modality      text          PRIMARY KEY,
  weights       jsonb         NOT NULL DEFAULT '{}',
  version       integer       NOT NULL DEFAULT 1,
  sample_count  integer       NOT NULL DEFAULT 0,
  updated_at    timestamptz   NOT NULL DEFAULT now()
);

-- RLS: only service role can read/write these tables
ALTER TABLE signal_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_weights  ENABLE ROW LEVEL SECURITY;

-- Service role bypass (for server-side admin client)
CREATE POLICY "service_bypass_signal_feedback" ON signal_feedback
  USING (auth.role() = 'service_role');

CREATE POLICY "service_bypass_signal_weights" ON signal_weights
  USING (auth.role() = 'service_role');

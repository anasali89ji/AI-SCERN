-- Feature flags table (used by admin dashboard Feature Flags tab)
CREATE TABLE IF NOT EXISTS feature_flags (
  id                  SERIAL PRIMARY KEY,
  key                 TEXT UNIQUE NOT NULL,
  enabled             BOOLEAN DEFAULT false,
  rollout_percentage  INTEGER DEFAULT 100 CHECK(rollout_percentage BETWEEN 0 AND 100),
  description         TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled);

-- Seed useful default flags
INSERT INTO feature_flags (key, enabled, rollout_percentage, description) VALUES
  ('batch_pdf_upload',      true,  100, 'Allow PDF uploads in batch scanner'),
  ('text_scanner_100k',     true,  100, 'Enable 100k character limit in text scanner'),
  ('audio_calibration',     true,  100, 'Use live audio calibration from Supabase'),
  ('video_frame_sampling',  true,  100, 'Enable frame-level video analysis'),
  ('cross_correlation',     true,  100, 'Enable cross-tool correlation in batch mode'),
  ('api_v1_public',         true,  100, 'Public REST API v1 access')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Public read (frontend can check flags without auth)
CREATE POLICY "Public read feature_flags" ON feature_flags
  FOR SELECT USING (true);

-- Service role write
CREATE POLICY "Service role write feature_flags" ON feature_flags
  FOR ALL USING (auth.role() = 'service_role');

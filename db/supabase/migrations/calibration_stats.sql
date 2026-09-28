-- DETECTAI Calibration Stats Tables
-- Run in Supabase SQL editor

-- Image calibration stats (single row, upserted by GitHub Actions weekly)
CREATE TABLE IF NOT EXISTS image_calibration_stats (
  id                     INTEGER PRIMARY KEY DEFAULT 1,
  -- Entropy
  entropy_ai_mean        REAL, entropy_ai_std        REAL,
  entropy_real_mean      REAL, entropy_real_std      REAL,
  -- Noise
  noise_ai_mean          REAL, noise_ai_std          REAL,
  noise_real_mean        REAL, noise_real_std        REAL,
  -- Luminance
  luminance_ai_mean      REAL, luminance_ai_std      REAL,
  luminance_real_mean    REAL, luminance_real_std    REAL,
  -- Background
  bg_ai_mean             REAL, bg_ai_std             REAL,
  bg_real_mean           REAL, bg_real_std           REAL,
  -- Color balance
  color_ai_mean          REAL, color_ai_std          REAL,
  color_real_mean        REAL, color_real_std        REAL,
  -- Compression
  compression_ai_mean    REAL, compression_ai_std    REAL,
  compression_real_mean  REAL, compression_real_std  REAL,
  -- HF Detail
  hf_detail_ai_mean      REAL, hf_detail_ai_std      REAL,
  hf_detail_real_mean    REAL, hf_detail_real_std    REAL,
  -- Skin smoothing
  skin_ai_mean           REAL, skin_ai_std           REAL,
  skin_real_mean         REAL, skin_real_std         REAL,
  -- Meta
  ai_sample_count        INTEGER DEFAULT 0,
  real_sample_count      INTEGER DEFAULT 0,
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Audio calibration stats (single row, upserted by GitHub Actions weekly)
CREATE TABLE IF NOT EXISTS audio_calibration_stats (
  id                   INTEGER PRIMARY KEY DEFAULT 1,
  -- Bitrate
  bitrate_ai_mean      REAL, bitrate_ai_std      REAL,
  bitrate_real_mean    REAL, bitrate_real_std    REAL,
  -- Entropy
  entropy_ai_mean      REAL, entropy_ai_std      REAL,
  entropy_real_mean    REAL, entropy_real_std    REAL,
  -- Silence ratio
  silence_ai_mean      REAL, silence_ai_std      REAL,
  silence_real_mean    REAL, silence_real_std    REAL,
  -- Zero crossing rate
  zcr_ai_mean          REAL, zcr_ai_std          REAL,
  zcr_real_mean        REAL, zcr_real_std        REAL,
  -- Amplitude variance
  ampvar_ai_mean       REAL, ampvar_ai_std       REAL,
  ampvar_real_mean     REAL, ampvar_real_std     REAL,
  -- File size (KB)
  filesize_ai_mean     REAL, filesize_ai_std     REAL,
  filesize_real_mean   REAL, filesize_real_std   REAL,
  -- Meta
  ai_sample_count      INTEGER DEFAULT 0,
  real_sample_count    INTEGER DEFAULT 0,
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Allow anon read (for frontend calibration-client fetching stats)
ALTER TABLE image_calibration_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_calibration_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read calibration stats" ON image_calibration_stats
  FOR SELECT USING (true);
CREATE POLICY "Public read audio calibration stats" ON audio_calibration_stats
  FOR SELECT USING (true);

-- Service role can write (GitHub Actions uses service key)
CREATE POLICY "Service write image calibration" ON image_calibration_stats
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service write audio calibration" ON audio_calibration_stats
  FOR ALL USING (auth.role() = 'service_role');

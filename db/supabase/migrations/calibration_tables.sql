-- DETECTAI Calibration Tables — run via Cloudflare D1 console
-- wrangler d1 execute detectai-pipeline --file=supabase/migrations/calibration_tables.sql

-- Temporary storage for raw signal samples (cleared after each aggregation run)
CREATE TABLE IF NOT EXISTS calibration_samples (
  id            TEXT PRIMARY KEY,
  label         TEXT NOT NULL CHECK(label IN ('ai', 'real')),
  source        TEXT NOT NULL,
  entropy       REAL NOT NULL,
  noise         REAL NOT NULL,
  luminance     REAL NOT NULL,
  background    REAL NOT NULL,
  color_balance REAL NOT NULL,
  compression   REAL NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cal_samples_label ON calibration_samples(label);

-- Single-row table storing the latest calibration state
CREATE TABLE IF NOT EXISTS calibration_state (
  id                       INTEGER PRIMARY KEY DEFAULT 1,
  -- Entropy: AI images have lower byte entropy (more compressible)
  entropy_ai_mean          REAL, entropy_ai_std          REAL,
  entropy_real_mean        REAL, entropy_real_std        REAL,
  -- Noise: AI images have lower adjacent-byte variance
  noise_ai_mean            REAL, noise_ai_std            REAL,
  noise_real_mean          REAL, noise_real_std          REAL,
  -- Luminance: AI images cluster in mid-tones (80-210 range)
  luminance_ai_mean        REAL, luminance_ai_std        REAL,
  luminance_real_mean      REAL, luminance_real_std      REAL,
  -- Background: AI studio renders have smooth gradients (low stddev)
  bg_ai_mean               REAL, bg_ai_std               REAL,
  bg_real_mean             REAL, bg_real_std             REAL,
  -- Color balance: AI images have unnaturally balanced RGB
  color_ai_mean            REAL, color_ai_std            REAL,
  color_real_mean          REAL, color_real_std          REAL,
  -- Compression: AI images are smaller per pixel than real photos
  compression_ai_mean      REAL, compression_ai_std      REAL,
  compression_real_mean    REAL, compression_real_std    REAL,
  -- Metadata
  ai_sample_count          INTEGER DEFAULT 0,
  real_sample_count        INTEGER DEFAULT 0,
  updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Run log (max 50 rows)
CREATE TABLE IF NOT EXISTS calibration_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_count    INTEGER,
  real_count  INTEGER,
  duration_ms INTEGER,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

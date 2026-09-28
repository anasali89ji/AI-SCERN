-- AISCERN IMAGE v3: Dataset Expansion Migration
-- Additive ONLY — adds new columns, indexes, and tables.
-- Does NOT modify, drop, or alter any existing columns, tables, or data.
-- Safe to run on production without downtime.

-- Add new columns to existing dataset_items table (IF NOT EXISTS = safe)
ALTER TABLE dataset_items ADD COLUMN IF NOT EXISTS generator_family TEXT;
ALTER TABLE dataset_items ADD COLUMN IF NOT EXISTS generator_version TEXT;
ALTER TABLE dataset_items ADD COLUMN IF NOT EXISTS image_width INTEGER;
ALTER TABLE dataset_items ADD COLUMN IF NOT EXISTS image_height INTEGER;
ALTER TABLE dataset_items ADD COLUMN IF NOT EXISTS aspect_ratio REAL;
ALTER TABLE dataset_items ADD COLUMN IF NOT EXISTS has_face INTEGER DEFAULT 0;
ALTER TABLE dataset_items ADD COLUMN IF NOT EXISTS has_text INTEGER DEFAULT 0;
ALTER TABLE dataset_items ADD COLUMN IF NOT EXISTS watermark_type TEXT;
ALTER TABLE dataset_items ADD COLUMN IF NOT EXISTS forensic_features JSONB DEFAULT '{}';
ALTER TABLE dataset_items ADD COLUMN IF NOT EXISTS difficulty_score REAL DEFAULT 0.5;

-- New indexes (IF NOT EXISTS = safe, additive)
CREATE INDEX IF NOT EXISTS idx_dataset_items_generator
  ON dataset_items(generator_family, generator_version);

CREATE INDEX IF NOT EXISTS idx_dataset_items_resolution
  ON dataset_items(image_width, image_height);

CREATE INDEX IF NOT EXISTS idx_dataset_items_face_text
  ON dataset_items(has_face, has_text);

CREATE INDEX IF NOT EXISTS idx_dataset_items_forensic_features
  ON dataset_items USING GIN (forensic_features);

-- New table for image dataset sources (does NOT modify any existing table)
CREATE TABLE IF NOT EXISTS image_dataset_sources (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name      TEXT NOT NULL,
  generator_family TEXT,
  generator_version TEXT,
  total_images     INTEGER DEFAULT 0,
  ai_images        INTEGER DEFAULT 0,
  human_images     INTEGER DEFAULT 0,
  quality_score    REAL DEFAULT 0.5,
  verified         BOOLEAN DEFAULT FALSE,
  download_url     TEXT,
  license          TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Seed dataset source records (ON CONFLICT DO NOTHING = safe, idempotent)
INSERT INTO image_dataset_sources
  (source_name, generator_family, total_images, ai_images, human_images, verified, license)
VALUES
  ('GenImage-Mixed',       'mixed',            1000000, 500000, 500000, TRUE,  'MIT'),
  ('FLUX-Synthetic',       'FLUX',              100000, 100000,      0, FALSE, 'CC-BY'),
  ('SD3-Collection',       'Stable Diffusion',  100000, 100000,      0, FALSE, 'CC-BY'),
  ('DALL-E-3-Set',         'DALL-E',             50000,  50000,      0, TRUE,  'OpenAI-TOS'),
  ('Midjourney-v6-Scrape', 'Midjourney',         50000,  50000,      0, FALSE, 'Fair-Use'),
  ('CIFAKE',               'Stable Diffusion',   60000,  30000,  30000, TRUE,  'MIT'),
  ('FakeFace-StyleGAN3',   'StyleGAN',          100000, 100000,      0, TRUE,  'MIT'),
  ('FaceForensics++',      'mixed',            1800000, 900000, 900000, TRUE,  'Academic'),
  ('DFDC-Preview',         'mixed',               5000,   2500,   2500, TRUE,  'Facebook'),
  ('ArtStation-Real',       NULL,               100000,      0, 100000, FALSE, 'Fair-Use'),
  ('LAION-Real-Subset',     NULL,               200000,      0, 200000, TRUE,  'CC-BY')
ON CONFLICT DO NOTHING;

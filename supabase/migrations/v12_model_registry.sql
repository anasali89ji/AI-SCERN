CREATE TABLE IF NOT EXISTS model_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  modality TEXT NOT NULL CHECK (modality IN ('text', 'image', 'audio', 'video')),
  version TEXT NOT NULL,
  base_model TEXT NOT NULL,
  dataset_used TEXT,
  r2_path TEXT NOT NULL,
  metrics JSONB,
  is_active BOOLEAN DEFAULT FALSE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deployed_at TIMESTAMPTZ,
  UNIQUE(name, version)
);

CREATE UNIQUE INDEX idx_model_registry_default ON model_registry(modality) WHERE is_default = TRUE;

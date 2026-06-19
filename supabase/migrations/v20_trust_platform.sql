-- =============================================================================
-- Aiscern v20 — Trust Platform Core Schema
-- Run in Supabase SQL Editor (service role). Safe to re-run (IF NOT EXISTS).
--
-- Transforms Aiscern from AI Detector → Trust Infrastructure Platform.
-- Adds tables for all 15 verification modules, trust scores, evidence,
-- risk factors, and downloadable report tracking.
--
-- New tables:
--   verifications          — universal verification registry (all modules)
--   trust_scores           — composite trust score per verification
--   evidence_items         — structured evidence attached to verifications
--   content_verifications  — ContentVerify™ specific data
--   image_verifications    — ImageVerify™ specific data
--   document_verifications — DocVerify™ specific data
--   web_verifications      — WebVerify™ specific data
--   identity_verifications — HumanVerify™ specific data
--   business_verifications — BusinessVerify™ specific data
--   legal_verifications    — LegalVerify™ specific data
--   plagiarism_checks      — plagiarism sub-results
--   citation_records       — citation verification records
--   source_reliability     — domain/source trust cache
--   manipulation_findings  — image manipulation evidence
--   metadata_analysis      — file metadata forensics
--   verification_reports   — R2 report artifact tracking
--   webhooks               — async result delivery
-- =============================================================================

-- ── Enable pgvector if not already active ─────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE verification_module AS ENUM (
    'content', 'image', 'document', 'web', 'identity',
    'business', 'legal', 'audio', 'video', 'academic',
    'source', 'provenance', 'risk', 'scam', 'deepfake'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE verification_status AS ENUM (
    'queued', 'processing', 'completed', 'failed', 'partial'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE risk_level AS ENUM ('critical', 'high', 'medium', 'low', 'none');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE evidence_type AS ENUM (
    'ai_detection', 'plagiarism', 'citation', 'source_check',
    'metadata', 'manipulation', 'voice_clone', 'deepfake',
    'document_format', 'domain_reputation', 'identity_signal',
    'stylometric', 'temporal', 'provenance', 'semantic'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- CORE VERIFICATION REGISTRY
-- =============================================================================

CREATE TABLE IF NOT EXISTS verifications (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT        NOT NULL,          -- Clerk user_id or 'anon_*'
  module            verification_module NOT NULL,
  status            verification_status NOT NULL DEFAULT 'queued',
  entity_type       TEXT        NOT NULL,          -- 'text', 'image', 'url', 'file', etc.
  entity_ref        TEXT,                          -- URL, filename, or identifier
  entity_hash       TEXT,                          -- SHA-256 of input for dedup
  entity_size_bytes BIGINT,
  api_key_hash      TEXT,                          -- if via API
  scan_id           UUID,                          -- legacy FK → scans.id (if applicable)
  inngest_event_id  TEXT,                          -- Inngest correlation ID
  processing_ms     INTEGER,
  error_message     TEXT,
  metadata          JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verifications_user_id    ON verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_verifications_module     ON verifications(module);
CREATE INDEX IF NOT EXISTS idx_verifications_status     ON verifications(status);
CREATE INDEX IF NOT EXISTS idx_verifications_entity_hash ON verifications(entity_hash);
CREATE INDEX IF NOT EXISTS idx_verifications_created_at ON verifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verifications_scan_id    ON verifications(scan_id) WHERE scan_id IS NOT NULL;

-- ── Auto-update updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_verifications_updated_at ON verifications;
CREATE TRIGGER trg_verifications_updated_at
  BEFORE UPDATE ON verifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- TRUST SCORES (composite output per verification)
-- =============================================================================

CREATE TABLE IF NOT EXISTS trust_scores (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id     UUID        NOT NULL REFERENCES verifications(id) ON DELETE CASCADE,
  -- Composite scores (0-100)
  trust_overall       SMALLINT    NOT NULL CHECK (trust_overall  BETWEEN 0 AND 100),
  risk_overall        SMALLINT    NOT NULL CHECK (risk_overall   BETWEEN 0 AND 100),
  confidence_overall  SMALLINT    NOT NULL CHECK (confidence_overall BETWEEN 0 AND 100),
  -- Trust sub-components
  trust_authenticity       SMALLINT CHECK (trust_authenticity       BETWEEN 0 AND 100),
  trust_consistency        SMALLINT CHECK (trust_consistency        BETWEEN 0 AND 100),
  trust_source_reliability SMALLINT CHECK (trust_source_reliability BETWEEN 0 AND 100),
  trust_verification_sigs  SMALLINT CHECK (trust_verification_sigs  BETWEEN 0 AND 100),
  trust_metadata_quality   SMALLINT CHECK (trust_metadata_quality   BETWEEN 0 AND 100),
  trust_historical_rep     SMALLINT CHECK (trust_historical_rep     BETWEEN 0 AND 100),
  -- Risk factors (individual contributions, 0-100)
  risk_factors        JSONB       NOT NULL DEFAULT '{}',
  -- Confidence interval
  confidence_low      SMALLINT,
  confidence_high     SMALLINT,
  -- Algorithm version for reproducibility
  algorithm_version   TEXT        NOT NULL DEFAULT 'v1.0',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trust_scores_verification
  ON trust_scores(verification_id);

-- =============================================================================
-- EVIDENCE ITEMS (structured findings per verification)
-- =============================================================================

CREATE TABLE IF NOT EXISTS evidence_items (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id  UUID        NOT NULL REFERENCES verifications(id) ON DELETE CASCADE,
  evidence_type    evidence_type NOT NULL,
  severity         risk_level  NOT NULL DEFAULT 'none',
  finding          TEXT        NOT NULL,
  confidence       SMALLINT    NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  details          JSONB       NOT NULL DEFAULT '{}',
  source           TEXT,                          -- which model/signal produced this
  position_ref     JSONB,                         -- text offset, image bounding box, etc.
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_verification ON evidence_items(verification_id);
CREATE INDEX IF NOT EXISTS idx_evidence_type         ON evidence_items(evidence_type);
CREATE INDEX IF NOT EXISTS idx_evidence_severity     ON evidence_items(severity);

-- =============================================================================
-- MODULE: ContentVerify™ (text/document content)
-- =============================================================================

CREATE TABLE IF NOT EXISTS content_verifications (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id      UUID        NOT NULL UNIQUE REFERENCES verifications(id) ON DELETE CASCADE,
  -- Input
  text_length          INTEGER,
  language_detected    TEXT,
  -- AI Detection
  ai_probability       SMALLINT    CHECK (ai_probability BETWEEN 0 AND 100),
  ai_model_detected    TEXT,
  perplexity_score     FLOAT,
  burstiness_score     FLOAT,
  -- Plagiarism
  plagiarism_score     SMALLINT    CHECK (plagiarism_score BETWEEN 0 AND 100),
  plagiarism_sources   JSONB       NOT NULL DEFAULT '[]',
  -- Citation Analysis
  citations_found      INTEGER     NOT NULL DEFAULT 0,
  citations_verified   INTEGER     NOT NULL DEFAULT 0,
  citations_broken     INTEGER     NOT NULL DEFAULT 0,
  citations_fabricated INTEGER     NOT NULL DEFAULT 0,
  -- Stylometric
  authorship_probability  SMALLINT CHECK (authorship_probability BETWEEN 0 AND 100),
  style_fingerprint    JSONB,
  -- Hallucination
  hallucination_risk   SMALLINT    CHECK (hallucination_risk BETWEEN 0 AND 100),
  factual_issues       JSONB       NOT NULL DEFAULT '[]',
  -- Academic
  academic_integrity_score SMALLINT CHECK (academic_integrity_score BETWEEN 0 AND 100),
  -- Embeddings (pgvector — for similarity search)
  content_embedding    vector(1536),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_ver_ai_prob    ON content_verifications(ai_probability);
CREATE INDEX IF NOT EXISTS idx_content_ver_plagiarism ON content_verifications(plagiarism_score);
-- pgvector cosine similarity index for plagiarism search
CREATE INDEX IF NOT EXISTS idx_content_embedding
  ON content_verifications USING ivfflat (content_embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE content_embedding IS NOT NULL;

-- =============================================================================
-- MODULE: ImageVerify™
-- =============================================================================

CREATE TABLE IF NOT EXISTS image_verifications (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id       UUID        NOT NULL UNIQUE REFERENCES verifications(id) ON DELETE CASCADE,
  -- File info
  file_mime             TEXT,
  file_size_bytes       BIGINT,
  width_px              INTEGER,
  height_px             INTEGER,
  -- AI Detection
  ai_probability        SMALLINT    CHECK (ai_probability BETWEEN 0 AND 100),
  gan_artifacts_score   SMALLINT    CHECK (gan_artifacts_score BETWEEN 0 AND 100),
  diffusion_artifacts   SMALLINT    CHECK (diffusion_artifacts BETWEEN 0 AND 100),
  -- Manipulation
  manipulation_detected BOOLEAN     NOT NULL DEFAULT FALSE,
  manipulation_score    SMALLINT    CHECK (manipulation_score BETWEEN 0 AND 100),
  clone_regions         JSONB       NOT NULL DEFAULT '[]',
  splicing_regions      JSONB       NOT NULL DEFAULT '[]',
  -- Metadata
  exif_present          BOOLEAN,
  exif_consistent       BOOLEAN,
  camera_model          TEXT,
  gps_stripped          BOOLEAN,
  metadata_anomalies    JSONB       NOT NULL DEFAULT '[]',
  -- Compression
  compression_anomaly   SMALLINT    CHECK (compression_anomaly BETWEEN 0 AND 100),
  -- Physics & Lighting
  lighting_consistency  SMALLINT    CHECK (lighting_consistency BETWEEN 0 AND 100),
  shadow_consistency    SMALLINT    CHECK (shadow_consistency   BETWEEN 0 AND 100),
  -- R2 artifact
  r2_forensic_report_key TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MODULE: DocVerify™ (documents, IDs, certificates, contracts)
-- =============================================================================

CREATE TABLE IF NOT EXISTS document_verifications (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id       UUID        NOT NULL UNIQUE REFERENCES verifications(id) ON DELETE CASCADE,
  document_type         TEXT,        -- 'degree', 'passport', 'contract', 'invoice', etc.
  issuing_authority     TEXT,
  -- Format integrity
  format_integrity_score SMALLINT   CHECK (format_integrity_score BETWEEN 0 AND 100),
  template_match_score  SMALLINT    CHECK (template_match_score   BETWEEN 0 AND 100),
  layout_anomalies      JSONB       NOT NULL DEFAULT '[]',
  -- OCR
  ocr_text_extracted    TEXT,
  ocr_confidence        SMALLINT    CHECK (ocr_confidence BETWEEN 0 AND 100),
  -- AI manipulation
  ai_manipulation_score SMALLINT    CHECK (ai_manipulation_score  BETWEEN 0 AND 100),
  font_anomalies        JSONB       NOT NULL DEFAULT '[]',
  -- Cross-reference
  cross_reference_passed BOOLEAN,
  external_db_checked   TEXT[],
  -- Security features
  security_features_detected JSONB NOT NULL DEFAULT '[]',
  watermark_verified    BOOLEAN,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MODULE: WebVerify™ (website trust analysis)
-- =============================================================================

CREATE TABLE IF NOT EXISTS web_verifications (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id      UUID        NOT NULL UNIQUE REFERENCES verifications(id) ON DELETE CASCADE,
  url                  TEXT        NOT NULL,
  domain               TEXT        NOT NULL,
  -- DNS/WHOIS
  domain_age_days      INTEGER,
  registrar            TEXT,
  whois_privacy        BOOLEAN,
  -- SSL
  ssl_valid            BOOLEAN,
  ssl_issuer           TEXT,
  ssl_expires_at       TIMESTAMPTZ,
  ssl_grade            TEXT,        -- 'A+', 'A', 'B', 'F', etc.
  -- Reputation
  reputation_score     SMALLINT    CHECK (reputation_score BETWEEN 0 AND 100),
  blacklist_hits       INTEGER     NOT NULL DEFAULT 0,
  blacklists_checked   TEXT[]      NOT NULL DEFAULT '{}',
  -- Content
  content_trust_score  SMALLINT    CHECK (content_trust_score BETWEEN 0 AND 100),
  has_privacy_policy   BOOLEAN,
  has_contact_info     BOOLEAN,
  -- Scam signals
  scam_indicators      JSONB       NOT NULL DEFAULT '[]',
  phishing_score       SMALLINT    CHECK (phishing_score BETWEEN 0 AND 100),
  -- Technology
  tech_stack           TEXT[]      NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MODULE: HumanVerify™ (identity verification)
-- =============================================================================

CREATE TABLE IF NOT EXISTS identity_verifications (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id      UUID        NOT NULL UNIQUE REFERENCES verifications(id) ON DELETE CASCADE,
  -- Input (hashed for privacy)
  email_hash           TEXT,
  username_checked     TEXT,
  -- Email signals
  email_valid          BOOLEAN,
  email_deliverable    BOOLEAN,
  email_disposable     BOOLEAN,
  email_domain_age_days INTEGER,
  -- Social presence
  social_profiles_found JSONB      NOT NULL DEFAULT '[]',
  social_consistency_score SMALLINT CHECK (social_consistency_score BETWEEN 0 AND 100),
  -- Digital footprint
  footprint_age_days   INTEGER,
  footprint_depth      SMALLINT    CHECK (footprint_depth BETWEEN 0 AND 100),
  -- Risk
  synthetic_id_risk    SMALLINT    CHECK (synthetic_id_risk BETWEEN 0 AND 100),
  fraud_signals        JSONB       NOT NULL DEFAULT '[]',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MODULE: BusinessVerify™
-- =============================================================================

CREATE TABLE IF NOT EXISTS business_verifications (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id       UUID        NOT NULL UNIQUE REFERENCES verifications(id) ON DELETE CASCADE,
  business_name         TEXT,
  jurisdiction          TEXT,
  -- Registration
  registration_verified BOOLEAN,
  registration_number   TEXT,
  incorporation_date    DATE,
  -- Online presence
  website_verified      BOOLEAN,
  social_verified       JSONB       NOT NULL DEFAULT '{}',
  -- Reviews
  review_score          FLOAT,
  review_count          INTEGER,
  review_platforms      TEXT[]      NOT NULL DEFAULT '{}',
  -- Risk
  sanctions_hit         BOOLEAN     NOT NULL DEFAULT FALSE,
  adverse_media_score   SMALLINT    CHECK (adverse_media_score BETWEEN 0 AND 100),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PLAGIARISM CHECKS (sub-table for ContentVerify™)
-- =============================================================================

CREATE TABLE IF NOT EXISTS plagiarism_checks (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_verification_id UUID     NOT NULL REFERENCES content_verifications(id) ON DELETE CASCADE,
  source_url           TEXT,
  source_title         TEXT,
  similarity_percent   SMALLINT    NOT NULL CHECK (similarity_percent BETWEEN 0 AND 100),
  matched_chars        INTEGER,
  match_type           TEXT,       -- 'exact', 'paraphrase', 'mosaic'
  excerpt              TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plagiarism_content ON plagiarism_checks(content_verification_id);

-- =============================================================================
-- CITATION RECORDS (sub-table for ContentVerify™)
-- =============================================================================

CREATE TABLE IF NOT EXISTS citation_records (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_verification_id  UUID        NOT NULL REFERENCES content_verifications(id) ON DELETE CASCADE,
  citation_text            TEXT        NOT NULL,
  citation_type            TEXT,       -- 'doi', 'isbn', 'url', 'bare'
  external_id              TEXT,       -- DOI, ISBN, URL
  verified                 BOOLEAN,
  accessible               BOOLEAN,
  title_match              BOOLEAN,
  fabricated_probability   SMALLINT    CHECK (fabricated_probability BETWEEN 0 AND 100),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citations_content ON citation_records(content_verification_id);

-- =============================================================================
-- SOURCE RELIABILITY CACHE (shared across modules)
-- =============================================================================

CREATE TABLE IF NOT EXISTS source_reliability (
  domain              TEXT        PRIMARY KEY,
  trust_score         SMALLINT    NOT NULL CHECK (trust_score BETWEEN 0 AND 100),
  category            TEXT,       -- 'news', 'academic', 'government', 'social', 'unknown'
  bias_rating         TEXT,
  factual_rating      TEXT,
  last_checked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  metadata            JSONB       NOT NULL DEFAULT '{}'
);

-- =============================================================================
-- MANIPULATION FINDINGS (image forensics evidence)
-- =============================================================================

CREATE TABLE IF NOT EXISTS manipulation_findings (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  image_verification_id UUID       NOT NULL REFERENCES image_verifications(id) ON DELETE CASCADE,
  finding_type         TEXT        NOT NULL, -- 'clone', 'splice', 'lighting', 'noise', 'compression'
  severity             risk_level  NOT NULL,
  region               JSONB,      -- { x, y, width, height } in px
  confidence           SMALLINT    NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  description          TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manipulation_image ON manipulation_findings(image_verification_id);

-- =============================================================================
-- METADATA ANALYSIS (file forensics for all file types)
-- =============================================================================

CREATE TABLE IF NOT EXISTS metadata_analysis (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id      UUID        NOT NULL REFERENCES verifications(id) ON DELETE CASCADE,
  file_type            TEXT,
  -- Timestamps
  created_timestamp    TIMESTAMPTZ,
  modified_timestamp   TIMESTAMPTZ,
  accessed_timestamp   TIMESTAMPTZ,
  timestamp_consistent BOOLEAN,
  -- Software
  software_used        TEXT,
  software_version     TEXT,
  -- Location
  gps_lat              FLOAT,
  gps_lon              FLOAT,
  -- Anomalies
  anomalies            JSONB       NOT NULL DEFAULT '[]',
  raw_metadata         JSONB       NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metadata_verification ON metadata_analysis(verification_id);

-- =============================================================================
-- VERIFICATION REPORTS (R2 artifact tracking)
-- =============================================================================

CREATE TABLE IF NOT EXISTS verification_reports (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id     UUID        NOT NULL REFERENCES verifications(id) ON DELETE CASCADE,
  format              TEXT        NOT NULL, -- 'pdf', 'json', 'csv'
  r2_key              TEXT        NOT NULL,
  r2_url              TEXT        NOT NULL,
  file_size_bytes     INTEGER,
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ,
  download_count      INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_reports_verification ON verification_reports(verification_id);

-- =============================================================================
-- WEBHOOKS (async result delivery)
-- =============================================================================

CREATE TABLE IF NOT EXISTS webhooks (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT        NOT NULL,
  url               TEXT        NOT NULL,
  secret            TEXT        NOT NULL,  -- HMAC signing secret
  events            TEXT[]      NOT NULL DEFAULT '{"verification.completed"}',
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  failure_count     INTEGER     NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id        UUID        NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  verification_id   UUID        NOT NULL REFERENCES verifications(id) ON DELETE CASCADE,
  event_type        TEXT        NOT NULL,
  payload           JSONB       NOT NULL,
  status_code       INTEGER,
  response_body     TEXT,
  attempt           INTEGER     NOT NULL DEFAULT 1,
  delivered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- verifications: users see only their own
ALTER TABLE verifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_scores            ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_verifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_verifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_verifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_verifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_verifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_verifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_reports    ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries      ENABLE ROW LEVEL SECURITY;

-- Users can read their own verifications
CREATE POLICY IF NOT EXISTS "verifications_owner_read"
  ON verifications FOR SELECT
  USING (user_id = (SELECT auth.uid()::text));

-- Users can read trust_scores for their verifications
CREATE POLICY IF NOT EXISTS "trust_scores_owner_read"
  ON trust_scores FOR SELECT
  USING (
    verification_id IN (
      SELECT id FROM verifications WHERE user_id = (SELECT auth.uid()::text)
    )
  );

-- Evidence items follow verification ownership
CREATE POLICY IF NOT EXISTS "evidence_items_owner_read"
  ON evidence_items FOR SELECT
  USING (
    verification_id IN (
      SELECT id FROM verifications WHERE user_id = (SELECT auth.uid()::text)
    )
  );

-- Reports: owner read
CREATE POLICY IF NOT EXISTS "reports_owner_read"
  ON verification_reports FOR SELECT
  USING (
    verification_id IN (
      SELECT id FROM verifications WHERE user_id = (SELECT auth.uid()::text)
    )
  );

-- Webhooks: owner CRUD
CREATE POLICY IF NOT EXISTS "webhooks_owner_all"
  ON webhooks FOR ALL
  USING (user_id = (SELECT auth.uid()::text))
  WITH CHECK (user_id = (SELECT auth.uid()::text));

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Calculate composite trust score (deterministic, version-tagged)
CREATE OR REPLACE FUNCTION calculate_trust_score(
  p_authenticity       SMALLINT DEFAULT 50,
  p_consistency        SMALLINT DEFAULT 50,
  p_source_reliability SMALLINT DEFAULT 50,
  p_verification_sigs  SMALLINT DEFAULT 50,
  p_metadata_quality   SMALLINT DEFAULT 50,
  p_historical_rep     SMALLINT DEFAULT 50
) RETURNS SMALLINT LANGUAGE plpgsql AS $$
DECLARE
  score FLOAT;
BEGIN
  -- Weighted composite (weights tuned for Trust Platform v1):
  -- Authenticity:       30% (most important)
  -- Consistency:        20%
  -- Source reliability: 15%
  -- Verification sigs:  15%
  -- Metadata quality:   10%
  -- Historical rep:     10%
  score := (
    (p_authenticity       * 0.30) +
    (p_consistency        * 0.20) +
    (p_source_reliability * 0.15) +
    (p_verification_sigs  * 0.15) +
    (p_metadata_quality   * 0.10) +
    (p_historical_rep     * 0.10)
  );
  RETURN LEAST(100, GREATEST(0, ROUND(score)::SMALLINT));
END;
$$;

-- Upsert a complete verification result (called from API routes)
CREATE OR REPLACE FUNCTION upsert_trust_score(
  p_verification_id    UUID,
  p_trust_overall      SMALLINT,
  p_risk_overall       SMALLINT,
  p_confidence_overall SMALLINT,
  p_components         JSONB DEFAULT '{}',
  p_risk_factors       JSONB DEFAULT '{}',
  p_algorithm_version  TEXT DEFAULT 'v1.0'
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO trust_scores (
    verification_id, trust_overall, risk_overall, confidence_overall,
    trust_authenticity, trust_consistency, trust_source_reliability,
    trust_verification_sigs, trust_metadata_quality, trust_historical_rep,
    risk_factors, algorithm_version
  ) VALUES (
    p_verification_id, p_trust_overall, p_risk_overall, p_confidence_overall,
    (p_components->>'authenticity')::SMALLINT,
    (p_components->>'consistency')::SMALLINT,
    (p_components->>'source_reliability')::SMALLINT,
    (p_components->>'verification_sigs')::SMALLINT,
    (p_components->>'metadata_quality')::SMALLINT,
    (p_components->>'historical_rep')::SMALLINT,
    p_risk_factors, p_algorithm_version
  )
  ON CONFLICT (verification_id) DO UPDATE SET
    trust_overall       = EXCLUDED.trust_overall,
    risk_overall        = EXCLUDED.risk_overall,
    confidence_overall  = EXCLUDED.confidence_overall,
    trust_authenticity  = EXCLUDED.trust_authenticity,
    trust_consistency   = EXCLUDED.trust_consistency,
    trust_source_reliability = EXCLUDED.trust_source_reliability,
    trust_verification_sigs  = EXCLUDED.trust_verification_sigs,
    trust_metadata_quality   = EXCLUDED.trust_metadata_quality,
    trust_historical_rep     = EXCLUDED.trust_historical_rep,
    risk_factors        = EXCLUDED.risk_factors,
    algorithm_version   = EXCLUDED.algorithm_version
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Increment report download count
CREATE OR REPLACE FUNCTION increment_report_download(p_report_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE verification_reports
  SET download_count = download_count + 1
  WHERE id = p_report_id;
END;
$$;

-- Increment webhook failure count (used by Inngest delivery worker)
CREATE OR REPLACE FUNCTION increment_webhook_failures(p_webhook_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE webhooks
  SET failure_count = failure_count + 1,
      is_active = CASE WHEN failure_count + 1 >= 20 THEN FALSE ELSE is_active END
  WHERE id = p_webhook_id;
END;
$$;

-- =============================================================================
-- BACKWARD COMPATIBILITY VIEW
-- Maps verifications → scans format so existing code still works
-- =============================================================================

CREATE OR REPLACE VIEW scans_trust_unified AS
SELECT
  v.id,
  v.user_id,
  v.created_at,
  v.status,
  v.module   AS media_type,
  v.entity_ref AS input_url,
  ts.trust_overall   AS confidence,
  CASE
    WHEN ts.trust_overall >= 70 THEN 'AUTHENTIC'
    WHEN ts.trust_overall >= 40 THEN 'UNCERTAIN'
    ELSE 'SUSPICIOUS'
  END AS verdict,
  ts.risk_overall,
  v.metadata
FROM verifications v
LEFT JOIN trust_scores ts ON ts.verification_id = v.id;

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_verifications_user_module
  ON verifications(user_id, module, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_verifications_entity_type_status
  ON verifications(entity_type, status);

CREATE INDEX IF NOT EXISTS idx_content_ver_embedding_gin
  ON content_verifications USING gin (plagiarism_sources jsonb_path_ops);

COMMENT ON TABLE verifications IS 'Universal verification registry — every verification across all 15 modules registers here';
COMMENT ON TABLE trust_scores IS 'Composite trust/risk/confidence scores with explainable component breakdown';
COMMENT ON TABLE evidence_items IS 'Structured evidence items attached to each verification for explainability';
COMMENT ON TABLE content_verifications IS 'ContentVerify™ — AI text detection, plagiarism, citations, hallucination';
COMMENT ON TABLE image_verifications IS 'ImageVerify™ — AI image, manipulation, metadata, lighting forensics';
COMMENT ON TABLE document_verifications IS 'DocVerify™ — documents, IDs, certificates, contracts';
COMMENT ON TABLE web_verifications IS 'WebVerify™ — website trust, DNS, SSL, reputation, scam detection';
COMMENT ON TABLE identity_verifications IS 'HumanVerify™ — identity and social presence verification';

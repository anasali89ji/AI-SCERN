/**
 * Aiscern Trust Platform — Shared Types
 *
 * All verification modules, API responses, and internal pipelines
 * reference these types. Every score is probability-based (0-100),
 * never presented as absolute truth.
 */

// ── Score primitives ──────────────────────────────────────────────────────────

export type Score = number // 0-100 integer

export interface ScoreInterval {
  low:  Score
  high: Score
}

export interface TrustScoreComponents {
  authenticity:       Score
  consistency:        Score
  source_reliability: Score
  verification_sigs:  Score
  metadata_quality:   Score
  historical_rep:     Score
}

export interface RiskFactors {
  ai_generated?:      Score
  plagiarism?:        Score
  citation_issues?:   Score
  source_unreliable?: Score
  manipulation?:      Score
  metadata_anomaly?:  Score
  deepfake?:          Score
  document_fraud?:    Score
  identity_synthetic?: Score
  domain_suspicious?: Score
  [key: string]:      Score | undefined
}

export interface TrustScoreResult {
  trust: {
    overall:    Score
    components: TrustScoreComponents
  }
  risk: {
    overall:  Score
    factors:  RiskFactors
  }
  confidence: {
    overall:  Score
    interval: ScoreInterval
  }
}

// ── Evidence ──────────────────────────────────────────────────────────────────

export type EvidenceType =
  | 'ai_detection'
  | 'plagiarism'
  | 'citation'
  | 'source_check'
  | 'metadata'
  | 'manipulation'
  | 'voice_clone'
  | 'deepfake'
  | 'document_format'
  | 'domain_reputation'
  | 'identity_signal'
  | 'stylometric'
  | 'temporal'
  | 'provenance'
  | 'semantic'

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'none'

export interface EvidenceItem {
  type:       EvidenceType
  finding:    string             // human-readable sentence
  confidence: Score              // how confident in this finding (0-100)
  severity:   Severity
  details:    Record<string, unknown>
  source?:    string             // which model/signal produced this
}

export interface Finding {
  severity:   Severity
  category:   string
  message:    string
  evidence_ref?: string         // reference to evidence item
}

// ── Universal API response ────────────────────────────────────────────────────

export type VerificationModule =
  | 'content' | 'image' | 'document' | 'web'
  | 'identity' | 'business' | 'legal'
  | 'audio' | 'video' | 'academic'

export type VerificationStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'partial'

export interface VerificationResponse {
  scan_id:         string         // UUID
  verification_id: string         // UUID (audit trail)
  timestamp:       string         // ISO 8601 UTC
  tool:            string         // 'ContentVerify™', 'ImageVerify™', etc.
  entity_type:     string         // 'text', 'image', 'url', 'file'
  status:          VerificationStatus
  scores:          TrustScoreResult
  evidence:        EvidenceItem[]
  findings:        Finding[]
  recommendations: string[]
  report_url?:     string         // R2 PDF/JSON report URL
  audit_log_url:   string         // /api/v1/audit/log/:verification_id
  processing_ms?:  number
  api_version:     string         // 'v1'
}

// ── ContentVerify™ ────────────────────────────────────────────────────────────

export interface ContentVerifyInput {
  text:      string
  title?:    string
  language?: string
  context?:  string             // optional user-provided context
}

export interface ContentVerifyResult extends VerificationResponse {
  ai_probability:           Score
  plagiarism_score:         Score
  academic_integrity_score: Score
  hallucination_risk:       Score
  citations_found:          number
  citations_verified:       number
}

// ── ImageVerify™ ─────────────────────────────────────────────────────────────

export interface ImageVerifyResult extends VerificationResponse {
  ai_probability:       Score
  manipulation_score:   Score
  authenticity_score:   Score
  exif_consistent:      boolean | null
}

// ── WebVerify™ ────────────────────────────────────────────────────────────────

export interface WebVerifyInput {
  url: string
}

export interface WebVerifyResult extends VerificationResponse {
  domain:           string
  ssl_valid:        boolean | null
  domain_age_days:  number | null
  reputation_score: Score
  phishing_score:   Score
}

// ── HumanVerify™ ─────────────────────────────────────────────────────────────

export interface IdentityVerifyInput {
  email?:    string
  username?: string
}

export interface IdentityVerifyResult extends VerificationResponse {
  email_valid:        boolean | null
  email_deliverable:  boolean | null
  social_profiles:    number
  synthetic_id_risk:  Score
}

// ── DocVerify™ ────────────────────────────────────────────────────────────────

export interface DocumentVerifyResult extends VerificationResponse {
  document_type:          string | null
  format_integrity_score: Score
  ai_manipulation_score:  Score
  ocr_confidence:         Score | null
}

// ── Audit ─────────────────────────────────────────────────────────────────────

export interface AuditEventInput {
  actorId:       string
  eventType:     string
  eventCategory: string
  resourceType?: string
  resourceId?:   string
  beforeState?:  Record<string, unknown>
  afterState?:   Record<string, unknown>
  metadata?:     Record<string, unknown>
  actorIp?:      string
  chainId?:      string
}

export interface AuditEventResult {
  event_id:       string
  chain_sequence: number
  event_hash:     string
}

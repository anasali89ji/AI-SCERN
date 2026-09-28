// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Forensic Detection Types (v1.0)
// Shared contract for the 6-Layer Cascading Forensic Detection Pipeline.
// Every layer MUST return types conforming to these interfaces.
// ════════════════════════════════════════════════════════════════════════════

/** 0.0 = definitely human, 1.0 = definitely AI */
export type EvidenceConfidence = number

export type ArtifactStatus = 'anomalous' | 'normal' | 'inconclusive' | 'not_present'

export interface EvidenceNode {
  layer: number
  category: string
  artifactType: string
  status: ArtifactStatus
  confidence: EvidenceConfidence
  detail: string
  region?: { x: number; y: number; width: number; height: number } // normalized 0-1
  rawValue?: number
}

export interface LayerReport {
  layer: number
  layerName: string
  processingTimeMs: number
  status: 'success' | 'failure' | 'timeout'
  evidence: EvidenceNode[]
  /** 0.0 = real, 1.0 = AI */
  layerSuspicionScore: EvidenceConfidence
}

export interface SemanticAgentReport {
  agentName: string
  promptHash: string
  modelUsed: string
  evidence: EvidenceNode[]
  agentSuspicionScore: EvidenceConfidence
  rawResponse: string
}

export interface ProvenanceReport {
  reverseSearchHits: number
  earliestSourceDate?: string
  c2paValid: boolean
  c2paSigner?: string
  synthidDetected: boolean
  synthidConfidence?: number
  exifCameraModel?: string
  exifSoftware?: string
}

export interface CrossValidation {
  agreeingLayers: number[]
  disagreeingLayers: number[]
  keyAgreements: string[]
  keyDisagreements: string[]
}

export interface FinalVerdict {
  label: 'ai-generated' | 'human-created' | 'uncertain'
  confidence: EvidenceConfidence
  explanation: string
  crossValidations: CrossValidation
  uncertaintyFlags: string[]
}

export interface ForensicScanRecord {
  id: string
  createdAt: string
  imageUrl: string
  r2Key: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  layers: LayerReport[]
  semanticAgents: SemanticAgentReport[]
  provenance: ProvenanceReport | null
  finalVerdict: FinalVerdict | null
  existingEnsembleResult?: {
    confidence: number
    label: 'ai' | 'human' | 'uncertain'
  }
  processingTimeMs?: number
}

/** Input for the Inngest cascade event */
export interface ForensicCascadeEventData {
  scanId: string
  imageUrl: string
  r2Key: string
  existingEnsembleResult?: {
    confidence: number
    label: 'ai' | 'human' | 'uncertain'
  }
}

/** Region flagged by a semantic agent for targeted signal analysis */
export interface TargetRegion {
  x: number
  y: number
  width: number
  height: number
  reason: string
}

// ════════════════════════════════════════════════════════════════════════════
// v2.0 Extensions — 9-Agent Image Pipeline + Audio Pipeline Types
// ════════════════════════════════════════════════════════════════════════════

/**
 * Extended SemanticAgentReport — covers base 4 agents + 5 new agents.
 * Extra fields are optional so the v1.0 contract still type-checks.
 */
export interface SemanticAgentReportV2 extends SemanticAgentReport {
  // GENERATOR_FINGERPRINT agent extra fields
  topGeneratorMatch?:    string
  generatorConfidence?:  number
  alternativeMatches?:   Array<{ generator: string; confidence: number }>
  provenanceSignals?: {
    c2paDetected:     boolean
    c2paSigner:       string | null
    synthidLikely:    boolean
    watermarkVisible: boolean
  }
  // SEMANTIC_LOGIC agent extra fields
  textAnomalies?:   string[]
  logicViolations?: string[]
  // GEOMETRIC agent extra fields
  vanishingPointConsistent?: boolean
  shadowsConsistent?:        boolean
  reflectionsAccurate?:      boolean
  // COLOR_SCIENCE agent extra fields
  generatorColorMatch?:   string
  channelBiasDetected?:   boolean
  colorBandingDetected?:  boolean
}

// ── Audio Detection Types ─────────────────────────────────────────────────────

export type AudioVerdict = 'AI_AUDIO' | 'HUMAN_AUDIO' | 'UNCERTAIN'

export interface AudioSignalReport {
  name:        string
  score:       number
  rawValue:    number
  weight:      number
  description: string
}

export interface AudioAgentReport {
  agentName:           string
  agentSuspicionScore: number
  evidence: Array<{
    category:     string
    artifactType: string
    status:       'anomalous' | 'normal' | 'inconclusive'
    confidence:   number
    detail:       string
  }>
  rawResponse: string
}

export interface AudioTemporalResult {
  breathingScore:       number
  prosodyScore:         number
  formantScore:         number
  overallTemporalScore: number
  violations:           string[]
}

export interface AudioFusionResult {
  verdict:              AudioVerdict
  overallScore:         number
  confidence:           number
  confidenceInterval:   [number, number]
  generatorAttribution: string | null
  l1Score:              number
  l2Score:              number
  l3Score:              number
  primaryEvidence:      string[]
  processingTimeMs:     number
  layerScores: {
    signalFingerprint: number
    semanticRAG:       number
    temporalGraph:     number
  }
}

export interface AudioScanRecord {
  id:               string
  createdAt:        string
  fileName:         string
  fileSize:         number
  format:           string
  durationSeconds?: number
  status:           'pending' | 'processing' | 'completed' | 'failed'
  // HF ensemble result (existing pipeline)
  hfVerdict?:       string
  hfConfidence?:    number
  // Forensic pipeline result (new)
  forensic?:        AudioFusionResult | null
  // Blended final verdict
  verdict:          string
  confidence:       number
  processingTimeMs: number
}

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

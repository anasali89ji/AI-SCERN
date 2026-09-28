/**
 * Aiscern Trust Platform — Trust Score Algorithm v1.0
 *
 * Calculates composite Trust Score, Risk Score, and Confidence Score
 * for any verification module. Every score is probability-based (0-100)
 * and never presented as absolute truth. Fully deterministic and versioned.
 *
 * Algorithm version: v1.0
 * Published methodology: aiscern.com/methodology
 */

import type {
  Score,
  TrustScoreResult,
  TrustScoreComponents,
  RiskFactors,
  ScoreInterval,
  EvidenceItem,
} from './types'

// ── Weights (must sum to 1.0 within each group) ───────────────────────────────

const TRUST_WEIGHTS: Record<keyof TrustScoreComponents, number> = {
  authenticity:       0.30,  // Most important: is the content what it claims?
  consistency:        0.20,  // Internal logical and signal consistency
  source_reliability: 0.15,  // How reliable are the sources/domain?
  verification_sigs:  0.15,  // Positive verification signals present
  metadata_quality:   0.10,  // Metadata integrity and completeness
  historical_rep:     0.10,  // Historical reputation of entity/domain
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ALGORITHM_VERSION = 'v1.0'

// Confidence interval half-width: based on evidence count
// More evidence → narrower interval → higher confidence
const CONFIDENCE_HALF_WIDTH = (evidenceCount: number, baseConfidence: Score): number => {
  const width = Math.max(2, 15 - Math.min(evidenceCount, 10))
  return Math.min(width, 100 - baseConfidence, baseConfidence)
}

// ── Core computation ──────────────────────────────────────────────────────────

/**
 * Calculate composite trust score from component scores.
 * Returns an integer 0-100 (weighted average).
 */
export function computeTrustOverall(components: TrustScoreComponents): Score {
  let weighted = 0
  for (const [key, weight] of Object.entries(TRUST_WEIGHTS) as [keyof TrustScoreComponents, number][]) {
    const value = components[key] ?? 50  // default to 50 (neutral) if missing
    weighted += value * weight
  }
  return clampScore(Math.round(weighted))
}

/**
 * Calculate risk score from individual risk factors.
 * Risk is the complement of trust, but weighted by severity.
 * High-severity factors (deepfake, document_fraud) have more weight.
 */
export function computeRiskOverall(factors: RiskFactors): Score {
  if (Object.keys(factors).length === 0) return 0

  // Severity weights for risk factors
  const RISK_FACTOR_WEIGHTS: Record<string, number> = {
    ai_generated:        1.0,
    deepfake:            1.5,  // higher weight — more severe
    manipulation:        1.3,
    document_fraud:      1.5,
    identity_synthetic:  1.2,
    plagiarism:          0.8,
    citation_issues:     0.7,
    source_unreliable:   0.9,
    metadata_anomaly:    0.8,
    domain_suspicious:   1.1,
  }

  let totalWeighted = 0
  let totalWeight   = 0

  for (const [key, value] of Object.entries(factors)) {
    if (value == null) continue
    const w = RISK_FACTOR_WEIGHTS[key] ?? 1.0
    totalWeighted += (value * w)
    totalWeight   += w
  }

  return totalWeight > 0 ? clampScore(Math.round(totalWeighted / totalWeight)) : 0
}

/**
 * Calculate confidence score based on evidence quality and quantity.
 * More evidence items with high individual confidence → higher overall confidence.
 */
export function computeConfidence(evidence: EvidenceItem[]): {
  overall: Score
  interval: ScoreInterval
} {
  if (evidence.length === 0) {
    return { overall: 40, interval: { low: 25, high: 55 } }
  }

  // Weighted average of evidence confidences, with diminishing returns per item
  const sorted = [...evidence].sort((a, b) => b.confidence - a.confidence)
  let weighted = 0
  let divisor  = 0

  sorted.forEach((item, i) => {
    const w = 1 / Math.sqrt(i + 1)  // diminishing returns
    weighted += item.confidence * w
    divisor  += w
  })

  const overall  = clampScore(Math.round(weighted / divisor))
  const halfWidth = CONFIDENCE_HALF_WIDTH(evidence.length, overall)

  return {
    overall,
    interval: {
      low:  clampScore(overall - halfWidth),
      high: clampScore(overall + halfWidth),
    },
  }
}

// ── Convenience builders for each module ─────────────────────────────────────

/**
 * ContentVerify™ — build trust score from text analysis signals
 */
export function buildContentTrustScore(params: {
  aiProbability:     Score   // 0-100 probability of AI generation
  plagiarismScore:   Score   // 0-100 similarity to known sources
  citationScore:     Score   // 0-100 citation quality
  sourceScore:       Score   // 0-100 source reliability
  hallucinationRisk: Score   // 0-100 factual inconsistency risk
  evidence:          EvidenceItem[]
}): TrustScoreResult {
  const { aiProbability, plagiarismScore, citationScore, sourceScore, hallucinationRisk, evidence } = params

  // Map signals → components
  const components: TrustScoreComponents = {
    authenticity:       clampScore(100 - aiProbability),           // low AI prob → high authenticity
    consistency:        clampScore(100 - (hallucinationRisk * 0.7 + plagiarismScore * 0.3)),
    source_reliability: sourceScore,
    verification_sigs:  citationScore,
    metadata_quality:   50,   // text submissions don't have file metadata
    historical_rep:     50,   // no historical rep for ad-hoc text
  }

  const factors: RiskFactors = {
    ai_generated:   aiProbability,
    plagiarism:     plagiarismScore,
    citation_issues: clampScore(100 - citationScore),
    source_unreliable: clampScore(100 - sourceScore),
  }

  return buildTrustScoreResult(components, factors, evidence)
}

/**
 * ImageVerify™ — build trust score from image analysis signals
 */
export function buildImageTrustScore(params: {
  aiProbability:     Score
  manipulationScore: Score
  metadataScore:     Score   // 0-100 metadata integrity
  lightingScore:     Score   // 0-100 physics consistency
  evidence:          EvidenceItem[]
}): TrustScoreResult {
  const { aiProbability, manipulationScore, metadataScore, lightingScore, evidence } = params

  const components: TrustScoreComponents = {
    authenticity:       clampScore(100 - Math.max(aiProbability, manipulationScore)),
    consistency:        clampScore((lightingScore * 0.5 + metadataScore * 0.5)),
    source_reliability: 50,
    verification_sigs:  clampScore(100 - aiProbability * 0.6 - manipulationScore * 0.4),
    metadata_quality:   metadataScore,
    historical_rep:     50,
  }

  const factors: RiskFactors = {
    ai_generated:    aiProbability,
    manipulation:    manipulationScore,
    metadata_anomaly: clampScore(100 - metadataScore),
    deepfake:        clampScore(aiProbability * 0.7 + manipulationScore * 0.3),
  }

  return buildTrustScoreResult(components, factors, evidence)
}

/**
 * WebVerify™ — build trust score from website analysis signals
 */
export function buildWebTrustScore(params: {
  sslScore:          Score   // 100 if valid, 0 if missing/expired
  domainAgeScore:    Score   // 100 if >5yr, 0 if <30days
  reputationScore:   Score   // from reputation APIs
  contentScore:      Score   // content quality score
  phishingRisk:      Score   // 0-100 phishing probability
  evidence:          EvidenceItem[]
}): TrustScoreResult {
  const { sslScore, domainAgeScore, reputationScore, contentScore, phishingRisk, evidence } = params

  const components: TrustScoreComponents = {
    authenticity:       reputationScore,
    consistency:        clampScore((sslScore * 0.4 + contentScore * 0.6)),
    source_reliability: reputationScore,
    verification_sigs:  clampScore((sslScore * 0.3 + domainAgeScore * 0.7)),
    metadata_quality:   sslScore,
    historical_rep:     domainAgeScore,
  }

  const factors: RiskFactors = {
    domain_suspicious:   clampScore(100 - reputationScore),
    source_unreliable:   clampScore(100 - contentScore),
  }
  if (phishingRisk > 30) {
    factors['phishing'] = phishingRisk
  }

  return buildTrustScoreResult(components, factors, evidence)
}

/**
 * DocVerify™ — build trust score from document analysis signals
 */
export function buildDocumentTrustScore(params: {
  formatScore:         Score   // template / format integrity
  aiManipulationScore: Score   // AI-assisted document creation/manipulation
  ocrConfidence:       Score   // OCR extraction quality
  crossRefPassed:      boolean | null
  evidence:            EvidenceItem[]
}): TrustScoreResult {
  const { formatScore, aiManipulationScore, ocrConfidence, crossRefPassed, evidence } = params

  const crossRefScore = crossRefPassed === null ? 50 : crossRefPassed ? 90 : 20

  const components: TrustScoreComponents = {
    authenticity:       clampScore(100 - aiManipulationScore),
    consistency:        formatScore,
    source_reliability: crossRefScore,
    verification_sigs:  clampScore((crossRefScore * 0.5 + formatScore * 0.5)),
    metadata_quality:   ocrConfidence,
    historical_rep:     50,
  }

  const factors: RiskFactors = {
    document_fraud:     aiManipulationScore,
    manipulation:       clampScore(100 - formatScore),
  }

  return buildTrustScoreResult(components, factors, evidence)
}

/**
 * HumanVerify™ — build trust score from identity signals
 */
export function buildIdentityTrustScore(params: {
  emailScore:         Score   // email validity/deliverability
  socialScore:        Score   // social presence consistency
  footprintScore:     Score   // digital footprint age/depth
  syntheticIdRisk:    Score   // synthetic identity probability
  evidence:           EvidenceItem[]
}): TrustScoreResult {
  const { emailScore, socialScore, footprintScore, syntheticIdRisk, evidence } = params

  const components: TrustScoreComponents = {
    authenticity:       clampScore(100 - syntheticIdRisk),
    consistency:        socialScore,
    source_reliability: emailScore,
    verification_sigs:  footprintScore,
    metadata_quality:   emailScore,
    historical_rep:     footprintScore,
  }

  const factors: RiskFactors = {
    identity_synthetic: syntheticIdRisk,
  }

  return buildTrustScoreResult(components, factors, evidence)
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function buildTrustScoreResult(
  components: TrustScoreComponents,
  factors:    RiskFactors,
  evidence:   EvidenceItem[],
): TrustScoreResult {
  const trustOverall      = computeTrustOverall(components)
  const riskOverall       = computeRiskOverall(factors)
  const confidenceResult  = computeConfidence(evidence)

  return {
    trust: {
      overall:    trustOverall,
      components,
    },
    risk: {
      overall: riskOverall,
      factors,
    },
    confidence: confidenceResult,
  }
}

function clampScore(n: number): Score {
  return Math.max(0, Math.min(100, Math.round(n)))
}

// ── Score interpretation ──────────────────────────────────────────────────────

export type TrustLevel = 'high' | 'medium' | 'low' | 'critical'

export function interpretTrustScore(score: Score): {
  level: TrustLevel
  label: string
  description: string
} {
  if (score >= 80) return {
    level: 'high',
    label: 'High Trust',
    description: 'Strong authenticity signals. This content shows high indicators of legitimacy.',
  }
  if (score >= 60) return {
    level: 'medium',
    label: 'Moderate Trust',
    description: 'Mixed signals detected. Some authenticity concerns warrant careful review.',
  }
  if (score >= 35) return {
    level: 'low',
    label: 'Low Trust',
    description: 'Significant authenticity concerns detected. Treat with caution.',
  }
  return {
    level: 'critical',
    label: 'Very Low Trust',
    description: 'Strong indicators of inauthenticity, manipulation, or fraud detected.',
  }
}

export function interpretRiskScore(score: Score): {
  level: TrustLevel
  label: string
  color: string
} {
  if (score >= 70) return { level: 'critical', label: 'Critical Risk', color: 'rose' }
  if (score >= 50) return { level: 'low',      label: 'High Risk',     color: 'orange' }
  if (score >= 30) return { level: 'medium',   label: 'Medium Risk',   color: 'amber' }
  return                  { level: 'high',     label: 'Low Risk',      color: 'emerald' }
}

// Export metadata for reproducibility
export const TRUST_SCORE_METADATA = {
  version:   ALGORITHM_VERSION,
  weights:   TRUST_WEIGHTS,
  published: 'https://aiscern.com/methodology',
}

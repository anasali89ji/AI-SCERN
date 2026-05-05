// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Audio Detection Layer 4: Bayesian Fusion
//
// Combines L1 (signal), L2 (semantic), L3 (temporal) scores into a final
// verdict with confidence intervals and TTS generator attribution.
//
// Architecture:
//   Prior:     0.50 (no prior assumed — balanced starting point)
//   L1 weight: 0.35 (physics-based signals — most reliable)
//   L2 weight: 0.30 (semantic agents — LLM-based)
//   L3 weight: 0.35 (temporal constraints — physiological limits)
//
// Post-processing:
//   - Confidence interval via beta distribution approximation
//   - TTS generator attribution from L1 signal matching
//   - Early abort: if ALL layers agree >0.85, skip remaining layers (done by caller)
// ════════════════════════════════════════════════════════════════════════════

import type { AudioSignal }          from './l1-signal-graph'
import type { AudioAgentReport }     from './l2-semantic-rag'
import type { TemporalGraphResult }  from './l3-temporal-graph'
import { attributeToGenerator }       from './l1-signal-graph'

export type AudioVerdict = 'AI_AUDIO' | 'HUMAN_AUDIO' | 'UNCERTAIN'

export interface AudioFusionResult {
  verdict:              AudioVerdict
  overallScore:         number       // 0.0 = definitively human, 1.0 = definitively AI
  confidence:           number       // how certain we are (0.0–1.0)
  confidenceInterval:   [number, number]  // 95% CI
  generatorAttribution: string | null
  l1Score:              number
  l2Score:              number
  l3Score:              number
  primaryEvidence:      string[]
  processingTimeMs:     number
  layerScores: {
    signalFingerprint:  number
    semanticRAG:        number
    temporalGraph:      number
  }
}

// ── Beta Distribution CI approximation ───────────────────────────────────────
// Approximates 95% CI for a proportion estimate using the Wilson score interval.
// n = effective sample count (number of signals contributing)

function wilsonCI(p: number, n: number): [number, number] {
  if (n <= 0) return [Math.max(0, p - 0.15), Math.min(1, p + 0.15)]
  const z    = 1.96  // 95% CI
  const denom = 1 + z * z / n
  const center = (p + z * z / (2 * n)) / denom
  const spread = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / denom
  return [Math.max(0, center - spread), Math.min(1, center + spread)]
}

// ── Layer weight calibration ──────────────────────────────────────────────────
// If a layer is unavailable (all signals failed), redistribute its weight.

function redistributeWeights(
  l1Available: boolean,
  l2Available: boolean,
  l3Available: boolean,
): { w1: number; w2: number; w3: number } {
  const base = { w1: 0.35, w2: 0.30, w3: 0.35 }
  let { w1, w2, w3 } = base
  let missing = 0

  if (!l1Available) { missing += w1; w1 = 0 }
  if (!l2Available) { missing += w2; w2 = 0 }
  if (!l3Available) { missing += w3; w3 = 0 }

  // Redistribute missing weight proportionally to available layers
  const availableTotal = w1 + w2 + w3
  if (availableTotal > 0 && missing > 0) {
    const scale = 1 + missing / availableTotal
    if (w1 > 0) w1 *= scale
    if (w2 > 0) w2 *= scale
    if (w3 > 0) w3 *= scale
  }

  return { w1, w2, w3 }
}

// ── Confidence calibration ────────────────────────────────────────────────────
// Transforms raw weighted score into calibrated confidence.
// A score of 0.5 maps to low confidence regardless of verdict.
// Extreme scores (near 0 or 1) map to high confidence.

function calibrateConfidence(score: number): number {
  // Map 0.5 → 0.30, 0.0 or 1.0 → 0.95
  const distFromCenter = Math.abs(score - 0.5) * 2   // 0.0 at center, 1.0 at extremes
  return 0.30 + 0.65 * (distFromCenter ** 0.75)
}

// ── Primary evidence extraction ───────────────────────────────────────────────

function extractPrimaryEvidence(
  l1Signals:    AudioSignal[],
  l2Agents:     AudioAgentReport[],
  l3Temporal:   TemporalGraphResult,
): string[] {
  const evidence: string[] = []

  // L1: top 2 anomalous signals
  const anomalousL1 = l1Signals
    .filter(s => s.score > 0.65)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
  for (const s of anomalousL1) {
    evidence.push(`${s.name}: ${(s.score * 100).toFixed(0)}% AI probability (raw=${s.rawValue.toFixed(3)})`)
  }

  // L2: top agent's top anomalous finding
  const topL2Agent = [...l2Agents].sort((a, b) => b.agentSuspicionScore - a.agentSuspicionScore)[0]
  if (topL2Agent?.agentSuspicionScore > 0.6) {
    const topFinding = topL2Agent.evidence
      .filter(e => e.status === 'anomalous')
      .sort((a, b) => b.confidence - a.confidence)[0]
    if (topFinding) evidence.push(`${topL2Agent.agentName}: ${topFinding.detail}`)
  }

  // L3: temporal violations
  for (const v of l3Temporal.violations.slice(0, 2)) {
    evidence.push(v)
  }

  return evidence.slice(0, 6)
}

// ── Main L4 Fusion ────────────────────────────────────────────────────────────

export function runAudioFusion(params: {
  l1Signals:      AudioSignal[]
  l1Score:        number
  l2Agents:       AudioAgentReport[]
  l2Score:        number
  l3Temporal:     TemporalGraphResult
  startTimeMs:    number
}): AudioFusionResult {
  const { l1Signals, l1Score, l2Agents, l2Score, l3Temporal, startTimeMs } = params

  const l3Score = l3Temporal.overallTemporalScore

  const l1Available = l1Signals.some(s => s.rawValue > 0)
  const l2Available = l2Agents.some(a => a.agentSuspicionScore !== 0.5)
  const l3Available = l3Temporal.violations !== undefined

  const { w1, w2, w3 } = redistributeWeights(l1Available, l2Available, l3Available)

  // Bayesian fusion: Naive Bayes combination starting from prior 0.5
  const prior = 0.5
  const bayesianScore = (w1 * l1Score + w2 * l2Score + w3 * l3Score)

  // Weighted combination with prior dampening
  const overallScore = 0.15 * prior + 0.85 * bayesianScore

  // Effective sample count for CI (sum of agent counts)
  const effectiveN = l1Signals.filter(s => s.rawValue > 0).length
                   + l2Agents.filter(a => a.agentSuspicionScore !== 0.5).length
                   + (l3Available ? 3 : 0)

  const confidence         = calibrateConfidence(overallScore)
  const confidenceInterval = wilsonCI(overallScore, effectiveN)

  // Verdict thresholds
  const verdict: AudioVerdict =
    overallScore > 0.65  ? 'AI_AUDIO'
    : overallScore < 0.35 ? 'HUMAN_AUDIO'
    : 'UNCERTAIN'

  // Generator attribution from L1 signals
  const generatorAttribution = l1Available ? attributeToGenerator(l1Signals) : null

  const primaryEvidence = extractPrimaryEvidence(l1Signals, l2Agents, l3Temporal)

  return {
    verdict,
    overallScore:         Math.min(Math.max(overallScore, 0), 1),
    confidence:           Math.min(Math.max(confidence, 0), 1),
    confidenceInterval,
    generatorAttribution,
    l1Score,
    l2Score,
    l3Score,
    primaryEvidence,
    processingTimeMs:     Date.now() - startTimeMs,
    layerScores: {
      signalFingerprint: l1Score,
      semanticRAG:       l2Score,
      temporalGraph:     l3Score,
    },
  }
}

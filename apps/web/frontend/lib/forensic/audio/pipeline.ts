// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Audio Detection Pipeline Orchestrator
//
// Ties together L1 (signal), L2 (semantic), L3 (temporal), L4 (fusion).
// Entry point: analyzeAudio(audioBuffer, transcription, precomputedFeatures?)
//
// Cost control: AUDIO_CREDITS_PER_SCAN = 2
// Max duration: AUDIO_MAX_DURATION_SECONDS = 120
// ════════════════════════════════════════════════════════════════════════════

import { extractAudioSignals, aggregateL1Score, type PrecomputedAudioFeatures } from './l1-signal-graph'
import { runAudioSemanticRAG }  from './l2-semantic-rag'
import { analyzeTemporalGraph } from './l3-temporal-graph'
import { runAudioFusion }        from './l4-fusion'
import type { AudioFusionResult } from './l4-fusion'
import { AUDIO_MAX_DURATION_SECONDS } from '@/lib/forensic/constants'

export type { AudioFusionResult }

export interface AudioAnalysisInput {
  transcription:      string
  durationSeconds:    number
  precomputedFeatures?: PrecomputedAudioFeatures
  // Temporal track arrays — provided by signal-worker Python service or
  // Cloudflare cf-pipeline Worker when available
  temporalTracks?: {
    energyEnvelope: number[]
    pitchTrack:     number[]
    energyTrack:    number[]
    rateTrack:      number[]
    formantTracks:  { f1: number[]; f2: number[]; f3: number[] }
    frameRateMs:    number
  }
}

export async function analyzeAudio(input: AudioAnalysisInput): Promise<AudioFusionResult> {
  const startTimeMs = Date.now()

  // Duration guard
  if (input.durationSeconds > AUDIO_MAX_DURATION_SECONDS) {
    throw new Error(
      `Audio duration ${input.durationSeconds}s exceeds maximum of ${AUDIO_MAX_DURATION_SECONDS}s`
    )
  }

  // ── L1: Signal fingerprint ─────────────────────────────────────────────────
  const l1Signals = await extractAudioSignals(input.precomputedFeatures ?? {})
  const l1Score   = aggregateL1Score(l1Signals)

  // ── L2: Semantic RAG (4 LLM agents) ───────────────────────────────────────
  const { agents: l2Agents, l2Score } = await runAudioSemanticRAG(
    input.transcription,
    l1Signals.map(s => ({ name: s.name, score: s.score, rawValue: s.rawValue })),
  )

  // ── L3: Temporal causal graph ──────────────────────────────────────────────
  // Use provided temporal tracks; fall back to dummy arrays (returns score 0.5)
  let l3Temporal = {
    breathingScore:       0.5,
    prosodyScore:         0.5,
    formantScore:         0.5,
    overallTemporalScore: 0.5,
    violations:           [] as string[],
  }
  if (input.temporalTracks) {
    l3Temporal = analyzeTemporalGraph(
      input.temporalTracks.energyEnvelope,
      input.temporalTracks.pitchTrack,
      input.temporalTracks.energyTrack,
      input.temporalTracks.rateTrack,
      input.temporalTracks.formantTracks,
      input.temporalTracks.frameRateMs,
    )
  }

  // ── L4: Bayesian fusion ────────────────────────────────────────────────────
  const fusionResult = runAudioFusion({ l1Signals, l1Score, l2Agents, l2Score, l3Temporal, startTimeMs })

  return fusionResult
}

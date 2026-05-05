// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Audio Detection Layer 3: Temporal Causal Graph
//
// Models temporal structure of speech for physiological constraint checking.
//
// Components:
//   1. Breathing Pattern State Machine (BPSM) — physiological transitions
//   2. Prosody Transition Graph (PTG)          — Zipfian vs uniform distribution
//   3. Formant Trajectory Bayesian Network     — formant physics constraints
// ════════════════════════════════════════════════════════════════════════════

// ── Breathing Pattern State Machine ──────────────────────────────────────────

type BreathState = 'INHALE' | 'EXHALE' | 'SPEAK' | 'PAUSE'

interface BPSMTransition {
  from:                    BreathState
  to:                      BreathState
  minDurationMs:           number
  maxDurationMs:           number
  isPhysiologicallyValid:  boolean
}

const PHYSIOLOGICAL_TRANSITIONS: BPSMTransition[] = [
  // Valid transitions
  { from: 'PAUSE',  to: 'INHALE', minDurationMs: 100,   maxDurationMs: 2000,    isPhysiologicallyValid: true },
  { from: 'INHALE', to: 'SPEAK',  minDurationMs: 300,   maxDurationMs: 2500,    isPhysiologicallyValid: true },
  { from: 'SPEAK',  to: 'EXHALE', minDurationMs: 500,   maxDurationMs: 8000,    isPhysiologicallyValid: true },
  { from: 'EXHALE', to: 'PAUSE',  minDurationMs: 100,   maxDurationMs: 1500,    isPhysiologicallyValid: true },
  // Impossible transitions (TTS violations)
  { from: 'SPEAK',  to: 'SPEAK',  minDurationMs: 15000, maxDurationMs: 9999999, isPhysiologicallyValid: false }, // >15s without breath
  { from: 'PAUSE',  to: 'SPEAK',  minDurationMs: 0,     maxDurationMs: 50,      isPhysiologicallyValid: false }, // instantaneous speech start
]

interface BPSMResult {
  violations:   string[]
  score:        number   // 0=real, 1=AI
  breathCount:  number
}

export function runBreathingStateMachine(
  energyEnvelope: number[],
  frameRateMs:    number = 10,
): BPSMResult {
  const violations: string[] = []
  let currentState: BreathState = 'PAUSE'
  let stateDurationMs = 0
  const threshold = Math.max(...energyEnvelope) * 0.05

  let continuousSpeakMs = 0

  for (let i = 0; i < energyEnvelope.length; i++) {
    const isSpeaking  = energyEnvelope[i] > threshold
    const nextState: BreathState = isSpeaking ? 'SPEAK' : 'PAUSE'

    if (nextState !== currentState) {
      // State transition — check physiological validity
      const transition = PHYSIOLOGICAL_TRANSITIONS.find(
        t => t.from === currentState && t.to === nextState
      )

      if (transition && !transition.isPhysiologicallyValid) {
        violations.push(
          `Invalid transition ${currentState}→${nextState} after ${stateDurationMs}ms`
        )
      }

      if (currentState === 'SPEAK') {
        continuousSpeakMs = 0
      }

      currentState    = nextState
      stateDurationMs = 0
    } else {
      stateDurationMs += frameRateMs

      // Check if speaking too long without a breath
      if (currentState === 'SPEAK') {
        continuousSpeakMs += frameRateMs
        if (continuousSpeakMs > 15000) {
          violations.push(`Continuous speech for ${(continuousSpeakMs / 1000).toFixed(1)}s without breath — physiologically impossible`)
          continuousSpeakMs = 0  // reset to avoid duplicate violations
        }
      }
    }
  }

  // Score: violations → AI; no violations → real
  const score = violations.length === 0
    ? 0.15                                      // no violations: likely real
    : Math.min(0.9, 0.40 + violations.length * 0.15)

  return { violations, score, breathCount: 0 }
}

// ── Prosody Transition Graph ──────────────────────────────────────────────────
// Real speech follows Zipfian distribution across prosodic state transitions.
// TTS shows near-uniform distribution (entropy too high).

interface ProsodyStateKey {
  pitchRange:   'low' | 'mid' | 'high'
  energyLevel:  'quiet' | 'normal' | 'loud'
  rate:         'slow' | 'normal' | 'fast'
}

function quantizeProsodyState(
  pitch:  number,
  energy: number,
  rate:   number,
  pitchMean:  number,
  pitchStd:   number,
  energyMean: number,
  energyStd:  number,
  rateMean:   number,
  rateStd:    number,
): string {
  const pr = pitch  < pitchMean  - pitchStd  ? 'low'    : pitch  > pitchMean  + pitchStd  ? 'high'   : 'mid'
  const el = energy < energyMean - energyStd ? 'quiet'  : energy > energyMean + energyStd ? 'loud'   : 'normal'
  const rr = rate   < rateMean   - rateStd   ? 'slow'   : rate   > rateMean   + rateStd   ? 'fast'   : 'normal'
  return `${pr}_${el}_${rr}`
}

function calcTransitionEntropy(transitions: Map<string, number>): number {
  const total = Array.from(transitions.values()).reduce((a, b) => a + b, 0)
  let entropy = 0
  for (const count of transitions.values()) {
    const p = count / total
    if (p > 0) entropy -= p * Math.log2(p)
  }
  return entropy
  // Real speech: entropy 2.5–4.0 bits (Zipfian, dominated by few transitions)
  // TTS: entropy 5.0–6.5 bits (near-uniform distribution)
}

interface PTGResult {
  transitionEntropy: number
  score:             number  // 0=real, 1=AI
  distributionType:  'zipfian' | 'uniform' | 'insufficient_data'
}

export function runProsodyTransitionGraph(
  pitchTrack:  number[],
  energyTrack: number[],
  rateTrack:   number[],
): PTGResult {
  if (pitchTrack.length < 10) {
    return { transitionEntropy: 0, score: 0.5, distributionType: 'insufficient_data' }
  }

  // Compute mean/std for quantization
  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  const std  = (arr: number[], m: number) =>
    Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length)

  const pM = mean(pitchTrack);  const pS = std(pitchTrack, pM)
  const eM = mean(energyTrack); const eS = std(energyTrack, eM)
  const rM = mean(rateTrack);   const rS = std(rateTrack, rM)

  // Build transition counts
  const transitions = new Map<string, number>()
  let prevState: string | null = null

  for (let i = 0; i < pitchTrack.length; i++) {
    const state = quantizeProsodyState(
      pitchTrack[i], energyTrack[i], rateTrack[i],
      pM, pS, eM, eS, rM, rS
    )
    if (prevState !== null) {
      const key = `${prevState}->${state}`
      transitions.set(key, (transitions.get(key) || 0) + 1)
    }
    prevState = state
  }

  const entropy = calcTransitionEntropy(transitions)
  // Real speech: 2.5–4.0; TTS: 5.0–6.5
  const score = entropy < 2.5 ? 0.15
              : entropy < 4.0 ? 0.30
              : entropy < 5.0 ? 0.55
              : entropy < 6.0 ? 0.75
              : 0.88

  const distributionType = entropy < 4.0 ? 'zipfian' : 'uniform'

  return { transitionEntropy: entropy, score, distributionType }
}

// ── Formant Trajectory Bayesian Network ──────────────────────────────────────
// Checks that formant transitions obey vocal tract physics.

interface FormantResult {
  violations: string[]
  score:      number
}

export function analyzeFormantTrajectory(
  f1Track: number[],
  f2Track: number[],
  f3Track: number[],
  frameRateMs: number = 10,
): FormantResult {
  const violations: string[] = []

  // Maximum physiological formant transition rate: ~300 Hz per 10ms frame
  const MAX_RATE_HZ = 300

  for (let i = 1; i < f1Track.length; i++) {
    const df1 = Math.abs(f1Track[i] - f1Track[i - 1])
    const df2 = Math.abs(f2Track[i] - f2Track[i - 1])
    const df3 = Math.abs(f3Track[i] - f3Track[i - 1])

    if (df1 > MAX_RATE_HZ) violations.push(`F1 transition ${df1.toFixed(0)}Hz at frame ${i} exceeds physiological limit (300Hz/10ms)`)
    if (df2 > MAX_RATE_HZ) violations.push(`F2 transition ${df2.toFixed(0)}Hz at frame ${i} exceeds physiological limit`)
    if (df3 > MAX_RATE_HZ * 1.5) violations.push(`F3 transition ${df3.toFixed(0)}Hz at frame ${i} exceeds physiological limit`)
  }

  // F1/F2 correlation: in natural speech F1 and F2 are anticorrelated during vowel transitions
  let anticorrelationViolations = 0
  for (let i = 1; i < f1Track.length - 1; i++) {
    const df1 = f1Track[i] - f1Track[i - 1]
    const df2 = f2Track[i] - f2Track[i - 1]
    // When F1 rises, F2 tends to fall in real speech (not always, but statistically)
    if (Math.abs(df1) > 50 && Math.abs(df2) > 50 && Math.sign(df1) === Math.sign(df2)) {
      anticorrelationViolations++
    }
  }
  if (anticorrelationViolations > f1Track.length * 0.35) {
    violations.push(`F1/F2 anticorrelation violated ${anticorrelationViolations} times — suggests TTS phoneme-independent synthesis`)
  }

  const score = violations.length === 0 ? 0.15
              : Math.min(0.90, 0.35 + violations.length * 0.10)

  return { violations, score }
}

// ── Main Layer 3 Entry Point ──────────────────────────────────────────────────

export interface TemporalGraphResult {
  breathingScore:       number   // 0=real, 1=AI
  prosodyScore:         number
  formantScore:         number
  overallTemporalScore: number
  violations:           string[]
}

export function analyzeTemporalGraph(
  energyEnvelope: number[],
  pitchTrack:     number[],
  energyTrack:    number[],
  rateTrack:      number[],
  formantTracks:  { f1: number[]; f2: number[]; f3: number[] },
  frameRateMs:    number = 10,
): TemporalGraphResult {
  const bpsm    = runBreathingStateMachine(energyEnvelope, frameRateMs)
  const ptg     = runProsodyTransitionGraph(pitchTrack, energyTrack, rateTrack)
  const formant = analyzeFormantTrajectory(
    formantTracks.f1, formantTracks.f2, formantTracks.f3, frameRateMs
  )

  const allViolations = [
    ...bpsm.violations.map(v => `[BREATHING] ${v}`),
    ...ptg.distributionType === 'uniform' ? [`[PROSODY] Near-uniform prosody transition distribution (entropy=${ptg.transitionEntropy.toFixed(2)}) — consistent with TTS`] : [],
    ...formant.violations.map(v => `[FORMANT] ${v}`),
  ]

  // Weighted combination: breathing 40%, prosody 35%, formant 25%
  const overallTemporalScore =
    0.40 * bpsm.score +
    0.35 * ptg.score  +
    0.25 * formant.score

  return {
    breathingScore:       bpsm.score,
    prosodyScore:         ptg.score,
    formantScore:         formant.score,
    overallTemporalScore: Math.min(Math.max(overallTemporalScore, 0), 1),
    violations:           allViolations,
  }
}

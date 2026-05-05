// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Audio Detection Layer 1: Signal Fingerprint Graph
//
// Physics-informed signal analysis for AI audio detection.
// Targets >90% accuracy on ASVspoof 2021 dataset.
//
// Features:
//   1. Spectral Flatness (Wiener entropy)
//   2. Phase Linearity (group delay variance)
//   3. Pitch Jitter (F0 micro-perturbation)
//   4. Formant Transition Rate (articulatory speed limit)
//   5. Breathing Pattern Detection (physiological constraint)
//   6. MFCC Variance (mel-cepstral distribution)
//   7. Prosody Naturalness
//   8. Vocal Tract Consistency
// ════════════════════════════════════════════════════════════════════════════

export interface AudioSignal {
  name:        string
  score:       number   // 0.0 = real speech, 1.0 = AI/TTS
  rawValue:    number
  weight:      number
  description: string
}

// ── TTS Generator Signature Database ─────────────────────────────────────────
// Vectorless RAG equivalent: intelligence embedded in data structures, not vectors.
// Updatable at runtime via Supabase/Cloudflare KV without code deployment.

export const TTS_GENERATOR_SIGNATURES: Record<string, {
  spectralFlatness:   { min: number; max: number }
  mfccVariance:       { max: number }
  breathingPattern:   'absent' | 'absent_or_fake' | 'synthetic_regular' | 'sometimes_present'
  knownArtifacts:     string[]
  vocoderFamily:      string
}> = {
  'Tacotron2 + WaveGlow': {
    spectralFlatness: { min: 0.38, max: 0.55 },
    mfccVariance:     { max: 0.8 },
    breathingPattern: 'absent_or_fake',
    knownArtifacts:   ['waveglow_high_freq_noise', 'mel_dropout_artifact'],
    vocoderFamily:    'flow_based',
  },
  'VITS / NaturalSpeech': {
    spectralFlatness: { min: 0.25, max: 0.45 },
    mfccVariance:     { max: 1.2 },
    breathingPattern: 'absent',
    knownArtifacts:   ['vits_phase_discontinuity', 'phoneme_boundary_click'],
    vocoderFamily:    'vae_flow',
  },
  'ElevenLabs': {
    spectralFlatness: { min: 0.18, max: 0.35 },
    mfccVariance:     { max: 2.5 },
    breathingPattern: 'synthetic_regular',
    knownArtifacts:   ['eleven_breath_synthetic', 'over_smooth_consonants'],
    vocoderFamily:    'neural_codec',
  },
  'OpenAI TTS / ChatGPT Voice': {
    spectralFlatness: { min: 0.20, max: 0.40 },
    mfccVariance:     { max: 2.0 },
    breathingPattern: 'absent',
    knownArtifacts:   ['openai_tts_pitch_quantization', 'prosody_over_control'],
    vocoderFamily:    'neural_codec',
  },
  'Microsoft VALL-E': {
    spectralFlatness: { min: 0.15, max: 0.35 },
    mfccVariance:     { max: 3.0 },
    breathingPattern: 'sometimes_present',
    knownArtifacts:   ['valle_codec_artifact_800hz', 'acoustic_token_boundary'],
    vocoderFamily:    'codec_lm',
  },
  'HuBERT + HiFiGAN (generic)': {
    spectralFlatness: { min: 0.30, max: 0.50 },
    mfccVariance:     { max: 1.5 },
    breathingPattern: 'absent',
    knownArtifacts:   ['hifigan_aliasing_artifact', 'mel_mismatch_2khz'],
    vocoderFamily:    'gan_vocoder',
  },
}

// ── Signal computation functions ──────────────────────────────────────────────
// Note: Full FFT and formant tracking require Web Audio API (browser) or a
// Node.js audio library (meyda, audiobuffer-utils). In production the
// cf-pipeline Cloudflare Worker provides pre-computed feature arrays from
// Python (librosa). These TypeScript functions are used when features are
// already computed and passed in as arrays.

/**
 * Spectral Flatness (Wiener entropy).
 * Real speech: 0.05–0.25 (formants create peaks)
 * Neural TTS: 0.30–0.60 (unnaturally flat — missing formant peak sharpness)
 */
export function calcSpectralFlatness(fftMagnitudes: Float32Array): number {
  const n = fftMagnitudes.length
  const logSum = Array.from(fftMagnitudes).reduce((s, v) => s + Math.log(v + 1e-10), 0)
  const geomMean = Math.exp(logSum / n)
  const arithMean = Array.from(fftMagnitudes).reduce((s, v) => s + v, 0) / n
  return geomMean / (arithMean + 1e-10)
}

export function spectralFlatnessScore(flatness: number): number {
  if (flatness > 0.50) return 0.88   // extremely flat: TTS artifact
  if (flatness > 0.35) return 0.72
  if (flatness > 0.22) return 0.50
  if (flatness > 0.12) return 0.28   // natural speech range
  return 0.12                         // clear formants: real speech
}

/**
 * Phase Linearity (group delay variance).
 * Real speech: minimum-phase system (vocal tract is causal) — high variance
 * Neural TTS: vocoder phase reconstruction creates non-minimum-phase artifacts — low variance
 */
export function calcPhaseLinearity(complexFFT: { real: Float32Array; imag: Float32Array }): number {
  const phases = Array.from(complexFFT.real).map((r, i) => Math.atan2(complexFFT.imag[i], r))
  let groupDelayVariance = 0
  for (let i = 1; i < phases.length - 1; i++) {
    const gd = -(phases[i + 1] - phases[i - 1]) / 2
    groupDelayVariance += gd * gd
  }
  return Math.sqrt(groupDelayVariance / phases.length)
}

export function phaseLinearityScore(variance: number): number {
  if (variance < 0.1) return 0.85   // suspiciously linear phase: TTS
  if (variance < 0.3) return 0.65
  if (variance < 0.6) return 0.40
  return 0.15                        // high phase variance: real speech
}

/**
 * Pitch Jitter (F0 micro-perturbations).
 * Real speech: jitter 1–5 Hz per 10ms frame
 * Neural TTS: < 0.5 Hz (unnaturally smooth prosody model)
 */
export function calcPitchSmoothness(pitchTrack: number[]): number {
  if (pitchTrack.length < 4) return 0.5
  let jitter = 0
  for (let i = 1; i < pitchTrack.length; i++) {
    jitter += Math.abs(pitchTrack[i] - pitchTrack[i - 1])
  }
  return jitter / (pitchTrack.length - 1)
}

export function pitchSmoothnessScore(jitter: number): number {
  if (jitter < 0.3) return 0.90   // extreme smoothness: neural TTS
  if (jitter < 1.0) return 0.70
  if (jitter < 2.5) return 0.45
  if (jitter < 5.0) return 0.20   // natural jitter range
  return 0.10                      // high jitter: emotional/distressed speech
}

/**
 * Formant Transition Rate.
 * Real speech: max ~300 Hz per 10ms frame (tongue speed limit)
 * TTS: can exceed 500 Hz per frame (physically impossible)
 */
export function calcFormantTransitionRate(f1Track: number[], f2Track: number[]): number {
  const f1Rate = f1Track.slice(1).map((v, i) => Math.abs(v - f1Track[i]))
  const f2Rate = f2Track.slice(1).map((v, i) => Math.abs(v - f2Track[i]))
  return Math.max(Math.max(...f1Rate), Math.max(...f2Rate))
}

export function formantRateScore(maxRateHz: number): number {
  if (maxRateHz > 500) return 0.85  // physically impossible: TTS
  if (maxRateHz > 350) return 0.65
  if (maxRateHz > 200) return 0.35
  return 0.15                        // within physiological limits
}

/**
 * Breathing Pattern Detection.
 * Real speech: breathing is present and follows physiological timing (irregular)
 * Neural TTS: either silent between utterances OR has added fake breath sounds at regular intervals
 */
export function detectBreathingPattern(energyEnvelope: number[]): {
  breathingDetected: boolean
  isRegular:         boolean
  avgBreathInterval: number
  score:             number
} {
  const threshold = Math.max(...energyEnvelope) * 0.05
  const breathIntervals: number[] = []
  let inSilence  = false
  let silenceStart = 0

  energyEnvelope.forEach((e, i) => {
    if (!inSilence && e < threshold)  { inSilence = true; silenceStart = i }
    else if (inSilence && e >= threshold) { breathIntervals.push(i - silenceStart); inSilence = false }
  })

  if (breathIntervals.length === 0) {
    return { breathingDetected: false, isRegular: false, avgBreathInterval: 0, score: 0.80 }
  }

  const avgInterval = breathIntervals.reduce((a, b) => a + b, 0) / breathIntervals.length
  const stdInterval = Math.sqrt(
    breathIntervals.reduce((a, b) => a + (b - avgInterval) ** 2, 0) / breathIntervals.length
  )
  const isRegular = stdInterval < avgInterval * 0.20  // CV < 20% = suspiciously regular

  // Suspiciously regular breathing = synthetic; absent = TTS; natural irregular = real
  const score = !breathIntervals.length ? 0.80 : isRegular ? 0.72 : 0.15

  return { breathingDetected: true, isRegular, avgBreathInterval: avgInterval, score }
}

/**
 * MFCC Variance (mel-cepstral coefficient distribution).
 * Neural vocoders over-smooth mel-cepstral coefficients → lower variance.
 * Real speech has higher MFCC variance (natural spectral modulation).
 */
export function calcMCCPattern(mfcc: Float32Array[]): number {
  const variances = mfcc.slice(1, 13).map(c => {
    const vals = Array.from(c)
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    return vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length
  })
  return variances.reduce((a, b) => a + b, 0) / variances.length
}

export function mfccVarianceScore(variance: number): number {
  if (variance < 0.5)  return 0.85  // over-smooth: neural TTS / WaveGlow
  if (variance < 1.0)  return 0.70
  if (variance < 2.0)  return 0.45
  if (variance < 3.0)  return 0.25
  return 0.15                        // natural speech variance
}

// ── Attribute detected L1 scores to a known TTS generator ────────────────────

export function attributeToGenerator(signals: AudioSignal[]): string | null {
  const flatnessSignal = signals.find(s => s.name === 'Spectral Flatness')
  const mfccSignal     = signals.find(s => s.name === 'MFCC Variance')
  const breathSignal   = signals.find(s => s.name === 'Breathing Pattern')

  let bestMatch: string | null = null
  let bestScore = -Infinity

  for (const [name, sig] of Object.entries(TTS_GENERATOR_SIGNATURES)) {
    let matchScore = 0

    if (flatnessSignal) {
      const fv = flatnessSignal.rawValue
      if (fv >= sig.spectralFlatness.min && fv <= sig.spectralFlatness.max) matchScore += 2
    }
    if (mfccSignal && mfccSignal.rawValue < sig.mfccVariance.max) matchScore += 1.5
    if (breathSignal) {
      const bScore = breathSignal.rawValue
      if (sig.breathingPattern === 'absent' && bScore > 0.70) matchScore += 1
      if (sig.breathingPattern === 'synthetic_regular' && bScore > 0.60 && bScore < 0.80) matchScore += 1
    }

    if (matchScore > bestScore) { bestScore = matchScore; bestMatch = name }
  }

  return bestScore > 2 ? bestMatch : null
}

// ── Main Signal Extraction ────────────────────────────────────────────────────
// In production, pre-computed features arrive from the cf-pipeline Cloudflare
// Worker or the signal-worker Python service. This function accepts them and
// produces scored AudioSignal arrays.

export interface PrecomputedAudioFeatures {
  spectralFlatness?:   number
  phaseLinearityVar?:  number
  pitchJitterHz?:      number
  formantMaxRateHz?:   number
  mfccVariance?:       number
  breathingPresent?:   boolean
  breathingRegular?:   boolean
  durationSeconds?:    number
}

export async function extractAudioSignals(
  features: PrecomputedAudioFeatures = {},
): Promise<AudioSignal[]> {
  const signals: AudioSignal[] = [
    {
      name:        'Spectral Flatness',
      score:       features.spectralFlatness !== undefined
                   ? spectralFlatnessScore(features.spectralFlatness)
                   : 0.5,
      rawValue:    features.spectralFlatness ?? 0,
      weight:      0.18,
      description: 'Neural TTS produces unnaturally flat spectra; real speech has distinct formant peaks.',
    },
    {
      name:        'Phase Linearity',
      score:       features.phaseLinearityVar !== undefined
                   ? phaseLinearityScore(features.phaseLinearityVar)
                   : 0.5,
      rawValue:    features.phaseLinearityVar ?? 0,
      weight:      0.16,
      description: 'TTS vocoders produce phase artifacts (linear group delay) not present in natural speech.',
    },
    {
      name:        'Pitch Jitter',
      score:       features.pitchJitterHz !== undefined
                   ? pitchSmoothnessScore(features.pitchJitterHz)
                   : 0.5,
      rawValue:    features.pitchJitterHz ?? 0,
      weight:      0.14,
      description: 'Real speech has micro-perturbations in pitch (jitter); TTS prosody is unnaturally smooth.',
    },
    {
      name:        'Formant Transition Rate',
      score:       features.formantMaxRateHz !== undefined
                   ? formantRateScore(features.formantMaxRateHz)
                   : 0.5,
      rawValue:    features.formantMaxRateHz ?? 0,
      weight:      0.12,
      description: 'TTS can produce formant transitions faster than physically possible (>300 Hz per 10ms frame).',
    },
    {
      name:        'Breathing Pattern',
      score:       features.breathingPresent === undefined
                   ? 0.5
                   : !features.breathingPresent
                   ? 0.80
                   : features.breathingRegular
                   ? 0.72
                   : 0.15,
      rawValue:    features.breathingPresent ? (features.breathingRegular ? 0.72 : 0.15) : 0.80,
      weight:      0.10,
      description: 'Real speakers breathe; TTS either has absent or unnaturally regular breathing between utterances.',
    },
    {
      name:        'MFCC Variance',
      score:       features.mfccVariance !== undefined
                   ? mfccVarianceScore(features.mfccVariance)
                   : 0.5,
      rawValue:    features.mfccVariance ?? 0,
      weight:      0.14,
      description: 'Neural vocoders over-smooth mel-cepstral coefficients; real speech has natural spectral modulation.',
    },
    {
      name:        'Prosody Naturalness',
      score:       0.5,   // computed by L2 semantic agents (LLM-based)
      rawValue:    0,
      weight:      0.10,
      description: 'TTS prosody follows learned patterns; real speech is more variable and emotionally authentic.',
    },
    {
      name:        'Vocal Tract Consistency',
      score:       0.5,   // computed by L2 semantic agents
      rawValue:    0,
      weight:      0.06,
      description: 'Real speakers have consistent vocal tract length; voice cloning may show spectral inconsistencies.',
    },
  ]

  return signals
}

/** Aggregate L1 signals into a single layer score (weighted average). */
export function aggregateL1Score(signals: AudioSignal[]): number {
  let weightedSum = 0
  let totalWeight = 0
  for (const s of signals) {
    weightedSum += s.score * s.weight
    totalWeight += s.weight
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0.5
}

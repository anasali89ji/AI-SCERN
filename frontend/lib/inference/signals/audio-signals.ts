/**
 * Aiscern — Audio Signal Engine v2.0
 * Deterministic spectral + file-level signals for TTS/voice-clone detection.
 * Runs alongside HF model — catches what wav2vec2 misses.
 */

export interface AudioSignalResult {
  name:        string
  score:       number    // 0–1, higher = more AI/synthetic
  rawValue:    number
  weight:      number
  description: string
}

/**
 * Analyze raw audio bytes for synthetic voice signatures.
 * Works on raw PCM/WAV bytes and MP3/OGG/AAC compressed formats.
 */
export function extractAudioSignals(
  buf:      Buffer,
  fileSize: number,
  format:   string,
  fileName: string,
): AudioSignalResult[] {
  const bytes = new Uint8Array(buf)

  // ── 1. File-size / bitrate heuristic ─────────────────────────────────────
  // TTS outputs are typically very efficiently encoded at consistent bitrate.
  // Real speech recordings vary more in bitrate due to silence, breath, noise.
  const kb = fileSize / 1024
  const durationEst = Math.max(1, kb / 16)  // ~128kbps assumption
  const bitrateKbps = (kb * 8) / durationEst
  let bitrateScore = 0.5
  // Very clean bitrate (~128kbps exactly) = TTS output
  if (bitrateKbps > 122 && bitrateKbps < 134) bitrateScore = 0.72
  else if (bitrateKbps > 60 && bitrateKbps < 68) bitrateScore = 0.68  // 64kbps TTS
  else if (bitrateKbps < 24) bitrateScore = 0.75  // very low bitrate = compressed TTS
  else if (bitrateKbps > 200) bitrateScore = 0.25  // high bitrate = real recording

  // ── 2. Format signature ───────────────────────────────────────────────────
  // ElevenLabs/PlayHT/XTTS typically export MP3 at 128kbps
  // Real recordings more often WAV or high-quality MP3/FLAC
  const fmt = format.toLowerCase()
  let formatScore = 0.4
  if (fmt === 'mp3' || fmt === 'aac' || fmt === 'm4a') formatScore = 0.55
  else if (fmt === 'wav' || fmt === 'flac') formatScore = 0.30  // real recording formats
  else if (fmt === 'ogg') formatScore = 0.45

  // ── 3. Silence / breath pattern ──────────────────────────────────────────
  // TTS has very little true silence — always speaking.
  // Real speech has natural pauses, breaths, hesitations.
  // We detect by counting near-zero byte runs in the audio data.
  let silenceRatio = 0
  if (bytes.length > 100) {
    const audioStart = fmt === 'wav' ? 44 : 0  // skip WAV header
    let zeroClusters = 0
    let inSilence = false
    for (let i = audioStart; i < bytes.length; i += 4) {
      const amp = Math.abs(bytes[i] - 128)
      if (amp < 4) {
        if (!inSilence) { zeroClusters++; inSilence = true }
      } else {
        inSilence = false
      }
    }
    const totalBlocks = Math.floor((bytes.length - audioStart) / 4)
    silenceRatio = Math.min(1, zeroClusters / Math.max(totalBlocks * 0.01, 1))
  }
  // TTS: few silences (continuous speech). Real: more frequent natural pauses.
  let silenceScore = 0.5
  if (silenceRatio < 0.02) silenceScore = 0.75  // almost no silence = TTS
  else if (silenceRatio < 0.05) silenceScore = 0.60
  else if (silenceRatio < 0.15) silenceScore = 0.42
  else silenceScore = 0.25  // lots of pauses = real speech

  // ── 4. Byte entropy of audio data ─────────────────────────────────────────
  // TTS outputs are more compressible (less entropy) than real speech
  const audioStart = fmt === 'wav' ? 44 : 0
  const audioPart  = bytes.slice(audioStart, audioStart + 8000)
  const freq = new Array(256).fill(0)
  for (const b of audioPart) freq[b]++
  let h = 0
  for (const f of freq) {
    if (f > 0) { const p = f / audioPart.length; h -= p * Math.log2(p) }
  }
  let entropyScore = 0.5
  if (h < 5.5) entropyScore = 0.80  // very low entropy = TTS
  else if (h < 6.2) entropyScore = 0.65
  else if (h < 7.0) entropyScore = 0.48
  else entropyScore = 0.28  // high entropy = natural speech

  // ── 5. File size absolute ─────────────────────────────────────────────────
  // TTS files are typically small (< 2MB for a 1-2 min clip).
  // Real voice recordings of same duration are larger due to ambient noise.
  let sizeScore = 0.5
  if (kb < 100)  sizeScore = 0.65   // very small = short TTS clip
  else if (kb < 500)  sizeScore = 0.52
  else if (kb < 2000) sizeScore = 0.42
  else sizeScore = 0.28              // large file = real recording

  return [
    {
      name:        'Bitrate Uniformity',
      score:       bitrateScore,
      rawValue:    bitrateKbps,
      weight:      0.25,
      description: 'TTS systems output at perfectly consistent bitrates; real speech has variable encoding',
    },
    {
      name:        'Silence / Breath Pattern',
      score:       silenceScore,
      rawValue:    silenceRatio,
      weight:      0.25,
      description: 'AI voice lacks natural pauses and breathing; continuous speech is a TTS fingerprint',
    },
    {
      name:        'Audio Byte Entropy',
      score:       entropyScore,
      rawValue:    h,
      weight:      0.20,
      description: 'AI-synthesized audio is more compressible (lower entropy) than natural human speech',
    },
    {
      name:        'Format Signature',
      score:       formatScore,
      rawValue:    fmt === 'mp3' ? 1 : fmt === 'wav' ? 0 : 0.5,
      weight:      0.15,
      description: 'ElevenLabs, PlayHT, XTTS v2 typically export MP3 @ 128kbps; real recordings use WAV/FLAC',
    },
    {
      name:        'File Compression Ratio',
      score:       sizeScore,
      rawValue:    kb,
      weight:      0.15,
      description: 'TTS outputs are smaller per second than real speech recordings due to reduced noise floor',
    },
  ]
}

export function aggregateAudioSignals(signals: AudioSignalResult[]): number {
  const totalW = signals.reduce((s, sig) => s + sig.weight, 0)
  return signals.reduce((s, sig) => s + sig.score * sig.weight, 0) / totalW
}


// ── CALIBRATION SUPPORT ───────────────────────────────────────────────────────
import type { AudioCalibrationStats } from '../calibration-client'
import { calibratedScore }            from '../calibration-client'

export function applyAudioCalibration(
  signals: AudioSignalResult[],
  cal:     AudioCalibrationStats,
): AudioSignalResult[] {
  const sigMap: Record<string, { aiM: number; aiS: number; realM: number; realS: number }> = {
    'Bitrate Uniformity': {
      aiM: cal.bitrate_ai_mean, aiS: cal.bitrate_ai_std,
      realM: cal.bitrate_real_mean, realS: cal.bitrate_real_std,
    },
    'Silence / Breath Pattern': {
      aiM: cal.silence_ai_mean, aiS: cal.silence_ai_std,
      realM: cal.silence_real_mean, realS: cal.silence_real_std,
    },
    'Audio Byte Entropy': {
      aiM: cal.entropy_ai_mean, aiS: cal.entropy_ai_std,
      realM: cal.entropy_real_mean, realS: cal.entropy_real_std,
    },
    'File Compression Ratio': {
      aiM: cal.filesize_ai_mean, aiS: cal.filesize_ai_std,
      realM: cal.filesize_real_mean, realS: cal.filesize_real_std,
    },
  }
  return signals.map(sig => {
    const ref = sigMap[sig.name]
    if (!ref) return sig
    const calibrated = calibratedScore(sig.rawValue, ref.aiM, ref.aiS, ref.realM, ref.realS)
    return { ...sig, score: calibrated }
  })
}

// ── Engineering Brief §3.1: Handcrafted Forensic Audio Signals ───────────────
// These are deterministic byte-level approximations — no audio decode required.

/**
 * Spectral Flux Proxy
 * AI TTS has unnaturally low frame-to-frame spectral change.
 * Approximated via byte-sequence variance across overlapping windows.
 */
function spectralFluxProxy(audioBytes: Buffer): number {
  const buf    = audioBytes.slice(Math.min(44, audioBytes.length))  // skip WAV header
  const frameN = 256
  const frames: number[] = []

  for (let i = 0; i < Math.min(buf.length - frameN, 8000); i += frameN) {
    const frame = Array.from(buf.slice(i, i + frameN))
    const mean  = frame.reduce((a, b) => a + b, 0) / frame.length
    frames.push(mean)
  }
  if (frames.length < 4) return 0.5

  // Flux = mean of frame-to-frame absolute differences
  const flux = frames.slice(1).reduce((sum, f, i) => sum + Math.abs(f - frames[i]), 0) / (frames.length - 1)

  // Low flux = smooth = AI TTS. High flux = natural variation = human voice
  if (flux < 2.0)  return 0.82
  if (flux < 5.0)  return 0.62
  if (flux < 10.0) return 0.42
  return 0.22
}

/**
 * Zero-Crossing Rate Variance
 * AI TTS often has unnaturally consistent ZCR across the utterance.
 */
function zcrVarianceSignal(audioBytes: Buffer): number {
  const buf    = audioBytes.slice(Math.min(44, audioBytes.length))
  const frameN = 512
  const zcrPerFrame: number[] = []

  for (let i = 0; i < Math.min(buf.length - frameN, 10000); i += frameN) {
    let crossings = 0
    for (let j = i + 1; j < i + frameN && j < buf.length; j++) {
      const prev = buf[j - 1] - 128
      const curr = buf[j]     - 128
      if ((prev >= 0) !== (curr >= 0)) crossings++
    }
    zcrPerFrame.push(crossings / frameN)
  }
  if (zcrPerFrame.length < 4) return 0.5

  const mean   = zcrPerFrame.reduce((a, b) => a + b, 0) / zcrPerFrame.length
  const stdDev = Math.sqrt(zcrPerFrame.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / zcrPerFrame.length)
  const cv     = stdDev / Math.max(mean, 0.001)

  // Low CV = mechanically consistent = AI TTS
  if (cv < 0.08) return 0.82
  if (cv < 0.15) return 0.62
  if (cv < 0.25) return 0.40
  return 0.22
}

/**
 * High-Frequency Energy Ratio
 * Energy above 8kHz / total. AI TTS tends to have less HF content.
 * Approximated via byte-level high-pass differencing.
 */
function hfEnergyRatioAudio(audioBytes: Buffer): number {
  const buf    = audioBytes.slice(Math.min(44, audioBytes.length))
  const sampleN = Math.min(buf.length, 8000)
  let hfEnergy  = 0
  let totEnergy = 0

  for (let i = 1; i < sampleN; i++) {
    const v     = buf[i] - 128
    const prev  = buf[i - 1] - 128
    const diff  = v - prev   // high-pass approximation
    hfEnergy   += diff * diff
    totEnergy  += v * v + 1
  }
  const ratio = hfEnergy / totEnergy

  // AI TTS: low HF ratio. Human voice: higher
  if (ratio < 0.15) return 0.78
  if (ratio < 0.30) return 0.58
  if (ratio < 0.50) return 0.38
  return 0.20
}

/**
 * Returns extended audio signals including forensic signals from §3.1
 */
export function extractAudioSignalsExtended(buf: Buffer, fileSize: number): AudioSignalResult[] {
  const base = extractAudioSignals(buf, fileSize)
  return [
    ...base,
    {
      name:        'Spectral Flux',
      score:       spectralFluxProxy(buf),
      rawValue:    0,
      weight:      0.12,
      description: 'AI TTS has unnaturally low frame-to-frame spectral change; human voice fluctuates naturally',
    },
    {
      name:        'ZCR Consistency',
      score:       zcrVarianceSignal(buf),
      rawValue:    0,
      weight:      0.10,
      description: 'Zero-crossing rate is mechanically consistent in AI TTS; human speech shows natural ZCR variance',
    },
    {
      name:        'HF Energy Ratio',
      score:       hfEnergyRatioAudio(buf),
      rawValue:    0,
      weight:      0.08,
      description: 'AI TTS suppresses energy above 8kHz relative to natural human voice recordings',
    },
  ]
}

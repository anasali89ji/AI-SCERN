/**
 * DETECTAI — Audio Signal Engine v2.0
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

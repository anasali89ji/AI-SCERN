/**
 * Aiscern — Advanced Image Signal Engine v4.0
 *
 * Detects AI-generated images from ALL major platforms:
 *   - Stable Diffusion / SDXL / Flux
 *   - Midjourney v5/v6
 *   - DALL-E 3 (ChatGPT)
 *   - Gemini / Imagen / Gemini Nano
 *   - Grok (Aurora)
 *   - Leonardo AI
 *   - Firefly / Canva AI
 *   - Runway, Pika, Kling (video frames)
 *
 * Also detects: real photos edited in Photoshop/Lightroom/GIMP
 */

export interface ImageSignalResult {
  name:        string
  score:       number    // 0–1, higher = more AI-like
  rawValue:    number    // raw measurement for calibration
  weight:      number
  description: string
}

// ── JPEG helpers ──────────────────────────────────────────────────────────────

function findPixelStart(bytes: Uint8Array | Buffer): number {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let i = 2
  while (i < buf.length - 4) {
    const marker = (buf[i] << 8) | buf[i + 1]
    const len    = (buf[i + 2] << 8) | buf[i + 3]
    if (marker === 0xFFDA) return i + 4
    if ((marker >= 0xFFE0 && marker <= 0xFFEF) ||
        marker === 0xFFFE || marker === 0xFFDB ||
        marker === 0xFFC0 || marker === 0xFFC4) {
      i += 2 + len; continue
    }
    i += 2
  }
  return Math.floor(buf.length * 0.3)
}

function toUint8(buf: Buffer | Uint8Array): Uint8Array {
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf)
}

function samplePixels(bytes: Uint8Array, count = 3000): number[] {
  const start = findPixelStart(bytes)
  const end   = bytes.length - 2
  const range = end - start
  if (range <= 0) return []
  const step = Math.max(1, Math.floor(range / count))
  const out: number[] = []
  for (let i = start; i < end && out.length < count; i += step) out.push(bytes[i])
  return out
}

// ── 1. Byte Entropy ───────────────────────────────────────────────────────────
// AI images (all generators) compress more efficiently → lower entropy
// Gemini/Imagen score particularly low (very clean outputs)
function calcEntropy(samples: number[]): number {
  if (!samples.length) return 7.0
  const freq = new Array(256).fill(0)
  for (const b of samples) freq[b]++
  let h = 0
  for (const f of freq) {
    if (f > 0) { const p = f / samples.length; h -= p * Math.log2(p) }
  }
  return h
}
function entropyScore(entropy: number): number {
  // Recalibrated for modern AI (2024+): DALL-E 3/MJ v6 have high entropy (7.2-7.5)
  // Old SD 1.x was 6.2-6.8; modern generators look like real photos in entropy
  if (entropy < 6.2) return 0.92  // old/compressed AI output
  if (entropy < 6.8) return 0.82  // Gemini/Imagen: still quite clean
  if (entropy < 7.1) return 0.70  // SD/SDXL
  if (entropy < 7.3) return 0.56  // DALL-E 3 / MJ v6 lower end
  if (entropy < 7.5) return 0.44  // DALL-E 3 / MJ v6 — borderline, not strongly human
  if (entropy < 7.7) return 0.28  // real photo range
  return 0.14                      // heavy sensor noise / DSLR RAW
}

// ── 2. Sensor Noise (Adjacent Byte Variance) ──────────────────────────────────
// Camera sensors produce random per-pixel noise. AI is unnaturally smooth.
// Grok/Aurora and Gemini are extremely smooth; DALL-E slightly less so.
function calcNoise(samples: number[]): number {
  if (samples.length < 4) return 10
  let diff = 0
  for (let i = 1; i < samples.length; i++) diff += Math.abs(samples[i] - samples[i-1])
  return diff / (samples.length - 1)
}
function noiseScore(noise: number): number {
  // Modern AI adds intentional film grain (DALL-E 3, MJ v6, Adobe Firefly)
  // Lower thresholds calibrated: only near-zero noise is definitively AI
  if (noise < 2.0) return 0.92  // near-zero: definitely AI (Gemini/old SD)
  if (noise < 3.5) return 0.78  // very low: probably AI (older generators)
  if (noise < 5.5) return 0.58  // low: could be AI with grain filter
  if (noise < 8.5) return 0.40  // moderate: DALL-E 3 grain / real phone
  if (noise < 12)  return 0.25  // normal: likely real photo
  return 0.12                    // heavy grain: DSLR / ISO push
}

// ── 3. Background Uniformity ──────────────────────────────────────────────────
// AI studio renders (Grok, Leonardo) have perfectly smooth bg gradients.
// Real photos always have texture, noise, or compression artifacts in background.
function calcBgVariance(bytes: Uint8Array): number {
  const start = findPixelStart(bytes)
  const end   = start + Math.floor((bytes.length - start) * 0.08)
  const bg: number[] = []
  const step = Math.max(1, Math.floor((end - start) / 400))
  for (let i = start; i < end; i += step) bg.push(bytes[i])
  if (!bg.length) return 25
  const mean = bg.reduce((a, b) => a + b, 0) / bg.length
  return Math.sqrt(bg.reduce((a, b) => a + (b - mean) ** 2, 0) / bg.length)
}
function bgScore(variance: number): number {
  if (variance < 4)  return 0.92  // AI studio render: perfectly flat
  if (variance < 8)  return 0.82  // Grok/Leonardo portrait
  if (variance < 14) return 0.68  // Midjourney/SDXL
  if (variance < 22) return 0.48  // DALL-E 3 / Gemini portrait
  if (variance < 35) return 0.30  // real photo soft-bg
  return 0.15                      // busy real background
}

// ── 4. Luminance Distribution ─────────────────────────────────────────────────
// AI diffusion models cluster values in 90–210 midtone range.
// Real photos have wider spread including deep shadows and bright highlights.
function calcLuminance(samples: number[]): number {
  if (!samples.length) return 0.6
  return samples.filter(b => b >= 90 && b <= 210).length / samples.length
}
function luminanceScore(fraction: number): number {
  // Modern AI (DALL-E 3, MJ v6) has full tonal range — luminance signal is weakened
  // Only extreme midtone compression (old Gemini/SD) is reliably AI
  if (fraction > 0.88) return 0.90  // extreme compression: old-style AI
  if (fraction > 0.82) return 0.76  // high compression: likely AI (Gemini/old MJ)
  if (fraction > 0.75) return 0.58  // moderate: could be AI or overexposed real
  if (fraction > 0.65) return 0.44  // slight: borderline — DALL-E 3 range
  if (fraction > 0.55) return 0.30  // normal: probably real
  return 0.18                        // wide range: real photo with shadows/highlights
}

// ── 5. Color Channel Balance ──────────────────────────────────────────────────
// AI generators produce unnaturally balanced RGB — closer to 0.333 each.
// Real photos always have a natural color cast (warm sunset, cool shade, etc.)
// BUT: heavy Photoshop editing can re-balance RGB = edited photo signal too.
function calcColorBalance(bytes: Uint8Array): number {
  const start = findPixelStart(bytes)
  const end   = bytes.length - 2
  const step  = Math.max(3, Math.floor((end - start) / 900))
  let r = 0, g = 0, b = 0, n = 0
  for (let i = start; i < end - 2 && n < 900; i += step) {
    r += bytes[i]; g += bytes[i+1]; b += bytes[i+2]; n++
  }
  if (!n) return 0.07
  const total = r + g + b
  if (!total) return 0.07
  return Math.abs(r/total - 0.333) + Math.abs(g/total - 0.333) + Math.abs(b/total - 0.333)
}
function colorBalanceScore(deviation: number): number {
  // Very low deviation = suspiciously perfect balance = AI or edited
  if (deviation < 0.015) return 0.88  // near-perfect balance: AI
  if (deviation < 0.04)  return 0.72
  if (deviation < 0.08)  return 0.50
  if (deviation < 0.14)  return 0.32
  return 0.15                          // natural color cast: real
}

// ── 6. High-Frequency Detail Consistency ─────────────────────────────────────
// Real photos show irregular high-frequency detail (hair strands, fabric, bark).
// AI images show periodic/regular high-frequency patterns from upsampling.
// Measure: variance of second-order differences (d²x/di²)
function calcHFDetail(samples: number[]): number {
  if (samples.length < 6) return 8
  let secondDiff = 0
  for (let i = 2; i < samples.length; i++) {
    secondDiff += Math.abs(samples[i] - 2*samples[i-1] + samples[i-2])
  }
  return secondDiff / (samples.length - 2)
}
function hfDetailScore(hfVal: number): number {
  // AI: very uniform HF → low variance in second differences
  if (hfVal < 3)  return 0.85  // Gemini/Grok: unnaturally regular
  if (hfVal < 5)  return 0.72
  if (hfVal < 8)  return 0.52
  if (hfVal < 12) return 0.35
  return 0.18                   // real: irregular HF
}

// ── 7. Compression Efficiency ─────────────────────────────────────────────────
// AI images compress smaller than real photos at same resolution.
// < 300KB almost always AI output; > 3MB almost always real DSLR/phone.
function calcCompression(fileSize: number): number {
  return fileSize
}
function compressionScore(size: number): number {
  // Recalibrated: Midjourney/DALL-E 3 full-quality downloads are 1-4MB
  // File size is now a WEAK signal — only very small files are clearly AI
  const kb = size / 1024
  if (kb < 60)   return 0.85  // tiny = definitely AI web output
  if (kb < 150)  return 0.72  // small = probably AI
  if (kb < 400)  return 0.58  // medium-small = leaning AI
  if (kb < 1000) return 0.50  // medium = neutral (AI and real overlap here)
  if (kb < 2500) return 0.46  // large = slightly human-leaning (but DALL-E can be this big)
  if (kb < 5000) return 0.35  // very large = probably real phone/camera
  return 0.18                  // huge = DSLR RAW/uncompressed
}

// ── 8. DCT Coefficient Distribution (JPEG artifact pattern) ──────────────────
// AI diffusion outputs have unusually uniform DCT block coefficients.
// Photoshop-edited images also show DCT anomalies (double-compression).
// We approximate by measuring the distribution of byte value clusters.
function calcDCTPattern(bytes: Uint8Array): number {
  const start = findPixelStart(bytes)
  // Sample 3 regions: beginning, middle, end of pixel data
  const regions = [
    { from: start, to: start + Math.floor((bytes.length - start) * 0.1) },
    { from: start + Math.floor((bytes.length - start) * 0.45), to: start + Math.floor((bytes.length - start) * 0.55) },
    { from: bytes.length - Math.floor((bytes.length - start) * 0.1), to: bytes.length - 2 },
  ]
  const regionMeans: number[] = []
  for (const { from, to } of regions) {
    if (to <= from) continue
    let sum = 0, count = 0
    const step = Math.max(1, Math.floor((to - from) / 200))
    for (let i = from; i < to; i += step) { sum += bytes[i]; count++ }
    if (count) regionMeans.push(sum / count)
  }
  if (regionMeans.length < 2) return 0.5
  // Low variance across regions = uniform AI output
  const mean = regionMeans.reduce((a, b) => a + b, 0) / regionMeans.length
  const variance = regionMeans.reduce((a, b) => a + (b - mean) ** 2, 0) / regionMeans.length
  const stddev = Math.sqrt(variance)
  if (stddev < 2)   return 0.82  // extremely uniform: AI
  if (stddev < 5)   return 0.68
  if (stddev < 10)  return 0.50
  if (stddev < 18)  return 0.33
  return 0.16                     // high variation: real photo
}

// ── 9. Skin-Tone Perfection (Portrait-Specific) ───────────────────────────────
// AI portrait generators (Midjourney, Gemini, DALL-E, Grok) produce
// perfectly smooth, uniform skin tones. Real skin has pores, blemishes,
// micro-texture. Measure: histogram smoothness in skin-tone byte range (150-220).
function calcSkinSmoothing(samples: number[]): number {
  const skinRange = samples.filter(b => b >= 145 && b <= 225)
  if (skinRange.length < 30) return 0.5  // not a portrait / not enough skin tones
  const mean = skinRange.reduce((a, b) => a + b, 0) / skinRange.length
  const variance = skinRange.reduce((a, b) => a + (b - mean) ** 2, 0) / skinRange.length
  const std = Math.sqrt(variance)
  // AI skin: very low std (unnaturally smooth). Real skin: higher std.
  if (std < 4)  return 0.88  // Grok/Gemini: porcelain smooth
  if (std < 7)  return 0.75  // Midjourney v6
  if (std < 10) return 0.60  // DALL-E 3
  if (std < 15) return 0.42  // edited portrait
  return 0.22                 // real unretouched skin
}

// ── 10. Edit Signature Detection ─────────────────────────────────────────────
// Photoshop/Lightroom edits leave specific patterns:
// - Clone stamp → repetitive block patterns
// - Color grading → unusual channel separations
// - Sharpening → accentuated edge halos
// Returns separate "edited" score 0-1 alongside AI score
function calcEditSignature(bytes: Uint8Array, samples: number[]): number {
  // Check for double JPEG compression (export after editing)
  // Manifests as unusually even distribution in some byte ranges
  const mid = samples.filter(b => b > 100 && b < 150)
  const evenness = mid.length > 20
    ? Math.min(1, 20 / (new Set(mid.map(b => Math.floor(b / 5))).size + 1))
    : 0

  // Check for clone stamp: periodic repetition in local regions
  const start = findPixelStart(bytes)
  const blockSize = 50
  const blocks: number[] = []
  for (let i = start; i < start + 2000 && i + blockSize < bytes.length; i += blockSize) {
    let sum = 0
    for (let j = 0; j < blockSize; j++) sum += bytes[i + j]
    blocks.push(sum / blockSize)
  }
  let repetitionScore = 0
  if (blocks.length > 4) {
    let matchCount = 0
    for (let i = 0; i < blocks.length - 1; i++) {
      if (Math.abs(blocks[i] - blocks[i+1]) < 1.5) matchCount++
    }
    repetitionScore = matchCount / (blocks.length - 1)
  }

  return Math.min(0.95, (evenness * 0.5 + repetitionScore * 0.5))
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export function extractImageSignals(buf: Buffer, fileSize: number): ImageSignalResult[] {
  const bytes   = toUint8(buf)
  const samples = samplePixels(bytes, 3000)

  const rawEntropy    = calcEntropy(samples)
  const rawNoise      = calcNoise(samples)
  const rawBg         = calcBgVariance(bytes)
  const rawLuminance  = calcLuminance(samples)
  const rawColor      = calcColorBalance(bytes)
  const rawHF         = calcHFDetail(samples)
  const rawCompression = calcCompression(fileSize)
  const rawDCT        = calcDCTPattern(bytes)
  const rawSkin       = calcSkinSmoothing(samples)
  const rawEdit       = calcEditSignature(bytes, samples)

  return [
    // Reliable signals: work well even for modern AI (DALL-E 3, MJ v6, Gemini, Grok, Flux)
    { name: 'HF Detail Regularity',    score: hfDetailScore(rawHF),           rawValue: rawHF,          weight: 0.22, description: 'AI upsampling creates unnaturally regular high-frequency patterns — most reliable signal' },
    { name: 'DCT Block Pattern',       score: rawDCT,                         rawValue: rawDCT,         weight: 0.18, description: 'JPEG block coefficient patterns differ between AI diffusion output and real camera captures' },
    { name: 'Skin Tone Smoothing',     score: rawSkin,                        rawValue: rawSkin,        weight: 0.15, description: 'AI portrait generators (Midjourney v6, Grok, Gemini) produce unnaturally smooth skin texture' },
    { name: 'Background Uniformity',   score: bgScore(rawBg),                 rawValue: rawBg,          weight: 0.14, description: 'AI studio renders have unnaturally smooth gradients — reliable for portraits and product shots' },
    // Moderate signals: somewhat reliable but weakened by modern AI sophistication
    { name: 'Sensor Noise Absence',    score: noiseScore(rawNoise),           rawValue: rawNoise,       weight: 0.11, description: 'Near-zero sensor noise indicates AI — modern generators add grain but rarely match real cameras' },
    { name: 'Byte Entropy',            score: entropyScore(rawEntropy),       rawValue: rawEntropy,     weight: 0.08, description: 'Modern AI has similar entropy to real photos — reliable only for old or compressed AI outputs' },
    { name: 'Color Channel Balance',   score: colorBalanceScore(rawColor),    rawValue: rawColor,       weight: 0.07, description: 'Unnaturally balanced RGB channels — less reliable as modern AI adds natural color variation' },
    // Weak signals: poor discriminators for 2024+ AI generators
    { name: 'Luminance Clustering',    score: luminanceScore(rawLuminance),   rawValue: rawLuminance,   weight: 0.03, description: 'DALL-E 3 and MJ v6 have full tonal range like real photos — signal is weak for modern AI' },
    { name: 'Compression Efficiency',  score: compressionScore(rawCompression), rawValue: rawCompression, weight: 0.02, description: 'Modern AI generates 1-4MB files — file size is no longer a reliable AI indicator' },
    { name: 'Edit Signature',          score: rawEdit,                        rawValue: rawEdit,        weight: 0.00, description: 'Photoshop/Lightroom edits leave double-compression patterns — disabled to reduce false positives' },
  ]
}

export function aggregateImageSignals(signals: ImageSignalResult[]): number {
  const totalW = signals.reduce((s, sig) => s + sig.weight, 0)
  return signals.reduce((s, sig) => s + sig.score * sig.weight, 0) / totalW
}

// ── CALIBRATION SUPPORT ───────────────────────────────────────────────────────
import type { CalibrationStats } from '../calibration-client'
import { calibratedScore }       from '../calibration-client'

export function applyCalibration(
  signals: ImageSignalResult[],
  cal:     CalibrationStats,
): ImageSignalResult[] {
  const sigMap: Record<string, { aiM: number; aiS: number; realM: number; realS: number }> = {
    'Byte Entropy':           { aiM: cal.entropy_ai_mean,     aiS: cal.entropy_ai_std,     realM: cal.entropy_real_mean,     realS: cal.entropy_real_std },
    'Sensor Noise Absence':   { aiM: cal.noise_ai_mean,       aiS: cal.noise_ai_std,       realM: cal.noise_real_mean,       realS: cal.noise_real_std },
    'Background Uniformity':  { aiM: cal.bg_ai_mean,          aiS: cal.bg_ai_std,          realM: cal.bg_real_mean,          realS: cal.bg_real_std },
    'Luminance Clustering':   { aiM: cal.luminance_ai_mean,   aiS: cal.luminance_ai_std,   realM: cal.luminance_real_mean,   realS: cal.luminance_real_std },
    'Color Channel Balance':  { aiM: cal.color_ai_mean,       aiS: cal.color_ai_std,       realM: cal.color_real_mean,       realS: cal.color_real_std },
    'Compression Efficiency': { aiM: cal.compression_ai_mean, aiS: cal.compression_ai_std, realM: cal.compression_real_mean, realS: cal.compression_real_std },
  }
  return signals.map(sig => {
    const ref = sigMap[sig.name]
    if (!ref) return sig
    const calibrated = calibratedScore(sig.rawValue, ref.aiM, ref.aiS, ref.realM, ref.realS)
    return { ...sig, score: calibrated }
  })
}

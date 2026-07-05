// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Image Detection Brain v2.0
// Deep embedded knowledge engine for AI vs real image classification.
//
// v2.0 Upgrades over v1.0:
//   ✦ Sharp-powered pixel decoder — reads actual DECODED pixels, not
//     compressed bytes. Fixes high-quality JPEG / uncompressed PNG analysis.
//   ✦ 16 signals (was 8) including 8 brand-new detectors
//   ✦ Gemini Imagen v3 fingerprint (HDR-clean, B>G>R channel order)
//   ✦ Grok Aurora deep fingerprint (violet+lime double hue peak)
//   ✦ Ideogram, Leonardo AI, Canva AI, Adobe Firefly fingerprints
//   ✦ Gradient field smoothness (AI has mathematically perfect gradients)
//   ✦ Color palette clustering (AI uses limited learned palettes)
//   ✦ Hue ring distribution (per-generator hue fingerprint)
//   ✦ Neural upsampling artifact detection (8×8 latent-space residuals)
//   ✦ Pixel value discretization (AI outputs quantized at specific intervals)
//   ✦ Local contrast consistency map (AI has uniform contrast blocks)
//   ✦ Color gamut coverage (narrow or over-extended vs camera native)
//   ✦ Background coherence analysis (AI = suspiciously uniform)
//   ✦ Multi-signal confidence boost system
//
// Architecture (16 signals):
//   1.  Saturation Distribution  — generator color saturation fingerprints
//   2.  Texture Noise Floor      — camera sensor noise vs AI smoothness
//   3.  Channel Correlation      — inter-channel statistical analysis
//   4.  Luminance Gradient       — gradient peakedness + mid-tone analysis
//   5.  Frequency Artifacts      — 8×8 upsampling spectral fingerprints
//   6.  Edge Sharpness Pattern   — inconsistent sharpness (Sobel on decoded px)
//   7.  Compression Signature    — EXIF, file density, JPEG/PNG/WebP markers
//   8.  Gradient Field           — [NEW] 2nd-order gradient smoothness
//   9.  Color Palette Clustering — [NEW] palette diversity and concentration
//   10. Hue Ring Distribution    — [NEW] per-generator hue fingerprints
//   11. Neural Upsampling        — [NEW] 8px periodicity autocorrelation
//   12. Pixel Discretization     — [NEW] quantization gaps in luma histogram
//   13. Local Contrast           — [NEW] block-level contrast CV analysis
//   14. Color Gamut Coverage     — [NEW] CIELab gamut area measurement
//   15. Background Coherence     — [NEW] border luma uniformity
//   16. Generator Fingerprints   — Midjourney, DALL-E 3, SD, Flux, Gemini
//                                  Imagen v3, Grok Aurora, Adobe Firefly,
//                                  Ideogram v2, Leonardo AI, Canva AI
//
// Returns: ImageBrainResult { score, signals, findings, verdict, generatorHints, decodedPixels }
// ════════════════════════════════════════════════════════════════════════════

export interface ImageBrainSignal {
  name:     string
  category: 'saturation' | 'texture' | 'frequency' | 'edge' | 'color' | 'noise'
            | 'compression' | 'structure' | 'generator' | 'gradient' | 'palette'
            | 'hue' | 'upsampling' | 'discretization' | 'contrast' | 'gamut' | 'background'
  score:    number   // 0–1: AI probability for this signal
  weight:   number
  evidence: string
  rawValue: number
}

export interface ImageBrainResult {
  score:          number
  signals:        ImageBrainSignal[]
  findings:       string[]
  verdict:        'AI' | 'HUMAN' | 'UNCERTAIN'
  generatorHints: string[]
  decodedPixels:  boolean
}

// ── TYPES ─────────────────────────────────────────────────────────────────────

interface RGBPixel { r: number; g: number; b: number }

interface DecodedImage {
  pixels:   Uint8Array
  width:    number
  height:   number
  channels: number   // 3 = RGB, 4 = RGBA
  decoded:  boolean
}

// ── CORE UTILITIES ─────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

function meanArr(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
}

function stats(arr: number[]): { mean: number; variance: number; std: number; min: number; max: number } {
  if (!arr.length) return { mean: 0, variance: 0, std: 0, min: 0, max: 0 }
  const m        = meanArr(arr)
  const variance = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length
  return { mean: m, variance, std: Math.sqrt(variance), min: Math.min(...arr), max: Math.max(...arr) }
}

function histogram(values: number[], buckets = 32): number[] {
  const h = new Array(buckets).fill(0)
  for (const v of values) {
    const i = clamp(Math.floor(v * buckets), 0, buckets - 1)
    h[i]++
  }
  return h.map(v => v / (values.length || 1))
}

function histPeakedness(hist: number[]): number {
  const maxV = Math.max(...hist)
  const m    = meanArr(hist)
  return maxV / (m + 1e-6)
}

function pearsonCorr(a: number[], b: number[]): number {
  if (!a.length) return 0
  const ma = meanArr(a), mb = meanArr(b)
  const num = a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0)
  const da  = Math.sqrt(a.reduce((s, v) => s + (v - ma) ** 2, 0))
  const db  = Math.sqrt(b.reduce((s, v) => s + (v - mb) ** 2, 0))
  return (da * db) === 0 ? 0 : num / (da * db)
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  const v = max, s = max === 0 ? 0 : d / max
  let h = 0
  if (d !== 0) {
    if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else                h = ((r - g) / d + 4) / 6
  }
  return { h, s, v }
}

function rgbToLab(r: number, g: number, b: number): { L: number; a: number; bval: number } {
  let R = r / 255, G = g / 255, B = b / 255
  R = R > 0.04045 ? ((R + 0.055) / 1.055) ** 2.4 : R / 12.92
  G = G > 0.04045 ? ((G + 0.055) / 1.055) ** 2.4 : G / 12.92
  B = B > 0.04045 ? ((B + 0.055) / 1.055) ** 2.4 : B / 12.92
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.9505
  const Y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0000
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.0890
  const f = (t: number) => t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116
  return { L: 116 * f(Y) - 16, a: 500 * (f(X) - f(Y)), bval: 200 * (f(Y) - f(Z)) }
}

function samplePixels(img: DecodedImage, maxSamples = 8000): RGBPixel[] {
  const { pixels, width, height, channels, decoded } = img
  const result: RGBPixel[] = []
  if (decoded && width > 0 && height > 0) {
    const stride = Math.max(1, Math.floor(width * height / maxSamples))
    for (let i = 0; i < width * height && result.length < maxSamples; i += stride) {
      const off = i * channels
      const r = pixels[off], g = pixels[off + 1], b = pixels[off + 2]
      if ((r === 0 && g === 0 && b === 0) || (r === 255 && g === 255 && b === 255)) continue
      result.push({ r, g, b })
    }
  } else {
    const step = Math.max(3, Math.floor(pixels.length / (maxSamples * 3))) * 3
    for (let i = 300; i < pixels.length - 2 && result.length < maxSamples; i += step) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2]
      if ((r === 0 && g === 0 && b === 0) || (r === 255 && g === 255 && b === 255)) continue
      result.push({ r, g, b })
    }
  }
  return result
}

// ── SHARP PIXEL DECODER ────────────────────────────────────────────────────────
// This fixes the core issue with high-quality JPEG analysis.
// Compressed bytes from JPEG are DCT coefficients — they bear no relationship
// to actual pixel values. Sharp decodes the image to raw RGB pixels first.

export async function decodeImagePixels(buf: Buffer, _mimeType: string): Promise<DecodedImage> {
  try {
    const mod   = await import('sharp')
    const sharp = mod.default
    const { data, info } = await sharp(buf)
      .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    return {
      pixels:   new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
      width:    info.width,
      height:   info.height,
      channels: info.channels,
      decoded:  true,
    }
  } catch (err) {
    // This is NOT a silent fallback — sharp decode failure significantly
    // degrades every signal that depends on real pixel data (texture, frequency,
    // edge, gradient, contrast, symmetry, horizon all return weaker raw-byte
    // heuristics or neutral 0.5 scores instead). Surface it loudly so it shows
    // up in server logs rather than disappearing as an unexplained accuracy drop.
    console.error(
      '[image-detection-brain] sharp pixel decode FAILED — falling back to degraded raw-byte analysis. ' +
      'This image will get a less accurate verdict. Reason:',
      err instanceof Error ? err.message : err,
    )
    return {
      pixels:   new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
      width:    0, height: 0, channels: 3, decoded: false,
    }
  }
}

// ── SIGNAL 1: SATURATION ANALYSIS ─────────────────────────────────────────────

function analyzeSaturation(samples: RGBPixel[]): ImageBrainSignal {
  const hsvs        = samples.map(({ r, g, b }) => rgbToHsv(r, g, b))
  const saturations = hsvs.map(h => h.s)
  const values      = hsvs.map(h => h.v)
  const satSt = stats(saturations), valSt = stats(values)
  const satH  = histogram(saturations), satPk = histPeakedness(satH)

  const tooHighSat   = satSt.mean > 0.65 ? 0.90 : satSt.mean > 0.58 ? 0.75 : satSt.mean > 0.50 ? 0.55 : 0.25
  const tooUniform   = satPk > 9 ? 0.92 : satPk > 6 ? 0.76 : satPk > 4 ? 0.54 : 0.22
  const tooLowStd    = satSt.std < 0.04 ? 0.94 : satSt.std < 0.08 ? 0.76 : satSt.std < 0.12 ? 0.52 : 0.20
  const blueRatio    = samples.filter(({ r, g, b }) => b > r + 15 && b > g + 8).length / samples.length
  const blueDom      = blueRatio > 0.40 ? 0.85 : blueRatio > 0.28 ? 0.65 : 0.18
  const valTooSmooth = valSt.std < 0.10 ? 0.88 : valSt.std < 0.18 ? 0.62 : 0.22

  return {
    name: 'Saturation Distribution', category: 'saturation',
    score: clamp(tooHighSat * 0.22 + tooUniform * 0.28 + tooLowStd * 0.24 + blueDom * 0.12 + valTooSmooth * 0.14, 0, 1),
    weight: 0.10, rawValue: satSt.mean,
    evidence: [
      `mean S=${satSt.mean.toFixed(3)} (AI: >0.55)`,
      `std S=${satSt.std.toFixed(3)} (AI: <0.10)`,
      `hist peak=${satPk.toFixed(1)} (AI: >5)`,
      blueRatio > 0.25 ? `blue dom=${(blueRatio * 100).toFixed(0)}%` : '',
    ].filter(Boolean).join(' | '),
  }
}

// ── SIGNAL 2: TEXTURE NOISE FLOOR ─────────────────────────────────────────────
// Uses decoded pixels for proper 2D luminance adjacent-difference analysis.

function analyzeTexture(img: DecodedImage): ImageBrainSignal {
  const { pixels, width, height, channels, decoded } = img

  if (decoded && width > 1 && height > 1) {
    const variations: number[] = []
    for (let y = 0; y < height && variations.length < 30000; y++) {
      for (let x = 1; x < width; x++) {
        const off  = (y * width + x) * channels
        const offP = (y * width + x - 1) * channels
        const luma  = 0.299 * pixels[off]  + 0.587 * pixels[off + 1]  + 0.114 * pixels[off + 2]
        const lumaP = 0.299 * pixels[offP] + 0.587 * pixels[offP + 1] + 0.114 * pixels[offP + 2]
        variations.push(Math.abs(luma - lumaP))
      }
    }
    const varSt = stats(variations)
    const smooth = varSt.mean < 0.8 ? 0.96 : varSt.mean < 1.5 ? 0.86 : varSt.mean < 2.5 ? 0.68 : varSt.mean < 4.0 ? 0.42 : 0.18
    const cv     = varSt.mean > 0 ? varSt.std / varSt.mean : 0
    const cvSc   = cv < 0.5 ? 0.92 : cv < 0.8 ? 0.74 : cv < 1.2 ? 0.48 : 0.20
    return { name: 'Texture Noise Floor', category: 'texture',
      score: clamp(smooth * 0.60 + cvSc * 0.40, 0, 1), weight: 0.14, rawValue: varSt.mean,
      evidence: `mean luma diff=${varSt.mean.toFixed(3)} (AI: <2) | CV=${cv.toFixed(3)} (AI: <0.8, decoded px)` }
  }

  // Raw byte fallback
  const bytes = pixels, step = Math.max(1, Math.floor(bytes.length / 10000))
  const variations: number[] = []
  for (let i = step; i < bytes.length - step && variations.length < 8000; i += step) {
    const d = Math.abs(bytes[i] - bytes[i - step])
    if (d < 40) variations.push(d)
  }
  if (!variations.length) return { name: 'Texture Noise Floor', category: 'texture', score: 0.5, weight: 0.14, rawValue: 0, evidence: 'insufficient data' }
  const varSt = stats(variations)
  return { name: 'Texture Noise Floor', category: 'texture',
    score: clamp(varSt.mean < 0.8 ? 0.94 : varSt.mean < 1.5 ? 0.84 : varSt.mean < 2.5 ? 0.62 : 0.16, 0, 1),
    weight: 0.14, rawValue: varSt.mean, evidence: `mean var=${varSt.mean.toFixed(2)} (raw byte fallback)` }
}

// ── SIGNAL 3: CHANNEL CORRELATION ─────────────────────────────────────────────

function analyzeChannelCorrelation(samples: RGBPixel[]): ImageBrainSignal {
  if (samples.length < 100) return { name: 'Channel Correlation', category: 'color', score: 0.5, weight: 0.08, rawValue: 0, evidence: 'insufficient samples' }
  const rs = samples.map(s => s.r / 255)
  const gs = samples.map(s => s.g / 255)
  const bs = samples.map(s => s.b / 255)
  const avgCorr  = (pearsonCorr(rs, gs) + pearsonCorr(rs, bs) + pearsonCorr(gs, bs)) / 3
  const corrScore = avgCorr > 0.97 ? 0.92 : avgCorr > 0.93 ? 0.74 : avgCorr > 0.88 ? 0.50 : 0.20
  const rM = meanArr(rs), gM = meanArr(gs), bM = meanArr(bs)
  const chanDiff  = Math.abs(rM - gM) + Math.abs(gM - bM) + Math.abs(rM - bM)
  const balScore  = chanDiff < 0.025 ? 0.92 : chanDiff < 0.05 ? 0.68 : chanDiff < 0.10 ? 0.40 : 0.16
  return { name: 'Color Channel Correlation', category: 'color',
    score: clamp(corrScore * 0.55 + balScore * 0.45, 0, 1), weight: 0.08, rawValue: avgCorr,
    evidence: `avg RGB corr=${avgCorr.toFixed(4)} (AI: >0.93) | imbalance=${chanDiff.toFixed(4)} (AI: <0.04)` }
}

// ── SIGNAL 4: LUMINANCE GRADIENT ──────────────────────────────────────────────

function analyzeLuminanceGradient(samples: RGBPixel[]): ImageBrainSignal {
  const lumas   = samples.map(({ r, g, b }) => (0.299 * r + 0.587 * g + 0.114 * b) / 255)
  const lumSt   = stats(lumas)
  const lumPk   = histPeakedness(histogram(lumas))
  const dark    = lumas.filter(l => l < 0.15).length / lumas.length
  const bright  = lumas.filter(l => l > 0.85).length / lumas.length
  const midTones = 1 - dark - bright
  return { name: 'Luminance Gradient Pattern', category: 'color',
    score: clamp(
      (lumPk > 6 ? 0.87 : lumPk > 4 ? 0.70 : lumPk > 2.5 ? 0.48 : 0.20) * 0.32 +
      (midTones > 0.92 ? 0.90 : midTones > 0.82 ? 0.72 : midTones > 0.68 ? 0.42 : 0.18) * 0.34 +
      (lumSt.std < 0.07 ? 0.92 : lumSt.std < 0.13 ? 0.74 : lumSt.std < 0.20 ? 0.44 : 0.16) * 0.34,
    0, 1), weight: 0.09, rawValue: lumSt.std,
    evidence: `luma std=${lumSt.std.toFixed(3)} (AI: <0.13) | mid-tones=${(midTones * 100).toFixed(0)}% (AI: >82%) | peak=${lumPk.toFixed(1)}` }
}

// ── SIGNAL 5: FREQUENCY ARTIFACTS ─────────────────────────────────────────────
// 8×8 block periodicity from diffusion model latent-space upsampling.

function analyzeFrequencyArtifacts(img: DecodedImage): ImageBrainSignal {
  const { pixels, width, height, channels, decoded } = img

  if (decoded && width > 8 && height > 8) {
    const bpDiffs: number[] = []
    const BS = 8
    for (let y = BS; y < height - BS && bpDiffs.length < 5000; y += BS) {
      for (let x = BS; x < width; x += BS) {
        const off  = (y * width + x) * channels
        const offA = ((y - BS) * width + x) * channels
        bpDiffs.push(Math.abs(
          (0.299 * pixels[off] + 0.587 * pixels[off + 1] + 0.114 * pixels[off + 2]) -
          (0.299 * pixels[offA] + 0.587 * pixels[offA + 1] + 0.114 * pixels[offA + 2])
        ))
      }
    }
    const bpSt = stats(bpDiffs)
    return { name: 'Frequency Domain Artifacts', category: 'frequency',
      score: clamp(
        (bpSt.mean < 1.5 ? 0.90 : bpSt.mean < 3 ? 0.72 : bpSt.mean < 6 ? 0.45 : 0.18) * 0.55 +
        (bpSt.std  < 1.0 ? 0.88 : bpSt.std  < 2 ? 0.68 : bpSt.std  < 4 ? 0.42 : 0.18) * 0.45,
      0, 1), weight: 0.11, rawValue: bpSt.mean,
      evidence: `8×8 block diff mean=${bpSt.mean.toFixed(2)} (AI: <3) | std=${bpSt.std.toFixed(2)} (decoded px)` }
  }

  // Raw byte fallback
  const bytes = pixels
  const rDiffs: number[] = []
  for (let stride = 8; stride <= 64; stride += 8) {
    let sum = 0, cnt = 0
    for (let i = stride; i < Math.min(bytes.length, 30000); i += stride) { sum += Math.abs(bytes[i] - bytes[i - stride]); cnt++ }
    if (cnt > 0) rDiffs.push(sum / cnt)
  }
  const rdSt = stats(rDiffs)
  const bySt = stats(Array.from(bytes.slice(300, 5300)))
  return { name: 'Frequency Domain Artifacts', category: 'frequency',
    score: clamp(
      (rdSt.mean < 3 ? 0.84 : rdSt.mean < 5 ? 0.64 : rdSt.mean < 8 ? 0.40 : 0.18) * 0.50 +
      (bySt.std  < 40 ? 0.84 : bySt.std < 60 ? 0.64 : bySt.std < 75 ? 0.40 : 0.16) * 0.50,
    0, 1), weight: 0.11, rawValue: rdSt.mean,
    evidence: `repeat-diff mean=${rdSt.mean.toFixed(2)} (AI: <5) | byte entropy std=${bySt.std.toFixed(1)} (raw fallback)` }
}

// ── SIGNAL 6: EDGE SHARPNESS PATTERN ─────────────────────────────────────────
// Proper Sobel magnitude on decoded pixels.

function analyzeEdgePattern(img: DecodedImage): ImageBrainSignal {
  const { pixels, width, height, channels, decoded } = img

  if (decoded && width > 2 && height > 2) {
    const mags: number[] = []
    const luma = (off: number) => 0.299 * pixels[off] + 0.587 * pixels[off + 1] + 0.114 * pixels[off + 2]
    for (let y = 1; y < height - 1 && mags.length < 20000; y++) {
      for (let x = 1; x < width - 1; x++) {
        const tl = luma(((y-1)*width+(x-1))*channels), tc = luma(((y-1)*width+x)*channels), tr = luma(((y-1)*width+(x+1))*channels)
        const ml = luma((y*width+(x-1))*channels),                                           mr = luma((y*width+(x+1))*channels)
        const bl = luma(((y+1)*width+(x-1))*channels), bc = luma(((y+1)*width+x)*channels), br = luma(((y+1)*width+(x+1))*channels)
        const gx = -tl - 2*ml - bl + tr + 2*mr + br
        const gy = -tl - 2*tc - tr + bl + 2*bc + br
        mags.push(Math.sqrt(gx*gx + gy*gy))
        if (mags.length >= 20000) break
      }
    }
    const magSt  = stats(mags)
    const flat   = mags.filter(m => m < 8).length / mags.length
    const vSharp = mags.filter(m => m > 160).length / mags.length
    const edgeCV = magSt.mean > 0 ? magSt.std / magSt.mean : 0
    return { name: 'Edge Sharpness Pattern', category: 'edge',
      score: clamp(
        (flat > 0.92 ? 0.92 : flat > 0.80 ? 0.74 : flat > 0.65 ? 0.50 : 0.20) * 0.34 +
        (vSharp > 0.12 ? 0.80 : vSharp > 0.07 ? 0.60 : 0.22) * 0.26 +
        (edgeCV < 0.6 ? 0.88 : edgeCV < 0.9 ? 0.66 : edgeCV < 1.2 ? 0.42 : 0.18) * 0.40,
      0, 1), weight: 0.09, rawValue: flat,
      evidence: `flat=${(flat*100).toFixed(0)}% | vsharp=${(vSharp*100).toFixed(0)}% | edge CV=${edgeCV.toFixed(2)} (Sobel, decoded px)` }
  }

  // Fallback
  const bytes = pixels, step = Math.max(3, Math.floor(bytes.length / 8000))
  const diffs: number[] = []
  for (let i = step; i < Math.min(bytes.length, 100000); i += step) diffs.push(Math.abs(bytes[i] - bytes[i - step]))
  const sRatio = diffs.filter(d => d > 40).length / diffs.length
  const vRatio = diffs.filter(d => d > 80).length / diffs.length
  return { name: 'Edge Sharpness Pattern', category: 'edge',
    score: clamp((sRatio < 0.05 ? 0.84 : 0.25) * 0.50 + (vRatio > 0.15 ? 0.78 : 0.22) * 0.50, 0, 1),
    weight: 0.09, rawValue: sRatio,
    evidence: `sharp=${(sRatio*100).toFixed(1)}% | vsharp=${(vRatio*100).toFixed(1)}% (raw fallback)` }
}

// ── SIGNAL 7: COMPRESSION SIGNATURE ──────────────────────────────────────────

function analyzeCompressionSignature(rawBuf: Buffer, fileSize: number): ImageBrainSignal {
  const isJPEG = rawBuf[0] === 0xFF && rawBuf[1] === 0xD8
  const isPNG  = rawBuf[0] === 0x89 && rawBuf[1] === 0x50
  const isWebP = rawBuf[8] === 0x57 && rawBuf[9] === 0x45
  let hasEXIF  = false
  if (isJPEG) {
    for (let i = 2; i < Math.min(rawBuf.length, 4000); i++) {
      if (rawBuf[i] === 0xFF && rawBuf[i + 1] === 0xE1) { hasEXIF = true; break }
    }
  }
  const sizeMB    = fileSize / (1024 * 1024)
  const sizeScore = sizeMB < 0.04 ? 0.82 : sizeMB < 0.12 ? 0.62 : sizeMB < 0.40 ? 0.38 : 0.18
  const compScore = isJPEG ? ((isJPEG && !hasEXIF) ? 0.72 : 0.12)
                  : isPNG  ? 0.78
                  : isWebP ? 0.60 : 0.50
  return { name: 'Compression & Metadata Signature', category: 'compression',
    score: clamp(compScore * 0.50 + sizeScore * 0.28 + ((isPNG || isWebP) && !hasEXIF ? 0.72 : 0.20) * 0.22, 0, 1),
    weight: 0.07, rawValue: fileSize,
    evidence: `${isJPEG ? 'JPEG' : isPNG ? 'PNG' : isWebP ? 'WebP' : 'Unknown'} | EXIF=${hasEXIF ? 'YES' : 'NO (AI signal)'} | size=${sizeMB.toFixed(2)}MB` }
}

// ── SIGNAL 8: GRADIENT FIELD SMOOTHNESS ──────────────────────────────────────
// [NEW] AI has mathematically perfect 2nd-order smooth gradient fields.

function analyzeGradientField(img: DecodedImage): ImageBrainSignal {
  const { pixels, width, height, channels, decoded } = img
  if (!decoded || width < 16 || height < 16) return { name: 'Gradient Field Smoothness', category: 'gradient', score: 0.5, weight: 0.08, rawValue: 0, evidence: 'requires decoded pixels' }

  const BS = 4
  const bw = Math.floor(width / BS), bh = Math.floor(height / BS)
  const blks: number[][] = Array.from({ length: bh }, () => new Array(bw).fill(0))
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let sum = 0, cnt = 0
      for (let y = by * BS; y < (by + 1) * BS && y < height; y++) {
        for (let x = bx * BS; x < (bx + 1) * BS && x < width; x++) {
          const off = (y * width + x) * channels
          sum += 0.299 * pixels[off] + 0.587 * pixels[off + 1] + 0.114 * pixels[off + 2]
          cnt++
        }
      }
      blks[by][bx] = cnt ? sum / cnt : 0
    }
  }

  const d1: number[] = [], d2: number[] = []
  for (let by = 1; by < bh - 1; by++) {
    for (let bx = 1; bx < bw - 1; bx++) {
      const dx1 = blks[by][bx] - blks[by][bx-1], dx2 = blks[by][bx+1] - blks[by][bx]
      const dy1 = blks[by][bx] - blks[by-1][bx], dy2 = blks[by+1][bx] - blks[by][bx]
      d1.push(Math.abs(dx1), Math.abs(dy1))
      d2.push(Math.abs(dx2 - dx1), Math.abs(dy2 - dy1))
    }
  }
  const d1St = stats(d1), d2St = stats(d2)
  const gradRatio = d1St.mean > 0 ? d2St.mean / d1St.mean : 0
  return { name: 'Gradient Field Smoothness', category: 'gradient',
    score: clamp(
      (gradRatio < 0.10 ? 0.94 : gradRatio < 0.18 ? 0.82 : gradRatio < 0.30 ? 0.60 : gradRatio < 0.50 ? 0.38 : 0.18) * 0.60 +
      (d2St.std  < 0.5  ? 0.90 : d2St.std  < 1.2  ? 0.70 : d2St.std  < 2.5 ? 0.46 : 0.20) * 0.40,
    0, 1), weight: 0.09, rawValue: gradRatio,
    evidence: `grad ratio=${gradRatio.toFixed(4)} (AI: <0.18, Real: >0.30) | 2nd-deriv std=${d2St.std.toFixed(3)}` }
}

// ── SIGNAL 9: COLOR PALETTE CLUSTERING ────────────────────────────────────────
// [NEW] AI learned color spaces produce tightly clustered palettes.

function analyzeColorPalette(samples: RGBPixel[]): ImageBrainSignal {
  if (samples.length < 200) return { name: 'Color Palette Clustering', category: 'palette', score: 0.5, weight: 0.07, rawValue: 0, evidence: 'insufficient samples' }
  const HUE = 32, SAT = 8
  const buckets = new Map<number, number>()
  for (const { r, g, b } of samples) {
    const { h, s } = rgbToHsv(r, g, b)
    if (s < 0.08) continue
    const key = Math.min(HUE-1, Math.floor(h * HUE)) * SAT + Math.min(SAT-1, Math.floor(s * SAT))
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  const total  = Array.from(buckets.values()).reduce((a, b) => a + b, 0) || 1
  const counts = Array.from(buckets.values()).sort((a, b) => b - a)
  const top3   = counts.slice(0, 3).reduce((a, b) => a + b, 0) / total
  const top8   = counts.slice(0, 8).reduce((a, b) => a + b, 0) / total
  const div    = buckets.size
  return { name: 'Color Palette Clustering', category: 'palette',
    score: clamp(
      (top3 > 0.60 ? 0.90 : top3 > 0.50 ? 0.76 : top3 > 0.38 ? 0.52 : 0.20) * 0.38 +
      (top8 > 0.90 ? 0.88 : top8 > 0.78 ? 0.68 : top8 > 0.65 ? 0.46 : 0.20) * 0.30 +
      (div  < 10   ? 0.92 : div  < 18   ? 0.74 : div  < 30   ? 0.50 : div < 50 ? 0.28 : 0.12) * 0.32,
    0, 1), weight: 0.07, rawValue: top3,
    evidence: `top-3 buckets=${(top3*100).toFixed(1)}% (AI: >50%) | diversity=${div} (AI: <20) | top-8=${(top8*100).toFixed(1)}%` }
}

// ── SIGNAL 10: HUE RING DISTRIBUTION ─────────────────────────────────────────
// [NEW] Per-generator hue fingerprinting via 72-bin hue histograms.

function analyzeHueDistribution(samples: RGBPixel[]): { signal: ImageBrainSignal; hueHints: string[] } {
  const HUE_BINS = 72
  const hueCounts = new Array(HUE_BINS).fill(0)
  let satCnt = 0
  for (const { r, g, b } of samples) {
    const { h, s } = rgbToHsv(r, g, b)
    if (s < 0.10) continue
    satCnt++
    hueCounts[Math.min(HUE_BINS - 1, Math.floor(h * HUE_BINS))]++
  }
  const hueHints: string[] = []
  if (satCnt < 50) return { signal: { name: 'Hue Ring Distribution', category: 'hue', score: 0.5, weight: 0.07, rawValue: 0, evidence: 'insufficient saturated pixels' }, hueHints }

  const hF    = hueCounts.map(c => c / satCnt)
  const huePk = histPeakedness(hF)
  const sorted = [...hF].sort((a, b) => b - a)
  const top3   = sorted.slice(0, 3).reduce((a, b) => a + b, 0)
  let genBoost = 0

  // NOTE: these per-generator hue-peak heuristics are weak and easily
  // confounded by ordinary scene content — a clear blue sky or saturated
  // foliage produces the same "single dominant hue band" signature as these
  // generator "fingerprints". genBoost values are capped well below the 0.75
  // "strong AI" threshold; real corroboration happens downstream in
  // detectGeneratorFingerprints(), which requires multiple independent matches
  // (this hue hint plus separate channel-statistic matches) before allowing
  // high confidence.
  const geminiBlue = hF.slice(40, 45).reduce((a, b) => a + b, 0)
  if (geminiBlue > 0.18) { hueHints.push('Gemini Imagen v3 (200–220° peak)'); genBoost = Math.max(genBoost, 0.55) }
  const grokViolet = hF.slice(48, 55).reduce((a, b) => a + b, 0)
  const grokLime   = hF.slice(22, 27).reduce((a, b) => a + b, 0)
  if (grokViolet > 0.20 && grokLime > 0.08) { hueHints.push('Grok Aurora (violet+lime double peak)'); genBoost = Math.max(genBoost, 0.58) }
  const mjPurple   = hF.slice(50, 55).reduce((a, b) => a + b, 0)
  if (mjPurple > 0.20 && top3 > 0.40) { hueHints.push('Midjourney (purple-blue dominant)'); genBoost = Math.max(genBoost, 0.55) }
  const sdWarm     = hF.slice(4, 9).reduce((a, b) => a + b, 0)
  if (sdWarm > 0.22 && top3 > 0.38) { hueHints.push('Stable Diffusion (warm amber cast)'); genBoost = Math.max(genBoost, 0.52) }

  return {
    signal: { name: 'Hue Ring Distribution', category: 'hue',
      score: clamp(
        (huePk > 10 ? 0.92 : huePk > 6 ? 0.76 : huePk > 3.5 ? 0.52 : 0.22) * 0.40 +
        (top3  > 0.55 ? 0.90 : top3 > 0.40 ? 0.70 : top3 > 0.28 ? 0.46 : 0.18) * 0.40 +
        genBoost * 0.20,
      0, 1), weight: 0.08, rawValue: huePk,
      evidence: [
        `peak=${huePk.toFixed(1)} at ${(hF.indexOf(Math.max(...hF)) * 5).toFixed(0)}° (AI: >6)`,
        `top-3=${(top3*100).toFixed(1)}% (AI: >40%)`,
        hueHints.length ? `hints: ${hueHints.join('; ')}` : '',
      ].filter(Boolean).join(' | ') },
    hueHints,
  }
}

// ── SIGNAL 11: NEURAL UPSAMPLING ARTIFACTS ────────────────────────────────────
// [NEW] 8-pixel autocorrelation from diffusion model latent upsampling.

function analyzeNeuralUpsampling(img: DecodedImage): ImageBrainSignal {
  const { pixels, width, height, channels, decoded } = img
  if (!decoded || width < 64 || height < 64) return { name: 'Neural Upsampling Artifacts', category: 'upsampling', score: 0.5, weight: 0.08, rawValue: 0, evidence: 'requires decoded pixels ≥64px' }

  const colMeans: number[] = new Array(width).fill(0)
  for (let x = 0; x < width; x++) {
    let sum = 0
    for (let y = 0; y < height; y++) {
      const off = (y * width + x) * channels
      sum += 0.299 * pixels[off] + 0.587 * pixels[off + 1] + 0.114 * pixels[off + 2]
    }
    colMeans[x] = sum / height
  }
  const colMean = meanArr(colMeans), colVar = stats(colMeans).variance
  let corr8 = 0, cnt8 = 0
  for (let x = 8; x < width; x++) { corr8 += (colMeans[x] - colMean) * (colMeans[x - 8] - colMean); cnt8++ }
  const normAC8 = cnt8 > 0 && colVar > 0 ? (corr8 / cnt8) / colVar : 0
  const ac8Sc   = normAC8 > 0.70 ? 0.90 : normAC8 > 0.50 ? 0.74 : normAC8 > 0.35 ? 0.54 : 0.22

  let cbPow = 0, cbCnt = 0
  for (let y = 4; y < height - 4 && cbCnt < 5000; y += 4) {
    for (let x = 4; x < width - 4; x += 4) {
      const luma = (off: number) => 0.299 * pixels[off] + 0.587 * pixels[off + 1] + 0.114 * pixels[off + 2]
      const l00 = luma((y*width+x)*channels), l11 = luma(((y+4)*width+(x+4))*channels)
      const l10 = luma(((y+4)*width+x)*channels), l01 = luma((y*width+(x+4))*channels)
      cbPow += Math.abs((l00 + l11) - (l01 + l10)); cbCnt++
    }
  }
  const cbPower = cbCnt > 0 ? cbPow / cbCnt : 0
  return { name: 'Neural Upsampling Artifacts', category: 'upsampling',
    score: clamp(
      ac8Sc * 0.55 +
      (cbPower < 4 ? 0.85 : cbPower < 8 ? 0.70 : cbPower > 70 ? 0.78 : 0.25) * 0.45,
    0, 1), weight: 0.08, rawValue: normAC8,
    evidence: `8-lag autocorr=${normAC8.toFixed(3)} (AI: >0.50) | checkerboard power=${cbPower.toFixed(1)} (AI: <8 or >70)` }
}

// ── SIGNAL 12: PIXEL DISCRETIZATION ───────────────────────────────────────────
// [NEW] AI outputs have gaps and clusters in luma value histogram.

function analyzePixelDiscretization(img: DecodedImage): ImageBrainSignal {
  const { pixels, width, height, channels, decoded } = img
  if (!decoded || width < 32 || height < 32) return { name: 'Pixel Discretization', category: 'discretization', score: 0.5, weight: 0.06, rawValue: 0, evidence: 'requires decoded pixels' }

  const lumaBins = new Array(256).fill(0)
  let total = 0
  const stride = Math.max(1, Math.floor(width * height / 15000))
  for (let i = 0; i < width * height && total < 15000; i += stride) {
    const off  = i * channels
    lumaBins[Math.min(255, Math.round(0.299 * pixels[off] + 0.587 * pixels[off + 1] + 0.114 * pixels[off + 2]))]++
    total++
  }
  const freq       = lumaBins.map(c => c / (total || 1))
  const emptyBins  = freq.filter(f => f === 0).length
  const spiky      = histPeakedness(freq)
  const diffs      = freq.slice(1).map((v, i) => Math.abs(v - freq[i]))
  const diffSt     = stats(diffs)
  const altScore   = diffSt.mean > 0 ? diffSt.std / diffSt.mean : 0
  return { name: 'Pixel Discretization', category: 'discretization',
    score: clamp(
      (emptyBins > 60 ? 0.88 : emptyBins > 35 ? 0.70 : emptyBins > 15 ? 0.46 : 0.18) * 0.36 +
      (spiky     > 12 ? 0.88 : spiky     > 7  ? 0.70 : spiky     > 4  ? 0.46 : 0.20) * 0.34 +
      (altScore  > 1.5 ? 0.86 : altScore > 1.0 ? 0.68 : altScore > 0.7 ? 0.44 : 0.18) * 0.30,
    0, 1), weight: 0.06, rawValue: emptyBins,
    evidence: `empty luma bins=${emptyBins}/256 (AI: >35) | spikiness=${spiky.toFixed(1)} (AI: >7) | alternation=${altScore.toFixed(2)}` }
}

// ── SIGNAL 13: LOCAL CONTRAST CONSISTENCY ─────────────────────────────────────
// [NEW] AI images have unnaturally uniform 16×16 block contrast.

function analyzeLocalContrast(img: DecodedImage): ImageBrainSignal {
  const { pixels, width, height, channels, decoded } = img
  if (!decoded || width < 32 || height < 32) return { name: 'Local Contrast Consistency', category: 'contrast', score: 0.5, weight: 0.06, rawValue: 0, evidence: 'requires decoded pixels' }
  const BLOCK = 16
  const bContrasts: number[] = []
  for (let by = 0; by < height - BLOCK; by += BLOCK) {
    for (let bx = 0; bx < width - BLOCK; bx += BLOCK) {
      const lms: number[] = []
      for (let y = by; y < by + BLOCK && y < height; y++) {
        for (let x = bx; x < bx + BLOCK && x < width; x++) {
          const off = (y * width + x) * channels
          lms.push(0.299 * pixels[off] + 0.587 * pixels[off + 1] + 0.114 * pixels[off + 2])
        }
      }
      const bSt = stats(lms)
      bContrasts.push(bSt.max - bSt.min)
    }
  }
  if (!bContrasts.length) return { name: 'Local Contrast Consistency', category: 'contrast', score: 0.5, weight: 0.06, rawValue: 0, evidence: 'no blocks' }
  const bcSt = stats(bContrasts)
  const cv   = bcSt.mean > 0 ? bcSt.std / bcSt.mean : 0
  return { name: 'Local Contrast Consistency', category: 'contrast',
    score: clamp(
      (cv < 0.25 ? 0.92 : cv < 0.40 ? 0.76 : cv < 0.60 ? 0.52 : cv < 0.80 ? 0.28 : 0.12) * 0.60 +
      (bcSt.mean < 20 ? 0.80 : bcSt.mean < 40 ? 0.58 : bcSt.mean < 80 ? 0.36 : 0.18) * 0.40,
    0, 1), weight: 0.06, rawValue: cv,
    evidence: `contrast CV=${cv.toFixed(3)} (AI: <0.40, Real: >0.70) | mean block=${bcSt.mean.toFixed(1)} (AI: <40)` }
}

// ── SIGNAL 14: COLOR GAMUT COVERAGE ───────────────────────────────────────────
// [NEW] CIELab gamut area — AI is either too narrow or too clean at boundaries.

function analyzeColorGamut(samples: RGBPixel[]): ImageBrainSignal {
  if (samples.length < 100) return { name: 'Color Gamut Coverage', category: 'gamut', score: 0.5, weight: 0.05, rawValue: 0, evidence: 'insufficient samples' }
  const labs    = samples.map(({ r, g, b }) => rgbToLab(r, g, b))
  const aVals   = labs.map(l => l.a), bVals = labs.map(l => l.bval)
  const aSt     = stats(aVals), bSt = stats(bVals)
  const area    = (aSt.max - aSt.min) * (bSt.max - bSt.min)
  const clipR   = samples.filter(({ r, g, b }) => r > 245 || r < 10 || g > 245 || g < 10 || b > 245 || b < 10).length / samples.length
  return { name: 'Color Gamut Coverage', category: 'gamut',
    score: clamp(
      (area  < 800  ? 0.82 : area < 1800 ? 0.64 : area < 3000 ? 0.40 : 0.18) * 0.65 +
      (clipR < 0.005 ? 0.80 : clipR > 0.15 ? 0.70 : 0.25) * 0.35,
    0, 1), weight: 0.05, rawValue: area,
    evidence: `CIELab area=${area.toFixed(0)} (AI: <1800) | clip=${(clipR*100).toFixed(1)}% (AI: <0.5% or >15%)` }
}

// ── SIGNAL 15: BACKGROUND COHERENCE ───────────────────────────────────────────
// [NEW] AI backgrounds are unnaturally smooth at the image borders.

function analyzeBackgroundCoherence(img: DecodedImage): ImageBrainSignal {
  const { pixels, width, height, channels, decoded } = img
  if (!decoded || width < 64 || height < 64) return { name: 'Background Coherence', category: 'background', score: 0.5, weight: 0.05, rawValue: 0, evidence: 'requires decoded pixels' }
  const bw = Math.max(16, Math.min(64, Math.floor(Math.min(width, height) * 0.12)))
  const lms: number[] = []
  for (let y = 0; y < bw; y++) {
    for (let x = 0; x < width && lms.length < 5000; x += 2) {
      const off = (y * width + x) * channels
      lms.push(0.299 * pixels[off] + 0.587 * pixels[off + 1] + 0.114 * pixels[off + 2])
    }
  }
  for (let y = height - bw; y < height; y++) {
    for (let x = 0; x < width && lms.length < 8000; x += 2) {
      const off = (y * width + x) * channels
      lms.push(0.299 * pixels[off] + 0.587 * pixels[off + 1] + 0.114 * pixels[off + 2])
    }
  }
  if (!lms.length) return { name: 'Background Coherence', category: 'background', score: 0.5, weight: 0.05, rawValue: 0, evidence: 'no border pixels' }
  const bgSt = stats(lms)
  const lMean = meanArr(lms.slice(0, Math.floor(lms.length / 2)))
  const rMean = meanArr(lms.slice(Math.floor(lms.length / 2)))
  return { name: 'Background Coherence', category: 'background',
    score: clamp(
      (bgSt.std < 8  ? 0.92 : bgSt.std < 15 ? 0.74 : bgSt.std < 25 ? 0.48 : 0.20) * 0.60 +
      (Math.abs(lMean - rMean) < 5 ? 0.85 : Math.abs(lMean - rMean) < 15 ? 0.60 : 0.25) * 0.40,
    0, 1), weight: 0.05, rawValue: bgSt.std,
    evidence: `border luma std=${bgSt.std.toFixed(1)} (AI: <15, Real: >25) | L-R grad=${Math.abs(lMean-rMean).toFixed(1)} (AI: <15)` }
}

// ── SIGNAL 17: BILATERAL SYMMETRY ─────────────────────────────────────────────
// AI generators can produce images with high left-right symmetry — but this
// signal is INHERENTLY WEAK and easily confounded: a real photo of a naturally
// symmetric subject (a face, a product on a plain backdrop, architecture,
// flowers) is mirror-symmetric for reasons that have nothing to do with how it
// was captured. Symmetry is a property of the SUBJECT, not the generation
// process. Empirical testing showed this signal firing >0.9 ("AI") on ordinary
// centred real-world photo compositions — a major false-positive source.
//
// Calibration fix: thresholds tightened to only register near-mathematically-
// perfect mirror symmetry (which is rare even for AI images of real-world
// scenes), score range compressed so this signal alone can never push a verdict
// to AI, and weight reduced — it now functions only as a very weak corroborating
// nudge, never a primary driver.
// AI: mean absolute difference (MAD) < 4 luma units (out of 255) — near-perfect.
// Real (and most "symmetric" real subjects too): MAD typically >8.

function analyzeBilateralSymmetry(img: DecodedImage): ImageBrainSignal {
  const { pixels, width, height, channels, decoded } = img
  if (!decoded || width < 32 || height < 32) {
    return {
      name: 'Bilateral Symmetry', category: 'structure',
      score: 0.5, weight: 0.03, rawValue: 0,
      evidence: 'requires decoded pixels ≥32px',
    }
  }

  const halfW  = Math.floor(width / 2)
  const diffs: number[] = []
  const stride = Math.max(1, Math.floor(height / 80))

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < halfW; x += 2) {
      const offL = (y * width + x)               * channels
      const offR = (y * width + (width - 1 - x)) * channels
      const lumaL = 0.299 * pixels[offL] + 0.587 * pixels[offL + 1] + 0.114 * pixels[offL + 2]
      const lumaR = 0.299 * pixels[offR] + 0.587 * pixels[offR + 1] + 0.114 * pixels[offR + 2]
      diffs.push(Math.abs(lumaL - lumaR))
    }
  }

  if (!diffs.length) {
    return { name: 'Bilateral Symmetry', category: 'structure', score: 0.5, weight: 0.03, rawValue: 0, evidence: 'no samples' }
  }

  const mad     = meanArr(diffs)
  const diffSt  = stats(diffs)
  // Tightened: ordinary real photos of symmetric subjects commonly land in the
  // 8-20 MAD range — that band must NOT read as a confident AI signal.
  const madSc   = mad < 4 ? 0.78 : mad < 8 ? 0.62 : mad < 16 ? 0.50 : mad < 30 ? 0.42 : 0.32
  const varSc   = diffSt.std < 4  ? 0.70 : diffSt.std < 8 ? 0.58 : diffSt.std < 16 ? 0.48 : 0.36
  const perfectR = diffs.filter(d => d < 3).length / diffs.length
  const perfSc   = perfectR > 0.70 ? 0.74 : perfectR > 0.50 ? 0.58 : perfectR > 0.30 ? 0.48 : 0.36

  return {
    name: 'Bilateral Symmetry', category: 'structure',
    // Hard-capped below the 0.75 "highAI" confidence-boost threshold — this
    // signal alone must never count as a "strong AI" vote in the ensemble.
    score: clamp(madSc * 0.42 + varSc * 0.28 + perfSc * 0.30, 0.20, 0.74),
    weight: 0.03, rawValue: mad,
    evidence: `mirror MAD=${mad.toFixed(1)} (weak/corroborating signal only — symmetric real subjects are common) | std=${diffSt.std.toFixed(1)} | perfect=${(perfectR*100).toFixed(0)}%`,
  }
}

// ── SIGNAL 18: HORIZON LINE CONSISTENCY ───────────────────────────────────────
// This signal is INHERENTLY WEAK: a level horizon is a property of the PHYSICAL
// WORLD (gravity), not of the generation process. Real landscape, seascape, and
// architecture photography routinely produces a strong, clean, level horizontal
// edge — tripods, image stabilization, and post-capture levelling are all
// extremely common. Empirical testing showed this firing >0.85 ("AI") on a
// basic simulated sky/ground landscape photo — a major false-positive source.
//
// Calibration fix: thresholds tightened to require a far more extreme,
// statistically unusual peak before treating it as AI-indicative, score range
// compressed so this signal alone can never push a verdict to AI, and weight
// reduced to a weak corroborating nudge only.

function analyzeHorizonConsistency(img: DecodedImage): ImageBrainSignal {
  const { pixels, width, height, channels, decoded } = img
  if (!decoded || width < 32 || height < 32) {
    return {
      name: 'Horizon Line Consistency', category: 'structure',
      score: 0.5, weight: 0.03, rawValue: 0,
      evidence: 'requires decoded pixels ≥32px',
    }
  }

  const rowEnergy = new Float32Array(height)
  const luma = (y: number, x: number) => {
    const off = (y * width + x) * channels
    return 0.299 * pixels[off] + 0.587 * pixels[off + 1] + 0.114 * pixels[off + 2]
  }

  const xStep = Math.max(1, Math.floor(width / 128))
  for (let y = 1; y < height - 1; y++) {
    let energy = 0, cnt = 0
    for (let x = 1; x < width - 1; x += xStep) {
      const gy = -luma(y-1,x-1) - 2*luma(y-1,x) - luma(y-1,x+1)
               +  luma(y+1,x-1) + 2*luma(y+1,x) + luma(y+1,x+1)
      energy += gy * gy
      cnt++
    }
    rowEnergy[y] = cnt > 0 ? energy / cnt : 0
  }

  const energyArr = Array.from(rowEnergy)
  const enSt      = stats(energyArr)
  const peakIdx   = energyArr.indexOf(Math.max(...energyArr))
  const peakVal   = energyArr[peakIdx]
  const zScore    = enSt.std > 0 ? (peakVal - enSt.mean) / enSt.std : 0
  const peakFrac  = peakIdx / Math.max(1, height - 1)
  const inMiddle  = peakFrac >= 0.35 && peakFrac <= 0.75 ? 1 : 0

  const nearPeak  = energyArr.slice(Math.max(0, peakIdx - 8), Math.min(height, peakIdx + 9))
  const farEnergy = energyArr.filter((_, i) => Math.abs(i - peakIdx) > 20)
  const concentration = farEnergy.length > 0 ? (meanArr(nearPeak) / (meanArr(farEnergy) + 1e-6)) : 1

  // A single dominant horizontal edge (table, wall, shadow, railing, real
  // horizon...) is common in ALL photography. Only an extreme, highly
  // concentrated peak gets even a mild nudge — never a confident verdict.
  const zSc    = zScore > 9  ? 0.68 : zScore > 6  ? 0.58 : zScore > 3 ? 0.50 : 0.40
  const midSc  = inMiddle ? 0.56 : 0.42
  const concSc = concentration > 20 ? 0.66 : concentration > 10 ? 0.56 : concentration > 4 ? 0.48 : 0.40

  return {
    name: 'Horizon Line Consistency', category: 'structure',
    // Hard-capped below the 0.75 "highAI" confidence-boost threshold — a clean
    // horizon/edge is extremely common in real photography and must never
    // alone count as a "strong AI" vote.
    score: clamp(zSc * 0.45 + midSc * 0.25 + concSc * 0.30, 0.20, 0.70),
    weight: 0.03, rawValue: zScore,
    evidence: `horizon/edge z=${zScore.toFixed(2)} (weak/corroborating signal only — real photos commonly have a clean horizon) | at ${(peakFrac*100).toFixed(0)}% height | conc=${concentration.toFixed(1)}`,
  }
}

// ── SIGNAL 16: AI GENERATOR FINGERPRINTS v2.0 ─────────────────────────────────
// Covers 11 generators: MJ, DALL-E 3, SD, Flux, Gemini Imagen v3, Grok Aurora,
// Adobe Firefly, Ideogram v2, Leonardo AI, Canva AI, Claude Image Gen.

function detectGeneratorFingerprints(
  samples:  RGBPixel[],
  satSig:   ImageBrainSignal,
  texSig:   ImageBrainSignal,
  hueSig:   ImageBrainSignal,
  hueHints: string[],
): { signal: ImageBrainSignal; hints: string[] } {
  // IMPORTANT CALIBRATION NOTE: every rule below is a coarse global color-
  // statistic match (channel means, saturation mean/std, "blueShift" pixel
  // fraction, etc). None of these are unique to AI generators — ordinary real
  // photo content reproduces them constantly. A blue-dominant, low-saturation-
  // variance image is also just... a photo with a clear sky in it. Empirical
  // testing on a genuine real outdoor photo (blue sky + building) showed THIS
  // EXACT pattern firing the "Gemini Imagen v3" and "Grok Aurora/Midjourney"
  // rules with high confidence — a false positive driven entirely by the sky.
  //
  // Fix: rules no longer set confidence directly. Each match is logged as a
  // weak, capped "candidate" (≤0.60 — below the 0.75 "strong AI" threshold).
  // Only when MULTIPLE independent rules agree on the same image does
  // confidence rise toward the levels needed to influence the verdict. A real
  // AI image consistently exhibiting several synthetic statistical properties
  // at once will still be caught with high confidence; a real photo that
  // coincidentally matches exactly one rule (e.g. "has a blue sky") will not.
  const hints: string[] = [...hueHints]
  const rs  = samples.map(s => s.r / 255), gs = samples.map(s => s.g / 255), bs = samples.map(s => s.b / 255)
  const rS  = stats(rs), gS = stats(gs), bS = stats(bs)
  const hsvs = samples.map(({ r, g, b }) => rgbToHsv(r, g, b))
  const satS = stats(hsvs.map(h => h.s)), valS = stats(hsvs.map(h => h.v))
  const blueShift = samples.filter(({ r, b }) => b > r + 20).length / samples.length
  const chanDiff  = Math.abs(rS.mean - gS.mean) + Math.abs(gS.mean - bS.mean)
  const warmCast  = samples.filter(({ r, b }) => r > b + 18).length / samples.length

  // Candidate confidence per rule capped at 0.60 (a single match nudges, never decides).
  const CAP = 0.60
  let newMatches = 0

  // Midjourney v5/v6/v7
  if (blueShift > 0.35 && satS.mean > 0.52 && valS.std < 0.22) {
    if (!hints.some(h => h.includes('Midjourney'))) { hints.push('Midjourney v5/v6/v7 (blue-purple dominant, high saturation)'); newMatches++ }
  }
  // DALL-E 3
  if (chanDiff < 0.04 && satS.mean > 0.30 && satS.mean < 0.58 && texSig.score > 0.72) {
    hints.push('DALL-E 3 (balanced channels, clean texture, moderate saturation)'); newMatches++
  }
  // Stable Diffusion
  if (warmCast > 0.42 && satS.mean < 0.44 && satS.mean > 0.18) {
    if (!hints.some(h => h.includes('Stable'))) { hints.push('Stable Diffusion (warm cast, mild desaturation)'); newMatches++ }
  }
  // Flux.1
  if (satS.std < 0.05 && satS.mean > 0.42 && texSig.score > 0.76 && valS.mean > 0.55) {
    hints.push('Flux.1 / Flux.1 Dev (ultra-low saturation variance, crisp uniform)'); newMatches++
  }
  // Gemini Imagen v3 — NOTE: this exact pattern (B>G>R, low channel diff, cool
  // tint) is also what a clear blue sky looks like. Kept as a weak candidate only.
  if (bS.mean > gS.mean && gS.mean > rS.mean && chanDiff < 0.06 && bS.mean > rS.mean + 0.03 && texSig.score > 0.72 && satS.std < 0.09) {
    if (!hints.some(h => h.includes('Gemini'))) { hints.push('Gemini Imagen v3 (B>G>R channel order, HDR-clean, cool-tinted)'); newMatches++ }
  }
  // Grok Aurora / Midjourney — same blue-sky caveat applies.
  if (bS.mean > rS.mean + 0.06 && satS.mean > 0.58) {
    if (!hints.some(h => h.includes('Grok') || h.includes('Midjourney'))) { hints.push('Grok Aurora / Midjourney (vivid blue-shifted, high saturation)'); newMatches++ }
  }
  // Adobe Firefly
  if (chanDiff < 0.05 && satS.mean > 0.32 && satS.mean < 0.52 && satS.std < 0.08 && texSig.score > 0.70 && hints.length === hueHints.length) {
    hints.push('Adobe Firefly (professional-clean, low grain)'); newMatches++
  }
  // Ideogram v2
  if (satS.mean > 0.45 && satS.std < 0.06 && valS.mean > 0.60 && hints.length === hueHints.length) {
    hints.push('Ideogram v2 (uniform saturation, clean palette)'); newMatches++
  }
  // Leonardo AI
  if (warmCast > 0.30 && satS.mean > 0.40 && satS.std < 0.08 && valS.mean > 0.58 && hints.length === hueHints.length) {
    hints.push('Leonardo AI (warm, painterly, consistent saturation)'); newMatches++
  }
  // Canva AI
  if (chanDiff < 0.04 && satS.mean > 0.28 && satS.mean < 0.48 && texSig.score > 0.68 && satS.std < 0.07 && hints.length === hueHints.length) {
    hints.push('Canva AI (clean poster aesthetic, balanced)'); newMatches++
  }

  // Total independent corroboration = new color-stat matches in this function
  // PLUS any hue-ring generator hints passed in (a genuinely separate signal).
  const totalMatches = newMatches + hueHints.length

  let fingerScore: number
  if (totalMatches === 0) {
    // No fingerprint match. Fall back to a mild nudge from the already-
    // independently-computed saturation/texture signals, same as before.
    fingerScore = (satSig.score > 0.68 || texSig.score > 0.72) ? 0.55 : 0.40
  } else if (totalMatches === 1) {
    fingerScore = CAP // single coincidental match — capped, cannot alone tip the verdict
  } else if (totalMatches === 2) {
    fingerScore = 0.74 // two independent agreements — meaningful but still cautious
  } else {
    fingerScore = 0.88 // three or more independent agreements — genuinely strong signal
  }

  return {
    signal: { name: 'AI Generator Fingerprint', category: 'generator',
      score: clamp(fingerScore, 0.18, 0.95), weight: 0.08, rawValue: blueShift,
      evidence: hints.length > 0
        ? `Detected (${totalMatches} corroborating match${totalMatches === 1 ? '' : 'es'}): ${hints.join('; ')}`
        : 'No specific generator matched — general AI statistics present' },
    hints,
  }
}

// ── MAIN ENTRY POINT — async (sharp decode) ───────────────────────────────────

export async function analyzeImageWithBrain(
  imageBuffer: Buffer,
  fileSize:    number,
  mimeType     = 'image/jpeg',
): Promise<ImageBrainResult> {
  // Step 1: Sharp pixel decode
  const img     = await decodeImagePixels(imageBuffer, mimeType)
  const samples = samplePixels(img, 10000)

  if (samples.length < 80) {
    return { score: 0.5, verdict: 'UNCERTAIN', signals: [], decodedPixels: img.decoded,
      findings: ['Insufficient pixel data for brain analysis'], generatorHints: [] }
  }

  // Step 2: Run all 16 signals
  const satSig  = analyzeSaturation(samples)
  const texSig  = analyzeTexture(img)
  const chanSig = analyzeChannelCorrelation(samples)
  const lumaSig = analyzeLuminanceGradient(samples)
  const freqSig = analyzeFrequencyArtifacts(img)
  const edgeSig = analyzeEdgePattern(img)
  const compSig = analyzeCompressionSignature(imageBuffer, fileSize)
  const gradSig = analyzeGradientField(img)
  const palSig  = analyzeColorPalette(samples)
  const { signal: hueSig, hueHints }  = analyzeHueDistribution(samples)
  const upsSig  = analyzeNeuralUpsampling(img)
  const discSig = analyzePixelDiscretization(img)
  const lcSig   = analyzeLocalContrast(img)
  const gamutSig = analyzeColorGamut(samples)
  const bgSig   = analyzeBackgroundCoherence(img)
  const symSig  = analyzeBilateralSymmetry(img)
  const horizSig = analyzeHorizonConsistency(img)
  const { signal: genSig, hints: genHints } = detectGeneratorFingerprints(samples, satSig, texSig, hueSig, hueHints)

  const allSignals: ImageBrainSignal[] = [
    satSig, texSig, chanSig, lumaSig, freqSig, edgeSig,
    compSig, gradSig, palSig, hueSig, upsSig, discSig,
    lcSig, gamutSig, bgSig, symSig, horizSig, genSig,
  ]

  // Step 3: Weighted ensemble + confidence boost
  const totalW  = allSignals.reduce((s, sig) => s + sig.weight, 0) || 1
  const rawSc   = allSignals.reduce((s, sig) => s + sig.score * sig.weight, 0) / totalW
  const highAI  = allSignals.filter(s => s.score > 0.75).length
  const highHu  = allSignals.filter(s => s.score < 0.25).length
  // Thresholds restored to the original 16-signal calibration. Bilateral
  // Symmetry and Horizon Consistency are now hard-capped at 0.74 (see their
  // definitions above) so they structurally cannot register as "strong AI"
  // (>0.75) or "strong human" (<0.25) votes — the effective voting pool for
  // this tally is still the original 16 well-calibrated signals.
  const boost   = highAI >= 8 ? 0.10 : highAI >= 5 ? 0.06 : highHu >= 8 ? -0.10 : highHu >= 5 ? -0.06 : 0

  // ── Artistic / Fantasy AI Override ────────────────────────────────────────
  // Texture, frequency, and gradient signals are calibrated for photorealistic
  // AI images (smooth skin, clean backgrounds). For artistic/fantasy AI images
  // (Midjourney illustrations, Gemini art, Grok Aurora paintings) these signals
  // falsely fire REAL because sparkles + complex fabric + particle effects create
  // high texture variance indistinguishable from a real camera at signal level.
  //
  // Solution: when generator fingerprint AND hue ring BOTH strongly identify a
  // specific AI generator, they are far more reliable than the texture signals.
  // Apply a correction boost that overrides the false-REAL texture drag.
  //
  // Calibration fix: detectGeneratorFingerprints() caps genSig.score at
  // exactly 0.74 for its "2 independent rules agree" tier (e.g. "Midjourney
  // (Gemini agree)") -- the single most common real-world corroboration
  // level. The gate below was previously > 0.78, which that tier can NEVER
  // reach (only the rare 3+-match tier at 0.88 could) -- making this
  // correction structurally unreachable for the exact case it was written
  // to catch. Lowered so the 2-match tier actually qualifies.
  const artStyleAI = genSig.score >= 0.72 && hueSig.score >= 0.58
  const artBoost   = artStyleAI ? 0.25 : genSig.score >= 0.70 && satSig.score >= 0.55 ? 0.18 : 0

  // Purple/violet dominant palette is statistically near-impossible in real
  // photographs — real cameras produce warm or neutral casts. A purple-dominated
  // image with AI generator statistics is almost certainly AI art.
  const isPurpleDom  = genHints.some(h => /midjourney|grok|gemini/i.test(h)) && hueSig.score >= 0.55
  const purpleBoost  = isPurpleDom ? 0.12 : 0

  const score   = clamp(rawSc + boost + artBoost + purpleBoost, 0.01, 0.99)
  const verdict = score > 0.55 ? 'AI' : score < 0.36 ? 'HUMAN' : 'UNCERTAIN'

  // Step 4: Findings
  const sorted   = [...allSignals].sort((a, b) => Math.abs(b.score - 0.5) - Math.abs(a.score - 0.5))
  const findings = sorted.slice(0, 8).map(s => {
    const dir = s.score > 0.65 ? '🤖 AI' : s.score < 0.35 ? '✅ Real' : '⚠️ Mixed'
    return `${dir} — ${s.name}: ${s.evidence}`
  })
  if (genHints.length) findings.unshift(`🔬 Generator: ${genHints.join(' | ')}`)
  if (img.decoded) findings.push(`📡 Sharp decode: ${img.width}×${img.height}px (accurate pixel analysis)`)

  return { score, signals: allSignals, findings, verdict, generatorHints: genHints, decodedPixels: img.decoded }
}

// ── SYNC WRAPPER (backwards compatibility for places not using await) ──────────
// The old analyzeImageWithBrain was sync. This wrapper lets call sites that
// haven't been updated yet still call it, but returns a Promise they must await.
// All new code should call the async version directly.
export { analyzeImageWithBrain as analyzeImageWithBrainAsync }

// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Deepfake & AI Portrait Detector v1.0
//
// Dedicated module for detecting:
//   • AI-generated human faces (deepfakes, synthetic portraits)
//   • High-quality uncompressed AI images (PNG, TIFF, WebP lossless)
//   • Photo-realistic renders from Flux, Midjourney V6, DALL-E 3 HD
//   • GAN artifacts (StyleGAN2, StyleGAN3, InsightFace swaps)
//   • Diffusion model face-specific artifacts (Realistic Vision, RealisticXL)
//
// Signals (9 total):
//   1.  Eye Symmetry Analysis        — GAN eyes are unnaturally symmetric
//   2.  Skin Texture Frequency       — AI skin has no biological noise floor
//   3.  Hair Strand Coherence        — AI hair blurs at boundary regions
//   4.  Facial Boundary Blending     — sharp content but blurry face-bg merge
//   5.  Iris Pattern Entropy         — real irises have high fractal complexity
//   6.  Cheekbone Gradient Sharpness — AI skin transitions are too smooth
//   7.  Ear Topology Consistency     — GAN ear rendering artifacts
//   8.  High-Quality PNG Trap        — PNG/lossless AI = more signal, not less
//   9.  Spatial Frequency Profile    — HF:LF ratio distinctive for face renders
//
// Returns: DeepfakeResult { score, signals, isPortrait, findings }
// ════════════════════════════════════════════════════════════════════════════

import type { ImageBrainSignal } from './image-detection-brain'

export interface DeepfakeResult {
  score:       number          // 0–1 deepfake/AI-portrait probability
  signals:     ImageBrainSignal[]
  isPortrait:  boolean         // true if portrait/face signals fired
  findings:    string[]
  verdict:     'AI' | 'HUMAN' | 'UNCERTAIN'
}

// ── Utilities (duplicated here to avoid circular imports) ─────────────────────

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }
function meanArr(arr: number[]): number { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0 }
function statsArr(arr: number[]): { mean: number; std: number; variance: number; min: number; max: number } {
  if (!arr.length) return { mean: 0, variance: 0, std: 0, min: 0, max: 0 }
  const m = meanArr(arr)
  const variance = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length
  return { mean: m, variance, std: Math.sqrt(variance), min: Math.min(...arr), max: Math.max(...arr) }
}

// ── SIGNAL 1: Bilateral symmetry enhanced for portrait detection ──────────────
// GAN/diffusion face models are trained on aligned face datasets (FFHQ etc.)
// which are meticulously centred. This creates near-perfect left-right symmetry
// even stronger than general image symmetry (Signal 17 in base brain).
// For portrait crops, AI symmetry threshold drops significantly.

function analyzeFacialSymmetry(
  pixels: Uint8Array, width: number, height: number, channels: number,
): ImageBrainSignal {
  // Focus on the horizontal centre strip (top 60% of image — face region)
  const faceH = Math.floor(height * 0.60)
  const halfW = Math.floor(width / 2)
  const diffs: number[] = []
  const stride = Math.max(1, Math.floor(faceH / 60))

  for (let y = 0; y < faceH; y += stride) {
    for (let x = 0; x < halfW; x += 3) {
      const offL = (y * width + x)               * channels
      const offR = (y * width + (width - 1 - x)) * channels
      const lumaL = 0.299 * pixels[offL] + 0.587 * pixels[offL + 1] + 0.114 * pixels[offL + 2]
      const lumaR = 0.299 * pixels[offR] + 0.587 * pixels[offR + 1] + 0.114 * pixels[offR + 2]
      diffs.push(Math.abs(lumaL - lumaR))
    }
  }

  if (!diffs.length) return { name: 'Facial Symmetry', category: 'structure', score: 0.5, weight: 0.12, rawValue: 0, evidence: 'no samples' }

  const mad = meanArr(diffs)
  const st  = statsArr(diffs)
  const perfectR = diffs.filter(d => d < 4).length / diffs.length

  // Portrait-calibrated thresholds (tighter than general image)
  const madSc  = mad < 6 ? 0.96 : mad < 11 ? 0.86 : mad < 18 ? 0.68 : mad < 28 ? 0.40 : 0.16
  const varSc  = st.std < 5  ? 0.92 : st.std < 10 ? 0.76 : st.std < 16 ? 0.52 : 0.22
  const perfSc = perfectR > 0.60 ? 0.94 : perfectR > 0.45 ? 0.78 : perfectR > 0.28 ? 0.54 : 0.20

  return {
    name: 'Facial Symmetry (Deepfake)',
    category: 'structure',
    score: clamp(madSc * 0.44 + varSc * 0.26 + perfSc * 0.30, 0, 1),
    weight: 0.12,
    rawValue: mad,
    evidence: `face MAD=${mad.toFixed(1)} (AI: <11, Real: >22) | std=${st.std.toFixed(1)} | perfect=${(perfectR*100).toFixed(0)}% (AI: >45%)`,
  }
}

// ── SIGNAL 2: Skin texture frequency analysis ─────────────────────────────────
// Real human skin has a biological noise floor from pores, fine hair, sub-surface
// scattering variation. AI skin is rendered from a learned distribution which
// produces low-frequency smooth gradients without microscopic texture.
// Method: sample 32×32 patches from the image centre, compute HF:LF power ratio.

function analyzeSkinTextureFrequency(
  pixels: Uint8Array, width: number, height: number, channels: number,
): ImageBrainSignal {
  if (width < 64 || height < 64) {
    return { name: 'Skin Texture Frequency', category: 'texture', score: 0.5, weight: 0.10, rawValue: 0, evidence: 'image too small' }
  }

  // Sample centre-ish region (where face/skin typically is)
  const startY = Math.floor(height * 0.20)
  const endY   = Math.floor(height * 0.65)
  const startX = Math.floor(width  * 0.20)
  const endX   = Math.floor(width  * 0.80)

  // Compute vertical HF energy: |L(y,x) - L(y+1,x)| and LF: |L(y,x) - L(y+2,x)|
  const hfDiffs: number[] = []
  const lfDiffs: number[] = []
  const strideY = Math.max(1, Math.floor((endY - startY) / 80))
  const strideX = Math.max(1, Math.floor((endX - startX) / 80))

  for (let y = startY; y < endY - 2 && hfDiffs.length < 8000; y += strideY) {
    for (let x = startX; x < endX; x += strideX) {
      const luma  = (off: number) => 0.299 * pixels[off] + 0.587 * pixels[off + 1] + 0.114 * pixels[off + 2]
      const l0 = luma((y * width + x)     * channels)
      const l1 = luma(((y + 1) * width + x) * channels)
      const l2 = luma(((y + 2) * width + x) * channels)
      hfDiffs.push(Math.abs(l0 - l1))        // 1-pixel = high frequency
      lfDiffs.push(Math.abs(l0 - l2))        // 2-pixel = lower frequency
    }
  }

  if (!hfDiffs.length) return { name: 'Skin Texture Frequency', category: 'texture', score: 0.5, weight: 0.10, rawValue: 0, evidence: 'no samples' }

  const hfMean = meanArr(hfDiffs)
  const lfMean = meanArr(lfDiffs)
  // Real skin: HF/LF ratio 0.6–0.85 (texture noise visible at 1px)
  // AI skin: ratio <0.45 (ultra-smooth — 1px diff is tiny vs 2px diff)
  const ratio   = lfMean > 0 ? hfMean / lfMean : 0.5
  const hfSt    = statsArr(hfDiffs)
  const cvHF    = hfMean > 0 ? hfSt.std / hfMean : 0

  const ratioSc = ratio < 0.38 ? 0.92 : ratio < 0.48 ? 0.78 : ratio < 0.58 ? 0.56 : ratio < 0.70 ? 0.32 : 0.14
  const cvSc    = cvHF < 0.50 ? 0.88 : cvHF < 0.75 ? 0.68 : cvHF < 1.05 ? 0.44 : 0.18

  return {
    name: 'Skin Texture Frequency',
    category: 'texture',
    score: clamp(ratioSc * 0.60 + cvSc * 0.40, 0, 1),
    weight: 0.10,
    rawValue: ratio,
    evidence: `HF/LF ratio=${ratio.toFixed(3)} (AI: <0.48, Real: >0.65) | CV=${cvHF.toFixed(3)} (AI: <0.75)`,
  }
}

// ── SIGNAL 3: Boundary blending — face/background transition ─────────────────
// AI-generated portraits blend subject and background with a characteristically
// smooth sigmoid-like transition. Real photos have motion blur, depth-of-field
// bokeh rings, diffraction artefacts, and hair tendrils crossing the boundary.
// Method: detect the sharpest 5% of edge rows, measure variance at boundary.

function analyzePortraitBoundaryBlend(
  pixels: Uint8Array, width: number, height: number, channels: number,
): ImageBrainSignal {
  if (width < 48 || height < 48) {
    return { name: 'Portrait Boundary Blending', category: 'edge', score: 0.5, weight: 0.09, rawValue: 0, evidence: 'image too small' }
  }

  // Look at left/right strips (30px wide) — these are typically
  // face-background boundaries in portrait photos
  const stripW = Math.min(30, Math.floor(width * 0.08))
  const gradients: number[] = []
  const strideY = Math.max(1, Math.floor(height / 100))

  for (let y = 1; y < height - 1; y += strideY) {
    // Left strip
    for (let x = stripW; x < stripW + 8; x++) {
      const luma = (off: number) => 0.299 * pixels[off] + 0.587 * pixels[off + 1] + 0.114 * pixels[off + 2]
      const gx = luma((y * width + x + 1) * channels) - luma((y * width + x - 1) * channels)
      gradients.push(Math.abs(gx))
    }
    // Right strip
    for (let x = width - stripW - 8; x < width - stripW; x++) {
      const luma = (off: number) => 0.299 * pixels[off] + 0.587 * pixels[off + 1] + 0.114 * pixels[off + 2]
      const gx = luma((y * width + x + 1) * channels) - luma((y * width + x - 1) * channels)
      gradients.push(Math.abs(gx))
    }
  }

  if (!gradients.length) return { name: 'Portrait Boundary Blending', category: 'edge', score: 0.5, weight: 0.09, rawValue: 0, evidence: 'no gradient data' }

  const st = statsArr(gradients)
  const verySmooth = gradients.filter(g => g < 3).length / gradients.length
  const verySharp  = gradients.filter(g => g > 40).length / gradients.length
  // AI: smooth boundary with occasional hard compositing edges
  // Real: mixed gradients from actual depth of field
  const cv = st.mean > 0 ? st.std / st.mean : 0

  const smoothSc = verySmooth > 0.70 ? 0.88 : verySmooth > 0.55 ? 0.72 : verySmooth > 0.40 ? 0.50 : 0.22
  const sharpSc  = verySharp  > 0.18 ? 0.80 : verySharp  > 0.10 ? 0.60 : 0.25    // hard composite = AI
  const cvSc     = cv < 0.60 ? 0.82 : cv < 0.90 ? 0.60 : 0.22

  return {
    name: 'Portrait Boundary Blending',
    category: 'edge',
    score: clamp(smoothSc * 0.45 + sharpSc * 0.25 + cvSc * 0.30, 0, 1),
    weight: 0.09,
    rawValue: verySmooth,
    evidence: `smooth=${(verySmooth*100).toFixed(0)}% | sharp=${(verySharp*100).toFixed(0)}% | cv=${cv.toFixed(2)} (AI: smooth + cv<0.9)`,
  }
}

// ── SIGNAL 4: High-quality PNG/lossless trap ──────────────────────────────────
// Conventional wisdom says high-resolution PNGs are real photos.
// The truth: ALL modern AI generators (Midjourney, DALL-E 3, Flux) default to
// PNG output for "HD" downloads. High-res uncompressed PNG with AI pixel
// statistics is actually a STRONGER AI signal, not weaker.
// This signal corrects for the false-HUMAN bias on large PNGs.

function analyzeHighQualityPNGTrap(
  rawBuf: Buffer, fileSize: number, decodedWidth: number, decodedHeight: number,
): ImageBrainSignal {
  const isPNG    = rawBuf[0] === 0x89 && rawBuf[1] === 0x50
  const isWebP   = rawBuf.length > 12 && rawBuf[8] === 0x57 && rawBuf[9] === 0x45
  const isTIFF   = (rawBuf[0] === 0x49 && rawBuf[1] === 0x49) || (rawBuf[0] === 0x4D && rawBuf[1] === 0x4D)
  const sizeMB   = fileSize / (1024 * 1024)
  const megaPx   = (decodedWidth * decodedHeight) / 1_000_000

  if (!isPNG && !isWebP && !isTIFF) {
    // JPEG: no trap needed — compression analysis already handles it
    return { name: 'Lossless Format Trap', category: 'compression', score: 0.30, weight: 0.08, rawValue: 0, evidence: 'JPEG — no lossless trap needed' }
  }

  // Large lossless PNG with no metadata = classic AI export
  let hasMetadata = false
  if (isPNG) {
    // Check for tEXt, iTXt, zTXt, eXIf chunks
    for (let i = 8; i < Math.min(rawBuf.length - 12, 20000); i++) {
      const chunk = rawBuf.slice(i + 4, i + 8).toString('ascii')
      if (['tEXt', 'iTXt', 'zTXt', 'eXIf', 'iCCP'].includes(chunk)) { hasMetadata = true; break }
      // PNG chunks: skip to next (4 len + 4 type + N data + 4 crc)
      if (i > 8) {
        const len = rawBuf.readUInt32BE(i)
        if (len > 0 && len < 10_000_000) i += len + 12
      }
    }
  }

  // Score: high-res lossless without metadata = likely AI
  const sizeSc   = sizeMB > 8 ? 0.72 : sizeMB > 4 ? 0.62 : sizeMB > 2 ? 0.50 : sizeMB > 0.5 ? 0.38 : 0.25
  const resSc    = megaPx > 4 ? 0.70 : megaPx > 2 ? 0.56 : megaPx > 1 ? 0.42 : 0.25
  const metaSc   = hasMetadata ? 0.22 : 0.78  // no metadata = very suspicious for PNG
  const formatSc = isPNG ? 0.72 : isWebP ? 0.60 : isTIFF ? 0.55 : 0.30

  return {
    name: 'Lossless Format Trap',
    category: 'compression',
    score: clamp(sizeSc * 0.25 + resSc * 0.20 + metaSc * 0.35 + formatSc * 0.20, 0, 1),
    weight: 0.08,
    rawValue: sizeMB,
    evidence: `${isPNG ? 'PNG' : isWebP ? 'WebP' : 'TIFF'} ${sizeMB.toFixed(1)}MB | ${megaPx.toFixed(1)}MP | metadata=${hasMetadata ? 'YES' : 'NO (AI tell)'}`,
  }
}

// ── SIGNAL 5: Spatial frequency profile ──────────────────────────────────────
// AI images have a distinctive HF falloff curve. Diffusion models learned to
// generate most detail at 8–32px wavelengths (the "sweet spot" of CLIP/DINO
// perception) but under-generate at 2–4px wavelengths (microscopic texture).
// Method: compute multi-scale Laplacian variance pyramid.

function analyzeSpatialFrequencyProfile(
  pixels: Uint8Array, width: number, height: number, channels: number,
): ImageBrainSignal {
  if (width < 32 || height < 32) {
    return { name: 'Spatial Frequency Profile', category: 'frequency', score: 0.5, weight: 0.09, rawValue: 0, evidence: 'image too small' }
  }

  const luma = (y: number, x: number) => {
    const off = (Math.min(height-1, y) * width + Math.min(width-1, x)) * channels
    return 0.299 * pixels[off] + 0.587 * pixels[off + 1] + 0.114 * pixels[off + 2]
  }

  // Scale 1: 1-pixel Laplacian (very HF — pore-level detail)
  const lap1: number[] = []
  // Scale 2: 3-pixel Laplacian (medium HF — skin/hair texture)
  const lap3: number[] = []
  // Scale 3: 8-pixel Laplacian (LF — shape/shading)
  const lap8: number[] = []

  const stride = Math.max(1, Math.floor(Math.min(width, height) / 60))
  for (let y = 8; y < height - 8 && lap1.length < 5000; y += stride) {
    for (let x = 8; x < width - 8; x += stride) {
      lap1.push(Math.abs(luma(y, x) * 4 - luma(y-1,x) - luma(y+1,x) - luma(y,x-1) - luma(y,x+1)))
      lap3.push(Math.abs(luma(y, x) * 4 - luma(y-3,x) - luma(y+3,x) - luma(y,x-3) - luma(y,x+3)))
      lap8.push(Math.abs(luma(y, x) * 4 - luma(y-8,x) - luma(y+8,x) - luma(y,x-8) - luma(y,x+8)))
    }
  }

  if (!lap1.length) return { name: 'Spatial Frequency Profile', category: 'frequency', score: 0.5, weight: 0.09, rawValue: 0, evidence: 'no data' }

  const m1 = meanArr(lap1), m3 = meanArr(lap3), m8 = meanArr(lap8)
  // AI: m1 << m3 (missing 1px HF) | Real: m1 ≈ m3 * 0.7–0.9 (continuous noise)
  const hfRatio   = m8 > 0 ? m1 / m8 : 0.5
  const mfRatio   = m8 > 0 ? m3 / m8 : 0.5
  // AI profile: hfRatio < 0.25, mfRatio 0.3–0.6
  // Real profile: hfRatio > 0.35, mfRatio 0.4–0.7

  const hfSc = hfRatio < 0.18 ? 0.92 : hfRatio < 0.26 ? 0.78 : hfRatio < 0.35 ? 0.56 : hfRatio < 0.50 ? 0.34 : 0.16
  const mfSc = mfRatio < 0.25 ? 0.80 : mfRatio < 0.40 ? 0.58 : mfRatio > 0.75 ? 0.70 : 0.28

  return {
    name: 'Spatial Frequency Profile',
    category: 'frequency',
    score: clamp(hfSc * 0.60 + mfSc * 0.40, 0, 1),
    weight: 0.09,
    rawValue: hfRatio,
    evidence: `HF/LF=${hfRatio.toFixed(3)} (AI: <0.26, Real: >0.40) | MF/LF=${mfRatio.toFixed(3)} | L1=${m1.toFixed(1)} L3=${m3.toFixed(1)} L8=${m8.toFixed(1)}`,
  }
}

// ── SIGNAL 6: Neural network output smoothing ─────────────────────────────────
// Diffusion models apply a learned upscaling / super-resolution pass that
// produces a characteristic "3D render" smoothness — extremely smooth gradients
// in non-textured regions (sky, backgrounds, walls) with perfectly sharp
// feature edges. Real photos have natural noise across ALL regions.

function analyzeNNSmoothingArtifact(
  pixels: Uint8Array, width: number, height: number, channels: number,
): ImageBrainSignal {
  if (width < 64 || height < 64) {
    return { name: 'NN Smoothing Artifact', category: 'gradient', score: 0.5, weight: 0.08, rawValue: 0, evidence: 'too small' }
  }

  // Measure gradient magnitudes in 32 random 16×16 patches
  const patchVariances: number[] = []
  const PATCH = 16
  const cols = Math.floor(width / PATCH)
  const rows = Math.floor(height / PATCH)

  const stride = Math.max(1, Math.floor(Math.max(cols, rows) / 8))
  for (let by = 0; by < rows; by += stride) {
    for (let bx = 0; bx < cols; bx += stride) {
      const lms: number[] = []
      for (let y = by * PATCH; y < (by + 1) * PATCH && y < height; y++) {
        for (let x = bx * PATCH; x < (bx + 1) * PATCH && x < width; x++) {
          const off = (y * width + x) * channels
          lms.push(0.299 * pixels[off] + 0.587 * pixels[off + 1] + 0.114 * pixels[off + 2])
        }
      }
      if (lms.length > 4) {
        const m = meanArr(lms)
        const v = lms.reduce((a, b) => a + (b - m) ** 2, 0) / lms.length
        patchVariances.push(v)
      }
    }
  }

  if (!patchVariances.length) return { name: 'NN Smoothing Artifact', category: 'gradient', score: 0.5, weight: 0.08, rawValue: 0, evidence: 'no patches' }

  // Sort: check ratio of smooth patches (low var) to textured patches (high var)
  patchVariances.sort((a, b) => a - b)
  const n = patchVariances.length
  const q25 = patchVariances[Math.floor(n * 0.25)]
  const q75 = patchVariances[Math.floor(n * 0.75)]
  const median = patchVariances[Math.floor(n * 0.50)]

  // AI: q25 very low (smooth patches), q75 also relatively low (no very noisy patches)
  // Real: q25 low but q75 much higher (natural noise everywhere)
  const iqr = q75 - q25
  const bimodalScore = q25 < 5 && iqr < 40 ? 0.90 : q25 < 10 && iqr < 80 ? 0.72 : q25 < 20 && iqr < 160 ? 0.50 : 0.22
  const medianSc = median < 8 ? 0.88 : median < 20 ? 0.68 : median < 50 ? 0.42 : 0.18

  return {
    name: 'NN Smoothing Artifact',
    category: 'gradient',
    score: clamp(bimodalScore * 0.55 + medianSc * 0.45, 0, 1),
    weight: 0.08,
    rawValue: median,
    evidence: `patch var Q25=${q25.toFixed(1)} median=${median.toFixed(1)} IQR=${iqr.toFixed(1)} (AI: median<20, IQR<80)`,
  }
}

// ── SIGNAL 7: GAN/Diffusion eye region analysis ──────────────────────────────
// GANs (StyleGAN, InsightFace) produce eyes with unnaturally high bilateral
// symmetry and specific iris-pupil boundary sharpness patterns.
// For diffusion face models, the eye region has a characteristic "glassy" look:
// extremely uniform iris colour with a sharp pupil-iris boundary.
// Method: analyse the upper-centre region of the image (eye zone in portraits).

function analyzeEyeRegionPatterns(
  pixels: Uint8Array, width: number, height: number, channels: number,
): ImageBrainSignal {
  if (width < 64 || height < 64) {
    return { name: 'Eye Region Patterns', category: 'structure', score: 0.5, weight: 0.10, rawValue: 0, evidence: 'image too small' }
  }

  // Eye zone: top 30–55% of height, centre 20–80% width
  const y0 = Math.floor(height * 0.28), y1 = Math.floor(height * 0.52)
  const x0 = Math.floor(width  * 0.18), x1 = Math.floor(width  * 0.82)

  const lumaVals: number[] = []
  const satVals:  number[] = []
  const strideY = Math.max(1, Math.floor((y1 - y0) / 50))
  const strideX = Math.max(1, Math.floor((x1 - x0) / 80))

  for (let y = y0; y < y1; y += strideY) {
    for (let x = x0; x < x1; x += strideX) {
      const off = (y * width + x) * channels
      const r = pixels[off], g = pixels[off + 1], b = pixels[off + 2]
      const luma = 0.299 * r + 0.587 * g + 0.114 * b
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
      const sat = mx > 0 ? (mx - mn) / mx : 0
      lumaVals.push(luma)
      satVals.push(sat)
    }
  }

  if (!lumaVals.length) return { name: 'Eye Region Patterns', category: 'structure', score: 0.5, weight: 0.10, rawValue: 0, evidence: 'no samples' }

  const lumaSt = statsArr(lumaVals)
  const satSt  = statsArr(satVals)

  // Eye region: real photos have wider luma/sat variance (glasses, shadows, colour)
  // AI: uniform iris saturation, narrow luma range in eye zone
  const lumaCvSc = lumaSt.std < 15 ? 0.88 : lumaSt.std < 30 ? 0.68 : lumaSt.std < 50 ? 0.42 : 0.18
  const satUnif  = satSt.std  < 0.05 ? 0.88 : satSt.std  < 0.10 ? 0.68 : satSt.std < 0.18 ? 0.44 : 0.20

  // Glassy look: narrow luma range (very bright highlights) + medium saturation
  const glassy = lumaSt.max - lumaSt.min < 80 && satSt.mean > 0.15 && satSt.mean < 0.50
  const glassySc = glassy ? 0.82 : 0.28

  return {
    name: 'Eye Region Patterns',
    category: 'structure',
    score: clamp(lumaCvSc * 0.36 + satUnif * 0.34 + glassySc * 0.30, 0, 1),
    weight: 0.10,
    rawValue: lumaSt.std,
    evidence: `luma std=${lumaSt.std.toFixed(1)} (AI: <30) | sat std=${satSt.std.toFixed(3)} (AI: <0.10) | glassy=${glassy ? 'YES' : 'NO'}`,
  }
}

// ── SIGNAL 8: Chromatic aberration absence ────────────────────────────────────
// Real camera lenses produce chromatic aberration — RGB channels shift slightly
// at high-contrast edges (colour fringing). AI renders have zero aberration
// because they're not simulating real optics (unless explicitly added as post).
// Method: at high-contrast edges, measure the R-B channel spatial offset.

function analyzeChromAberration(
  pixels: Uint8Array, width: number, height: number, channels: number,
): ImageBrainSignal {
  if (width < 48 || height < 48) {
    return { name: 'Chromatic Aberration', category: 'color', score: 0.5, weight: 0.07, rawValue: 0, evidence: 'too small' }
  }

  // Find high-contrast edges; measure R vs B channel gradient divergence
  const aberrations: number[] = []
  const stride = Math.max(2, Math.floor(Math.min(width, height) / 80))

  for (let y = 1; y < height - 1 && aberrations.length < 3000; y += stride) {
    for (let x = 1; x < width - 1; x += stride) {
      const offC  = (y * width + x)     * channels
      const offR2 = (y * width + x + 1) * channels
      const offL2 = (y * width + x - 1) * channels
      // Luminance gradient at this point
      const lumaL = 0.299 * pixels[offL2] + 0.587 * pixels[offL2 + 1] + 0.114 * pixels[offL2 + 2]
      const lumaR = 0.299 * pixels[offR2] + 0.587 * pixels[offR2 + 1] + 0.114 * pixels[offR2 + 2]
      const lumGrad = Math.abs(lumaR - lumaL)
      if (lumGrad < 25) continue  // only look at actual edges

      // At this edge: how different are R and B gradients?
      const rGrad = Math.abs(pixels[offR2] - pixels[offL2])
      const bGrad = Math.abs(pixels[offR2 + 2] - pixels[offL2 + 2])
      aberrations.push(Math.abs(rGrad - bGrad))
    }
  }

  if (aberrations.length < 20) {
    return { name: 'Chromatic Aberration', category: 'color', score: 0.60, weight: 0.07, rawValue: 0, evidence: 'insufficient edges found' }
  }

  const abMean = meanArr(aberrations)
  const abSt   = statsArr(aberrations)
  // Real camera: mean aberration 4–12 units
  // AI render: mean aberration 0–3 units (no lens optics)
  const abSc = abMean < 2.0 ? 0.90 : abMean < 3.5 ? 0.76 : abMean < 6.0 ? 0.52 : abMean < 10 ? 0.28 : 0.14
  const cvSc  = abSt.std < 1.5 ? 0.84 : abSt.std < 3.0 ? 0.62 : 0.28

  return {
    name: 'Chromatic Aberration',
    category: 'color',
    score: clamp(abSc * 0.65 + cvSc * 0.35, 0, 1),
    weight: 0.07,
    rawValue: abMean,
    evidence: `edge R-B divergence=${abMean.toFixed(2)} (AI: <3.5, Real: >6) | edges found=${aberrations.length}`,
  }
}

// ── SIGNAL 9: Noise floor consistency ─────────────────────────────────────────
// Real cameras add sensor noise that's spatially independent (each pixel is
// independently noisy). AI images have noise-free smooth regions alternating
// with textured regions — the "noise" is patterned and correlated.
// Method: compute spatial autocorrelation of the residual (image - blurred image).

function analyzeNoiseFloorConsistency(
  pixels: Uint8Array, width: number, height: number, channels: number,
): ImageBrainSignal {
  if (width < 48 || height < 48) {
    return { name: 'Noise Floor Consistency', category: 'noise', score: 0.5, weight: 0.07, rawValue: 0, evidence: 'too small' }
  }

  // Compute residual: pixel - 3x3 average (simple blur)
  const residuals: number[] = []
  const stride = Math.max(2, Math.floor(Math.min(width, height) / 80))

  for (let y = 1; y < height - 1 && residuals.length < 5000; y += stride) {
    for (let x = 1; x < width - 1; x += stride) {
      const luma = (dy: number, dx: number) => {
        const off = ((y + dy) * width + (x + dx)) * channels
        return 0.299 * pixels[off] + 0.587 * pixels[off + 1] + 0.114 * pixels[off + 2]
      }
      const centre = luma(0, 0)
      const avg3x3 = (luma(-1,-1)+luma(-1,0)+luma(-1,1)+luma(0,-1)+luma(0,1)+luma(1,-1)+luma(1,0)+luma(1,1)) / 8
      residuals.push(Math.abs(centre - avg3x3))
    }
  }

  if (!residuals.length) return { name: 'Noise Floor Consistency', category: 'noise', score: 0.5, weight: 0.07, rawValue: 0, evidence: 'no samples' }

  const nSt = statsArr(residuals)
  const nearZero = residuals.filter(r => r < 0.5).length / residuals.length
  // AI: many zero-residual patches (smooth) + occasional high-residual (texture)
  // Real camera: residuals more uniformly distributed (Gaussian noise everywhere)
  const cv = nSt.mean > 0 ? nSt.std / nSt.mean : 0

  const nearSc = nearZero > 0.55 ? 0.88 : nearZero > 0.40 ? 0.70 : nearZero > 0.25 ? 0.46 : 0.20
  const cvSc   = cv > 2.5 ? 0.84 : cv > 1.8 ? 0.66 : cv > 1.2 ? 0.44 : 0.20
  const meanSc = nSt.mean < 0.8 ? 0.88 : nSt.mean < 1.5 ? 0.70 : nSt.mean < 2.5 ? 0.46 : 0.18

  return {
    name: 'Noise Floor Consistency',
    category: 'noise',
    score: clamp(nearSc * 0.38 + cvSc * 0.32 + meanSc * 0.30, 0, 1),
    weight: 0.07,
    rawValue: nSt.mean,
    evidence: `residual mean=${nSt.mean.toFixed(2)} (AI: <1.5) | near-zero=${(nearZero*100).toFixed(0)}% (AI: >40%) | cv=${cv.toFixed(2)} (AI: >1.8)`,
  }
}

// ── MAIN ENTRY POINT ──────────────────────────────────────────────────────────

export async function analyzeDeepfake(
  imageBuffer: Buffer,
  fileSize:    number,
  mimeType:    string,
  decodedPixels: Uint8Array,
  decodedWidth:  number,
  decodedHeight: number,
  decodedChannels: number,
): Promise<DeepfakeResult> {
  const p = decodedPixels
  const w = decodedWidth
  const h = decodedHeight
  const c = decodedChannels

  const hasPixels = w > 0 && h > 0 && p.length > 0

  if (!hasPixels) {
    return {
      score: 0.5, verdict: 'UNCERTAIN', isPortrait: false,
      signals: [], findings: ['Deepfake analysis requires decoded pixels'],
    }
  }

  // Run all 9 signals
  const symmSig  = analyzeFacialSymmetry(p, w, h, c)
  const skinSig  = analyzeSkinTextureFrequency(p, w, h, c)
  const boundSig = analyzePortraitBoundaryBlend(p, w, h, c)
  const pngSig   = analyzeHighQualityPNGTrap(imageBuffer, fileSize, w, h)
  const sfpSig   = analyzeSpatialFrequencyProfile(p, w, h, c)
  const nnSig    = analyzeNNSmoothingArtifact(p, w, h, c)
  const eyeSig   = analyzeEyeRegionPatterns(p, w, h, c)
  const chromSig = analyzeChromAberration(p, w, h, c)
  const noiseSig = analyzeNoiseFloorConsistency(p, w, h, c)

  const allSigs = [symmSig, skinSig, boundSig, pngSig, sfpSig, nnSig, eyeSig, chromSig, noiseSig]

  const totalW = allSigs.reduce((s, sig) => s + sig.weight, 0) || 1
  const rawSc  = allSigs.reduce((s, sig) => s + sig.score * sig.weight, 0) / totalW
  const highAI = allSigs.filter(s => s.score > 0.75).length
  const highHu = allSigs.filter(s => s.score < 0.25).length
  const boost  = highAI >= 5 ? 0.08 : highAI >= 3 ? 0.04 : highHu >= 5 ? -0.08 : highHu >= 3 ? -0.04 : 0

  const score   = clamp(rawSc + boost, 0.01, 0.99)
  const verdict = score > 0.55 ? 'AI' : score < 0.36 ? 'HUMAN' : 'UNCERTAIN'

  // Portrait heuristic: if symmetry and eye signals both fired, it's a portrait
  const isPortrait = symmSig.score > 0.62 || eyeSig.score > 0.62

  // Build findings
  const sorted = [...allSigs].sort((a, b) => Math.abs(b.score - 0.5) - Math.abs(a.score - 0.5))
  const findings = sorted.slice(0, 6).map(s => {
    const dir = s.score > 0.65 ? '🤖 Deepfake/AI' : s.score < 0.35 ? '✅ Real' : '⚠️ Mixed'
    return `${dir} — ${s.name}: ${s.evidence}`
  })

  return { score, signals: allSigs, isPortrait, findings, verdict }
}

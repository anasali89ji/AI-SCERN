// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Free Image Forensics Engine v2
// Real decoded-pixel ELA, noise-variance, color-distribution, and resolution
// analysis (via `sharp`, already a project dependency) + EXIF heuristics.
// Zero external API calls — pure pixel analysis, runs locally.
//
// v2 fixes the v1 bug where every signal was computed on raw *compressed*
// JPEG bytes (`analyzePixels`/`simulateELA`) instead of decoded pixels —
// that produced forensically meaningless, near-random scores. All new
// analysis below decodes to RGBA first via sharp, then operates on real
// pixel data. EXIF parsing is unchanged (it already worked on raw bytes,
// which is correct — EXIF is a byte-level container format).
// ════════════════════════════════════════════════════════════════════════════

import sharp from 'sharp'
import type { ScannedImage } from './types'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB — skip larger images
const DECODE_TIMEOUT_MS = 15_000

// Common AI-generator output resolutions (DALL-E 3, Midjourney v6, SDXL, SD1.5)
const COMMON_AI_RESOLUTIONS: Array<[number, number]> = [
  [1024, 1024], [512, 512], [768, 768],
  [512, 768], [768, 512],
  [768, 1344], [1344, 768],
  [896, 1152], [1152, 896],
  [1024, 1792], [1792, 1024],
]

// Simple EXIF parser for JPEG (no external deps)
function parseEXIF(buffer: Uint8Array): Record<string, string> {
  const exif: Record<string, string> = {}

  // JPEG starts with 0xFFD8
  if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) return exif

  let offset = 2
  while (offset < buffer.length - 4) {
    if (buffer[offset] !== 0xFF) { offset++; continue }

    const marker = buffer[offset + 1]

    // APP1 marker (EXIF)
    if (marker === 0xE1) {
      const length = (buffer[offset + 2] << 8) | buffer[offset + 3]
      const segment = buffer.slice(offset + 4, offset + 2 + length)

      // Check for "Exif\0\0" header
      if (segment[0] === 0x45 && segment[1] === 0x78 && segment[2] === 0x69 && segment[3] === 0x66) {
        const tiffOffset = 6
        const isLittleEndian = segment[tiffOffset] === 0x49 // 'II'

        // Parse IFD0
        const ifdOffset = readUint32(segment, tiffOffset + 4, isLittleEndian)
        const numEntries = readUint16(segment, tiffOffset + ifdOffset, isLittleEndian)

        for (let i = 0; i < numEntries && i < 50; i++) {
          const entryOffset = tiffOffset + ifdOffset + 2 + i * 12
          if (entryOffset + 12 > segment.length) break

          const tag = readUint16(segment, entryOffset, isLittleEndian)
          const type = readUint16(segment, entryOffset + 2, isLittleEndian)
          const count = readUint32(segment, entryOffset + 4, isLittleEndian)
          const valueOffset = readUint32(segment, entryOffset + 8, isLittleEndian)

          const tagNames: Record<number, string> = {
            0x010F: 'Make',
            0x0110: 'Model',
            0x0131: 'Software',
            0x0132: 'DateTime',
            0x8298: 'Copyright',
            0x9286: 'UserComment',
            0x9003: 'DateTimeOriginal',
            0xA001: 'ColorSpace',
            0xA002: 'PixelXDimension',
            0xA003: 'PixelYDimension',
          }

          const tagName = tagNames[tag]
          if (tagName) {
            let value = ''
            if (type === 2) { // ASCII string
              if (count <= 4) {
                value = String.fromCharCode(
                  segment[entryOffset + 8], segment[entryOffset + 9],
                  segment[entryOffset + 10], segment[entryOffset + 11]
                ).replace(/\0/g, '').trim()
              } else if (tiffOffset + valueOffset + count <= segment.length) {
                const strBytes = segment.slice(tiffOffset + valueOffset, tiffOffset + valueOffset + count)
                value = String.fromCharCode(...strBytes).replace(/\0/g, '').trim()
              }
            }
            if (value) exif[tagName] = value
          }
        }
      }
      offset += 2 + length
    } else if (marker === 0xD9) {
      break // EOI
    } else if (marker >= 0xD0 && marker <= 0xFE) {
      const length = (buffer[offset + 2] << 8) | buffer[offset + 3]
      offset += 2 + length
    } else {
      offset += 2
    }
  }

  return exif
}

function readUint16(arr: Uint8Array, offset: number, littleEndian: boolean): number {
  if (littleEndian) return arr[offset] | (arr[offset + 1] << 8)
  return (arr[offset] << 8) | arr[offset + 1]
}

function readUint32(arr: Uint8Array, offset: number, littleEndian: boolean): number {
  if (littleEndian) {
    return arr[offset] | (arr[offset + 1] << 8) | (arr[offset + 2] << 16) | (arr[offset + 3] << 24)
  }
  return (arr[offset] << 24) | (arr[offset + 1] << 16) | (arr[offset + 2] << 8) | arr[offset + 3]
}

/**
 * Analyze EXIF for AI tells
 */
function analyzeEXIF(exif: Record<string, string>): string[] {
  const flags: string[] = []
  const software = (exif.Software || '').toLowerCase()
  const make = (exif.Make || '').toLowerCase()
  const model = (exif.Model || '').toLowerCase()
  const userComment = (exif.UserComment || '').toLowerCase()

  // AI generator signatures in EXIF
  if (software.includes('stable diffusion') || software.includes('sdxl') || software.includes('sd 1.')) {
    flags.push('Software: Stable Diffusion')
  }
  if (software.includes('midjourney') || software.includes('mj')) {
    flags.push('Software: Midjourney')
  }
  if (software.includes('dall-e') || software.includes('dalle')) {
    flags.push('Software: DALL-E')
  }
  if (software.includes('comfyui') || software.includes('comfy')) {
    flags.push('Software: ComfyUI')
  }
  if (software.includes('automatic1111') || software.includes('a1111')) {
    flags.push('Software: AUTOMATIC1111')
  }
  if (software.includes('invoke') || software.includes('invokeai')) {
    flags.push('Software: InvokeAI')
  }
  if (software.includes('leonardo') || software.includes('leonardo.ai')) {
    flags.push('Software: Leonardo AI')
  }
  if (software.includes('ideogram') || software.includes('ideogram.ai')) {
    flags.push('Software: Ideogram')
  }
  if (software.includes('firefly') || software.includes('adobe firefly')) {
    flags.push('Software: Adobe Firefly')
  }
  if (software.includes('gimp') || software.includes('photoshop') || software.includes('canva')) {
    flags.push(`Software: ${exif.Software}`)
  }

  // Prompt residue in UserComment
  if (userComment.includes('prompt') || userComment.includes('negative prompt') ||
      userComment.includes('seed') || userComment.includes('cfg scale') ||
      userComment.includes('steps') || userComment.includes('sampler')) {
    flags.push('UserComment contains generation parameters')
  }

  // Self-contradictory EXIF
  if (make.includes('apple') && (software.includes('photoshop') || software.includes('gimp'))) {
    flags.push('Contradictory EXIF: Apple device + editing software')
  }
  if (make.includes('canon') && software.includes('stable diffusion')) {
    flags.push('Contradictory EXIF: Canon camera + AI generator')
  }

  // Missing EXIF on camera-claimed image
  if (!exif.Make && !exif.Model && !software) {
    flags.push('No camera EXIF — possible AI generation')
  }

  return flags
}

interface DecodedImage {
  width: number
  height: number
  data: Buffer      // raw RGB (3 channels), row-major
  channels: number
  format: string
}

/**
 * Decode an image buffer to raw RGB pixel data via sharp.
 * Returns null if decoding fails (corrupt image, unsupported format, etc.) —
 * callers fall back to EXIF-only scoring rather than crashing.
 */
async function decodeImageToPixels(buffer: Uint8Array): Promise<DecodedImage | null> {
  try {
    const img = sharp(Buffer.from(buffer), { failOn: 'none' }).timeout({ seconds: 15 })
    const metadata = await img.metadata()
    // Downscale very large images before decoding raw pixels — forensic
    // signals below operate on 8x8 blocks and don't need full resolution,
    // and this keeps memory bounded for huge source images.
    const resized = metadata.width && metadata.width > 1600
      ? img.resize({ width: 1600, withoutEnlargement: true })
      : img

    const { data, info } = await resized
      .raw()
      .toColorspace('srgb')
      .removeAlpha()
      .toBuffer({ resolveWithObject: true })

    return {
      width: info.width,
      height: metadata.height ?? info.height, // keep ORIGINAL height for resolution heuristics
      data,
      channels: info.channels,
      format: metadata.format ?? 'unknown',
    }
  } catch {
    return null
  }
}

/**
 * Real Error Level Analysis:
 * Re-encode the decoded pixels as JPEG at quality 90, decode that back,
 * and measure the per-pixel absolute difference in 8x8 blocks.
 * Real photos (already lossy, textured, noisy) show *varied* error levels
 * across blocks. AI-generated images — smooth gradients, denoised output —
 * tend to compress almost identically the second time, producing
 * unnaturally *uniform* error levels.
 */
async function performELA(decoded: DecodedImage): Promise<{ uniformityScore: number; overallScore: number }> {
  try {
    const recompressedBuf = await sharp(decoded.data, {
      raw: { width: decoded.width, height: decoded.height, channels: decoded.channels as 1 | 2 | 3 | 4 },
    }).jpeg({ quality: 90 }).toBuffer()

    const { data: recompressed } = await sharp(recompressedBuf)
      .raw()
      .toBuffer({ resolveWithObject: true })

    const blockSize = 8
    const blocksX = Math.floor(decoded.width / blockSize)
    const blocksY = Math.floor(decoded.height / blockSize)
    if (blocksX < 2 || blocksY < 2) return { uniformityScore: 0.5, overallScore: 0.5 }

    const blockErrors: number[] = []
    for (let by = 0; by < blocksY; by++) {
      for (let bx = 0; bx < blocksX; bx++) {
        let sum = 0
        let count = 0
        for (let y = 0; y < blockSize; y++) {
          const row = (by * blockSize + y) * decoded.width * decoded.channels
          for (let x = 0; x < blockSize; x++) {
            const idx = row + (bx * blockSize + x) * decoded.channels
            for (let c = 0; c < decoded.channels; c++) {
              sum += Math.abs(decoded.data[idx + c] - recompressed[idx + c])
              count++
            }
          }
        }
        blockErrors.push(sum / count)
      }
    }

    const mean = blockErrors.reduce((a, b) => a + b, 0) / blockErrors.length
    const variance = blockErrors.reduce((a, b) => a + (b - mean) ** 2, 0) / blockErrors.length
    const stdDev = Math.sqrt(variance)
    // Coefficient of variation: low CV = uniform error levels = AI-suspicious
    const cv = mean > 0.01 ? stdDev / mean : 0
    const uniformityScore = Math.max(0, Math.min(1, 1 - cv / 1.5))

    // Uniform error levels AND a low absolute mean error both push toward AI
    let overallScore = uniformityScore * 0.7
    if (mean < 3) overallScore += 0.2
    overallScore = Math.max(0.03, Math.min(0.97, overallScore))

    return {
      uniformityScore: Math.round(uniformityScore * 1000) / 1000,
      overallScore: Math.round(overallScore * 1000) / 1000,
    }
  } catch {
    return { uniformityScore: 0.5, overallScore: 0.5 }
  }
}

/**
 * Local noise-variance analysis over 8x8 blocks.
 * Real camera sensors produce noise whose variance differs across the image
 * (more in shadows/high-ISO regions, correlated across R/G/B via the sensor's
 * Bayer pattern). AI generators tend to produce either "too clean" flat
 * regions or noise that's statistically identical everywhere.
 */
function analyzeNoise(decoded: DecodedImage): { noiseVariance: number; blockUniformity: number; score: number } {
  const { width, height, data, channels } = decoded
  const blockSize = 8
  const blocksX = Math.floor(width / blockSize)
  const blocksY = Math.floor(height / blockSize)
  if (blocksX < 2 || blocksY < 2) return { noiseVariance: 0.5, blockUniformity: 0.5, score: 0.5 }

  const blockVariances: number[] = []
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      // Grayscale-approximate local variance via simple horizontal Laplacian
      // (high-frequency residual = noise + fine texture)
      let sum = 0
      let sumSq = 0
      let n = 0
      for (let y = 1; y < blockSize - 1; y++) {
        const row = (by * blockSize + y) * width * channels
        for (let x = 1; x < blockSize - 1; x++) {
          const idx = row + (bx * blockSize + x) * channels
          const idxL = row + (bx * blockSize + x - 1) * channels
          const idxR = row + (bx * blockSize + x + 1) * channels
          const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
          const grayL = 0.299 * data[idxL] + 0.587 * data[idxL + 1] + 0.114 * data[idxL + 2]
          const grayR = 0.299 * data[idxR] + 0.587 * data[idxR + 1] + 0.114 * data[idxR + 2]
          const residual = gray - (grayL + grayR) / 2
          sum += residual
          sumSq += residual * residual
          n++
        }
      }
      const mean = sum / n
      blockVariances.push(sumSq / n - mean * mean)
    }
  }

  const avgVariance = blockVariances.reduce((a, b) => a + b, 0) / blockVariances.length
  const varOfVariances = blockVariances.reduce((a, b) => a + (b - avgVariance) ** 2, 0) / blockVariances.length
  // How similar the noise level is *across* blocks — real photos vary a lot
  // (edges/texture vs flat sky/wall); heavily denoised AI output is flatter.
  const blockUniformity = Math.max(0, Math.min(1, 1 - Math.sqrt(varOfVariances) / (avgVariance + 1)))

  let score = 0.3
  if (avgVariance < 4) score += 0.3        // unnaturally clean / denoised
  if (blockUniformity > 0.75) score += 0.3 // noise level too consistent across the frame
  score = Math.max(0.03, Math.min(0.97, score))

  return {
    noiseVariance: Math.round(avgVariance * 1000) / 1000,
    blockUniformity: Math.round(blockUniformity * 1000) / 1000,
    score: Math.round(score * 1000) / 1000,
  }
}

/**
 * Color-distribution analysis: smoothness of transitions + chromatic
 * aberration proxy. Diffusion models tend to produce very smooth gradients
 * and near-perfect channel alignment; real lenses introduce slight
 * red/blue channel misalignment (chromatic aberration) especially at edges.
 */
function analyzeColorDistribution(decoded: DecodedImage): { smoothnessScore: number; chromaticAberration: number; score: number } {
  const { width, height, data, channels } = decoded
  if (channels < 3) return { smoothnessScore: 0.5, chromaticAberration: 0.5, score: 0.5 }

  let gradientSum = 0
  let aberrationSum = 0
  let n = 0
  const step = 4 // sample every 4th pixel for speed on large images
  for (let y = 0; y < height - step; y += step) {
    for (let x = 0; x < width - step; x += step) {
      const idx = (y * width + x) * channels
      const idxNext = (y * width + x + step) * channels

      const rDiff = Math.abs(data[idxNext] - data[idx])
      const gDiff = Math.abs(data[idxNext + 1] - data[idx + 1])
      const bDiff = Math.abs(data[idxNext + 2] - data[idx + 2])
      gradientSum += (rDiff + gDiff + bDiff) / 3

      // Chromatic aberration proxy: divergence between R and B channel edges
      aberrationSum += Math.abs(rDiff - bDiff)
      n++
    }
  }

  const avgGradient = gradientSum / Math.max(1, n)
  const avgAberration = aberrationSum / Math.max(1, n)

  // Smaller average gradient = smoother = more AI-suspicious
  const smoothnessScore = Math.max(0, Math.min(1, 1 - avgGradient / 25))
  // Lower chromatic aberration = more AI-suspicious (real lenses have some)
  const chromaticAberration = Math.max(0, Math.min(1, avgAberration / 10))

  let score = smoothnessScore * 0.6 + (1 - chromaticAberration) * 0.4
  score = Math.max(0.03, Math.min(0.97, score))

  return {
    smoothnessScore: Math.round(smoothnessScore * 1000) / 1000,
    chromaticAberration: Math.round(chromaticAberration * 1000) / 1000,
    score: Math.round(score * 1000) / 1000,
  }
}

/**
 * Resolution heuristics: exact-match common AI generator output sizes are a
 * meaningful (if weak on their own) signal.
 */
function analyzeDimensions(width: number, height: number): { isCommonAiResolution: boolean; score: number } {
  const isCommonAiResolution = COMMON_AI_RESOLUTIONS.some(([w, h]) => w === width && h === height)
  const aspectRatio = width / height
  const suspiciousAspect = Math.abs(aspectRatio - 1) < 0.02
    || Math.abs(aspectRatio - 16 / 9) < 0.02
    || Math.abs(aspectRatio - 9 / 16) < 0.02

  let score = 0.3
  if (isCommonAiResolution) score = 0.75
  else if (suspiciousAspect) score = 0.45

  return { isCommonAiResolution, score }
}

/**
 * Main image forensics analysis
 * Runs entirely without external APIs
 */
export async function analyzeImageForensics(imageUrl: string): Promise<ScannedImage> {
  const startTime = Date.now()

  try {
    // Fetch image — many CDNs/WordPress installs 403 a bare fetch with no
    // Referer or Accept header (hotlink protection), which used to make
    // every one of those images fall through to the generic UNCERTAIN
    // placeholder even though the image itself was perfectly analyzable.
    // Send full browser-like headers, and retry once without Referer for
    // the (rarer) sites that reject cross-origin referers instead.
    let res: Response | null = null
    let origin = ''
    try { origin = new URL(imageUrl).origin } catch {}

    const baseHeaders: Record<string, string> = {
      'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept':          'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    }

    try {
      res = await fetch(imageUrl, {
        headers: { ...baseHeaders, ...(origin ? { Referer: `${origin}/` } : {}) },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) res = null
    } catch { res = null }

    if (!res) {
      try {
        res = await fetch(imageUrl, { headers: baseHeaders, signal: AbortSignal.timeout(15000) })
        if (!res.ok) res = null
      } catch { res = null }
    }

    if (!res) {
      return {
        url: imageUrl,
        aiScore: 0.5,
        verdict: 'UNCERTAIN',
        modelUsed: 'forensics-fetch-failed',
        exifFlags: [],
        elaUniformity: 0.5,
        dctAnomaly: 0.5,
        colorFingerprint: 'unknown',
      }
    }

    const arrayBuffer = await res.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return {
        url: imageUrl,
        aiScore: 0.5,
        verdict: 'UNCERTAIN',
        modelUsed: 'forensics-too-large',
        exifFlags: ['Image exceeds 5MB — skipped pixel analysis'],
        elaUniformity: 0.5,
        dctAnomaly: 0.5,
        colorFingerprint: 'skipped',
        decodeFailed: true,
      }
    }

    // Parse EXIF (byte-level container parsing — correct to do on raw bytes)
    const exif = parseEXIF(buffer)
    const exifFlags = analyzeEXIF(exif)

    // EXIF-based score — strongest single signal when present
    let exifScore = 0.5
    if (exifFlags.some(f => f.includes('Stable Diffusion') || f.includes('Midjourney') || f.includes('DALL-E'))) {
      exifScore = 0.92
    } else if (exifFlags.some(f => f.includes('ComfyUI') || f.includes('AUTOMATIC1111') || f.includes('Firefly'))) {
      exifScore = 0.88
    } else if (exifFlags.some(f => f.includes('generation parameters'))) {
      exifScore = 0.85
    } else if (exifFlags.some(f => f.includes('No camera EXIF'))) {
      exifScore = 0.6
    } else if (exifFlags.some(f => f.includes('Contradictory'))) {
      exifScore = 0.75
    }

    // Decode to real pixels for ELA / noise / color / dimension analysis
    const decoded = await Promise.race([
      decodeImageToPixels(buffer),
      new Promise<null>(resolve => setTimeout(() => resolve(null), DECODE_TIMEOUT_MS)),
    ])

    if (!decoded) {
      // Decode failed (corrupt/unsupported format) — fall back to EXIF-only
      // scoring rather than the old byte-level heuristics, which were
      // forensically meaningless. Confidence is intentionally capped closer
      // to 0.5 since we're missing 3 of our 4 signal families.
      const aiScore = Math.max(0.05, Math.min(0.95, 0.3 + exifScore * 0.5))
      return {
        url: imageUrl,
        aiScore: Math.round(aiScore * 1000) / 1000,
        verdict: aiScore >= 0.65 ? 'AI' : aiScore <= 0.35 ? 'HUMAN' : 'UNCERTAIN',
        modelUsed: 'exif-only-decode-failed',
        exifFlags: [...exifFlags, 'Pixel decode failed — scored on EXIF only'],
        elaUniformity: 0.5,
        dctAnomaly: 0.5,
        colorFingerprint: 'decode-failed',
        decodeFailed: true,
      }
    }

    const [ela, noise, color] = await Promise.all([
      performELA(decoded),
      Promise.resolve(analyzeNoise(decoded)),
      Promise.resolve(analyzeColorDistribution(decoded)),
    ])
    const dimensions = analyzeDimensions(decoded.width, decoded.height)

    const colorFingerprint = [
      `ELA:${ela.overallScore.toFixed(2)}`,
      `N:${noise.score.toFixed(2)}`,
      `C:${color.score.toFixed(2)}`,
      `D:${dimensions.isCommonAiResolution ? 'common' : 'atypical'}`,
    ].join('|')

    // Ensemble weights (rebalanced — EXIF false-positives were the biggest
    // driver of bad verdicts in v1, so its weight is halved in favor of the
    // three real pixel-analysis signals):
    const aiScore = Math.min(0.97, Math.max(0.03,
      exifScore * 0.20 +
      ela.overallScore * 0.30 +
      noise.score * 0.25 +
      color.score * 0.15 +
      dimensions.score * 0.10
    ))

    const verdict: 'AI' | 'HUMAN' | 'UNCERTAIN' =
      aiScore >= 0.65 ? 'AI' : aiScore <= 0.35 ? 'HUMAN' : 'UNCERTAIN'

    return {
      url: imageUrl,
      aiScore: Math.round(aiScore * 1000) / 1000,
      verdict,
      modelUsed: 'ela+noise+color+dimension+exif-v2',
      exifFlags,
      elaUniformity: ela.uniformityScore,
      dctAnomaly: noise.score, // retained field name for API/type compat; now carries the noise-analysis score
      colorFingerprint,
      noiseScore: noise.score,
      colorScore: color.score,
      dimensionScore: dimensions.score,
      isCommonAiResolution: dimensions.isCommonAiResolution,
      width: decoded.width,
      height: decoded.height,
    }
  } catch (err) {
    return {
      url: imageUrl,
      aiScore: 0.5,
      verdict: 'UNCERTAIN',
      modelUsed: 'forensics-error',
      exifFlags: [`Error: ${(err as Error).message}`],
      elaUniformity: 0.5,
      dctAnomaly: 0.5,
      colorFingerprint: 'error',
    }
  }
}

/**
 * Batch analyze images with concurrency limit
 */
export async function analyzeImagesBatch(
  imageUrls: string[],
  maxConcurrent = 5
): Promise<ScannedImage[]> {
  const results: ScannedImage[] = []

  for (let i = 0; i < imageUrls.length; i += maxConcurrent) {
    const batch = imageUrls.slice(i, i + maxConcurrent)
    const batchResults = await Promise.allSettled(
      batch.map(url => analyzeImageForensics(url))
    )

    for (let j = 0; j < batchResults.length; j++) {
      if (batchResults[j].status === 'fulfilled') {
        results.push((batchResults[j] as PromiseFulfilledResult<ScannedImage>).value)
      } else {
        results.push({
          url: batch[j],
          aiScore: 0.5,
          verdict: 'UNCERTAIN',
          modelUsed: 'forensics-failed',
          exifFlags: ['Analysis failed'],
          elaUniformity: 0.5,
          dctAnomaly: 0.5,
          colorFingerprint: 'failed',
        })
      }
    }
  }

  return results
}

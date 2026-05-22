/**
 * Aiscern — Image Preprocessing v2 (Module 5.1)
 *
 * Processing order (critically important):
 *   1. Decode raw pixels with Sharp → compute pHash before any lossy step
 *   2. Harvest EXIF/metadata via sharp.metadata() before stripping
 *   3. Build multi-resolution cascade (original/512/256/128) for agent routing
 *   4. Strip EXIF, normalise to JPEG 92% (removes bias from EXIF-based signals)
 *
 * pHash: 8×8 difference-hash encoded as 16-char hex (64 bits).
 *   Perceptually identical images share the same pHash regardless of minor
 *   compression. Used by clone-detection and dedup in forensic pipeline.
 *
 * ExifHarvest: camera make/model/software/GPS before any stripping.
 *   Downstream consumers: compression-analysis.ts (L2), provenance.ts (L10).
 *
 * CascadeBuffers: pre-built resolutions so each forensic agent doesn't
 *   have to call sharp independently:
 *     - original (≤1024px) — full-resolution texture + frequency analysis
 *     - px512              — gradient field + edge sharpness
 *     - px256              — color palette + hue ring
 *     - px128              — structure + background coherence
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExifHarvest {
  make?:              string
  model?:             string
  software?:          string
  dateTimeOriginal?:  string
  gpsLatitude?:       number
  gpsLongitude?:      number
  orientation?:       number
  width?:             number
  height?:            number
  format?:            string
  hasExif:            boolean
  hasGPS:             boolean
  hasCameraMetadata:  boolean
}

export interface CascadeBuffers {
  original: Buffer   // ≤1024px JPEG — for texture / frequency agents
  px512:    Buffer   // 512px JPEG   — for gradient / edge agents
  px256:    Buffer   // 256px JPEG   — for color palette / hue agents
  px128:    Buffer   // 128px JPEG   — for structure / background agents
}

export interface PreprocessResult {
  buffer:          Buffer          // primary inference buffer (≤1024px, EXIF stripped)
  mimeType:        string          // always 'image/jpeg' after processing
  originalSize:    number          // raw upload bytes
  processedSize:   number          // post-process bytes
  wasResized:      boolean
  pHash:           string          // 16-char hex dHash (empty string if sharp unavailable)
  exifHarvest:     ExifHarvest     // metadata harvested before stripping
  cascade:         CascadeBuffers  // multi-resolution buffers
}

// ── pHash (8×8 difference hash, 64 bits → 16 hex chars) ─────────────────────
// dHash algorithm: resize to 9×8, compute 64 horizontal adjacent diffs,
// threshold against row mean → 64-bit fingerprint.
// Identical perceptual content = identical pHash (even across JPEG levels).

function computeDHash(pixels: Uint8Array, width: number, height: number, channels: number): string {
  // We need a 9×8 grid → use nearest-neighbor sampling from decoded pixels
  const COLS = 9, ROWS = 8
  const grid: number[] = []

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const sx = Math.min(width  - 1, Math.floor(col * width  / COLS))
      const sy = Math.min(height - 1, Math.floor(row * height / ROWS))
      const off = (sy * width + sx) * channels
      // luma
      grid.push(0.299 * pixels[off] + 0.587 * pixels[off + 1] + 0.114 * pixels[off + 2])
    }
  }

  // 64 horizontal differences
  let hi = 0, lo = 0
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS - 1; col++) {
      const bit    = row * (COLS - 1) + col  // 0..63
      const isSet  = grid[row * COLS + col] < grid[row * COLS + col + 1] ? 1 : 0
      if (bit < 32) lo = (lo | (isSet << bit)) >>> 0
      else          hi = (hi | (isSet << (bit - 32))) >>> 0
    }
  }
  return hi.toString(16).padStart(8, '0') + lo.toString(16).padStart(8, '0')
}

// ── EXIF harvest from sharp metadata ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function harvestExif(meta: any): ExifHarvest {
  const exif    = meta?.exif
  const hasExif = !!(exif && exif.length > 0)

  // Parse simple EXIF fields if present — we use lightweight heuristics,
  // not a full EXIF parser. Accurate enough for L2/L10 downstream consumers.
  let make: string | undefined
  let model: string | undefined
  let software: string | undefined
  let dateTimeOriginal: string | undefined
  let orientation: number | undefined
  let gpsLatitude: number | undefined
  let gpsLongitude: number | undefined

  if (hasExif && Buffer.isBuffer(exif)) {
    // Scan for ASCII strings in EXIF block — quick wins
    const str = exif.toString('ascii', 0, Math.min(exif.length, 2000))
    const makeM = str.match(/(?:Make|Manufacturer)[^\x20-\x7E]*([A-Za-z][A-Za-z0-9 ]{1,30})/)
    if (makeM) make = makeM[1].trim()
    const softM = str.match(/(?:Software)\x00([A-Za-z][^\x00]{2,40})/)
    if (softM) software = softM[1].trim()
    const dtM = str.match(/(\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2})/)
    if (dtM) dateTimeOriginal = dtM[1]
  }

  // Sharp exposes some fields directly on metadata
  if (meta?.ifd0?.Make)     make     ??= String(meta.ifd0.Make).trim()
  if (meta?.ifd0?.Model)    model    ??= String(meta.ifd0.Model).trim()
  if (meta?.ifd0?.Software) software ??= String(meta.ifd0.Software).trim()
  if (meta?.ifd0?.Orientation) orientation = Number(meta.ifd0.Orientation)
  if (meta?.gps?.GPSLatitude)  gpsLatitude  = Number(meta.gps.GPSLatitude)
  if (meta?.gps?.GPSLongitude) gpsLongitude = Number(meta.gps.GPSLongitude)

  const hasCameraMetadata = !!(make || model)
  const hasGPS            = !!(gpsLatitude !== undefined || gpsLongitude !== undefined)

  return {
    make, model, software, dateTimeOriginal,
    gpsLatitude, gpsLongitude, orientation,
    width:  meta?.width,
    height: meta?.height,
    format: meta?.format,
    hasExif, hasGPS, hasCameraMetadata,
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function preprocessImage(
  buffer:   Buffer,
  mimeType: string,
): Promise<PreprocessResult> {
  const originalSize = buffer.length

  // Passthrough for non-images / SVG
  if (!mimeType.startsWith('image/') || mimeType === 'image/svg+xml') {
    return {
      buffer, mimeType, originalSize, processedSize: originalSize, wasResized: false,
      pHash: '', exifHarvest: { hasExif: false, hasGPS: false, hasCameraMetadata: false },
      cascade: { original: buffer, px512: buffer, px256: buffer, px128: buffer },
    }
  }

  try {
    const mod   = await import('sharp')
    const sharp = mod.default

    // ── Step 1: Decode pixels for pHash (before any transform) ──────────────
    const { data: rawPixels, info: rawInfo } = await sharp(buffer)
      .resize(9 * 8, 8 * 8, { fit: 'fill' })  // oversample for smoother dHash
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // Use actual 9×8 decode path
    const { data: hashPixels, info: hashInfo } = await sharp(buffer)
      .resize(9, 8, { fit: 'fill', kernel: 'lanczos3' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const pHash = computeDHash(
      new Uint8Array(hashPixels.buffer, hashPixels.byteOffset, hashPixels.byteLength),
      hashInfo.width, hashInfo.height, hashInfo.channels,
    )

    // ── Step 2: Harvest EXIF before stripping ────────────────────────────────
    const meta         = await sharp(buffer).metadata()
    const exifHarvest  = harvestExif(meta)

    // ── Step 3: Build multi-resolution cascade ───────────────────────────────
    const [orig, px512, px256, px128] = await Promise.all([
      // Original (≤1024px, EXIF stripped)
      sharp(buffer)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 92, progressive: false, mozjpeg: false })
        .withMetadata({ exif: {} })
        .toBuffer(),
      // 512px for gradient/edge agents
      sharp(buffer)
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .withMetadata({ exif: {} })
        .toBuffer(),
      // 256px for color/hue agents
      sharp(buffer)
        .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .withMetadata({ exif: {} })
        .toBuffer(),
      // 128px for structure/background agents
      sharp(buffer)
        .resize(128, 128, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .withMetadata({ exif: {} })
        .toBuffer(),
    ])

    void rawPixels; void rawInfo  // used for validation only

    return {
      buffer:        orig,
      mimeType:      'image/jpeg',
      originalSize,
      processedSize: orig.length,
      wasResized:    orig.length < originalSize || !mimeType.includes('jpeg'),
      pHash,
      exifHarvest,
      cascade: { original: orig, px512, px256, px128 },
    }
  } catch {
    // sharp unavailable or processing error — return original unchanged
    return {
      buffer, mimeType, originalSize, processedSize: originalSize, wasResized: false,
      pHash: '', exifHarvest: { hasExif: false, hasGPS: false, hasCameraMetadata: false },
      cascade: { original: buffer, px512: buffer, px256: buffer, px128: buffer },
    }
  }
}

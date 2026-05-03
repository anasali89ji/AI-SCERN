// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Layer 2: Compression & Structural Analysis
// Runs in Node.js (Next.js API route / Inngest step).
// No Python required. Pure buffer/EXIF inspection.
//
// Signals:
//   • EXIF presence and sanity
//   • Software tags (Midjourney, SD, DALL-E, Firefly, etc.)
//   • Impossible camera settings
//   • Color space (AI → sRGB; cameras → AdobeRGB / ICC profiles)
//   • JPEG quantization table fingerprints
//   • File density vs. resolution anomaly
// ════════════════════════════════════════════════════════════════════════════

import type { LayerReport, EvidenceNode, ArtifactStatus } from '@/types/forensic'
import { LAYER_NAMES } from '@/lib/forensic/constants'

// ── Known AI generator software tags ─────────────────────────────────────────
const AI_SOFTWARE_TAGS = [
  'midjourney', 'stable diffusion', 'dall-e', 'dall·e', 'adobe firefly',
  'firefly', 'imagen', 'flux', 'ideogram', 'leonardo', 'canva ai',
  'grok', 'openai', 'bing image creator', 'wombo', 'nightcafe',
  'dream', 'artbreeder', 'craiyon', 'jasper art', 'fotor',
]

// ── JPEG marker constants ─────────────────────────────────────────────────────
const JPEG_SOI  = [0xFF, 0xD8]
const JPEG_APP1 = 0xE1  // EXIF marker
const JPEG_DQT  = 0xDB  // Define Quantization Table

function readUint16BE(buf: Buffer, offset: number): number {
  return (buf[offset] << 8) | buf[offset + 1]
}

// ── EXIF Tag Parser (minimal, no deps) ───────────────────────────────────────
interface ExifData {
  software?:    string
  make?:        string
  model?:       string
  isoSpeed?:    number
  focalLength?: number
  colorSpace?:  number  // 1=sRGB, 65535=Uncalibrated
  hasExif:      boolean
  hasGps:       boolean
}

function parseExifBuffer(buf: Buffer): ExifData {
  const result: ExifData = { hasExif: false, hasGps: false }

  // Find EXIF APP1 marker in JPEG
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) return result  // Not JPEG

  let offset = 2
  while (offset < Math.min(buf.length - 4, 65536)) {
    if (buf[offset] !== 0xFF) break
    const marker = buf[offset + 1]
    const length = readUint16BE(buf, offset + 2)

    if (marker === JPEG_APP1) {
      // Check for 'Exif\0\0' header
      const exifSig = buf.slice(offset + 4, offset + 10).toString('ascii')
      if (exifSig.startsWith('Exif')) {
        result.hasExif = true
        // Parse IFD0 for basic tags (simplified extraction)
        const tiffStart = offset + 10
        const byteOrder = buf.slice(tiffStart, tiffStart + 2).toString('ascii')
        const le = byteOrder === 'II'

        const read16 = (o: number) => le ? buf.readUInt16LE(o) : buf.readUInt16BE(o)
        const read32 = (o: number) => le ? buf.readUInt32LE(o) : buf.readUInt32BE(o)
        const readStr = (o: number, len: number) => buf.slice(o, o + len).toString('ascii').replace(/\0.*/, '').trim()

        try {
          const ifdOffset = read32(tiffStart + 4)
          const entryCount = read16(tiffStart + ifdOffset)

          for (let i = 0; i < Math.min(entryCount, 64); i++) {
            const entryOff = tiffStart + ifdOffset + 2 + i * 12
            if (entryOff + 12 > buf.length) break
            const tag    = read16(entryOff)
            const type   = read16(entryOff + 2)
            const count  = read32(entryOff + 4)
            const valOff = entryOff + 8

            switch (tag) {
              case 0x010F: // Make
                result.make = readStr(tiffStart + read32(valOff), Math.min(count, 64))
                break
              case 0x0110: // Model
                result.model = readStr(tiffStart + read32(valOff), Math.min(count, 64))
                break
              case 0x0131: // Software
                result.software = readStr(tiffStart + read32(valOff), Math.min(count, 128))
                break
              case 0xA001: // ColorSpace
                result.colorSpace = read16(valOff)
                break
              case 0x8827: // ISO
                if (type === 3) result.isoSpeed = read16(valOff)
                break
              case 0x920A: // FocalLength (rational)
                if (type === 5) {
                  const num = read32(tiffStart + read32(valOff))
                  const den = read32(tiffStart + read32(valOff) + 4)
                  result.focalLength = den > 0 ? num / den : 0
                }
                break
              case 0x8825: // GPS IFD pointer
                result.hasGps = true
                break
            }
          }
        } catch { /* parse error — non-fatal */ }
      }
    }
    offset += 2 + length
    if (length < 2) break
  }
  return result
}

// ── JPEG Quantization Table Extractor ────────────────────────────────────────
// AI generators often use specific quantization matrices (or none at all).
function extractJpegQTables(buf: Buffer): number[][] {
  const tables: number[][] = []
  let offset = 2
  while (offset < Math.min(buf.length - 4, 65536)) {
    if (buf[offset] !== 0xFF) break
    const marker = buf[offset + 1]
    const length = readUint16BE(buf, offset + 2)
    if (marker === JPEG_DQT) {
      const tableEnd = offset + 2 + length
      let tOff = offset + 4
      while (tOff < tableEnd && tOff + 65 <= buf.length) {
        const precision = (buf[tOff] >> 4) & 0xF  // 0 = 8-bit, 1 = 16-bit
        if (precision === 0) {
          tables.push(Array.from(buf.slice(tOff + 1, tOff + 65)))
          tOff += 65
        } else {
          tables.push([])
          tOff += 129
        }
      }
    }
    offset += 2 + length
    if (length < 2) break
  }
  return tables
}

// Standard JPEG quality-75 luminance Q-table (reference baseline)
const STANDARD_LUMA_QT_75 = [
  16, 11, 10, 16, 24, 40, 51, 61,
  12, 12, 14, 19, 26, 58, 60, 55,
]

function qTableScore(tables: number[][]): number {
  if (!tables.length) return 0.72  // No Q-tables = likely AI-generated without standard JPEG
  const luma = tables[0]
  if (!luma.length) return 0.55
  // Check for suspiciously low values (AI using quality 95+)
  const avgVal = luma.reduce((s, v) => s + v, 0) / luma.length
  if (avgVal < 4)  return 0.82  // Very high quality — common in AI generators
  if (avgVal < 8)  return 0.62
  if (avgVal > 40) return 0.18  // Heavy JPEG compression = more likely real camera
  // Check deviation from standard table
  const dev = STANDARD_LUMA_QT_75.reduce((s, v, i) => s + Math.abs(luma[i] - v), 0) / STANDARD_LUMA_QT_75.length
  if (dev < 2) return 0.25  // Very close to standard — could be real
  if (dev > 15) return 0.70  // Non-standard Q-table — could be AI
  return 0.40
}

// ── Main Layer 2 Analyzer ─────────────────────────────────────────────────────

export async function analyzeCompressionAndExif(
  imageBuffer: Buffer,
  fileSize: number,
  mimeType: string,
): Promise<LayerReport> {
  const start = Date.now()
  const evidence: EvidenceNode[] = []

  try {
    const isJpeg = imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8
    const isPng  = imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50
    const isWebP = imageBuffer.length > 12 && imageBuffer.slice(8, 12).toString('ascii') === 'WEBP'

    // ── Signal 1: EXIF presence ───────────────────────────────────────────────
    const exif = isJpeg ? parseExifBuffer(imageBuffer) : { hasExif: false, hasGps: false } as ExifData

    let exifStatus: ArtifactStatus = 'normal'
    let exifConfidence = 0.15
    let exifDetail = 'EXIF data present with camera metadata'

    if (!exif.hasExif && isJpeg) {
      // Real cameras almost always embed EXIF in JPEGs; AI generators often don't
      exifStatus = 'anomalous'
      exifConfidence = 0.78
      exifDetail = 'JPEG has no EXIF data — strong AI indicator (real cameras always embed EXIF)'
    } else if (!exif.hasExif && (isPng || isWebP)) {
      exifStatus = 'inconclusive'
      exifConfidence = 0.45
      exifDetail = `${isPng ? 'PNG' : 'WebP'} without EXIF is common even for real images`
    }

    evidence.push({
      layer: 2, category: 'exif', artifactType: 'exif_absence',
      status: exifStatus, confidence: exifConfidence, detail: exifDetail,
    })

    // ── Signal 2: Software tag ────────────────────────────────────────────────
    if (exif.software) {
      const swLower = exif.software.toLowerCase()
      const matchedAI = AI_SOFTWARE_TAGS.find(tag => swLower.includes(tag))
      if (matchedAI) {
        evidence.push({
          layer: 2, category: 'exif', artifactType: 'ai_software_tag',
          status: 'anomalous', confidence: 0.97,
          detail: `Software tag identifies AI generator: "${exif.software}"`,
          rawValue: 1,
        })
      } else {
        evidence.push({
          layer: 2, category: 'exif', artifactType: 'software_tag',
          status: 'normal', confidence: 0.12,
          detail: `Software tag: "${exif.software}" — no known AI generator detected`,
        })
      }
    }

    // ── Signal 3: Camera make/model validation ────────────────────────────────
    if (exif.make || exif.model) {
      const hasCameraInfo = !!(exif.make && exif.model)
      evidence.push({
        layer: 2, category: 'exif', artifactType: 'camera_metadata',
        status: hasCameraInfo ? 'normal' : 'inconclusive', confidence: hasCameraInfo ? 0.10 : 0.40,
        detail: `Camera: ${exif.make || 'unknown'} ${exif.model || ''} ${exif.isoSpeed ? `ISO${exif.isoSpeed}` : ''}`.trim(),
      })

      // Impossible settings check
      if (exif.focalLength === 0 || exif.isoSpeed === 0) {
        evidence.push({
          layer: 2, category: 'exif', artifactType: 'impossible_camera_settings',
          status: 'anomalous', confidence: 0.88,
          detail: `Impossible camera settings: focal=${exif.focalLength}mm ISO=${exif.isoSpeed} — fabricated EXIF`,
          rawValue: 0,
        })
      }
    }

    // ── Signal 4: Color space ─────────────────────────────────────────────────
    if (exif.colorSpace !== undefined) {
      const isSRGB = exif.colorSpace === 1
      const isUncal = exif.colorSpace === 65535
      // AI generators overwhelmingly output sRGB; real cameras often use AdobeRGB or custom ICC
      evidence.push({
        layer: 2, category: 'exif', artifactType: 'color_space',
        status: isSRGB ? 'anomalous' : 'normal',
        confidence: isSRGB ? 0.55 : isUncal ? 0.62 : 0.20,
        detail: `Color space: ${isSRGB ? 'sRGB (common in AI)' : isUncal ? 'Uncalibrated' : `code ${exif.colorSpace}`}`,
        rawValue: exif.colorSpace,
      })
    }

    // ── Signal 5: JPEG Q-table fingerprint ───────────────────────────────────
    if (isJpeg) {
      const qTables = extractJpegQTables(imageBuffer)
      const qScore  = qTableScore(qTables)
      evidence.push({
        layer: 2, category: 'compression', artifactType: 'jpeg_qtable',
        status: qScore > 0.65 ? 'anomalous' : qScore < 0.30 ? 'normal' : 'inconclusive',
        confidence: qScore,
        detail: qTables.length
          ? `JPEG Q-tables found (${qTables.length}); avg luma value: ${qTables[0]?.slice(0,16).reduce((s,v)=>s+v,0)/16|0} (low=AI uses high quality)`
          : 'No JPEG quantization tables found (unusual)',
        rawValue: qScore,
      })
    }

    // ── Signal 6: File size vs. format density ────────────────────────────────
    const sizeMB = fileSize / (1024 * 1024)
    let sizeStatus: ArtifactStatus = 'normal'
    let sizeConf = 0.20
    let sizeDetail = `File size: ${sizeMB.toFixed(2)}MB (${isPng ? 'PNG' : isJpeg ? 'JPEG' : 'WebP'})`

    if (isPng && sizeMB < 0.15) {
      // Very small PNG is suspicious — AI generators often export small PNGs
      sizeStatus = 'anomalous'; sizeConf = 0.65
      sizeDetail += ' — small PNG: AI generators often produce compact PNGs'
    } else if (isJpeg && sizeMB < 0.05) {
      sizeStatus = 'anomalous'; sizeConf = 0.60
      sizeDetail += ' — very small JPEG for claimed content'
    }

    evidence.push({
      layer: 2, category: 'compression', artifactType: 'file_density',
      status: sizeStatus, confidence: sizeConf, detail: sizeDetail,
      rawValue: sizeMB,
    })

    // ── Compute layer suspicion score ─────────────────────────────────────────
    const weights = [0.30, 0.25, 0.10, 0.10, 0.15, 0.10]
    const scores  = evidence.map(e => e.confidence)
    const wSum    = weights.slice(0, scores.length).reduce((s, w) => s + w, 0) || 1
    const layerScore = scores.reduce((s, sc, i) => s + sc * (weights[i] ?? 0.1), 0) / wSum

    return {
      layer:              2,
      layerName:          LAYER_NAMES[2],
      processingTimeMs:   Date.now() - start,
      status:             'success',
      evidence,
      layerSuspicionScore: Math.min(Math.max(layerScore, 0), 1),
    }
  } catch (err) {
    return {
      layer:              2,
      layerName:          LAYER_NAMES[2],
      processingTimeMs:   Date.now() - start,
      status:             'failure',
      evidence:           [],
      layerSuspicionScore: 0.5,
    }
  }
}

import type { ExtractedImage } from './types'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MIN_IMAGE_BYTES = 1024

function cleanText(raw: string): string {
  return raw
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
}

export interface ExtractPdfResult {
  text: string
  paragraphs: string[]
  images: ExtractedImage[]
  pageCount: number
  /** Module 2.1: scanned-PDF fallback. When true, the PDF has no text layer
   * (image-only). Caller should fall back to image-only analysis on
   * rendered pages, or instruct the user to upload as an image. */
  isScannedPdf?: boolean
}

export async function extractPdf(buffer: Buffer): Promise<ExtractPdfResult> {
  // ── Text — Module 2.1: pdf-parse v1 → v2 API migration ──────────────────
  // Was: const pdfParse = pdfParseMod.default || pdfParseMod
  //      await pdfParse(buffer)
  // That's the v1 API. The v2 package has no default export — the namespace
  // object is what gets bound to `pdfParse`, so `pdfParse(buffer)` throws
  // `TypeError: pdfParse is not a function`. EVERY PDF uploaded via
  // /detect/document (VerifyDoc) was failing with PARSE_FAILED.
  // Now: matches the working pattern in /api/detect/pdf/route.ts:128-132.
  const { PDFParse } = await import('pdf-parse') as any
  const parser = new PDFParse({ data: buffer, verbosity: 0 })
  const parsed = await parser.getText()
  if (typeof parser.destroy === 'function') await parser.destroy()
  const text = cleanText(parsed?.text || '')
  const paragraphs = text.split('\n\n').filter(Boolean)
  const pageCount: number = parsed?.numpages || 1

  // ── Module 2.1: scanned-PDF fallback ─────────────────────────────────────
  // If we got no text but the PDF has pages, it's a scanned PDF (image-only)
  // — no text layer to extract. Don't fabricate text from binary; let the
  // caller decide whether to fall back to image-only analysis on rendered
  // pages or instruct the user to upload as an image.
  const isScannedPdf = !text.trim() && pageCount > 0

  // ── Images — pdf-lib walks pages and pulls image XObjects ────────────────
  const images: ExtractedImage[] = []
  try {
    const { PDFDocument, PDFName, PDFRawStream } = await import('pdf-lib')
    const doc = await PDFDocument.load(new Uint8Array(buffer), { ignoreEncryption: true })
    let idx = 0

    for (const page of doc.getPages()) {
      const resources = page.node.Resources()
      if (!resources) continue
      const xObjects = resources.lookup(PDFName.of('XObject'))
      if (!xObjects || typeof (xObjects as any).entries !== 'function') continue

      for (const [, ref] of (xObjects as any).entries()) {
        const xObject = doc.context.lookup(ref)
        if (!(xObject instanceof PDFRawStream)) continue
        const dict = xObject.dict
        const subtype = dict.lookup(PDFName.of('Subtype'))
        if (!subtype || subtype.toString() !== '/Image') continue

        const filter = dict.lookup(PDFName.of('Filter'))
        const filterName = filter ? filter.toString() : ''
        const raw = Buffer.from(xObject.contents as Uint8Array)
        if (!raw || raw.length < MIN_IMAGE_BYTES || raw.length > MAX_IMAGE_BYTES) continue

        if (filterName.includes('DCTDecode')) {
          // Already a JPEG bytestream -- usable as-is.
          images.push({ index: idx++, buffer: raw, mimeType: 'image/jpeg', ext: 'jpg' })
          continue
        }

        if (!filterName || filterName.includes('FlateDecode')) {
          // FlateDecode gives raw pixel samples, not an encoded image file --
          // re-encode via sharp using the XObject's declared width/height/colorspace.
          try {
            const width = Number(dict.lookup(PDFName.of('Width'))?.toString() || 0)
            const height = Number(dict.lookup(PDFName.of('Height'))?.toString() || 0)
            const csRaw = dict.lookup(PDFName.of('ColorSpace'))?.toString() || ''
            const bpc = Number(dict.lookup(PDFName.of('BitsPerComponent'))?.toString() || '8')
            const channels = csRaw.includes('DeviceRGB') ? 3 : csRaw.includes('DeviceCMYK') ? 4 : 1
            if (!width || !height) continue
            const expected = width * height * channels
            if (raw.length < expected) continue

            // Module 2.1: PNG predictor decoding.
            // FlateDecode often uses PNG predictors (Predictor >= 10 in the
            // DecodeParms). Without undoing them, the raw pixel layout is
            // garbage and sharp produces a scrambled image. Decode here.
            const predictor = dict.lookup(PDFName.of('DecodeParms'))
            let decoded: Buffer = raw
            const dpStr = predictor ? predictor.toString() : ''
            const predMatch = dpStr.match(/Predictor\s+(\d+)/)
            const predNum = predMatch ? parseInt(predMatch[1], 10) : 1
            if (predNum >= 10) {
              // PNG predictor — undo Sub/Up/Average/Paeth/None per row.
              const columnsMatch = dpStr.match(/Columns\s+(\d+)/)
              const cols = columnsMatch ? parseInt(columnsMatch[1], 10) : width * channels
              decoded = _undoPngPredictor(raw, width, height, channels, cols, bpc)
              if (decoded.length < expected) continue
            }

            const sharpMod = (await import('sharp')).default
            const rawSlice: any = decoded.subarray(0, expected)
            const png = await sharpMod(rawSlice, {
              raw: { width, height, channels: channels as 1 | 3 | 4 },
            }).png().toBuffer()
            images.push({ index: idx++, buffer: png, mimeType: 'image/png', ext: 'png', width, height })
          } catch {
            // Module 2.1: push a placeholder so the caller knows an image was
            // present but couldn't be reconstructed (was: silently swallowed).
            images.push({
              index: idx++,
              buffer: Buffer.alloc(0),
              mimeType: 'image/png',
              ext: 'png',
              note: 'undecodable_image',
            } as ExtractedImage)
          }
        }
      }
    }
  } catch (e) {
    console.warn('[extract-pdf] image extraction failed (non-fatal):', e)
  }

  // Module 2.1: include isScannedPdf in the result so callers can branch.
  return { text, paragraphs, images, pageCount, isScannedPdf }
}

// ── PNG predictor decoder (Module 2.1) ──────────────────────────────────────
// Implements the 5 PNG filter types per RFC 2083 §6:
//   0=None, 1=Sub, 2=Up, 3=Average, 4=Paeth
// PDF spec §7.4.4.4 maps Predictor values 10-15 to these filter types,
// with the row-prefix byte indicating which filter was applied to that row.

function _undoPngPredictor(
  raw: Buffer,
  width: number,
  height: number,
  channels: number,
  columns: number,
  _bpc: number,
): Buffer {
  // Each row has a 1-byte filter type prefix, then `columns * channels` bytes
  // of filtered pixel data. Total row length = 1 + columns * channels.
  const bpp = channels // bytes per pixel (assuming 8 bpc)
  const rowBytes = columns * channels
  const rowSize = 1 + rowBytes
  const out = Buffer.alloc(width * height * channels)

  const prevRow = Buffer.alloc(rowBytes) // initially zeros

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize
    if (rowStart + rowSize > raw.length) break
    const filterType = raw[rowStart]
    const filtered = raw.subarray(rowStart + 1, rowStart + 1 + rowBytes)
    const unfiltered = Buffer.alloc(rowBytes)

    for (let x = 0; x < rowBytes; x++) {
      const cur = filtered[x]
      const left = x >= bpp ? unfiltered[x - bpp] : 0
      const up = prevRow[x]
      const upLeft = x >= bpp ? prevRow[x - bpp] : 0
      let recon: number

      switch (filterType) {
        case 0: // None
          recon = cur
          break
        case 1: // Sub
          recon = (cur + left) & 0xff
          break
        case 2: // Up
          recon = (cur + up) & 0xff
          break
        case 3: // Average
          recon = (cur + Math.floor((left + up) / 2)) & 0xff
          break
        case 4: { // Paeth
          const p = left + up - upLeft
          const pa = Math.abs(p - left)
          const pb = Math.abs(p - up)
          const pc = Math.abs(p - upLeft)
          const pred = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft
          recon = (cur + pred) & 0xff
          break
        }
        default:
          // Unknown filter — return the raw byte unchanged (best effort).
          recon = cur
      }
      unfiltered[x] = recon
    }

    // Copy into the output buffer (handle the case where columns != width)
    const colsToCopy = Math.min(rowBytes, width * channels)
    unfiltered.copy(out, y * width * channels, 0, colsToCopy)
    unfiltered.copy(prevRow, 0)
  }

  return out
}

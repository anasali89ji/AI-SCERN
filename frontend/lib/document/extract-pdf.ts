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

export async function extractPdf(buffer: Buffer): Promise<{
  text: string
  paragraphs: string[]
  images: ExtractedImage[]
  pageCount: number
}> {
  // Text — pdf-parse is already a dependency.
  const pdfParseMod: any = await import('pdf-parse')
  const pdfParse = pdfParseMod.default || pdfParseMod
  const parsed = await pdfParse(buffer)
  const text = cleanText(parsed.text || '')
  const paragraphs = text.split('\n\n').filter(Boolean)
  const pageCount: number = parsed.numpages || 1

  // Images — pdf-lib to walk pages and pull image XObjects.
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
            const channels = csRaw.includes('DeviceRGB') ? 3 : csRaw.includes('DeviceCMYK') ? 4 : 1
            if (!width || !height) continue
            const expected = width * height * channels
            if (raw.length < expected) continue
            const sharpMod = (await import('sharp')).default
            const rawSlice: any = raw.subarray(0, expected)
            const png = await sharpMod(rawSlice, {
              raw: { width, height, channels: channels as 1 | 3 | 4 },
            }).png().toBuffer()
            images.push({ index: idx++, buffer: png, mimeType: 'image/png', ext: 'png', width, height })
          } catch {
            // Skip images we can't safely reconstruct rather than pass corrupt bytes downstream.
          }
        }
      }
    }
  } catch (e) {
    console.warn('[extract-pdf] image extraction failed (non-fatal):', e)
  }

  return { text, paragraphs, images, pageCount }
}

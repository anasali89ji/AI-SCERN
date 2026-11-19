import type { ExtractedImage } from './types'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MIN_IMAGE_BYTES = 1024

const EXT_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
  emf: 'image/x-emf',
  wmf: 'image/x-wmf',
}

function cleanText(raw: string): string {
  return raw
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
}


/** DOC-ZIP-1 (audit 2026-11): decompression-bomb guard. A 20 MB PPTX/DOCX
 * of highly-compressible XML can declare a single entry of many GB —
 * extracting it wholesale would OOM the serverless function. JSZip exposes
 * the central-directory uncompressedSize on each entry's _data; vet every
 * entry BEFORE decompressing it. Entries over the budget are skipped (the
 * scan proceeds with the remaining content and an honest reduced page
 * count) instead of crashing or hanging the route. */
const MAX_ZIP_ENTRIES = 300
const MAX_ENTRY_UNCOMPRESSED_BYTES = 25 * 1024 * 1024

function zipEntryTooLarge(entry: { _data?: { uncompressedSize?: number } } | undefined): boolean {
  const declared = entry?._data?.uncompressedSize
  return typeof declared === 'number' && declared > MAX_ENTRY_UNCOMPRESSED_BYTES
}

export async function extractDocx(buffer: Buffer): Promise<{
  text: string
  paragraphs: string[]
  images: ExtractedImage[]
}> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(buffer as unknown as ArrayBuffer)

  // DOC-ZIP-1: mammoth.extractRawText decompresses word/document.xml with
  // no size bound — vet every declared entry size from the central
  // directory BEFORE handing the buffer to mammoth. An over-budget bomb
  // yields empty text (honest partial result: images may still be analyzed)
  // instead of an OOM'd function.
  const bombEntries = Object.keys(zip.files)
    .filter(p => zipEntryTooLarge(zip.files[p] as never))
  if (bombEntries.length > 0) {
    console.warn('[extract-docx] skipped oversized entries (possible zip bomb):', bombEntries.slice(0, 5))
    return { text: '', paragraphs: [], images: [] }
  }

  let text = ''
  try {
    const mammoth: any = await import('mammoth')
    const { value } = await mammoth.extractRawText({ buffer })
    text = cleanText(value || '')
  } catch (e) {
    console.warn('[extract-docx] text extraction failed (non-fatal):', e)
  }
  const paragraphs = text.split('\n\n').filter(Boolean)

  const images: ExtractedImage[] = []
  try {
    const mediaFiles = Object.keys(zip.files).filter(f => f.startsWith('word/media/'))

    let idx = 0
    for (const path of mediaFiles.sort().slice(0, MAX_ZIP_ENTRIES)) {
      const entry = zip.files[path]
      if (entry.dir) continue
      if (zipEntryTooLarge(entry as never)) continue // bomb guard
      const ext = (path.split('.').pop() || '').toLowerCase()
      const mimeType = EXT_MIME[ext]
      if (!mimeType || !mimeType.startsWith('image/')) continue // skip EMF/WMF vector art, unsupported by detectors

      const data = await entry.async('nodebuffer')
      if (data.length < MIN_IMAGE_BYTES || data.length > MAX_IMAGE_BYTES) continue

      images.push({ index: idx++, buffer: data, mimeType, ext })
    }
  } catch (e) {
    console.warn('[extract-docx] image extraction failed (non-fatal):', e)
  }

  return { text, paragraphs, images }
}

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

/** Pull all <a:t>...</a:t> run-text nodes out of a slide's XML, in document order. */
function extractSlideText(xml: string): string {
  const matches = xml.match(/<a:t>([\s\S]*?)<\/a:t>/g) || []
  return matches
    .map(m => m.replace(/<a:t>/, '').replace(/<\/a:t>/, ''))
    .map(decodeXmlEntities)
    .join(' ')
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
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

export async function extractPptx(buffer: Buffer): Promise<{
  text: string
  paragraphs: string[]
  images: ExtractedImage[]
  pageCount: number
}> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(buffer as unknown as ArrayBuffer)

  // Slides are named slide1.xml, slide2.xml, ... — sort numerically, not lexically.
  const slidePaths = Object.keys(zip.files)
    .filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0', 10)
      const nb = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0', 10)
      return na - nb
    })

  const paragraphs: string[] = []
  for (const path of slidePaths.slice(0, MAX_ZIP_ENTRIES)) {
    if (zipEntryTooLarge(zip.files[path] as never)) continue // bomb guard
    const xml = await zip.files[path].async('string')
    const slideText = extractSlideText(xml)
    if (slideText.trim()) paragraphs.push(slideText.trim())
  }
  const text = cleanText(paragraphs.join('\n\n'))

  const images: ExtractedImage[] = []
  try {
    const mediaFiles = Object.keys(zip.files).filter(f => f.startsWith('ppt/media/'))
    let idx = 0
    for (const path of mediaFiles.sort().slice(0, MAX_ZIP_ENTRIES)) {
      const entry = zip.files[path]
      if (entry.dir) continue
      if (zipEntryTooLarge(entry as never)) continue // bomb guard
      const ext = (path.split('.').pop() || '').toLowerCase()
      const mimeType = EXT_MIME[ext]
      if (!mimeType || !mimeType.startsWith('image/')) continue

      const data = await entry.async('nodebuffer')
      if (data.length < MIN_IMAGE_BYTES || data.length > MAX_IMAGE_BYTES) continue

      images.push({ index: idx++, buffer: data, mimeType, ext })
    }
  } catch (e) {
    console.warn('[extract-pptx] image extraction failed (non-fatal):', e)
  }

  return { text, paragraphs: paragraphs.map(p => p.trim()).filter(Boolean), images, pageCount: slidePaths.length }
}

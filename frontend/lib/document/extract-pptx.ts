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
  for (const path of slidePaths) {
    const xml = await zip.files[path].async('string')
    const slideText = extractSlideText(xml)
    if (slideText.trim()) paragraphs.push(slideText.trim())
  }
  const text = cleanText(paragraphs.join('\n\n'))

  const images: ExtractedImage[] = []
  try {
    const mediaFiles = Object.keys(zip.files).filter(f => f.startsWith('ppt/media/'))
    let idx = 0
    for (const path of mediaFiles.sort()) {
      const entry = zip.files[path]
      if (entry.dir) continue
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

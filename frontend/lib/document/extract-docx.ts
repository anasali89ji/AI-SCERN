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

export async function extractDocx(buffer: Buffer): Promise<{
  text: string
  paragraphs: string[]
  images: ExtractedImage[]
}> {
  const mammoth: any = await import('mammoth')
  const { value } = await mammoth.extractRawText({ buffer })
  const text = cleanText(value || '')
  const paragraphs = text.split('\n\n').filter(Boolean)

  const images: ExtractedImage[] = []
  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(buffer as unknown as ArrayBuffer)
    const mediaFiles = Object.keys(zip.files).filter(f => f.startsWith('word/media/'))

    let idx = 0
    for (const path of mediaFiles.sort()) {
      const entry = zip.files[path]
      if (entry.dir) continue
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

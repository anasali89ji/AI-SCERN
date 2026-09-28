import type { Source, Extracted } from '../types'
import { sha256 } from '../utils/crypto'
import { qualityImage } from '../utils/quality'
import { extractLabel } from './text'

/** BUG-FIX #6: validate URL is an actual HTTP URL, not a path/filename/ID */
function isValidUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length < 8) return false
  return url.startsWith('http://') || url.startsWith('https://')
}

export async function extractImageRow(
  row:    Record<string, any>,
  src:    Source,
  rowIdx: number,
): Promise<Extracted | null> {
  const label = extractLabel(row, src)
  let url: string | undefined
  let w: number | undefined
  let h: number | undefined
  let fmt: string | undefined

  // Try image_field first (HF Image feature object or direct string)
  const imgF = src.image_field ? row[src.image_field] : null
  if (imgF) {
    if (isValidUrl(imgF)) {
      url = imgF
    } else if (imgF && typeof imgF === 'object') {
      // HF datasets-server returns CDN URL under 'src' key
      const candidate = imgF.src ?? imgF.path ?? imgF.url
      if (isValidUrl(candidate)) url = candidate
      w   = typeof imgF.width  === 'number' ? imgF.width  : undefined
      h   = typeof imgF.height === 'number' ? imgF.height : undefined
      fmt = typeof imgF.format === 'string'  ? imgF.format.toLowerCase() : undefined
    }
  }

  // Fallback to url_field — BUG-FIX #6: validate before accepting
  if (!url && src.url_field && isValidUrl(row[src.url_field])) {
    url = row[src.url_field]
  }

  // Generic URL field scan — BUG-FIX #6: only accept valid HTTP URLs
  if (!url) {
    for (const f of ['image_url', 'url', 'path', 'img_path', 'file_path']) {
      if (isValidUrl(row[f])) { url = row[f]; break }
    }
  }

  // Collect meta fields
  const meta: Record<string, any> = {}
  for (const f of (src.meta_fields ?? [])) {
    if (row[f] != null) {
      meta[f] = row[f]
      if (f === 'width'  || f === 'WIDTH')  w = Number(row[f]) || undefined
      if (f === 'height' || f === 'HEIGHT') h = Number(row[f]) || undefined
    }
  }

  // BUG-FIX #6: reject rows with no valid HTTP URL
  if (!url) return null

  const quality = qualityImage(w, h)
  // BUG-FIX #5: require at least baseline quality (URL present = 0.50; tiny images score 0)
  if (quality < 0.30) return null

  return {
    label,
    content_url:     url,
    content_preview: `[Image] ${url.slice(0, 200)}`,
    content_hash:    await sha256(`${src.name}:img:${rowIdx}:${url}`),
    quality_score:   quality,
    resolution_w:    w,
    resolution_h:    h,
    file_format:     fmt,
    has_face:        /face|celeb|deepfake|portrait/i.test(src.name),
    language:        src.language ?? 'en',
    metadata:        Object.keys(meta).length ? meta : undefined,
  }
}

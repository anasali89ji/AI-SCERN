import type { Source, Extracted } from '../types'
import { sha256 } from '../utils/crypto'
import { qualityImage } from '../utils/quality'
import { extractLabel } from './text'

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
    if (typeof imgF === 'string') {
      url = imgF
    } else if (imgF && typeof imgF === 'object') {
      // HF datasets-server returns CDN URL under 'src' key — check it first
      url = imgF.src ?? imgF.path ?? imgF.url
      w   = imgF.width
      h   = imgF.height
      fmt = imgF.format?.toLowerCase()
    }
  }

  // Fallback to url_field
  if (!url && src.url_field && typeof row[src.url_field] === 'string') {
    url = row[src.url_field]
  }

  // Generic URL field scan
  if (!url) {
    for (const f of ['image_url', 'url', 'path', 'img_path', 'file_path']) {
      if (typeof row[f] === 'string') { url = row[f]; break }
    }
  }

  // Collect meta fields
  const meta: Record<string, any> = {}
  for (const f of (src.meta_fields ?? [])) {
    if (row[f] != null) {
      meta[f] = row[f]
      if (f === 'width'  || f === 'WIDTH')  w = Number(row[f])
      if (f === 'height' || f === 'HEIGHT') h = Number(row[f])
    }
  }

  // Reject rows with no usable content — avoids inserting empty/garbage rows
  if (!url && !imgF) return null

  return {
    label,
    content_url:     url,
    content_preview: url ? `[Image] ${url.slice(0, 200)}` : `[Image from ${src.name}]`,
    content_hash:    await sha256(`${src.name}:img:${rowIdx}:${url ?? ''}`),
    quality_score:   qualityImage(w, h),
    resolution_w:    w,
    resolution_h:    h,
    file_format:     fmt,
    has_face:        /face|celeb|deepfake|portrait/i.test(src.name),
    language:        src.language ?? 'en',
    metadata:        Object.keys(meta).length ? meta : undefined,
  }
}

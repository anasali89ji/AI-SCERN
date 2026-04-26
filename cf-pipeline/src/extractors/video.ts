import type { Source, Extracted } from '../types'
import { sha256 } from '../utils/crypto'
import { qualityVideo } from '../utils/quality'
import { extractLabel } from './text'

/** BUG-FIX #6: validate URL is an actual HTTP URL */
function isValidUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length < 8) return false
  return url.startsWith('http://') || url.startsWith('https://')
}

export async function extractVideoRow(
  row:    Record<string, any>,
  src:    Source,
  rowIdx: number,
): Promise<Extracted | null> {
  const label = extractLabel(row, src)
  let url: string | undefined
  let dur: number | undefined
  let w: number | undefined
  let h: number | undefined

  // BUG-FIX #6: only accept valid HTTP URLs from url_field
  if (src.url_field && isValidUrl(row[src.url_field])) {
    url = row[src.url_field]
  }
  if (!url) {
    for (const f of ['video_url', 'url', 'path', 'video_path', 'file']) {
      if (isValidUrl(row[f])) { url = row[f]; break }
    }
  }

  const meta: Record<string, any> = {}
  for (const f of (src.meta_fields ?? [])) {
    if (row[f] != null) {
      meta[f] = row[f]
      if (f === 'duration')  dur = Number(row[f]) || undefined
      if (f === 'width')     w   = Number(row[f]) || undefined
      if (f === 'height')    h   = Number(row[f]) || undefined
      if (f === 'end_time' && meta['start_time'] != null) {
        const computed = Number(row[f]) - Number(meta['start_time'])
        if (computed > 0) dur = computed
      }
    }
  }

  // BUG-FIX #6: no valid URL → discard immediately
  if (!url) return null

  const quality = qualityVideo(url, dur)
  // BUG-FIX #5: require at least a URL + minimal quality signal
  if (quality < 0.30) return null

  return {
    label,
    content_url:      url,
    content_preview:  `[Video from ${src.name}] — ${url.slice(0, 120)}`,
    content_hash:     await sha256(`${src.name}:video:${rowIdx}:${url}`),
    quality_score:    quality,
    duration_seconds: dur,
    resolution_w:     w,
    resolution_h:     h,
    has_face:         /face|celeb|deepfake/i.test(src.name),
    language:         src.language ?? 'en',
    metadata:         Object.keys(meta).length ? meta : undefined,
  }
}

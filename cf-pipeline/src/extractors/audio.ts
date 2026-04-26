import type { Source, Extracted } from '../types'
import { sha256 } from '../utils/crypto'
import { qualityAudio } from '../utils/quality'
import { extractLabel } from './text'

/** BUG-FIX #6: validate URL is an actual HTTP URL */
function isValidUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length < 8) return false
  return url.startsWith('http://') || url.startsWith('https://')
}

export async function extractAudioRow(
  row:    Record<string, any>,
  src:    Source,
  rowIdx: number,
): Promise<Extracted | null> {
  const label = extractLabel(row, src)
  let url: string | undefined
  let dur: number | undefined
  let sr:  number | undefined

  const af = src.audio_field ? row[src.audio_field] : null
  if (af) {
    if (isValidUrl(af)) {
      url = af
    } else if (af && typeof af === 'object') {
      const candidate = af.src ?? af.path ?? af.url
      if (isValidUrl(candidate)) url = candidate
      sr = typeof af.sampling_rate === 'number' ? af.sampling_rate : undefined
      // Compute duration from PCM array length + sample rate
      if (af.array && af.sampling_rate) {
        const len = Array.isArray(af.array) ? af.array.length : (af.array?.length ?? 0)
        if (len > 0 && af.sampling_rate > 0) dur = len / af.sampling_rate
      }
    }
  }

  // BUG-FIX #6: url_field must be a valid HTTP URL
  if (!url && src.url_field && isValidUrl(row[src.url_field])) {
    url = row[src.url_field]
  }

  let transcript: string | undefined
  const meta: Record<string, any> = {}
  for (const f of (src.meta_fields ?? [])) {
    if (row[f] != null) {
      meta[f] = row[f]
      if (f === 'duration')      dur = Number(row[f]) || undefined
      if (f === 'sampling_rate') sr  = Number(row[f]) || undefined
      if (['sentence', 'text', 'transcription'].includes(f)) transcript = String(row[f])
    }
  }

  // BUG-FIX #6: no valid HTTP URL → discard
  if (!url) return null

  const quality = qualityAudio(dur, sr)
  // BUG-FIX #5: audio with no duration data or < 1s is useless for detection training
  if (quality < 0.30) return null

  return {
    label,
    content_url:      url,
    content_preview:  transcript?.slice(0, 250) ?? `[Audio from ${src.name}]`,
    content_hash:     await sha256(`${src.name}:audio:${rowIdx}:${url}`),
    quality_score:    quality,
    duration_seconds: dur,
    sample_rate:      sr,
    has_speech:       true,
    language:         src.language ?? 'en',
    metadata:         Object.keys(meta).length ? meta : undefined,
  }
}

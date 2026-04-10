import type { Source, Extracted } from '../types'
import { sha256 } from '../utils/crypto'
import { qualityAudio } from '../utils/quality'
import { extractLabel } from './text'

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
    if (typeof af === 'string') {
      url = af
    } else if (af && typeof af === 'object') {
      // HF datasets-server returns CDN URL under 'src' key — check it first
      url = af.src ?? af.path ?? af.url
      sr  = af.sampling_rate
      // Compute duration from array length + sample rate
      if (af.array && af.sampling_rate) {
        const len = Array.isArray(af.array) ? af.array.length : (af.array?.length ?? 0)
        if (len > 0) dur = len / af.sampling_rate
      }
    }
  }

  if (!url && src.url_field && typeof row[src.url_field] === 'string') {
    url = row[src.url_field]
  }

  let transcript: string | undefined
  const meta: Record<string, any> = {}
  for (const f of (src.meta_fields ?? [])) {
    if (row[f] != null) {
      meta[f] = row[f]
      if (f === 'duration')      dur        = Number(row[f])
      if (f === 'sampling_rate') sr         = Number(row[f])
      if (['sentence', 'text', 'transcription'].includes(f)) transcript = String(row[f])
    }
  }

  // Reject rows with no usable URL — avoids inserting empty/garbage rows
  if (!url) return null

  return {
    content_hash:    await sha256(`${src.name}:audio:${rowIdx}:${url ?? ''}`),
    quality_score:   qualityAudio(dur, sr),
    duration_seconds: dur,
    sample_rate:     sr,
    has_speech:      true,
    language:        src.language ?? 'en',
    metadata:        Object.keys(meta).length ? meta : undefined,
  }
}

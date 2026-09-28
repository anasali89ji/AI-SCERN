import type { Source, Extracted } from '../types'
import { sha256 } from '../utils/crypto'
import { qualityText } from '../utils/quality'

/**
 * Recursively extract a text string from a field value.
 * Handles: plain string, string[], object with text/content/answer/value keys,
 * and array of such objects (e.g. stack-exchange answers: [{text_url, answer}]).
 */
function deepExtractText(v: unknown, depth = 0): string | null {
  if (depth > 3) return null
  if (typeof v === 'string' && v.trim().length > 0) return v.trim()

  if (Array.isArray(v)) {
    for (const item of v) {
      const result = deepExtractText(item, depth + 1)
      if (result) return result
    }
    return null
  }

  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>
    for (const key of ['text', 'content', 'answer', 'body', 'value', 'response', 'description', 'sentence']) {
      if (obj[key]) {
        const result = deepExtractText(obj[key], depth + 1)
        if (result) return result
      }
    }
  }
  return null
}

function extractText(row: Record<string, any>, fields: string[]): string | null {
  for (const f of fields) {
    if (row[f] == null) continue
    const result = deepExtractText(row[f])
    if (result) return result
  }
  return null
}

export function extractLabel(row: Record<string, any>, src: Source): 'ai' | 'human' {
  if (src.label !== 'mixed') return src.label as 'ai' | 'human'
  if (!src.label_field || !src.label_map) return 'ai'
  const raw = row[src.label_field]
  if (raw == null) return 'ai'
  return src.label_map[String(raw)] ?? 'ai'
}

export async function extractTextRow(
  row: Record<string, any>,
  src: Source,
): Promise<Extracted | null> {
  const fields = src.text_fields ?? ['text', 'content', 'body', 'article', 'document', 'answer']
  const text   = extractText(row, fields)

  // BUG-FIX #5: raised min length from 80 → 150 chars (80 is often a single sentence with no signal)
  if (!text || text.length < 150) return null

  const label   = extractLabel(row, src)
  const trimmed = text.slice(0, 5000)
  const quality = qualityText(trimmed)

  // BUG-FIX #5: threshold is now 0.45 (was 0.4 which equalled the base score — nothing ever failed)
  if (quality < 0.45) return null

  const hash = await sha256(trimmed.slice(0, 400))

  return {
    label,
    content_text:    trimmed.slice(0, 4000),
    content_preview: trimmed.slice(0, 250).replace(/\s+/g, ' '),
    content_hash:    hash,
    quality_score:   quality,
    word_count:      trimmed.split(/\s+/).filter(w => w.length > 0).length,
    char_count:      trimmed.length,
    sentence_count:  (trimmed.match(/[.!?]+[\s\n]/g) ?? []).length || 1,
    language:        src.language ?? 'en',
  }
}

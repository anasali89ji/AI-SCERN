/**
 * DETECTAI Pipeline v6 — Core Orchestration
 * Thin module that re-exports everything workers need.
 */

export type { Env } from './types'
export { ALL_SOURCES, getWorkerSources } from './sources/index'
export { fetchHFRows } from './utils/hf-api'
export { batchInsert  } from './db/insert'
export { getStatus, cleanupPushed } from './db/status'
export { pushToHF    } from './hf/push'
export { pushReadme  } from './hf/readme'

import type { Source, Extracted, ScrapeResult } from './types'
import { fetchHFRows   } from './utils/hf-api'
import { batchInsert   } from './db/insert'
import { extractTextRow  } from './extractors/text'
import { extractImageRow } from './extractors/image'
import { extractAudioRow } from './extractors/audio'
import { extractVideoRow } from './extractors/video'
import { log } from './types'

export async function scrapeSource(
  db:     D1Database,
  src:    Source,
  token:  string,
  wid:    string,
  target = 60,
): Promise<ScrapeResult> {
  const start = Date.now()
  try {
    // Random offset — keep under 10k so small datasets don't 404
    const offset = Math.floor(Math.random() * 10_000)
    const { rows } = await fetchHFRows(
      src.id, src.config ?? 'default', src.split ?? 'train',
      offset, Math.min(target * 2, 100), token,
    )
    const d1Items: { src: Source; item: Extracted; rowIdx: number; wid: string }[] = []
    let skipped = 0
    for (const { row_idx, row } of rows) {
      if (d1Items.length >= target) break
      let extracted: Extracted | null = null
      try {
        switch (src.media_type) {
          case 'text':  extracted = await extractTextRow(row, src);            break
          case 'image': extracted = await extractImageRow(row, src, row_idx); break
          case 'audio': extracted = await extractAudioRow(row, src, row_idx); break
          case 'video': extracted = await extractVideoRow(row, src, row_idx); break
        }
      } catch {}
      if (extracted) d1Items.push({ src, item: extracted, rowIdx: offset + row_idx, wid })
      else skipped++
    }
    const inserted = await batchInsert(db, d1Items)
    log({ event: 'SCRAPE_COMPLETE', worker_id: wid, source_id: src.name, sample_count: inserted, duration_ms: Date.now()-start, timestamp: new Date().toISOString() })
    return { source: src.name, inserted, skipped: skipped + (d1Items.length - inserted) }
  } catch (e: any) {
    log({ event: 'ERROR', worker_id: wid, source_id: src.name, error_message: e?.message, duration_ms: Date.now()-start, timestamp: new Date().toISOString() })
    return { source: src.name, inserted: 0, skipped: 0, error: e?.message }
  }
}

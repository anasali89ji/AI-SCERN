/**
 * Aiscern Pipeline v8.1 — Core scraping engine
 *
 * BUG-FIX #4: Cursor was advanced BEFORE fetchHFRows was called.
 *   If fetchHFRows threw (timeout, 429, network error), the cursor already moved
 *   → those 100 rows were permanently skipped.
 *   FIX: Read current cursor offset, call fetch, advance cursor ONLY on success.
 *        Roll cursor back (reset error count + restore offset) on failure.
 *
 * Minor fix #7: Stagger reduced from 1500ms → 800ms per worker so W14 starts
 *   at 10.4s instead of 19.5s, leaving more time within the 60s cron window.
 */

export type { Env } from './types'
export { ALL_SOURCES, getWorkerSources, TOTAL_SCRAPER_WORKERS } from './sources/index'
export { fetchHFRows } from './utils/hf-api'
export { batchInsert  } from './db/insert'
export { getStatus, cleanupPushed } from './db/status'
export { pushToHF    } from './hf/push'
export { pushReadme  } from './hf/readme'

import type { Source, Extracted, ScrapeResult } from './types'
import { fetchHFRows, DEAD_SOURCES, MAX_ERRORS_BEFORE_COOLDOWN } from './utils/hf-api'
import { batchInsert   } from './db/insert'
import { extractTextRow  } from './extractors/text'
import { extractImageRow } from './extractors/image'
import { extractAudioRow } from './extractors/audio'
import { extractVideoRow } from './extractors/video'
import { log } from './types'

const ROWS_PER_FETCH = 100

/** Read current cursor offset WITHOUT advancing it */
async function readCursor(db: D1Database, sourceName: string): Promise<number> {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS source_cursors (
        source_name     TEXT PRIMARY KEY,
        next_offset     INTEGER NOT NULL DEFAULT 0,
        total_fetched   INTEGER NOT NULL DEFAULT 0,
        total_inserted  INTEGER NOT NULL DEFAULT 0,
        error_count     INTEGER NOT NULL DEFAULT 0,
        last_error      TEXT,
        last_updated    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).run().catch(() => {})

    const row = await db.prepare(
      `SELECT next_offset FROM source_cursors WHERE source_name = ? LIMIT 1`
    ).bind(sourceName).first<{ next_offset: number }>()

    return row?.next_offset ?? 0
  } catch {
    return 0
  }
}

/**
 * BUG-FIX #4: Advance cursor AFTER a successful fetch.
 * Upsert the row; if it doesn't exist yet, create it with the advanced offset.
 */
async function advanceCursor(db: D1Database, sourceName: string, advance: number): Promise<void> {
  await db.prepare(`
    INSERT INTO source_cursors (source_name, next_offset, total_fetched, last_updated)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(source_name) DO UPDATE SET
      next_offset   = next_offset + excluded.total_fetched,
      total_fetched = total_fetched + excluded.total_fetched,
      last_updated  = datetime('now')
  `).bind(sourceName, advance, advance).run().catch(() => {})
}

async function updateCursorInserted(db: D1Database, sourceName: string, inserted: number): Promise<void> {
  await db.prepare(
    `UPDATE source_cursors SET total_inserted = total_inserted + ?, last_updated = datetime('now')
     WHERE source_name = ?`
  ).bind(inserted, sourceName).run().catch(() => {})
}

async function recordCursorError(db: D1Database, sourceName: string, err: string): Promise<void> {
  await db.prepare(
    `UPDATE source_cursors SET error_count = error_count + 1, last_error = ?, last_updated = datetime('now')
     WHERE source_name = ?`
  ).bind(err.slice(0, 200), sourceName).run().catch(() => {})
}

async function shouldSkipSource(db: D1Database, src: Source): Promise<string | null> {
  if (DEAD_SOURCES.has(src.name)) return `DEAD source: ${src.name}`
  try {
    const row = await db.prepare(
      `SELECT error_count, last_error FROM source_cursors WHERE source_name = ? LIMIT 1`
    ).bind(src.name).first<{ error_count: number; last_error: string | null }>()

    if (row && row.error_count >= MAX_ERRORS_BEFORE_COOLDOWN) {
      if (row.last_error?.includes('DEAD:404') || row.last_error?.includes('does not exist')) {
        return `PERM_DEAD: ${src.name} (${row.error_count} 404 errors)`
      }
      return `COOLDOWN: ${src.name} (${row.error_count} errors, last: ${row.last_error?.slice(0, 60)})`
    }
  } catch {}
  return null
}

export async function scrapeSource(
  db:     D1Database,
  src:    Source,
  token:  string,
  wid:    string,
  target = 100,
): Promise<ScrapeResult> {
  const start = Date.now()

  const skipReason = await shouldSkipSource(db, src)
  if (skipReason) {
    log({ event: 'SKIP', worker_id: wid, source_id: src.name, reason: skipReason,
          timestamp: new Date().toISOString() })
    return { source: src.name, inserted: 0, skipped: 0, error: skipReason }
  }

  try {
    // BUG-FIX #4: read cursor first, do NOT advance yet
    const offset = await readCursor(db, src.name)

    let rows: { row_idx: number; row: Record<string, any> }[]
    try {
      const result = await fetchHFRows(
        src.id, src.config ?? 'default', src.split ?? 'train',
        offset, ROWS_PER_FETCH, token,
      )
      rows = result.rows
    } catch (fetchErr: any) {
      // BUG-FIX #4: fetch failed — do NOT advance cursor; record error instead
      const errMsg = fetchErr?.message ?? 'fetch_failed'
      await recordCursorError(db, src.name, errMsg)
      log({ event: 'ERROR', worker_id: wid, source_id: src.name, error_message: `fetch failed: ${errMsg}`,
            duration_ms: Date.now()-start, timestamp: new Date().toISOString() })
      return { source: src.name, inserted: 0, skipped: 0, error: errMsg }
    }

    // BUG-FIX #4: fetch succeeded → advance cursor now
    if (!rows?.length) {
      // Dataset exhausted — reset to 0 for next full cycle
      await db.prepare(
        `UPDATE source_cursors SET next_offset = 0, last_updated = datetime('now') WHERE source_name = ?`
      ).bind(src.name).run().catch(() => {})
      return { source: src.name, inserted: 0, skipped: 0 }
    }

    // Advance cursor by the number of rows we fetched
    await advanceCursor(db, src.name, rows.length)

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
      if (extracted) d1Items.push({ src, item: extracted, rowIdx: row_idx, wid })
      else skipped++
    }

    const inserted = await batchInsert(db, d1Items)
    await updateCursorInserted(db, src.name, inserted)

    if (inserted > 0) {
      await db.prepare(
        `UPDATE source_cursors SET error_count = 0, last_updated = datetime('now') WHERE source_name = ?`
      ).bind(src.name).run().catch(() => {})
    }

    log({ event: 'SCRAPE_COMPLETE', worker_id: wid, source_id: src.name,
          sample_count: inserted, duration_ms: Date.now()-start,
          timestamp: new Date().toISOString() })

    return { source: src.name, inserted, skipped: skipped + (d1Items.length - inserted) }

  } catch (e: any) {
    const errMsg = e?.message ?? 'unknown'
    await recordCursorError(db, src.name, errMsg)
    log({ event: 'ERROR', worker_id: wid, source_id: src.name, error_message: errMsg,
          duration_ms: Date.now()-start, timestamp: new Date().toISOString() })
    return { source: src.name, inserted: 0, skipped: 0, error: errMsg }
  }
}

/**
 * Scrape ALL assigned sources for this worker.
 * Minor fix #7: stagger reduced from 1500ms → 800ms so W14 starts at ~10.4s, not 19.5s.
 */
export async function scrapeParallel(
  db:        D1Database,
  sources:   Source[],
  token:     string,
  wid:       string,
  workerNum: number = 1,
): Promise<ScrapeResult[]> {
  if (!sources.length) return []

  // Minor fix #7: 800ms stagger (was 1500ms) — W14 starts at 10.4s instead of 19.5s
  const staggerMs = (workerNum - 1) * 800
  if (staggerMs > 0) await new Promise(r => setTimeout(r, staggerMs))

  const results: ScrapeResult[] = []
  for (let i = 0; i < sources.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 200))
    results.push(await scrapeSource(db, sources[i], token, wid, 100))
  }
  return results
}

import type { Source, Extracted } from '../types'

export async function batchInsert(
  db:    D1Database,
  items: { src: Source; item: Extracted; rowIdx: number; wid: string }[],
): Promise<number> {
  if (!items.length) return 0

  // Dedup check 1: current D1 table (hot dedup)
  const hashes = items.map(i => i.item.content_hash)
  const ph     = hashes.map(() => '?').join(',')
  const exist  = await db
    .prepare(`SELECT content_hash FROM dataset_items WHERE content_hash IN (${ph})`)
    .bind(...hashes)
    .all()
  const seen = new Set((exist.results ?? []).map((r: any) => r.content_hash))

  // Minor fix #8: Dedup check 2 — permanent bloom filter (survives row deletion after HF push)
  const unseenHashes = hashes.filter(h => !seen.has(h))
  if (unseenHashes.length > 0) {
    try {
      const bloomPh    = unseenHashes.map(() => '?').join(',')
      const bloomExist = await db
        .prepare(`SELECT hash FROM content_hash_bloom WHERE hash IN (${bloomPh})`)
        .bind(...unseenHashes)
        .all()
      for (const r of bloomExist.results ?? []) seen.add((r as any).hash)
    } catch {}
  }

  const novel = items.filter(i => !seen.has(i.item.content_hash))
  if (!novel.length) return 0

  const stmts = novel.map(({ src, item, rowIdx, wid }) => {
    // Deterministic train/val/test split (90/5/5)
    const split = rowIdx % 20 === 0 ? 'test' : rowIdx % 10 === 0 ? 'val' : 'train'
    return db.prepare(`
      INSERT OR IGNORE INTO dataset_items (
        id, media_type, source_name, hf_dataset_id, label, confidence,
        content_text, content_url, content_preview, content_hash,
        quality_score, language, word_count, char_count, sentence_count,
        duration_seconds, sample_rate, resolution_w, resolution_h, file_format,
        has_face, has_speech, is_synthetic, split, hf_row_index,
        hf_config, hf_split, worker_id, metadata, created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    `).bind(
      crypto.randomUUID(),
      src.media_type,
      src.name,
      src.id,
      item.label,
      item.quality_score,
      item.content_text    ?? null,
      item.content_url     ?? null,
      item.content_preview ?? null,
      item.content_hash,
      item.quality_score,
      item.language        ?? 'en',
      item.word_count      ?? null,
      item.char_count      ?? null,
      item.sentence_count  ?? null,
      item.duration_seconds ?? null,
      item.sample_rate     ?? null,
      item.resolution_w    ?? null,
      item.resolution_h    ?? null,
      item.file_format     ?? null,
      item.has_face   ? 1 : 0,
      item.has_speech ? 1 : 0,
      0,
      split,
      rowIdx,
      src.config ?? 'default',
      src.split  ?? 'train',
      wid,
      item.metadata ? JSON.stringify(item.metadata) : null,
    )
  })

  let inserted = 0
  // Batch in chunks of 80 (D1 limit)
  for (let i = 0; i < stmts.length; i += 80) {
    const chunk = stmts.slice(i, i + 80)
    try {
      await db.batch(chunk)
      inserted += chunk.length
    } catch {
      // Fall back to individual inserts if batch fails
      for (const s of chunk) {
        try { await s.run(); inserted++ } catch {}
      }
    }
  }

  // Update pipeline state counter
  if (inserted > 0) {
    await db.prepare(`
      UPDATE pipeline_state
      SET total_scraped = total_scraped + ?,
          last_scrape_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = 1
    `).bind(inserted).run().catch(() => {})
  }

  // Minor fix #8: record newly inserted hashes in permanent bloom filter
  if (inserted > 0) {
    const newHashes = novel.slice(0, inserted).map(i => i.item.content_hash)
    await recordPermanentHashes(db, newHashes)
  }

  return inserted
}

/**
 * Minor fix #8: Permanent content hash store to prevent cross-HF re-insertion.
 * D1 dedup works by content_hash before insert, but rows are deleted after push.
 * A re-scraped URL can re-enter D1 since its hash is gone. This table persists forever.
 * Called by batchInsert — hashes are written after successful D1 insert.
 */
export async function recordPermanentHashes(db: D1Database, hashes: string[]): Promise<void> {
  if (!hashes.length) return
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS content_hash_bloom (
      hash       TEXT PRIMARY KEY,
      first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {})

  const CHUNK = 50
  for (let i = 0; i < hashes.length; i += CHUNK) {
    const chunk = hashes.slice(i, i + CHUNK)
    const values = chunk.map(() => '(?, datetime(\'now\'))').join(',')
    await db.prepare(
      `INSERT OR IGNORE INTO content_hash_bloom (hash, first_seen) VALUES ${values}`
    ).bind(...chunk).run().catch(() => {})
  }
}

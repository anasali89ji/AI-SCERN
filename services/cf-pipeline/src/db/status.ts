/**
 * BUG-FIX #3: Orphan cleanup was deleting un-pushed rows during HF outages.
 *
 * OLD behaviour:
 *   DELETE FROM dataset_items WHERE created_at < datetime('now', '-2 hours')
 *   → Any row > 2h old was silently wiped, even if HF had been down and the row was never pushed.
 *
 * NEW behaviour:
 *   1. Check for a recent successful push in hf_push_log (within 3h).
 *      - If yes → HF is up, use the normal 2h orphan window.
 *      - If no  → HF may be down/slow, extend orphan window to 6h as a safety margin.
 *   2. Add hf_push_log trim: trim to 2000 rows (not 500) so the audit trail is longer.
 *      NOTE: part numbers now come from hf_shard_counters (never trimmed), so trimming
 *            hf_push_log no longer causes part# collisions (Bug #1 already fixed).
 */

export async function getStatus(db: D1Database) {
  const [st, ct, ql, sr, pl] = await db.batch([
    db.prepare('SELECT * FROM pipeline_state WHERE id = 1'),
    db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN media_type='text'  THEN 1 ELSE 0 END) as text_count,
        SUM(CASE WHEN media_type='image' THEN 1 ELSE 0 END) as image_count,
        SUM(CASE WHEN media_type='audio' THEN 1 ELSE 0 END) as audio_count,
        SUM(CASE WHEN media_type='video' THEN 1 ELSE 0 END) as video_count,
        SUM(CASE WHEN label='ai'         THEN 1 ELSE 0 END) as ai_count,
        SUM(CASE WHEN label='human'      THEN 1 ELSE 0 END) as human_count,
        0 as pushed_in_table,
        COUNT(*) as pending,
        SUM(CASE WHEN split='train' THEN 1 ELSE 0 END) as train_count,
        SUM(CASE WHEN split='val'   THEN 1 ELSE 0 END) as val_count,
        SUM(CASE WHEN split='test'  THEN 1 ELSE 0 END) as test_count
      FROM dataset_items
    `),
    db.prepare(`
      SELECT
        ROUND(AVG(quality_score), 3) as avg_quality,
        ROUND(AVG(CASE WHEN media_type='text'  THEN word_count       END), 0) as avg_words,
        ROUND(AVG(CASE WHEN media_type='audio' THEN duration_seconds END), 1) as avg_audio_s,
        ROUND(AVG(CASE WHEN media_type='image' THEN resolution_w * resolution_h END), 0) as avg_pixels
      FROM dataset_items
    `),
    db.prepare(`
      SELECT source_name, media_type, label, COUNT(*) as count
      FROM dataset_items
      GROUP BY source_name, media_type, label
      ORDER BY count DESC
      LIMIT 25
    `),
    db.prepare(`
      SELECT item_count, commit_id, status, error, created_at
      FROM hf_push_log
      ORDER BY created_at DESC
      LIMIT 10
    `),
  ])

  return {
    pipeline:      'Aiscern Neural Pipeline v8.1 — Bug-Fixed Edition',
    version:       'v8.1',
    data_mode:     'REAL (HuggingFace Datasets API)',
    hf_structure:  'data/{media_type}/{language}/part-NNNN.jsonl',
    state:         st.results[0],
    dataset:       ct.results[0],
    quality:       ql.results[0],
    top_sources:   sr.results,
    recent_pushes: pl.results,
  }
}

/**
 * Safety-net cleanup — called by W20 every 100 ticks (~1.7 hours).
 *
 * BUG-FIX #3: Orphan window is now adaptive:
 *   - If HF push was successful in the last 3h → use 2h orphan window (normal)
 *   - If no successful push in 3h (HF may be down) → extend to 6h
 *
 * hf_push_log is trimmed to 2000 rows (was 500). Part numbers now live in
 * hf_shard_counters and are never trimmed, so this trim is safe.
 */
export async function cleanupPushed(db: D1Database): Promise<number> {
  // Check for recent successful push (within 3h)
  const recentPush = await db.prepare(`
    SELECT COUNT(*) as cnt
    FROM hf_push_log
    WHERE status = 'success'
      AND created_at > datetime('now', '-3 hours')
  `).first<{ cnt: number }>().catch(() => null)

  const hfIsReachable = (recentPush?.cnt ?? 0) > 0

  // BUG-FIX #3: adaptive orphan window
  const orphanWindow = hfIsReachable ? '-2 hours' : '-6 hours'

  const stale = await db.prepare(`
    DELETE FROM dataset_items
    WHERE created_at < datetime('now', ?)
  `).bind(orphanWindow).run().catch(() => ({ meta: { changes: 0 } }))

  // Trim hf_push_log — now 2000 rows, not 500
  // Safe because part numbers come from hf_shard_counters (Bug #1 fixed)
  await db.prepare(`
    DELETE FROM hf_push_log
    WHERE id NOT IN (
      SELECT id FROM hf_push_log
      ORDER BY created_at DESC
      LIMIT 2000
    )
  `).run().catch(() => {})

  return stale.meta?.changes ?? 0
}

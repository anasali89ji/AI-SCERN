/**
 * Aiscern Pipeline v8.1 — HuggingFace Multi-Repo Push
 *
 * BUG-FIX #1: Shard part# collision
 *   OLD: partNum = COUNT(hf_push_log) → resets when log is trimmed to 500 → overwrites HF files
 *   FIX: Use a dedicated hf_shard_counters table (never trimmed) with AUTOINCREMENT-style
 *        MAX(part_number)+1 per (repo, media_type, language) key.
 *
 * BUG-FIX #2: Race condition (multiple workers call pushToHF simultaneously)
 *   FIX: push.ts now returns early if another push is already in progress, using a D1 lock row.
 *        worker.ts is ALSO fixed to remove the backup push from W1–W14 (only W20 should push).
 *
 * BUG-FIX #3: Orphan cleanup was deleting un-pushed rows during HF outages
 *   FIX: cleanupPushed() now checks for recent successful pushes before deleting orphans.
 *        If no successful push in the last 3h, the orphan window extends to 6h.
 *
 * Each modality pushes to its own HF dataset repo:
 *   text  → HF_REPO        (default: saghi776/detectai-dataset)
 *   image → HF_IMAGE_REPO  (default: saghi776/aiscern-image-dataset)
 *   audio → HF_AUDIO_REPO  (default: saghi776/aiscern-audio-dataset)
 *   video → HF_VIDEO_REPO  (default: saghi776/aiscern-video-dataset)
 */

import { toBase64, hfShardPath, hfMetaPath, sha256 } from '../utils/crypto'
import type { PushResult, ShardMeta } from '../types'

interface DBRow {
  id:              string
  media_type:      string
  source_name:     string
  hf_dataset_id:   string
  label:           string
  quality_score:   number
  content_text?:   string
  content_url?:    string
  content_preview?: string
  content_hash:    string
  word_count?:     number
  char_count?:     number
  duration_seconds?: number
  sample_rate?:    number
  resolution_w?:   number
  resolution_h?:   number
  file_format?:    string
  has_face:        number
  has_speech:      number
  split:           string
  hf_row_index?:   number
  language:        string
  created_at:      string
}

const DEFAULT_REPOS: Record<string, string> = {
  text:  'saghi776/detectai-dataset',
  image: 'saghi776/aiscern-image-dataset',
  audio: 'saghi776/aiscern-audio-dataset',
  video: 'saghi776/aiscern-video-dataset',
}

export function repoForModality(
  mediaType: string,
  env: { HF_REPO?: string; HF_IMAGE_REPO?: string; HF_AUDIO_REPO?: string; HF_VIDEO_REPO?: string }
): string {
  switch (mediaType) {
    case 'text':  return env.HF_REPO       ?? DEFAULT_REPOS.text
    case 'image': return env.HF_IMAGE_REPO ?? DEFAULT_REPOS.image
    case 'audio': return env.HF_AUDIO_REPO ?? DEFAULT_REPOS.audio
    case 'video': return env.HF_VIDEO_REPO ?? DEFAULT_REPOS.video
    default:      return env.HF_REPO       ?? DEFAULT_REPOS.text
  }
}

/**
 * BUG-FIX #1: Get next part number from a DEDICATED counter table (never trimmed).
 * Uses MAX(part_number)+1 per (repo, media_type, language) key.
 * Falls back to 1 on first push or table-creation failure.
 */
async function getNextPartNumber(
  db: D1Database,
  repo: string,
  mediaType: string,
  lang: string,
): Promise<number> {
  // Ensure the counter table exists — idempotent
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS hf_shard_counters (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      repo        TEXT NOT NULL,
      media_type  TEXT NOT NULL,
      language    TEXT NOT NULL,
      part_number INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(repo, media_type, language)
    )
  `).run().catch(() => {})

  // Atomically insert-or-increment and return the new part_number
  await db.prepare(`
    INSERT INTO hf_shard_counters (repo, media_type, language, part_number)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(repo, media_type, language)
    DO UPDATE SET part_number = part_number + 1
  `).bind(repo, mediaType, lang).run()

  const row = await db.prepare(`
    SELECT part_number FROM hf_shard_counters
    WHERE repo = ? AND media_type = ? AND language = ?
  `).bind(repo, mediaType, lang).first<{ part_number: number }>()

  return row?.part_number ?? 1
}

/**
 * BUG-FIX #2: Distributed push lock — only one worker can push at a time.
 * Uses a D1 row as a soft lock with a 55-second TTL (cron interval is 60s).
 * Returns true if the lock was acquired.
 */
async function acquirePushLock(db: D1Database, workerId: string): Promise<boolean> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS push_lock (
      id         INTEGER PRIMARY KEY CHECK (id = 1),
      locked_by  TEXT,
      locked_at  TIMESTAMP
    )
  `).run().catch(() => {})

  // Check if lock is held and still fresh (within 55s)
  const existing = await db.prepare(`
    SELECT locked_by, locked_at FROM push_lock WHERE id = 1
  `).first<{ locked_by: string; locked_at: string }>()

  if (existing) {
    const ageSeconds = (Date.now() - new Date(existing.locked_at).getTime()) / 1000
    if (ageSeconds < 55) {
      // Lock is fresh — another worker is pushing
      return false
    }
    // Lock is stale (> 55s) — previous worker crashed or timed out; take over
  }

  await db.prepare(`
    INSERT INTO push_lock (id, locked_by, locked_at) VALUES (1, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET locked_by = excluded.locked_by, locked_at = excluded.locked_at
  `).bind(workerId).run()

  return true
}

async function releasePushLock(db: D1Database): Promise<void> {
  await db.prepare(`DELETE FROM push_lock WHERE id = 1`).run().catch(() => {})
}

async function ensureRepo(repo: string, token: string): Promise<void> {
  const [org, name] = repo.split('/')
  if (!org || !name) return
  const check = await fetch(`https://huggingface.co/api/datasets/${repo}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (check.ok) return
  await fetch('https://huggingface.co/api/repos/create', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'dataset', name, organization: org, private: false }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {})
}

async function chunkedDelete(db: D1Database, ids: string[]): Promise<void> {
  const CHUNK = 100
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const ph    = chunk.map(() => '?').join(',')
    await db.prepare(`DELETE FROM dataset_items WHERE id IN (${ph})`)
      .bind(...chunk).run().catch(() => {})
  }
}

async function pushModalityGroup(
  db:        D1Database,
  token:     string,
  mediaType: string,
  repo:      string,
  rows:      DBRow[],
): Promise<{ pushed: number; commitId?: string; error?: string; files: string[] }> {
  await ensureRepo(repo, token)

  const langGroups = new Map<string, DBRow[]>()
  for (const row of rows) {
    const lang = (row.language || 'en').toLowerCase().slice(0, 5)
    if (!langGroups.has(lang)) langGroups.set(lang, [])
    langGroups.get(lang)!.push(row)
  }

  const operations:  any[]       = []
  const shardMetas:  ShardMeta[] = []
  const pushedIds:   string[]    = []
  const pushedFiles: string[]    = []

  for (const [lang, groupRows] of langGroups) {
    // BUG-FIX #1: use dedicated counter table instead of COUNT(hf_push_log)
    const partNum = await getNextPartNumber(db, repo, mediaType, lang)

    const jsonl = groupRows.map(r => JSON.stringify({
      id:             r.id,
      media_type:     r.media_type,
      source:         r.source_name,
      source_dataset: r.hf_dataset_id,
      label:          r.label,
      quality:        r.quality_score,
      preview:        r.content_preview,
      url:            r.content_url    ?? null,
      text:           r.content_text   ?? null,
      hash:           r.content_hash,
      split:          r.split,
      language:       r.language ?? 'en',
      word_count:     r.word_count     ?? null,
      char_count:     r.char_count     ?? null,
      duration_s:     r.duration_seconds ?? null,
      sample_rate:    r.sample_rate    ?? null,
      width:          r.resolution_w   ?? null,
      height:         r.resolution_h   ?? null,
      format:         r.file_format    ?? null,
      has_face:       r.has_face  === 1,
      has_speech:     r.has_speech === 1,
      row_index:      r.hf_row_index   ?? null,
      scraped_at:     r.created_at,
    })).join('\n')

    const filePath  = hfShardPath(mediaType, lang, partNum)
    const metaPath  = hfMetaPath(mediaType, lang, partNum)
    const shardHash = await sha256(jsonl)

    const sourceDist: Record<string, number> = {}
    for (const r of groupRows) sourceDist[r.source_name] = (sourceDist[r.source_name] ?? 0) + 1

    const meta: ShardMeta = {
      shard_id:            `${mediaType}-${lang}-${String(partNum).padStart(4, '0')}`,
      media_type:          mediaType as any,
      language:            lang,
      sample_count:        groupRows.length,
      size_bytes:          new TextEncoder().encode(jsonl).length,
      sha256_hash:         shardHash,
      created_at:          new Date().toISOString(),
      schema_version:      'v8.1',
      source_distribution: sourceDist,
      hf_path:             filePath,
    }

    operations.push({ type: 'addOrUpdate', key: filePath, value: toBase64(jsonl) })
    operations.push({ type: 'addOrUpdate', key: metaPath, value: toBase64(JSON.stringify(meta, null, 2)) })
    shardMetas.push(meta)
    pushedIds.push(...groupRows.map(r => r.id))
    pushedFiles.push(filePath)
  }

  const datasetInfo = buildDatasetInfo(shardMetas)
  operations.push({
    type:  'addOrUpdate',
    key:   'dataset_infos.json',
    value: toBase64(JSON.stringify(datasetInfo, null, 2)),
  })

  const commitSummary = `pipeline v8.1 [${mediaType}]: ${pushedIds.length} items — ${repo}`

  const hfRes = await fetch(`https://huggingface.co/api/datasets/${repo}/commit/main`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ summary: commitSummary, operations }),
    signal:  AbortSignal.timeout(28_000),
  })

  if (!hfRes.ok) {
    const errText = await hfRes.text().catch(() => '')
    const errMsg  = `HF ${hfRes.status} [${repo}]: ${errText.slice(0, 300)}`
    await db.prepare(`
      INSERT INTO hf_push_log (item_count, repo, status, error, created_at)
      VALUES (0, ?, 'error', ?, datetime('now'))
    `).bind(repo, errMsg.slice(0, 500)).run().catch(() => {})
    return { pushed: 0, error: errMsg, files: [] }
  }

  const hfJson   = await hfRes.json() as any
  const commitId = hfJson.id ?? hfJson.oid ?? 'ok'

  // Log each shard (for audit only — part numbers come from hf_shard_counters, not this log)
  for (const meta of shardMetas) {
    await db.prepare(`
      INSERT INTO hf_push_log
        (item_count, commit_id, repo, status, media_type, language, shard_path, sha256_hash, created_at)
      VALUES (?, ?, ?, 'success', ?, ?, ?, ?, datetime('now'))
    `).bind(
      meta.sample_count, commitId, repo,
      meta.media_type, meta.language, meta.hf_path, meta.sha256_hash,
    ).run().catch(() => {})
  }

  await db.prepare(`
    UPDATE pipeline_state
    SET total_pushed = total_pushed + ?, last_push_at = datetime('now'), updated_at = datetime('now')
    WHERE id = 1
  `).bind(pushedIds.length).run().catch(() => {})

  // Delete successfully pushed rows
  await chunkedDelete(db, pushedIds)

  return { pushed: pushedIds.length, commitId, files: pushedFiles }
}

export async function pushToHF(
  db:       D1Database,
  token:    string,
  env:      { HF_REPO?: string; HF_IMAGE_REPO?: string; HF_AUDIO_REPO?: string; HF_VIDEO_REPO?: string },
  batchSz = 5000,
  workerId = 'w20',
): Promise<PushResult> {

  // BUG-FIX #2: acquire distributed push lock — only one worker pushes at a time
  const locked = await acquirePushLock(db, workerId)
  if (!locked) {
    return { pushed: 0, skipped: 'push_locked' }
  }

  try {
    const { results } = await db.prepare(`
      SELECT id, media_type, source_name, hf_dataset_id, label, quality_score,
             content_text, content_url, content_preview, content_hash,
             word_count, char_count, duration_seconds, sample_rate,
             resolution_w, resolution_h, file_format,
             has_face, has_speech, split, hf_row_index, language, created_at
      FROM dataset_items
      WHERE hf_pushed_at IS NULL
      ORDER BY quality_score DESC, created_at ASC
      LIMIT ?
    `).bind(batchSz).all()

    if (!results?.length) return { pushed: 0 }

    const rows = results as unknown as DBRow[]

    const byModality = new Map<string, DBRow[]>()
    for (const row of rows) {
      if (!byModality.has(row.media_type)) byModality.set(row.media_type, [])
      byModality.get(row.media_type)!.push(row)
    }

    // Push modalities sequentially to avoid D1 write contention during chunkedDelete
    let totalPushed = 0
    const allFiles:    string[]          = []
    const allErrors:   string[]          = []
    let   firstCommit: string | undefined

    for (const [mediaType, modalityRows] of byModality) {
      const repo   = repoForModality(mediaType, env)
      const result = await pushModalityGroup(db, token, mediaType, repo, modalityRows)
      totalPushed += result.pushed
      allFiles.push(...result.files)
      if (result.commitId && !firstCommit) firstCommit = result.commitId
      if (result.error) allErrors.push(result.error)
    }

    const errors = allErrors.join('; ')
    if (totalPushed === 0 && errors) return { pushed: 0, error: errors }
    return { pushed: totalPushed, commitId: firstCommit, files: allFiles }

  } finally {
    // Always release lock — even on exception
    await releasePushLock(db)
  }
}

function buildDatasetInfo(metas: ShardMeta[]): Record<string, any> {
  const configs: Record<string, any> = {}
  for (const meta of metas) {
    const key = `${meta.media_type}_${meta.language}`
    if (!configs[key]) {
      configs[key] = {
        data_files: [{ split: 'train', path: `data/${meta.media_type}/${meta.language}/*.jsonl` }],
        features:   getFeatures(meta.media_type),
      }
    }
  }
  return configs
}

function getFeatures(mediaType: string): Record<string, any> {
  const base = {
    id:             { dtype: 'string',  _type: 'Value' },
    media_type:     { dtype: 'string',  _type: 'Value' },
    source:         { dtype: 'string',  _type: 'Value' },
    source_dataset: { dtype: 'string',  _type: 'Value' },
    label:          { dtype: 'string',  _type: 'Value' },
    quality:        { dtype: 'float32', _type: 'Value' },
    preview:        { dtype: 'string',  _type: 'Value' },
    hash:           { dtype: 'string',  _type: 'Value' },
    split:          { dtype: 'string',  _type: 'Value' },
    language:       { dtype: 'string',  _type: 'Value' },
    scraped_at:     { dtype: 'string',  _type: 'Value' },
  }
  const extra: Record<string, Record<string, any>> = {
    text:  { text:       { dtype: 'string',  _type: 'Value' }, word_count:  { dtype: 'int32',   _type: 'Value' }, char_count:  { dtype: 'int32', _type: 'Value' } },
    image: { url:        { dtype: 'string',  _type: 'Value' }, width:       { dtype: 'int32',   _type: 'Value' }, height:      { dtype: 'int32', _type: 'Value' }, has_face:   { dtype: 'bool', _type: 'Value' } },
    audio: { url:        { dtype: 'string',  _type: 'Value' }, duration_s:  { dtype: 'float32', _type: 'Value' }, sample_rate: { dtype: 'int32', _type: 'Value' }, has_speech: { dtype: 'bool', _type: 'Value' } },
    video: { url:        { dtype: 'string',  _type: 'Value' }, duration_s:  { dtype: 'float32', _type: 'Value' }, width:       { dtype: 'int32', _type: 'Value' }, height:     { dtype: 'int32', _type: 'Value' } },
  }
  return { ...base, ...(extra[mediaType] ?? {}) }
}

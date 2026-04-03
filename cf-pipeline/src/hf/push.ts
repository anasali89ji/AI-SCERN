/**
 * Aiscern Pipeline v7.3 — HuggingFace Multi-Repo Push
 *
 * Each modality pushes to its own HF dataset repo:
 *   text  → HF_REPO        (default: saghi776/detectai-dataset)
 *   image → HF_IMAGE_REPO  (default: saghi776/aiscern-image-dataset)
 *   audio → HF_AUDIO_REPO  (default: saghi776/aiscern-audio-dataset)
 *   video → HF_VIDEO_REPO  (default: saghi776/aiscern-video-dataset)
 *
 * Repos are auto-created on first push if they don't exist.
 */

import { toBase64, hfShardPath, hfMetaPath, sha256 } from '../utils/crypto'
import type { PushResult, ShardMeta } from '../types'

interface DBRow {
  id:             string
  media_type:     string
  source_name:    string
  hf_dataset_id:  string
  label:          string
  quality_score:  number
  content_text?:  string
  content_url?:   string
  content_preview?: string
  content_hash:   string
  word_count?:    number
  char_count?:    number
  duration_seconds?: number
  sample_rate?:   number
  resolution_w?:  number
  resolution_h?:  number
  file_format?:   string
  has_face:       number
  has_speech:     number
  split:          string
  hf_row_index?:  number
  language:       string
  created_at:     string
}

/** Default repo names per modality */
const DEFAULT_REPOS: Record<string, string> = {
  text:  'saghi776/detectai-dataset',
  image: 'saghi776/aiscern-image-dataset',
  audio: 'saghi776/aiscern-audio-dataset',
  video: 'saghi776/aiscern-video-dataset',
}

/** Resolve repo name for a given modality from env */
export function repoForModality(
  mediaType: string,
  env: { HF_REPO?: string; HF_IMAGE_REPO?: string; HF_AUDIO_REPO?: string; HF_VIDEO_REPO?: string }
): string {
  switch (mediaType) {
    case 'text':  return env.HF_REPO        ?? DEFAULT_REPOS.text
    case 'image': return env.HF_IMAGE_REPO  ?? DEFAULT_REPOS.image
    case 'audio': return env.HF_AUDIO_REPO  ?? DEFAULT_REPOS.audio
    case 'video': return env.HF_VIDEO_REPO  ?? DEFAULT_REPOS.video
    default:      return env.HF_REPO        ?? DEFAULT_REPOS.text
  }
}

/** Auto-create a HF dataset repo if it doesn't exist yet */
async function ensureRepo(repo: string, token: string): Promise<void> {
  const [org, name] = repo.split('/')
  if (!org || !name) return

  // Check if repo exists
  const check = await fetch(`https://huggingface.co/api/datasets/${repo}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (check.ok) return  // already exists

  // Create it
  await fetch('https://huggingface.co/api/repos/create', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'dataset', name, organization: org, private: false }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {})  // best-effort — push will fail with clear error if this fails
}

/** Delete rows in safe parameterized chunks — avoids D1 1MB SQL limit */
async function chunkedDelete(db: D1Database, ids: string[]): Promise<void> {
  const CHUNK = 100
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const ph    = chunk.map(() => '?').join(',')
    await db.prepare(`DELETE FROM dataset_items WHERE id IN (${ph})`)
      .bind(...chunk)
      .run()
      .catch(() => {})
  }
}

/** Push one modality group to its dedicated HF repo */
async function pushModalityGroup(
  db:        D1Database,
  token:     string,
  mediaType: string,
  repo:      string,
  rows:      DBRow[],
  batchSz:   number,
): Promise<{ pushed: number; commitId?: string; error?: string; files: string[] }> {

  // Ensure repo exists (auto-creates on first push)
  await ensureRepo(repo, token)

  // Group by language within this modality
  const langGroups = new Map<string, DBRow[]>()
  for (const row of rows) {
    const lang = (row.language || 'en').toLowerCase().slice(0, 5)
    if (!langGroups.has(lang)) langGroups.set(lang, [])
    langGroups.get(lang)!.push(row)
  }

  const operations: any[]     = []
  const shardMetas: ShardMeta[] = []
  const pushedIds: string[]   = []
  const pushedFiles: string[] = []

  for (const [lang, groupRows] of langGroups) {
    // Get next part number from push log for this repo+modality+lang
    const existing = await db.prepare(`
      SELECT COUNT(*) as cnt FROM hf_push_log
      WHERE repo = ? AND media_type = ? AND language = ?
    `).bind(repo, mediaType, lang).first<{ cnt: number }>()
    const partNum = (existing?.cnt ?? 0) + 1

    // Build JSONL
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

    const filePath = hfShardPath(mediaType, lang, partNum)
    const metaPath = hfMetaPath(mediaType, lang, partNum)
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
      schema_version:      'v7.3',
      source_distribution: sourceDist,
      hf_path:             filePath,
    }

    operations.push({ type: 'addOrUpdate', key: filePath, value: toBase64(jsonl) })
    operations.push({ type: 'addOrUpdate', key: metaPath, value: toBase64(JSON.stringify(meta, null, 2)) })
    shardMetas.push(meta)
    pushedIds.push(...groupRows.map(r => r.id))
    pushedFiles.push(filePath)
  }

  // Also push dataset_infos.json so HF auto-detects schema
  const datasetInfo = buildDatasetInfo(shardMetas)
  operations.push({
    type: 'addOrUpdate',
    key:  'dataset_infos.json',
    value: toBase64(JSON.stringify(datasetInfo, null, 2)),
  })

  const commitSummary = `pipeline v7.3 [${mediaType}]: ${pushedIds.length} items — ${repo}`

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

  // Log each shard
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

  // Update pipeline state counter
  await db.prepare(`
    UPDATE pipeline_state
    SET total_pushed = total_pushed + ?, last_push_at = datetime('now'), updated_at = datetime('now')
    WHERE id = 1
  `).bind(pushedIds.length).run().catch(() => {})

  // Delete pushed rows immediately
  await chunkedDelete(db, pushedIds)

  return { pushed: pushedIds.length, commitId, files: pushedFiles }
}

/** Main push function — routes each modality to its own HF repo */
export async function pushToHF(
  db:      D1Database,
  token:   string,
  env:     { HF_REPO?: string; HF_IMAGE_REPO?: string; HF_AUDIO_REPO?: string; HF_VIDEO_REPO?: string },
  batchSz = 5000,
): Promise<PushResult> {

  // Fetch unpushed rows ordered by quality DESC
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

  // Group by modality
  const byModality = new Map<string, DBRow[]>()
  for (const row of rows) {
    if (!byModality.has(row.media_type)) byModality.set(row.media_type, [])
    byModality.get(row.media_type)!.push(row)
  }

  // Push each modality concurrently to its own repo
  const results2 = await Promise.all(
    [...byModality.entries()].map(([mediaType, modalityRows]) => {
      const repo = repoForModality(mediaType, env)
      return pushModalityGroup(db, token, mediaType, repo, modalityRows, batchSz)
    })
  )

  const totalPushed = results2.reduce((s, r) => s + r.pushed, 0)
  const allFiles    = results2.flatMap(r => r.files)
  const firstCommit = results2.find(r => r.commitId)?.commitId
  const errors      = results2.filter(r => r.error).map(r => r.error).join('; ')

  if (totalPushed === 0 && errors) return { pushed: 0, error: errors }
  return { pushed: totalPushed, commitId: firstCommit, files: allFiles }
}

/** Build dataset_infos.json for HF schema auto-detection */
function buildDatasetInfo(metas: ShardMeta[]): Record<string, any> {
  const configs: Record<string, any> = {}
  for (const meta of metas) {
    const key = `${meta.media_type}_${meta.language}`
    if (!configs[key]) {
      configs[key] = {
        data_files: [{ split: 'train', path: `data/${meta.media_type}/${meta.language}/*.jsonl` }],
        features: getFeatures(meta.media_type),
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
    text:  { text: { dtype: 'string', _type: 'Value' }, word_count: { dtype: 'int32', _type: 'Value' }, char_count: { dtype: 'int32', _type: 'Value' } },
    image: { url:  { dtype: 'string', _type: 'Value' }, width:      { dtype: 'int32', _type: 'Value' }, height:     { dtype: 'int32', _type: 'Value' }, has_face:   { dtype: 'bool', _type: 'Value' } },
    audio: { url:  { dtype: 'string', _type: 'Value' }, duration_s: { dtype: 'float32', _type: 'Value' }, sample_rate: { dtype: 'int32', _type: 'Value' }, has_speech: { dtype: 'bool', _type: 'Value' } },
    video: { url:  { dtype: 'string', _type: 'Value' }, duration_s: { dtype: 'float32', _type: 'Value' }, width:      { dtype: 'int32', _type: 'Value' }, height:     { dtype: 'int32', _type: 'Value' } },
  }
  return { ...base, ...(extra[mediaType] ?? {}) }
}

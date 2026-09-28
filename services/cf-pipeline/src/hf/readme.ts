/**
 * Aiscern Pipeline v7.3 — Per-Modality README Push
 *
 * Each modality repo gets its own tailored README with accurate stats.
 */

import { toBase64 } from '../utils/crypto'
import { repoForModality } from './push'

interface PushReadmeEnv {
  HF_REPO?:       string
  HF_IMAGE_REPO?: string
  HF_AUDIO_REPO?: string
  HF_VIDEO_REPO?: string
}

async function pushRepoReadme(
  token:     string,
  repo:      string,
  mediaType: string,
  pushed:    number,
  pending:   number,
  lastPush:  string,
): Promise<void> {
  const label = { text: 'Text', image: 'Image', audio: 'Audio', video: 'Video' }[mediaType] ?? mediaType
  const tasks = {
    text:  'text-classification',
    image: 'image-classification',
    audio: 'audio-classification',
    video: 'video-classification',
  }[mediaType] ?? 'text-classification'

  const content = `---
license: cc-by-4.0
task_categories:
  - ${tasks}
tags:
  - ai-detection
  - deepfake
  - synthetic-data
  - aiscern
size_categories:
  - 100K<n<1M
configs:
  - config_name: default
    data_files: "data/${mediaType}/en/*.jsonl"
---

# Aiscern ${label} Detection Dataset

**${label} AI vs Human detection dataset** — scraped and curated by the [Aiscern](https://aiscern.com) pipeline from public HuggingFace sources.

## 📊 Stats

| | Count |
|---|---|
| Pushed samples | ${pushed.toLocaleString()} |
| Pending (in queue) | ${pending.toLocaleString()} |
| Last push | ${lastPush} |

## 📁 Structure

\`\`\`
data/${mediaType}/en/part-0001.jsonl
data/${mediaType}/en/part-0002.jsonl
...
\`\`\`

## 🏷️ Schema

\`\`\`json
{
  "id":         "uuid",
  "media_type": "${mediaType}",
  "source":     "source-dataset-name",
  "label":      "ai | human",
  "quality":    0.85,
  "url":        "https://...",
  "split":      "train | val | test",
  "language":   "en",
  "scraped_at": "2026-01-01T00:00:00Z"
}
\`\`\`

## 📦 Usage

\`\`\`python
from datasets import load_dataset
ds = load_dataset("${repo}")
print(ds["train"][0])
\`\`\`

## 📜 License

CC-BY-4.0. Individual source datasets retain their own licenses.
`

  await fetch(`https://huggingface.co/api/datasets/${repo}/commit/main`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary:    `docs: update ${mediaType} dataset card — ${pushed.toLocaleString()} samples`,
      operations: [{ type: 'addOrUpdate', key: 'README.md', value: toBase64(content) }],
    }),
    signal: AbortSignal.timeout(25_000),
  }).catch(() => {}) // Non-fatal
}

export async function pushReadme(
  db:    D1Database,
  token: string,
  env:   PushReadmeEnv,
): Promise<void> {
  const ps = await db.prepare(
    `SELECT total_scraped, total_pushed, last_push_at FROM pipeline_state WHERE id=1`
  ).first<any>()

  const modalities = ['text', 'image', 'audio', 'video']

  await Promise.all(modalities.map(async (mt) => {
    const repo = repoForModality(mt, env)

    const pushedRow = await db.prepare(`
      SELECT SUM(item_count) as count FROM hf_push_log
      WHERE repo = ? AND status = 'success' AND media_type = ?
    `).bind(repo, mt).first<{ count: number }>()

    const pendRow = await db.prepare(`
      SELECT COUNT(*) as count FROM dataset_items
      WHERE media_type = ? AND hf_pushed_at IS NULL
    `).bind(mt).first<{ count: number }>()

    await pushRepoReadme(
      token, repo, mt,
      pushedRow?.count ?? 0,
      pendRow?.count   ?? 0,
      ps?.last_push_at ?? 'N/A',
    )
  }))
}

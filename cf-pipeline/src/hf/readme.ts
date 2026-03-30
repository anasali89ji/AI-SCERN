/**
 * Aiscern Pipeline v7.2 — Dataset README Push
 *
 * Fix D3: Stats now sourced from pipeline_state + hf_push_log
 * (dataset_items is always empty after push — rows are deleted immediately)
 */

import { toBase64 } from '../utils/crypto'

export async function pushReadme(
  db:    D1Database,
  token: string,
  repo:  string,
): Promise<void> {
  // Pull stats from pipeline_state (persists after rows deleted) + hf_push_log per modality
  const ps = await db.prepare(
    `SELECT total_scraped, total_pushed, last_scrape_at, last_push_at FROM pipeline_state WHERE id=1`
  ).first<any>()

  // Per-modality pushed counts from hf_push_log (survives post-delete)
  const modStats = await db.prepare(`
    SELECT media_type, SUM(item_count) as count
    FROM hf_push_log
    WHERE repo = ? AND status = 'success'
    GROUP BY media_type
  `).bind(repo).all()

  // Pending (not yet pushed) from dataset_items — these DO exist
  const pending = await db.prepare(`
    SELECT media_type, COUNT(*) as count
    FROM dataset_items
    WHERE hf_pushed_at IS NULL
    GROUP BY media_type
  `).all()

  const pushed: Record<string, number> = {}
  for (const r of (modStats.results ?? []) as any[]) {
    pushed[r.media_type] = r.count ?? 0
  }
  const pend: Record<string, number> = {}
  for (const r of (pending.results ?? []) as any[]) {
    pend[r.media_type] = r.count ?? 0
  }

  const textPushed  = pushed['text']  ?? 0
  const imagePushed = pushed['image'] ?? 0
  const audioPushed = pushed['audio'] ?? 0
  const videoPushed = pushed['video'] ?? 0
  const totalPushed = ps?.total_pushed ?? 0

  const content = `---
language:
  - en
  - multilingual
license: cc-by-4.0
task_categories:
  - text-classification
  - image-classification
  - audio-classification
  - video-classification
tags:
  - ai-detection
  - deepfake
  - synthetic-data
  - multi-modal
size_categories:
  - 1M<n<10M
configs:
  - config_name: text_en
    data_files: "data/text/en/*.jsonl"
  - config_name: image_en
    data_files: "data/image/en/*.jsonl"
  - config_name: audio_en
    data_files: "data/audio/en/*.jsonl"
  - config_name: video_en
    data_files: "data/video/en/*.jsonl"
  - config_name: default
    data_files: "data/**/*.jsonl"
---

# Aiscern Dataset

**Multi-modal AI vs Human detection dataset** — scraped from 72 HuggingFace sources across text, image, audio, and video modalities.

## 📊 Pushed to HuggingFace

| Modality | Pushed Samples |
|----------|---------------|
| Text     | ${textPushed.toLocaleString()} |
| Image    | ${imagePushed.toLocaleString()} |
| Audio    | ${audioPushed.toLocaleString()} |
| Video    | ${videoPushed.toLocaleString()} |
| **Total** | **${totalPushed.toLocaleString()}** |

**Pending (in D1, not yet pushed):** Text: ${pend['text'] ?? 0} | Image: ${pend['image'] ?? 0} | Audio: ${pend['audio'] ?? 0} | Video: ${pend['video'] ?? 0}
**Total scraped:** ${(ps?.total_scraped ?? 0).toLocaleString()}
**Last scrape:** ${ps?.last_scrape_at ?? 'N/A'}
**Last HF push:** ${ps?.last_push_at ?? 'N/A'}

## 📁 Folder Structure

\`\`\`
data/
├── text/en/part-0001.jsonl
├── image/en/part-0001.jsonl
├── audio/en/part-0001.jsonl
└── video/en/part-0001.jsonl
\`\`\`

## 🏷️ Label Schema

\`\`\`json
{
  "id":        "uuid",
  "media_type": "text|image|audio|video",
  "source":    "source-name",
  "label":     "ai|human",
  "quality":   0.85,
  "language":  "en",
  "split":     "train|val|test",
  "scraped_at": "2025-01-01T00:00:00Z"
}
\`\`\`

## 📦 Usage

\`\`\`python
from datasets import load_dataset

# Text subset
ds = load_dataset("${repo}", name="text_en")

# All modalities
ds = load_dataset("${repo}", name="default")
\`\`\`

## 📜 License

CC-BY-4.0. Individual source datasets retain their original licenses.
`

  await fetch(`https://huggingface.co/api/datasets/${repo}/commit/main`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary:    'docs: update dataset card with latest pipeline stats',
      operations: [{ type: 'addOrUpdate', key: 'README.md', value: toBase64(content) }],
    }),
    signal: AbortSignal.timeout(25_000),
  }).catch(() => {}) // Non-fatal — README failures don't block pipeline
}

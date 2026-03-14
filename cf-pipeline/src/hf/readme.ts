/**
 * Generates and pushes the HuggingFace dataset README.md card.
 * Called after every major push cycle.
 */

import { toBase64 } from '../utils/crypto'

export async function pushReadme(
  db:    D1Database,
  token: string,
  repo:  string,
): Promise<void> {
  const st = await db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN media_type='text'  THEN 1 ELSE 0 END) as text_count,
      SUM(CASE WHEN media_type='image' THEN 1 ELSE 0 END) as image_count,
      SUM(CASE WHEN media_type='audio' THEN 1 ELSE 0 END) as audio_count,
      SUM(CASE WHEN media_type='video' THEN 1 ELSE 0 END) as video_count,
      SUM(CASE WHEN label='ai'         THEN 1 ELSE 0 END) as ai_count,
      SUM(CASE WHEN label='human'      THEN 1 ELSE 0 END) as human_count
    FROM dataset_items
  `).first<any>()

  const ps = await db.prepare(`SELECT total_pushed, last_push_at FROM pipeline_state WHERE id=1`).first<any>()

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

# DETECTAI Dataset

**Multi-modal AI vs Human detection dataset** scraped from 57 real HuggingFace sources.

## 📊 Current Stats

| Modality | Count |
|----------|-------|
| Text     | ${(st?.text_count  ?? 0).toLocaleString()} |
| Image    | ${(st?.image_count ?? 0).toLocaleString()} |
| Audio    | ${(st?.audio_count ?? 0).toLocaleString()} |
| Video    | ${(st?.video_count ?? 0).toLocaleString()} |
| **Total** | **${(st?.total ?? 0).toLocaleString()}** |

**AI samples:** ${(st?.ai_count ?? 0).toLocaleString()} | **Human samples:** ${(st?.human_count ?? 0).toLocaleString()}
**Total pushed to HF:** ${(ps?.total_pushed ?? 0).toLocaleString()}
**Last updated:** ${ps?.last_push_at ?? 'N/A'}

## 📁 Folder Structure

\`\`\`
data/
├── text/
│   ├── en/
│   │   ├── part-0001.jsonl
│   │   ├── part-0001.meta.json
│   │   └── ...
│   └── {lang}/...
├── image/
│   └── en/...
├── audio/
│   └── en/...
└── video/
    └── en/...
\`\`\`

## 🏷️ Label Schema

Each JSONL row contains:

\`\`\`json
{
  "id":           "uuid",
  "media_type":   "text|image|audio|video",
  "source":       "source-name",
  "label":        "ai|human",
  "quality":      0.85,
  "language":     "en",
  "split":        "train|val|test",
  "scraped_at":   "2025-01-01T00:00:00Z"
}
\`\`\`

## 📦 Usage

\`\`\`python
from datasets import load_dataset

# Load text subset
ds = load_dataset("${repo}", name="text_en")

# Load all modalities
ds = load_dataset("${repo}", name="default")
\`\`\`

## 🔑 Sources

57 HuggingFace datasets including: HC3, RAID, DiffusionDB, FakeOrReal Audio,
ASVspoof2019, FaceForensics, Kinetics-400, Wikipedia, LibriSpeech, and more.

## 📜 License

CC-BY-4.0. Individual source datasets retain their original licenses.
`

  await fetch(`https://huggingface.co/api/datasets/${repo}/commit/main`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary:    'docs: update dataset card with latest stats',
      operations: [{ type: 'addOrUpdate', key: 'README.md', value: toBase64(content) }],
    }),
    signal: AbortSignal.timeout(30_000),
  }).catch(() => {}) // Non-fatal — README update failures don't block pipeline
}

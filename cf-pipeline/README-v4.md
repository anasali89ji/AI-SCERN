# DETECTAI Neural Pipeline v4 — Real Data Edition

## What changed (v3 → v4)

| | v3 (old) | v4 (new) |
|---|---|---|
| Data | **SYNTHETIC** (fake hashes, no real content) | **REAL** (HuggingFace Datasets API) |
| Schema | 14 fields | **30+ fields** (text/audio/image/video metadata) |
| Modality | text-only (claimed multi) | True text + image + audio + video |
| Dedup | None | SHA-256 per-item before insert |
| Quality | None | Per-modality quality scoring |
| Sources | 104 fake entries | 57 real HF datasets |
| HF Push | JSON rows | Proper JSONL batches |
| D1 size | 500MB (fake data) | ~57KB (fresh) |

---

## Architecture

```
Worker A (cron */1)  ── TEXT_SOURCES[0,5,10,15,20,25]  ──┐
Worker B (cron */1)  ── IMAGE_SOURCES (11 datasets)     ──┤
Worker C (cron */1)  ── AUDIO_SOURCES (12 datasets)     ──┤── D1 (detectai-pipeline)
Worker D (cron */1)  ── VIDEO_SOURCES (8 datasets)      ──┤         ↓
Worker E (cron */1)  ── remaining TEXT + HF push/cleanup──┘   HF Dataset push (every 10 min)
```

## Source Registry

### Text (26 sources)
- **AI**: hc3-english, raid-benchmark, dolly-15k, alpaca, open-orca, ultrachat, openhermes, tiny-stories, gpt4-alpaca, hh-rlhf, airoboros, mage-benchmark, ai-detection-pile, ghostbuster, ai-vs-human
- **Human**: openwebtext, wikipedia-en, cnn-dailymail, imdb-reviews, yelp-reviews, arxiv-abstracts, pubmedqa, stack-exchange, scientific-papers, ag-news, reddit-eli5

### Image (11 sources)
- **AI/Deepfake**: diffusiondb, midjourney-v6, civitai-images, dalle3-coco, ai-art-laion, deepfake-faces, cifake-ai
- **Real**: unsplash-25k, flickr30k, div2k-real, celeba-hq

### Audio (12 sources)
- **AI/Fake**: fake-or-real, in-the-wild-fake, wavefake, deepfake-audio, tts-detection, asvspoof2019
- **Real**: common-voice-en, librispeech-clean, speech-commands, fleurs-en, tedlium, voxceleb

### Video (8 sources)
- **AI/Deepfake**: faceforensics, dfdc-meta, celeb-df, deepfake-timit
- **Real**: kinetics-400, ucf101-subset, hmdb51, xd-violence

## What each item captures

```typescript
// Text items
{ label, content_text (4000 chars), word_count, char_count, sentence_count, quality_score }

// Image items  
{ label, content_url, resolution_w, resolution_h, file_format, has_face, quality_score }

// Audio items
{ label, content_url, duration_seconds, sample_rate, has_speech, transcript_preview, quality_score }

// Video items
{ label, content_url, duration_seconds, resolution_w, resolution_h, has_face, metadata, quality_score }
```

## Deploy

### One-time setup (after rotating Cloudflare token)
```bash
cd cf-pipeline

# Add HF_TOKEN as secret to all workers
HF_TOKEN=hf_xxx CLOUDFLARE_API_TOKEN=new_token bash deploy-all.sh
```

### GitHub Actions (automatic on every push to cf-pipeline/**)
Add these secrets to GitHub repo settings:
- `CLOUDFLARE_API_TOKEN` — new rotated token
- `CLOUDFLARE_ACCOUNT_ID` — 34400e6e147e83e95c942135f54aeba7
- `HF_TOKEN` — your HuggingFace write token (from hf.co/settings/tokens)

### Status endpoints
- https://detectai-pipeline.workers.dev/status    — full analytics
- https://detectai-pipeline-b.workers.dev/health  — image worker
- https://detectai-pipeline-c.workers.dev/health  — audio worker
- https://detectai-pipeline-d.workers.dev/health  — video worker
- https://detectai-pipeline-e.workers.dev/health  — push worker

### Manual triggers
```bash
# Trigger text scrape
curl -X POST https://detectai-pipeline.workers.dev/trigger/scrape

# Trigger HF push
curl -X POST https://detectai-pipeline-e.workers.dev/trigger/push

# Trigger cleanup
curl -X POST https://detectai-pipeline-e.workers.dev/trigger/cleanup
```

## HuggingFace Dataset format

Each batch pushed as JSONL to `saghi776/detectai-dataset`:
```
data/text/batch_2026-03-13T12-00-00.jsonl
data/image/batch_2026-03-13T12-10-00.jsonl
data/audio/batch_2026-03-13T12-20-00.jsonl
data/video/batch_2026-03-13T12-30-00.jsonl
```

## ⚠️ Required actions

1. **Rotate Cloudflare API token** (old one was exposed)
   → https://dash.cloudflare.com/profile/api-tokens
   → Create token with "Worker Scripts: Edit" permission
   → Update GitHub secret `CLOUDFLARE_API_TOKEN`

2. **Make HF dataset public** (or keep private — up to you)
   → https://huggingface.co/datasets/saghi776/detectai-dataset/settings

3. **Trigger the GitHub Actions workflow** manually once to deploy all 5 workers
   → https://github.com/saghirahmed9067-png/DETECT-AI/actions

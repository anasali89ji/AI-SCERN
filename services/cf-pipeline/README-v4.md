# DETECTAI Neural Pipeline v6 — 5-Worker Edition

## Architecture (Cloudflare Free Plan)

```
Worker 1  (detectai-pipeline)   — scraper, sources 0–14  (15 sources), cron */1
Worker 2  (detectai-pipeline-b) — scraper, sources 15–29 (15 sources), cron */1
Worker 3  (detectai-pipeline-c) — scraper, sources 30–44 (15 sources), cron */1
Worker 4  (detectai-pipeline-d) — scraper, sources 45–58 (13 sources), cron */1
Worker 20 (detectai-pipeline-e) — HF push every 10 min + README every 50 min
```

CF free plan = 5 cron triggers max. 20-worker design was impossible.

## Source Distribution (58 total)

| Worker | Sources | Modalities |
|--------|---------|------------|
| 1 | hc3-ai/human, raid, ai-detection-pile, ghostbuster, ai-vs-human, mage, dolly, alpaca, open-orca, ultrachat, openhermes, tiny-stories, gpt4-alpaca, hh-rlhf | Text AI+Human |
| 2 | airoboros, openwebtext, wikipedia-en, cnn-dailymail, imdb, yelp, arxiv, pubmedqa, stack-exchange, scientific-papers, ag-news, reddit-eli5, diffusiondb, midjourney-v6, civitai | Text Human + Image AI |
| 3 | cifake, deepfake-faces, ai-art-laion, dalle3-coco, unsplash, flickr30k, div2k, celeba, fake-or-real, in-the-wild-fake, wavefake, deepfake-audio, tts-detection, asvspoof2019, common-voice | Image + Audio |
| 4 | librispeech, speech-commands, fleurs-en, tedlium, voxceleb, faceforensics, dfdc-metadata, celeb-df-faces, deepfake-vs-real, kinetics-400, ucf101-subset, hmdb51, xd-violence | Audio + Video |
| e | HF push only — pushes D1 items to saghi776/detectai-dataset every 10 min | — |

## Throughput
4 scrapers × ~15 sources × 60 items × 1440 min/day = **~5.2M items/day**

## Status Endpoints
- https://detectai-pipeline.saghirahmed9067.workers.dev/status
- https://detectai-pipeline.saghirahmed9067.workers.dev/health
- https://detectai-pipeline-e.saghirahmed9067.workers.dev/health
- POST https://detectai-pipeline-e.saghirahmed9067.workers.dev/trigger/push

## Fixes Applied (v6.1)
- HF Hub API: `key/value` not `path/content` (root cause of no HF data)
- `hf_pushed_at` set before DELETE (status tracking fixed)
- `toBase64()` uses TextEncoder (deprecated unescape removed)
- hc3-english label_field bug fixed (split into hc3-ai + hc3-human)
- 4 invalid video dataset IDs replaced with real HF repos
- wrangler-b/c/d/e fixed to use src/worker.ts
- workers_dev=true on all configs
- account_id hardcoded (no /memberships call needed)
- TOTAL_SCRAPER_WORKERS=4 (was 19, impossible on free plan)

<div align="center">

<img src="https://aiscern.com/logo.png" alt="Aiscern Logo" width="200"/>

# Aiscern — Multi-Modal AI Content Detection Platform

*Identify AI-generated text, images, audio, and video with state-of-the-art accuracy*

---

[![Website](https://img.shields.io/badge/🌐%20Website-aiscern.com-7c3aed?style=flat-square)](https://aiscern.com)
[![Live Demo](https://img.shields.io/badge/⚡%20Live%20Demo-Try%20Now-2563eb?style=flat-square)](https://aiscern.com/detect/image)
[![HuggingFace](https://img.shields.io/badge/🤗%20HuggingFace-saghi776-ffc107?style=flat-square)](https://huggingface.co/saghi776)
[![License](https://img.shields.io/badge/License-MIT-f5de53?style=flat-square)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15.3-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Gemini](https://img.shields.io/badge/Gemini-2.0%20Flash-4285F4?style=flat-square&logo=google)](https://deepmind.google/technologies/gemini)

</div>

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Platform Overview](#2-platform-overview)
3. [Detection Models](#3-detection-models)
4. [Accuracy Benchmarks](#4-accuracy-benchmarks)
5. [SynthID & C2PA Integration](#5-synthid--c2pa-integration)
6. [API Reference](#6-api-reference)
7. [Quick Start](#7-quick-start)
8. [Architecture](#8-architecture)
9. [Fine-Tuning](#9-fine-tuning)
10. [Data Pipeline](#10-data-pipeline)
11. [Tech Stack](#11-tech-stack)
12. [License](#12-license)
13. [Contact](#13-contact)

---

## 1. Introduction

**Aiscern** is a production-grade, multi-modal AI content detection platform built to identify AI-generated text, images, audio, and deepfake video — with no subscription required.

The platform uses a **hybrid detection architecture**: proprietary fine-tuned transformer models run in parallel with deterministic signal analysis and Gemini 2.0 Flash vision — giving accurate verdicts even when individual models are cold or unavailable. Every scan includes a confidence score, per-signal breakdown, and a plain-English summary.

**Key differentiators:**

- **No cold-start failures** — Gemini 2.0 Flash acts as primary fallback with no warm-up time
- **SynthID awareness** — detects Google's invisible token-selection watermarks in Gemini-generated text
- **C2PA detection** — scans raw image bytes for Content Authenticity Initiative watermarks (Google Imagen, Adobe Firefly, DALL-E 3)
- **Feedback learning loop** — user corrections write to Cloudflare D1 and improve verdicts over time without retraining
- **Fully open source** — MIT licensed, self-hostable on Vercel + Supabase + Cloudflare

---

## 2. Platform Overview

| Tool | What It Does | Engine |
|---|---|---|
| **Text Detector** | Detects ChatGPT, Claude, Gemini, LLaMA, GPT-4 generated text | Gemini 2.0 Flash + RoBERTa ensemble + 7 linguistic signals |
| **Image Detector** | Detects Midjourney, DALL-E 3, Stable Diffusion, Flux, Grok, Firefly | Gemini vision + ViT ensemble + C2PA byte scan + 10 pixel signals |
| **Audio Detector** | Detects ElevenLabs, PlayHT, XTTS, Bark, Azure TTS, RVC clones | Gemini audio + wav2vec2 + 5 acoustic signals |
| **Video Detector** | Detects deepfake face swaps, neural synthesis | NVIDIA NIM frame analysis + ViT fallback + temporal coherence |
| **PDF Scanner** | Scans every paragraph of a PDF document | Chunked text detection with per-paragraph scoring |
| **Web Scanner** | Scans any URL for AI-generated content | Gemini text analysis + image extraction |
| **Batch Scanner** | Analyze multiple files at once | All modalities, parallel processing |
| **ARIA Assistant** | AI chat with image upload and detection context | NVIDIA Nemotron 70B + Gemini vision |

---

## 3. Detection Models

### Text Detection — Transformer Ensemble

| Model | Weight | Specialization |
|---|---|---|
| `openai-community/roberta-base-openai-detector` | 40% | GPT-2 era baseline |
| `Hello-SimpleAI/chatgpt-detector-roberta` | 35% | ChatGPT-3.5/4 specialized |
| `andreas122001/roberta-mixed-detector` | 25% | Claude / Gemini / mixed-source |
| **Gemini 2.0 Flash** | Primary fallback | SynthID-aware, no cold start |

**+ 7 linguistic signals:** Sentence Uniformity, AI Phrase Fingerprint (Claude/Gemini/LLaMA patterns), Perplexity Proxy (bigram + trigram), Burstiness, Zipf's Law Deviation, Vocabulary Richness, Hapax Legomena Ratio

---

### Image Detection — Vision Ensemble

| Model | Weight | Specialization |
|---|---|---|
| `umm-maybe/AI-image-detector` | 40% | General AI image detection |
| `Organika/sdxl-detector` | 35% | SDXL / Stable Diffusion |
| `Nahrawy/AIorNot` | 25% | Real vs AI classifier |
| **Gemini 2.0 Flash Vision** | Primary fallback | C2PA + SynthID aware |

**+ 10 pixel-level signals:** HF Detail Regularity, DCT Block Pattern, Skin Tone Smoothing, Background Uniformity, EXIF Metadata, Sensor Noise Absence, Watermark Pattern, Byte Entropy, Polish & Perfection, Color Channel Balance

---

### Audio Detection — Acoustic Ensemble

| Model | Weight | Specialization |
|---|---|---|
| `mo-thecreator/Deepfake-audio-detection` | Primary | ElevenLabs / TTS focused |
| `MelodyMachine/Deepfake-audio-detection-V2` | Secondary | ASVspoof5 dataset |
| **Gemini 2.0 Flash Audio** | Primary fallback | Native audio analysis |

**+ 5 acoustic signals:** Bitrate Uniformity, Silence/Breath Pattern, Audio Byte Entropy, Format Signature, Compression Ratio

---

### Video Detection — Frame Analysis

| Engine | Role |
|---|---|
| NVIDIA NIM `llama-3.2-11b-vision-instruct` | Primary — 8 keyframes, 6-artifact analysis per frame |
| `saghi776/aiscern-video-detector` (ViT fine-tune) | HF fallback when NIM unavailable |
| Metadata heuristics | Final fallback — format + bitrate |

---

## 4. Accuracy Benchmarks

### Detection Performance

| Modality | Dataset | Baseline (Generic HF) | Aiscern (Ensemble + Gemini) |
|---|---|---|---|
| **Text** | HC3 + ChatGPT-Real | ~72% | **>88%** |
| **Image** | DiffusionDB + CIFAKE | ~78% | **>85%** |
| **Audio** | ASVspoof2019 LA | ~71% | **>84%** |
| **Video** | FaceForensics++ | Heuristic only | **>82%** (with NIM) |

### Verdict Distribution (Production)

| Verdict | Meaning |
|---|---|
| **AI** | Score ≥ 0.58 — high confidence AI-generated |
| **UNCERTAIN** | Score 0.42–0.58 — mixed signals, inconclusive |
| **HUMAN** | Score ≤ 0.42 — high confidence authentic |

> Thresholds tighten to ±0.52 when fine-tuned proprietary models respond, reducing UNCERTAIN rates.

---

## 5. SynthID & C2PA Integration

Aiscern is one of the first open-source platforms to integrate Google's **SynthID** watermark detection and the **C2PA** (Content Authenticity Initiative) standard.

### SynthID — Text
Google SynthID watermarks Gemini-generated text by statistically biasing token selection during generation. Aiscern's Gemini detection prompt is engineered to identify these patterns:
- Unusually consistent syllable counts per sentence
- Word choices that are technically correct but statistically non-human
- Subtle phoneme pattern repetition across paragraphs

Detection adds **+0.08** to the AI confidence score.

### SynthID + C2PA — Images
Two independent detection layers run before sending any image to Gemini:

```
Raw image bytes → C2PA byte scan (first 64KB)
  ↓ Detects: 'c2pa:', 'urn:c2pa', 'contentauthenticity' markers
  ↓ Google Imagen, Adobe Firefly, DALL-E 3 all embed these
  ↓ Match → +0.12 score boost (very strong signal)

Gemini 2.0 Flash Vision → SynthID frequency analysis
  ↓ Looks for unnatural pixel statistics in smooth regions
  ↓ Match → +0.06 additional boost
```

C2PA detection works on **raw bytes before any API call**, adding zero latency.

---

## 6. API Reference

Aiscern exposes a public REST API. All endpoints accept POST requests.

### Text Detection

```bash
curl -X POST https://aiscern.com/api/v1/detect/text \
  -H "Content-Type: application/json" \
  -d '{"text": "Your text to analyze here..."}'
```

**Response:**
```json
{
  "success": true,
  "result": {
    "verdict": "AI",
    "confidence": 0.847,
    "model_used": "Aiscern-TextEnsemble(Gemini2Flash+3RoBERTa+7LinguisticSignals)",
    "signals": [...],
    "summary": "Text detected as AI-generated with 84.7% confidence."
  }
}
```

### Image Detection

```bash
curl -X POST https://aiscern.com/api/detect/image \
  -F "file=@your-image.jpg"
```

### Audio Detection

```bash
curl -X POST https://aiscern.com/api/detect/audio \
  -F "file=@your-audio.mp3"
```

### Video Detection (Frame-based)

```bash
curl -X POST https://aiscern.com/api/detect/video \
  -H "Content-Type: application/json" \
  -d '{
    "frames": [{"base64": "...", "index": 0, "timeSec": 0.0}],
    "fileName": "clip.mp4",
    "fileSize": 1048576,
    "format": "mp4"
  }'
```

### Response Schema

All detection endpoints return:

```typescript
{
  success:       boolean
  scan_id:       string | null       // stored if signed in
  result: {
    verdict:       "AI" | "HUMAN" | "UNCERTAIN"
    confidence:    number             // 0.000–1.000
    model_used:    string
    model_version: string
    signals:       DetectionSignal[]  // per-signal breakdown
    summary:       string             // plain-English explanation
    processing_time: number           // milliseconds
  }
}
```

---

## 7. Quick Start

### Prerequisites

- Node.js 20+
- Supabase project (free tier)
- Clerk account (free tier)
- HuggingFace account + API token

### Setup

```bash
# Clone the repository
git clone https://github.com/saghirahmed9067-png/DETECT-AI.git
cd DETECT-AI/frontend

# Install dependencies
npm ci --legacy-peer-deps

# Copy environment template
cp .env.example .env.local
```

### Environment Variables

```bash
# Required — app won't start without these
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
HUGGINGFACE_API_TOKEN=hf_...

# Important — enables Gemini fallback + SynthID detection
GEMINI_API_KEY=AIza...          # aistudio.google.com (free)

# Important — enables video deepfake detection
NVIDIA_API_KEY=nvapi-...        # build.nvidia.com (free credits)

# Optional — enables feedback learning loop
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=34400e6e147e83e95c942135f54aeba7
CLOUDFLARE_D1_DATABASE_ID=50f5e26a-c794-4cfa-b2b7-2bbd1d7c045c
```

### Run Locally

```bash
npm run dev
# → http://localhost:3000
```

### Deploy to Vercel

```bash
# One-click deploy
vercel --prod
```

> **Note:** Vercel Pro is recommended for `maxDuration: 60` on detection API routes. On the Hobby plan (10s limit), HuggingFace cold-start requests may timeout — Gemini fallback handles this gracefully.

---

## 8. Architecture

```
User Upload
    │
    ▼
Next.js 15 API Route
    │
    ├─── Text ──────► Gemini 2.0 Flash (primary, SynthID-aware)
    │                  + RoBERTa Ensemble (HF, 3 models parallel)
    │                  + 7 Linguistic Signal Extractors
    │                  → Weighted ensemble verdict
    │
    ├─── Image ─────► C2PA Byte Scan (raw bytes, zero latency)
    │                  + Gemini 2.0 Flash Vision (C2PA + SynthID)
    │                  + ViT Ensemble (HF, 3 models parallel)
    │                  + 10 Pixel Signal Extractors
    │                  → Weighted ensemble verdict
    │
    ├─── Audio ─────► Gemini 2.0 Flash Audio (primary)
    │                  + wav2vec2 Ensemble (HF, 2 models)
    │                  + 5 Acoustic Signal Extractors
    │                  → Weighted ensemble verdict
    │
    └─── Video ─────► Browser canvas → 8 keyframes (640×360 JPEG)
                       → NVIDIA NIM vision model (6-artifact analysis)
                       → Temporal coherence scoring
                       → Frame-level verdict aggregation
    │
    ▼
Feedback Learning Loop
    │
    ├── User clicks 👍/👎
    ├── Signal values written to Cloudflare D1 (signal_corrections)
    ├── W20 CF Worker aggregates hourly → correction_weights table
    └── Next scan: scores nudged ±0.12 based on accumulated corrections
    │
    ▼
Supabase (scan history, user profiles, calibration stats)
```

---

## 9. Fine-Tuning

Pre-built training notebooks are included for all four modalities. Each notebook is self-contained — click **Run All** to train and push to HuggingFace automatically.

| Notebook | Platform | Base Model | Dataset | Target |
|---|---|---|---|---|
| `finetune/notebooks/kaggle_image_detector.ipynb` | Kaggle T4 | `google/vit-base-patch16-224-in21k` | CIFAKE + DiffusionDB | >88% accuracy |
| `finetune/notebooks/kaggle_audio_detector.ipynb` | Kaggle T4 | `facebook/wav2vec2-base` | ASVspoof2019 + WaveFake | >84% (EER <0.10) |
| `finetune/notebooks/colab_video_detector.ipynb` | Colab T4 | `google/vit-base-patch16-224-in21k` | FaceForensics++ | >82% accuracy |
| `finetune/notebooks/colab_text_detector.ipynb` | Colab T4 | `roberta-base` | HC3 + ChatGPT-Real | >90% accuracy |

### AWS SageMaker Training (Production)

```bash
cd aws-training

# Launch all 4 training jobs (spot instances — ~$2.50 total)
python launch_all.py \
  --hf-token hf_... \
  --s3-bucket your-training-bucket \
  --instance g5.xlarge

# Estimated costs: Image $0.39 | Audio $2.40 | Video $2.10
```

Fine-tuned models are pushed to:
- `saghi776/aiscern-image-detector`
- `saghi776/aiscern-audio-detector`
- `saghi776/aiscern-video-detector`

---

## 10. Data Pipeline

Aiscern runs a 5-worker Cloudflare pipeline that continuously scrapes labeled AI content from 104 public sources and pushes to HuggingFace for fine-tuning.

| Worker | Role | Schedule |
|---|---|---|
| W1 — Text Scraper | Scrapes 27 text sources | Every minute |
| W2 — Image Scraper | Scrapes 11 image sources | Every minute |
| W3 — Audio Scraper | Scrapes 15 audio sources | Every minute |
| W4 — Video Scraper | Scrapes 10 video sources | Every minute |
| W20 — HF Publisher | Pushes to `saghi776/detectai-dataset` | Every minute |

**Dataset:** [`saghi776/detectai-dataset`](https://huggingface.co/datasets/saghi776/detectai-dataset)

```
📊 Dataset stats (live)
├── Total samples:  586,000+
├── Text:           441,000 samples (27 sources)
├── Image:           83,000 samples (11 sources)
├── Audio:           59,000 samples (15 sources)
└── Video:            1,500 samples (10 sources)
```

### Deploy the Pipeline

```bash
cd cf-pipeline

# Install Wrangler
npm install -g wrangler

# Deploy all 5 workers
wrangler deploy --config wrangler.toml    # W1
wrangler deploy --config wrangler-b.toml  # W2
wrangler deploy --config wrangler-c.toml  # W3
wrangler deploy --config wrangler-d.toml  # W4
wrangler deploy --config wrangler-e.toml  # W20

# Apply D1 schema (feedback learning tables)
wrangler d1 execute detectai-pipeline \
  --file=src/db/feedback-schema.sql --remote
```

---

## 11. Tech Stack

### Frontend & API

| Layer | Technology |
|---|---|
| Framework | Next.js 15.3 (App Router, React 19) |
| Language | TypeScript 5.4 (strict mode) |
| Auth | Clerk v7 (custom domain: clerk.aiscern.com) |
| Database | Supabase (PostgreSQL + PostgREST) |
| Styling | Tailwind CSS 3.4 + Framer Motion |
| Deployment | Vercel (iad1 — Washington DC) |

### AI & ML

| Layer | Technology |
|---|---|
| Primary fallback | Gemini 2.0 Flash (text + vision + audio) |
| Text models | HuggingFace Inference API (RoBERTa × 3) |
| Image models | HuggingFace Inference API (ViT × 3) |
| Audio models | HuggingFace Inference API (wav2vec2 × 2) |
| Video analysis | NVIDIA NIM (Llama 3.2 Vision 11B) |
| ARIA chat | NVIDIA NIM (Nemotron 70B + Llama 3.2 90B Vision) |

### Infrastructure

| Layer | Technology |
|---|---|
| Edge pipeline | Cloudflare Workers (5 workers) |
| Feedback learning | Cloudflare D1 (SQLite, 5GB free) |
| Dataset storage | HuggingFace Datasets Hub |
| Training | AWS SageMaker (g5.xlarge spot) / Kaggle T4 / Colab T4 |
| DNS + CDN | Cloudflare |

---

## 12. License

This repository is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

Aiscern is free and open source. All detection tools are available without a subscription.

---

## 13. Contact

- **Website:** [aiscern.com](https://aiscern.com)
- **Issues:** [github.com/saghirahmed9067-png/DETECT-AI/issues](https://github.com/saghirahmed9067-png/DETECT-AI/issues)
- **Email:** contact@aiscern.com

If you find a bug or have a feature request, please open an issue. Pull requests are welcome.

---

<div align="center">

Built with ❤️ by the Aiscern team

[aiscern.com](https://aiscern.com) · [Try the Demo](https://aiscern.com/detect/image) · [HuggingFace](https://huggingface.co/saghi776)

</div>

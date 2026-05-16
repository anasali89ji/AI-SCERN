# Aiscern — AI Content Detection Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/anasali89ji/AI-SCERN/actions/workflows/ci.yml/badge.svg)](https://github.com/anasali89ji/AI-SCERN/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)

**Aiscern** is an AI-generated content detection SaaS that identifies AI-produced text, images, audio, and video using a multi-model ensemble — combining HuggingFace transformers, Gemini 2.0 Flash, NVIDIA NIM, and a retrieval-augmented generation (RAG) pipeline for high-accuracy, explainable results.

🌐 **Live**: [aiscern.com](https://aiscern.com)

---

## Features

| Modality | Models Used | Avg. Accuracy |
|----------|-------------|---------------|
| **Text** | RoBERTa-base-openai-detector, Binoculars perplexity, Gemini | ~95% |
| **Image** | ViT-based classifier, CLIP embeddings, pixel-integrity signals | ~91% |
| **Audio** | wav2vec2 fine-tuned, spectral analysis, SynthID local | ~88% |
| **Video** | NVIDIA NIM deepfake detection, frame-level ensemble | ~85% |

- **RAG-augmented ensemble** — retrieves similar patterns from pgvector for context-aware confidence
- **Web scanner** — full-page crawl with JavaScript rendering via Playwright
- **Ephemeral scan mode** — zero-history option for sensitive documents
- **Batch detection** — upload and process multiple files
- **API access** (Pro/Enterprise) — REST API with per-key rate limiting
- **Admin dashboard** — real-time pipeline stats, D1 queue monitoring, user management

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| Auth | Clerk (JWT, OAuth) |
| Database | Supabase (PostgreSQL + pgvector) |
| Storage | Cloudflare R2 |
| Edge DB | Cloudflare D1 |
| Inference | HuggingFace Inference API, Gemini 2.0 Flash, NVIDIA NIM |
| Background jobs | Inngest |
| Rate limiting | Upstash Redis |
| Payments | XPay (PKR + international) |
| Logging | Pino (structured JSON) |
| CI/CD | GitHub Actions → Vercel |

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- A Supabase project
- A Clerk application
- A Cloudflare account (R2 bucket + D1 database)

### Installation

```bash
git clone https://github.com/anasali89ji/AI-SCERN.git
cd AI-SCERN/frontend
npm install --legacy-peer-deps
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

See [Environment Variables](#environment-variables) section for full reference.

### Database Setup

Apply Supabase migrations in order:

```bash
# In Supabase SQL Editor, run each file in /supabase/migrations/ in order:
# 1. v6_pipeline_schema.sql
# 2. hardening.sql
# 3. calibration_tables.sql
# 4. calibration_stats.sql
# 5. performance_indexes.sql
# 6. r2_storage_column.sql
# 7. feature_flags.sql
# 8. v8_api_key_sha256_migration.sql
# 9. v9_scraper_sessions.sql
# 10. forensic_pipeline.sql
```

### Development

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
cd frontend
npm run build
npm start
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role — **server only, never expose** |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk publishable key |
| `CLERK_SECRET_KEY` | ✅ | Clerk secret key — **server only** |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `GROK_API_KEY` | optional | xAI Grok Vision (image detection primary) |
| `OPENROUTER_API_KEY` | optional | OpenRouter fallback |
| `HUGGINGFACE_API_TOKEN` | optional | HuggingFace Inference API |
| `NVIDIA_API_KEY` | optional | NVIDIA NIM (video deepfake) |
| `R2_ACCOUNT_ID` | ✅ | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | ✅ | R2 API key |
| `R2_SECRET_ACCESS_KEY` | ✅ | R2 API secret |
| `R2_BUCKET_NAME` | ✅ | R2 bucket name |
| `CLOUDFLARE_D1_DATABASE_ID` | ✅ | D1 database ID |
| `UPSTASH_REDIS_REST_URL` | ✅ (prod) | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ (prod) | Upstash Redis token |
| `INNGEST_EVENT_KEY` | ✅ | Inngest event key |
| `INNGEST_SIGNING_KEY` | ✅ (prod) | Inngest signing key |
| `SENTRY_DSN` | optional | Error tracking |
| `INTERNAL_API_SECRET` | ✅ | Server-to-server auth secret |

Full reference: [`.env.example`](frontend/.env.example)

---

## Project Structure

```
AI-SCERN/
├── frontend/                  # Next.js 15 application
│   ├── app/
│   │   ├── (auth)/            # Login, signup pages
│   │   ├── (dashboard)/       # Detect, history, settings
│   │   ├── (marketing)/       # Landing, pricing, blog
│   │   ├── (legal)/           # Privacy, terms, contact
│   │   └── api/               # API routes
│   ├── components/            # Shared UI components
│   ├── lib/
│   │   ├── auth/              # Auth utilities
│   │   ├── inference/         # HF, Gemini, NVIDIA inference
│   │   ├── rag/               # RAG pipeline (pgvector)
│   │   ├── security/          # File validation, CSRF
│   │   ├── storage/           # Cloudflare R2
│   │   └── supabase/          # DB client
│   └── next.config.ts
├── admin/                     # Separate admin Next.js app
├── signal-worker/             # Python image analysis worker
├── supabase/migrations/       # Database migrations
├── .github/workflows/         # CI/CD pipelines
└── cf-pipeline/               # Cloudflare Worker pipeline
```

---

## Benchmarks

Accuracy metrics are published on the [Methodology](https://aiscern.com/methodology) page with per-modality AUC-ROC, precision, recall, and false-positive rates.

Key datasets used for evaluation:
- **Text**: PAN25, PERSUADE Corpus 2.0, M4 Benchmark
- **Image**: FakeFace, CIFAKE, GenImage
- **Audio**: ASVspoof 2019/2021, ADD 2023
- **Video**: FaceForensics++, DFDC Preview

---

## API Reference

Full API documentation: [aiscern.com/docs/api](https://aiscern.com/docs/api)

```bash
# Example: Detect text via API
curl -X POST https://aiscern.com/api/v1/detect/text \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Your content here"}'
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## Security

To report vulnerabilities, see [SECURITY.md](SECURITY.md) or email **security@aiscern.com**.

---

## License

MIT — see [LICENSE](LICENSE).

---

## Citation

If you use Aiscern in research, please cite:

```bibtex
@software{aiscern2024,
  title   = {Aiscern: Multi-Modal AI Content Detection},
  author  = {Aiscern Team},
  year    = {2024},
  url     = {https://github.com/anasali89ji/AI-SCERN}
}
```

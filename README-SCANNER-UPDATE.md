# AISCERN Web Scanner v2.0 — Integration Guide

## What Changed

### New Modules (Zero API Cost)
| Module | File | Purpose |
|--------|------|---------|
| Smart Crawler | `lib/scanner/crawler.ts` | Priority BFS, stealth headers, Cloudflare bypass |
| Stylometry | `lib/scanner/stylometry.ts` | Voice diversity, sentence patterns, lexical analysis |
| Duplicity | `lib/scanner/duplicity.ts` | SimHash clustering, spin detection, thin content |
| Perplexity | `lib/scanner/perplexity.ts` | N-gram burst detection, information density curves |
| WordPress Deep | `lib/scanner/wordpress.ts` | Plugin/theme extraction, AI plugin fingerprinting |
| Image Forensics | `lib/scanner/image-forensics.ts` | ELA, DCT, EXIF heuristics, color fingerprinting |
| Trust Engine | `lib/scanner/trust.ts` | Transparency scoring, link trust, PageRank |
| Ensemble Brain | `lib/scanner/engines.ts` | Weighted vote across all engines |

### New API
- `POST /api/scanner` — Main forensic scanner endpoint
- `GET /api/verify/seal/:hash` — Integrity seal verification

### New UI
- `app/(dashboard)/scanner/page.tsx` — Complete dashboard with tabs

## Installation Steps

1. Copy all files into your AI-SCERN repo
2. Install dependencies: `npm install cheerio`
3. Add scanner route to your navigation
4. Build and deploy

## Environment Variables (None Required!)
This scanner runs entirely on free computation. No Gemini, no OpenAI, no paid HF inference required.

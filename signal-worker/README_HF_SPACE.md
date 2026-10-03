---
title: AI-SCERN Signal Worker L5 L5b
emoji: ⚡
colorFrom: blue
colorTo: indigo
sdk: gradio
sdk_version: 4.44.0
app_file: app.py
pinned: false
hardware: zero-a10g
---

# AI-SCERN Signal Worker — ZeroGPU Edition

Runs the full signal-worker with **L5 (Diffusion Inversion)** and **L5b (Snap-Back)**
on HuggingFace ZeroGPU (A10G).

## API Endpoints

- `POST /analyze/image` — full 30-layer image analysis (GPU layers enabled)
- `POST /analyze/text` — text analysis (Binoculars + sliding-window perplexity)
- `POST /analyze/audio` — audio analysis (17 signals)
- `GET /health` — health check (returns GPU status)

## Environment Variables (in Vercel)

```env
PYTHON_WORKER_URL=https://saghi776-ai-scern-signal-worker-l5-l5b.hf.space
```

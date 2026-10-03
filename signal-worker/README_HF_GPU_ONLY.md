---
title: AI-SCERN GPU Worker L5 L5b
emoji: ⚡
colorFrom: blue
colorTo: indigo
sdk: gradio
sdk_version: 4.44.0
app_file: app_gpu_only.py
pinned: false
hardware: zero-a10g
---

# AI-SCERN GPU Worker — L5/L5b Only (ZeroGPU)

This Space runs **ONLY** the GPU layers:
- **L5**: Diffusion Inversion (DIRE) — DDIM inversion reconstruction MSE
- **L5b**: Diffusion Snap-Back — 4-strength img2img LPIPS/SSIM curve

All CPU layers (L1-L25) run on the DigitalOcean worker:
`https://aiscern-detection-worker-iakg6.ondigitalocean.app`

## API

```
POST /analyze/image   — runs L5 + L5b, returns scores
GET  /health          — GPU status check
GET  /gradio          — Gradio UI for testing
```

## Setup in Vercel

```
PYTHON_WORKER_URL=https://aiscern-detection-worker-iakg6.ondigitalocean.app
HF_GPU_WORKER_URL=https://saghi776-ai-scern-signal-worker-l5-l5b.hf.space
```

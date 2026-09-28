---
title: Aiscern GPU Worker
emoji: 🔍
colorFrom: green
colorTo: gray
sdk: gradio
sdk_version: 4.44.0
app_file: app.py
pinned: false
license: other
short_description: Internal L5/L5b diffusion forensics worker for Aiscern (private use only)
---

# Aiscern GPU Worker (L5 / L5b)

Internal service. Do not make this Space public — see SECURITY note in `app.py`.

Wraps `diffusion_inversion_score()` (Layer 5) and `diffusion_snapback_score()`
(Layer 5b) from the AI-SCERN signal-worker, running on HF's free ZeroGPU
(A100 slices, allocated per-call).

## Setup

1. Set this Space to **Private** (Settings → Visibility).
2. Add a Space secret `INTERNAL_API_SECRET` matching the value used in your
   frontend and main signal-worker (Settings → Variables and secrets).
3. Requires `Hardware: ZeroGPU` under Settings → Space hardware (free tier).

## Calling from the frontend

Use an HF User Access Token (`hf_...`) with `read` scope as the `Authorization`
header, plus the shared secret as a function argument. See
`frontend/lib/forensic/layers/diffusion-inversion.ts` and
`diffusion-snapback.ts` in the main repo for the calling code.

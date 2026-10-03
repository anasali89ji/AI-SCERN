# Signal-Worker GPU Setup Guide — HuggingFace ZeroGPU

## Which layers run on GPU?

The signal-worker (`signal-worker/`) has **2 GPU-only layers** that provide
the most theoretically-grounded AI-image detection signals. They run ONLY
when `include_gpu_layers=True` AND a GPU with ≥4GB VRAM is available.

### Layer 5 (L5) — Diffusion Inversion (DIRE)
- **File**: `signal-worker/analyzers/diffusion_inversion.py`
- **Model**: Stable Diffusion 1.5 (4GB VRAM) or SDXL (6.5GB VRAM)
- **What it does**: DDIM inversion — reconstructs the image through the
  diffusion model's latent space. AI images that lie ON the learned manifold
  reconstruct with LOW MSE. Real photos that are OFF the manifold reconstruct
  with HIGH MSE.
- **Weight**: 1.4 (highest single-signal weight in LAYER_WEIGHTS)
- **VRAM**: 4GB (SD 1.5) or 6.5GB (SDXL)

### Layer 5b (L5b) — Diffusion Snap-Back
- **File**: `signal-worker/analyzers/diffusion_snapback.py`
- **Model**: Stable Diffusion 1.5 img2img pipeline (float16)
- **What it does**: Runs img2img at 4 different strengths (0.15, 0.30,
  0.60, 0.90) and measures the LPIPS/SSIM reconstruction dynamics. AI images
  have a FLAT LPIPS curve (model always reconstructs something similar);
  real photos have a STEEP curve (model departs from real content at high
  strength).
- **Weight**: 1.2
- **VRAM**: 4GB (uses SD 1.5 with float16)
- **Dependencies**: `lpips==0.1.4`, `torch`, `diffusers`, `accelerate`

## When do they activate?

```
include_gpu_layers=True  AND  _gpu_available()=True  AND  _gpu_vram_gb() >= 4.0
```

When activated, L5 and L5b results are appended to the `layers` list and
feed `_fuse_scores` like any other layer (with weights 1.4 and 1.2).

When NOT activated (CPU-only deployment), they return
`{"available": False, "reason": "gpu_unavailable"}` and are skipped.

## HuggingFace ZeroGPU Setup

### Step 1: Create a HuggingFace Space

1. Go to https://huggingface.co/new-space
2. **SDK**: Select "Docker" (not Gradio/Streamlit — we need a custom FastAPI server)
3. **Hardware**: Select "ZeroGPU" (A100 with dynamic allocation)
4. **Visibility**: Private (recommended — your model weights are proprietary)

### Step 2: Dockerfile

Create `Dockerfile` in your Space:

```dockerfile
FROM pytorch/pytorch:2.3.0-cuda12.1-cudnn8-runtime

# Install system deps
RUN apt-get update && apt-get install -y \
    git wget curl ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements-gpu.txt /app/requirements-gpu.txt
WORKDIR /app
RUN pip install --no-cache-dir -r requirements-gpu.txt

# Copy the signal-worker code
COPY . /app/signal-worker/
WORKDIR /app/signal-worker

# Expose the FastAPI port
EXPOSE 7860

# Start the worker
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
```

### Step 3: requirements-gpu.txt

```txt
# Core
fastapi==0.118.0
uvicorn[standard]==0.32.0
python-multipart==0.0.18
pydantic==2.9.0

# GPU layers (L5, L5b)
torch==2.3.0
torchvision==0.18.0
diffusers==0.27.2
accelerate==0.28.0
lpips==0.1.4
transformers==4.53.0

# Image processing
numpy==1.26.4
pillow==12.3.0
scipy==1.14.1
PyWavelets==1.7.0
opencv-python-headless==4.10.0.84
scikit-image==0.24.0

# Audio (if also running audio engine)
librosa==0.10.2.post1
soundfile==0.12.1

# Text (if also running text engine)
nltk==3.9.3
textstat==0.7.3
langdetect==1.0.9

# Utils
psutil==5.9.8
```

### Step 4: Environment variables

In your HuggingFace Space settings, add:

```env
GPU_ENABLED=true
PYTHON_WORKER_URL=https://your-space-name.hf.space
```

In your Vercel/Next.js frontend `.env`:

```env
PYTHON_WORKER_URL=https://your-space-name.hf.space
```

### Step 5: Health check

Verify the worker is running:

```bash
curl https://your-space-name.hf.space/health
# Should return: {"status": "healthy", "gpu_available": true, "gpu_vram_gb": 40.0}
```

### Step 6: Test L5/L5b activation

Upload an image and check the response for `diffusion_inversion.available: true`:

```bash
curl -X POST https://your-space-name.hf.space/analyze/image \
  -F "file=@test.png" \
  -F "include_gpu_layers=true"
```

The response should include:
- `diffusion_inversion: { available: true, score: 0.85, mse: 0.012, ... }`
- `diffusion_snapback: { available: true, snapBackScore: 0.78, ... }`
- `layers` array should contain layer 5 and "5b" entries

## How L5/L5b affect the final score

When the signal-worker is running on GPU:

1. L5 (DIRE) and L5b (snap-back) are appended to the `layers` list
2. They participate in `_fuse_scores` with weights 1.4 and 1.2 respectively
3. The DIRE reality-check at `image_engine.py:963-982` prefers L5's score
   over L7's TV-residual proxy
4. The frontend receives a unified `composite_score` that already includes
   the GPU layers — no separate fusion needed in `hf-analyze.ts`

When the signal-worker is NOT running (PYTHON_WORKER_URL not set):

1. The frontend ensemble falls back to Brain (31%) + HF (18%) + Pixel (9%) + Gemini (20%)
2. The Brain's 16 pixel-statistics signals are the only physics-layer signal
3. No DIRE, no snap-back, no PRNU, no JPEG ghost, no specular falloff
4. Accuracy drops significantly for artistic/stylized AI images

## Memory budget on ZeroGPU (A100 40GB)

| Component | VRAM |
|-----------|------|
| SD 1.5 VAE + UNet (float16) | ~2.5 GB |
| SD 1.5 img2img pipeline (L5b) | ~2.5 GB |
| distilgpt2 (text engine) | ~350 MB |
| gpt2 base (Binoculars) | ~500 MB |
| Face detector DNN | ~265 MB |
| **Total** | **~6.1 GB** (well within 40GB A100) |

Both L5 and L5b can run simultaneously without OOM. The model cache
(`utils/model_cache.py`) handles lazy loading + eviction.

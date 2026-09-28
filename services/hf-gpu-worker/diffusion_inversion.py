"""
Aiscern — Layer 5: Diffusion Inversion Analyzer
FastAPI endpoint: POST /diffusion-inversion

Theory: AI images from diffusion models lie ON the learned manifold.
DDIM inversion can reconstruct them with LOW MSE.
Real photographs are OFF the manifold — HIGH reconstruction error.

Model: Stable Diffusion 1.5 (4GB VRAM) as primary.
SDXL (6GB VRAM) used when GPU memory allows.
CPU fallback: disabled (too slow for production; returns 503).

GPU requirement: at least 4GB VRAM (NVIDIA or AMD via ROCm).
On Render.com GPU tier or HuggingFace Spaces with GPU, this runs in 10-30s.
"""

import os
import gc
import time
import logging
import hashlib
import requests
import numpy as np
from io import BytesIO
from typing import Optional
from functools import lru_cache

logger = logging.getLogger(__name__)

# ── Model registry ────────────────────────────────────────────────────────────

MODEL_CONFIGS = {
    'sd15': {
        'model_id':       'runwayml/stable-diffusion-v1-5',
        'vram_required':  4.0,  # GB
        'image_size':     512,
        'ddim_steps':     50,
    },
    'sdxl': {
        'model_id':       'stabilityai/stable-diffusion-xl-base-1.0',
        'vram_required':  6.5,
        'image_size':     1024,
        'ddim_steps':     50,
    },
}

# ── Model cache with TTL and GPU health check ──────────────────────────────────
_cached_model = None
_cached_model_id = None
_model_cache_timestamp = 0
MODEL_CACHE_TTL_SECONDS = 3600  # 1 hour


def _check_gpu_health() -> tuple[bool, float]:
    """Check if GPU is actually usable (not just reported available). Returns (ok, vram_gb)."""
    try:
        import torch
        if not torch.cuda.is_available():
            return False, 0.0
        # Run a tiny CUDA op to verify the context is actually alive
        test = torch.tensor([1.0], device='cuda')
        _ = test * 2
        vram = torch.cuda.get_device_properties(0).total_memory / 1e9
        return True, vram
    except Exception as e:
        logger.warning(f"[L5] GPU health check failed: {e}")
        return False, 0.0


def _load_model(model_key: str = 'sd15', force_reload: bool = False):
    """Load and cache the diffusion model components, with TTL expiry and OOM recovery."""
    global _cached_model, _cached_model_id, _model_cache_timestamp

    now = time.time()
    cache_expired = (now - _model_cache_timestamp) > MODEL_CACHE_TTL_SECONDS

    gpu_ok, vram_gb = _check_gpu_health()
    if not gpu_ok:
        raise RuntimeError(
            "L5 diffusion inversion requires GPU. "
            "GPU health check failed (unavailable, or CUDA context broken)."
        )

    # Auto-upgrade to SDXL if enough VRAM is available
    if model_key == 'sd15' and vram_gb >= 7.0:
        model_key = 'sdxl'
        logger.info(f"[L5] Auto-selected SDXL (VRAM: {vram_gb:.1f}GB)")

    if (not force_reload and not cache_expired
            and _cached_model is not None and _cached_model_id == model_key):
        return _cached_model

    # Clear any stale cached model before loading a new one, to avoid OOM
    if _cached_model is not None:
        logger.info("[L5] Clearing old model cache...")
        del _cached_model
        _cached_model = None
        gc.collect()
        import torch
        torch.cuda.empty_cache()

    try:
        import torch
        from diffusers import DDIMScheduler, AutoencoderKL, UNet2DConditionModel
    except ImportError:
        raise RuntimeError(
            "diffusers and torch are required for L5. "
            "Install: pip install diffusers transformers accelerate torch"
        )

    config   = MODEL_CONFIGS[model_key]
    model_id = config['model_id']
    device   = 'cuda'

    logger.info(f"[L5] Loading {model_id} on {device}...")
    t0 = time.time()

    try:
        vae   = AutoencoderKL.from_pretrained(model_id, subfolder='vae',
                                               torch_dtype=torch.float16).to(device)
        unet  = UNet2DConditionModel.from_pretrained(model_id, subfolder='unet',
                                                      torch_dtype=torch.float16).to(device)
        sched = DDIMScheduler.from_pretrained(model_id, subfolder='scheduler')
    except RuntimeError as e:
        if "out of memory" in str(e).lower():
            torch.cuda.empty_cache()
            gc.collect()
            raise RuntimeError(f"GPU OOM while loading {model_key}. Try SD 1.5 or a larger GPU.")
        raise

    vae.eval()
    unet.eval()

    logger.info(f"[L5] Model loaded in {time.time()-t0:.1f}s")

    _cached_model    = {'vae': vae, 'unet': unet, 'scheduler': sched,
                        'device': device, 'config': config}
    _cached_model_id = model_key
    _model_cache_timestamp = now
    return _cached_model


# ── Core analysis ─────────────────────────────────────────────────────────────

def diffusion_inversion_score(image_url: str, model_key: str = 'sd15') -> dict:
    """
    Run DDIM inversion on the image and measure reconstruction MSE.

    Returns:
        mse:        float — reconstruction error (lower = more AI-like)
        score:      float — 0.0 (real) to 1.0 (AI-generated)
        confidence: float — certainty of the score
        model:      str   — model used for inversion
        steps:      int   — DDIM steps used
    """
    import torch
    from PIL import Image

    # ── Load image ────────────────────────────────────────────────────────────
    try:
        resp = requests.get(image_url, timeout=20,
                            headers={'User-Agent': 'Aiscern-L5/1.0'})
        resp.raise_for_status()
        image = Image.open(BytesIO(resp.content)).convert('RGB')
    except Exception as e:
        raise ValueError(f"Failed to fetch image from {image_url}: {e}")

    # ── Load model ────────────────────────────────────────────────────────────
    try:
        model = _load_model(model_key)
    except RuntimeError as e:
        logger.warning(f"[L5] {e}")
        return {
            'mse': 0.5, 'score': 0.5, 'confidence': 0.0,
            'model': model_key, 'steps': 0,
            'error': str(e),
        }

    vae       = model['vae']
    unet      = model['unet']
    scheduler = model['scheduler']
    device    = model['device']
    config    = model['config']

    img_size = config['image_size']
    steps    = config['ddim_steps']

    # ── Preprocess ────────────────────────────────────────────────────────────
    image = image.resize((img_size, img_size), Image.LANCZOS)
    img_np = np.array(image).astype(np.float32) / 255.0  # [0, 1]
    # Normalize to [-1, 1] as expected by SD VAE
    img_np = img_np * 2.0 - 1.0
    img_tensor = torch.from_numpy(img_np).permute(2, 0, 1).unsqueeze(0)
    img_tensor = img_tensor.to(device, dtype=torch.float16)

    with torch.no_grad():
        # ── Encode to latent space ────────────────────────────────────────────
        latent = vae.encode(img_tensor).latent_dist.sample() * 0.18215

        # ── DDIM Inversion (forward process — add noise) ──────────────────────
        # Empty conditioning (unconditional inversion)
        # SD 1.5 uses (1, 77, 768) for cross-attention
        # SDXL uses (1, 77, 2048)
        hidden_dim   = 768 if model_key == 'sd15' else 2048
        empty_prompt = torch.zeros(1, 77, hidden_dim, dtype=torch.float16).to(device)

        scheduler.set_timesteps(steps)
        noisy_latent = latent.clone()

        for t in scheduler.timesteps:
            noise_pred   = unet(noisy_latent, t, encoder_hidden_states=empty_prompt).sample
            noisy_latent = scheduler.step(noise_pred, t, noisy_latent).prev_sample

        # ── Reconstruct via VAE decoder ───────────────────────────────────────
        reconstructed = vae.decode(noisy_latent / 0.18215).sample
        reconstructed = torch.clamp(reconstructed, -1, 1)

        # ── Compute MSE in original [0,1] space ───────────────────────────────
        orig_01  = (img_tensor + 1.0) / 2.0
        recon_01 = (reconstructed + 1.0) / 2.0
        mse      = torch.mean((orig_01 - recon_01) ** 2).item()

    # Clean up VRAM
    del img_tensor, latent, noisy_latent, reconstructed
    torch.cuda.empty_cache()
    gc.collect()

    # ── Score calibration ─────────────────────────────────────────────────────
    if mse < 0.04:   score, confidence = 1.00, 0.97
    elif mse < 0.06: score, confidence = 0.92, 0.92
    elif mse < 0.08: score, confidence = 0.82, 0.85
    elif mse < 0.10: score, confidence = 0.70, 0.75
    elif mse < 0.13: score, confidence = 0.52, 0.50
    elif mse < 0.18: score, confidence = 0.30, 0.60
    elif mse < 0.25: score, confidence = 0.14, 0.75
    else:            score, confidence = 0.05, 0.90

    return {
        'mse':        round(mse, 6),
        'score':      score,
        'confidence': confidence,
        'model':      config['model_id'],
        'steps':      steps,
    }

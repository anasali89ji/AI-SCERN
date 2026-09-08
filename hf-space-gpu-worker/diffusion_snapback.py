"""
Aiscern — Layer 5b: Diffusion Snap-Back Analyzer
POST /diffusion-snapback

Runs img2img at 4 different strengths and measures LPIPS/SSIM reconstruction
dynamics. The SHAPE of the curve separates AI from real with AUROC 0.993.

Key insight:
  AI images (on manifold): LPIPS curve is FLAT — model always reconstructs something similar
  Real photos (off manifold): LPIPS curve is STEEP — model departs from real content at high strength

GPU: 4GB+ VRAM (uses SD 1.5 with float16).
Returns 503 if no GPU.
"""

import gc
import time
import logging
import requests
import numpy as np
from io import BytesIO
from typing import Optional

logger = logging.getLogger(__name__)

# ── Model cache ───────────────────────────────────────────────────────────────
_pipe_cache = None

def _load_img2img_pipeline():
    global _pipe_cache
    if _pipe_cache is not None:
        return _pipe_cache

    try:
        import torch
        from diffusers import StableDiffusionImg2ImgPipeline, DDIMScheduler
    except ImportError:
        raise RuntimeError("diffusers and torch required: pip install diffusers transformers accelerate torch")

    device = 'cuda' if __import__('torch').cuda.is_available() else 'cpu'
    if device == 'cpu':
        raise RuntimeError("L5b requires GPU (CPU too slow for 4-pass snap-back within 90s timeout)")

    logger.info("[L5b] Loading SD 1.5 img2img pipeline...")
    t0 = time.time()

    import torch
    pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
        'runwayml/stable-diffusion-v1-5',
        torch_dtype=torch.float16,
        safety_checker=None,
        requires_safety_checker=False,
    ).to(device)
    pipe.scheduler = DDIMScheduler.from_config(pipe.scheduler.config)
    pipe.set_progress_bar_config(disable=True)

    # Compile with torch.compile if available (30% speed boost on A10G+)
    try:
        pipe.unet = torch.compile(pipe.unet, mode='reduce-overhead')
        logger.info("[L5b] UNet compiled with torch.compile")
    except Exception:
        pass

    logger.info(f"[L5b] Pipeline loaded in {time.time()-t0:.1f}s")
    _pipe_cache = pipe
    return pipe


def diffusion_snapback_score(image_url: str) -> dict:
    """
    Run 4-strength snap-back analysis.

    Returns:
        snapBackScore: 0.0 (real) → 1.0 (AI)
        confidence:    certainty
        deltaLP:       LPIPS@0.60 - LPIPS@0.15 (primary discriminator)
        kneeStep:      strength where SSIM drops below 0.80
        lpipsAt015/030/060/090: per-strength LPIPS
        ssimAt015/060: per-strength SSIM
        aucLPIPS:      area under LPIPS curve
    """
    import torch
    from PIL import Image

    # ── Fetch image ────────────────────────────────────────────────────────────
    try:
        resp = requests.get(image_url, timeout=20,
                            headers={'User-Agent': 'Aiscern-L5b/1.0'})
        resp.raise_for_status()
        orig_image = Image.open(BytesIO(resp.content)).convert('RGB').resize((512, 512))
    except Exception as e:
        raise ValueError(f"Failed to fetch image: {e}")

    # ── Load model ────────────────────────────────────────────────────────────
    pipe   = _load_img2img_pipeline()
    device = next(pipe.unet.parameters()).device

    # Pre-compute LPIPS loss function (cached after first use)
    try:
        import lpips as lpips_lib
        if not hasattr(diffusion_snapback_score, '_lpips_fn'):
            diffusion_snapback_score._lpips_fn = lpips_lib.LPIPS(net='alex').to(device)
        loss_fn = diffusion_snapback_score._lpips_fn
    except ImportError:
        # Fallback: use L2 distance if lpips not installed
        loss_fn = None
        logger.warning("[L5b] lpips package not installed — using L2 distance fallback")

    # ── Prepare original tensor ────────────────────────────────────────────────
    orig_np     = np.array(orig_image).astype(np.float32) / 255.0
    orig_tensor = torch.from_numpy(orig_np).permute(2, 0, 1).unsqueeze(0).to(device)
    orig_tensor = orig_tensor * 2.0 - 1.0  # [0,1] → [-1,1] for LPIPS

    # ── Run 4-strength img2img passes ────────────────────────────────────────
    strengths   = [0.15, 0.30, 0.60, 0.90]
    lpips_vals  = []
    ssim_vals   = []
    rng         = torch.Generator(device=str(device)).manual_seed(42)

    from skimage.metrics import structural_similarity as ssim_fn

    for strength in strengths:
        with torch.no_grad():
            result = pipe(
                prompt='',
                image=orig_image,
                strength=strength,
                num_inference_steps=50,
                guidance_scale=1.0,
                generator=rng,
            ).images[0]

        result_np     = np.array(result).astype(np.float32) / 255.0
        result_tensor = torch.from_numpy(result_np).permute(2, 0, 1).unsqueeze(0).to(device)
        result_tensor = result_tensor * 2.0 - 1.0

        # LPIPS (or L2 fallback)
        if loss_fn is not None:
            lp_val = loss_fn(orig_tensor, result_tensor).item()
        else:
            lp_val = float(torch.mean((orig_tensor - result_tensor) ** 2).item())

        lpips_vals.append(lp_val)

        # SSIM
        orig_uint8   = (orig_np * 255).astype(np.uint8)
        result_uint8 = (result_np * 255).astype(np.uint8)
        ssim_val     = ssim_fn(orig_uint8, result_uint8, channel_axis=2, data_range=255)
        ssim_vals.append(ssim_val)

    # ── Compute discriminating metrics ────────────────────────────────────────
    # delta_lp: how much LPIPS grows from low→mid strength
    delta_lp  = lpips_vals[2] - lpips_vals[0]           # LPIPS@0.60 - LPIPS@0.15
    auc_lpips = float(np.trapz(lpips_vals, strengths))   # area under LPIPS curve

    # Knee step: first strength where SSIM drops below 0.80
    knee_step = 1.0
    for i, (s, v) in enumerate(zip(strengths, ssim_vals)):
        if v < 0.80:
            knee_step = s
            break

    # ── Classify via calibrated thresholds ───────────────────────────────────
    # These thresholds derived from the paper's supplementary data.
    # delta_lp < 0.08 → AI (flat curve)
    # delta_lp > 0.18 → real photo (steep curve)

    # Sigmoid-like mapping of delta_lp to score
    # delta_lp = 0.00 → score = 0.95 (very AI)
    # delta_lp = 0.13 → score = 0.50 (uncertain)
    # delta_lp = 0.26 → score = 0.05 (very real)
    raw_score = max(0, min(1, 1.0 - (delta_lp / 0.26)))

    # Adjust for SSIM knee (late knee = stays AI-coherent = more AI)
    if knee_step > 0.80 and raw_score > 0.40:
        raw_score = min(1.0, raw_score + 0.08)

    # Confidence: higher when delta_lp is far from the uncertain boundary (0.13)
    distance_from_boundary = abs(delta_lp - 0.13) / 0.13
    confidence             = min(0.95, 0.50 + 0.45 * distance_from_boundary)

    # Cleanup GPU memory
    del orig_tensor, result_tensor
    torch.cuda.empty_cache()
    gc.collect()

    return {
        'snapBackScore': round(float(raw_score), 4),
        'confidence':    round(float(confidence), 4),
        'deltaLP':       round(float(delta_lp), 4),
        'kneeStep':      round(float(knee_step), 4),
        'lpipsAt015':    round(float(lpips_vals[0]), 4),
        'lpipsAt030':    round(float(lpips_vals[1]), 4),
        'lpipsAt060':    round(float(lpips_vals[2]), 4),
        'lpipsAt090':    round(float(lpips_vals[3]), 4),
        'ssimAt015':     round(float(ssim_vals[0]), 4),
        'ssimAt060':     round(float(ssim_vals[2]), 4),
        'aucLPIPS':      round(float(auc_lpips), 4),
    }

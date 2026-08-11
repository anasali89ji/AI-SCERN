"""
Aiscern Detection Worker — Layer 7: DIRE Approximation Detector
CPU-only, no diffusion model required.

Approximates the DIRE (Diffusion Reconstruction Error) idea using:
  1. Perona-Malik anisotropic diffusion NRMSE — measures how well an edge-
     preserving smoother can reconstruct the image; AI images with over-smooth
     internals but crisp edges show low NRMSE (easy to reconstruct).
  2. TV (Total-Variation) inpainting reconstruction error — TV-denoised
     residual energy; real photos have higher residual because noise is real.
  3. Frequency HF/LF residual ratio — difference between original and
     anisotropic-smoothed in frequency domain; AI images suppress HF residual.

Outputs a dict compatible with build_layer_report.
"""

from __future__ import annotations

import logging
from typing import Any, Dict

import numpy as np

logger = logging.getLogger(__name__)


# ── Perona-Malik anisotropic diffusion (pure numpy) ──────────────────────────

def _perona_malik(img: np.ndarray, iterations: int = 10, kappa: float = 20.0,
                  gamma: float = 0.1) -> np.ndarray:
    """
    Perona-Malik anisotropic diffusion on a float32 2-D image.
    Edge-preserving smoother; converges within 10 iterations for analysis.
    """
    u = img.astype(np.float32).copy()
    for _ in range(iterations):
        # Gradient in 4 directions
        dn = np.roll(u, -1, axis=0) - u
        ds = np.roll(u,  1, axis=0) - u
        de = np.roll(u, -1, axis=1) - u
        dw = np.roll(u,  1, axis=1) - u
        # Conduction coefficients (exponential function)
        cn = np.exp(-(dn / kappa) ** 2)
        cs = np.exp(-(ds / kappa) ** 2)
        ce = np.exp(-(de / kappa) ** 2)
        cw = np.exp(-(dw / kappa) ** 2)
        u = u + gamma * (cn * dn + cs * ds + ce * de + cw * dw)
    return u


def _pm_nrmse(gray: np.ndarray) -> float:
    """NRMSE between original and Perona-Malik-smoothed image."""
    g = gray.astype(np.float32)
    smoothed = _perona_malik(g, iterations=8, kappa=15.0)
    diff = g - smoothed
    denom = g.std()
    if denom < 1e-6:
        return 0.0
    nrmse = float(np.sqrt((diff ** 2).mean())) / denom
    return float(np.clip(nrmse, 0, 1))


# ── TV denoising proxy (gradient shrinkage, 1 pass) ──────────────────────────

def _tv_residual(gray: np.ndarray) -> float:
    """
    Simple TV-denoising residual.
    One iteration of proximal gradient shrinkage on gradient magnitude.
    AI images have lower residual (smoother prior matches their stats).
    """
    g = gray.astype(np.float32)
    gx = np.roll(g, -1, axis=1) - g
    gy = np.roll(g, -1, axis=0) - g
    mag = np.sqrt(gx ** 2 + gy ** 2 + 1e-8)
    lam = 5.0  # regularisation strength
    # Shrinkage
    shrink = np.maximum(0, 1 - lam / mag)
    tv_x = gx * shrink
    tv_y = gy * shrink
    # Divergence
    div = (tv_x - np.roll(tv_x, 1, axis=1)) + (tv_y - np.roll(tv_y, 1, axis=0))
    residual = g - div
    diff = g - residual
    energy = float(np.sqrt((diff ** 2).mean()))
    # Normalise against image dynamic range
    dyn = float(g.max() - g.min()) + 1e-9
    return float(np.clip(energy / dyn, 0, 1))


# ── Frequency residual ratio ──────────────────────────────────────────────────

def _freq_hf_residual(gray: np.ndarray) -> float:
    """
    Energy fraction of high-frequency residual (original − PM-smoothed) vs
    total original spectrum.  AI images: low HF residual (smooth internals).
    """
    g = gray.astype(np.float32)
    smoothed = _perona_malik(g, iterations=5, kappa=25.0)
    residual = g - smoothed
    spec_orig = np.abs(np.fft.fft2(g))
    spec_res  = np.abs(np.fft.fft2(residual))
    h, w = g.shape
    # High-frequency mask: outer 50% of spectrum
    r_thresh = min(h, w) // 4
    cy, cx = h // 2, w // 2
    Y, X = np.ogrid[:h, :w]
    dist = np.sqrt((Y - cy) ** 2 + (X - cx) ** 2)
    hf_mask = dist > r_thresh
    e_orig_hf = float((np.fft.fftshift(spec_orig)[hf_mask] ** 2).mean()) + 1e-9
    e_res_hf  = float((np.fft.fftshift(spec_res) [hf_mask] ** 2).mean())
    ratio = e_res_hf / e_orig_hf
    return float(np.clip(ratio, 0, 1))


# ── public API ────────────────────────────────────────────────────────────────

def analyze_dire(img_array: np.ndarray, img_pil: Any) -> Dict[str, Any]:
    """
    Run the DIRE Approximation Detector.

    Parameters
    ----------
    img_array : np.ndarray  shape (H, W, 3) uint8
    img_pil   : PIL.Image   (unused, kept for consistent engine signature)

    Returns
    -------
    dict compatible with the layer-report schema.
    """
    from utils.evidence_builder import build_layer_report

    try:
        # ── Resize to max 512px (DIRE signal is scale-invariant) ─────────────
        gray_full = np.mean(img_array, axis=2).astype(np.float32)
        h, w = gray_full.shape
        if max(h, w) > 512:
            from PIL import Image as _PIL
            scale = 512 / max(h, w)
            nh, nw = max(8, int(h * scale)), max(8, int(w * scale))
            pil_g = _PIL.fromarray(np.clip(gray_full, 0, 255).astype(np.uint8))
            pil_g = pil_g.resize((nw, nh), _PIL.LANCZOS)
            gray = np.array(pil_g, dtype=np.float32)
        else:
            gray = gray_full

        # Signal 1 — PM-NRMSE (low → AI-like easy reconstruction → high suspicion)
        nrmse = _pm_nrmse(gray)
        sig_nrmse = float(np.clip(1.0 - nrmse * 3.0, 0, 1))

        # Signal 2 — TV residual (low → AI-like smooth prior → high suspicion)
        tv_res = _tv_residual(gray)
        sig_tv = float(np.clip(1.0 - tv_res * 10.0, 0, 1))

        # Signal 3 — HF frequency residual (low → AI-suppressed HF → high suspicion)
        hf_ratio = _freq_hf_residual(gray)
        sig_freq = float(np.clip(1.0 - hf_ratio * 5.0, 0, 1))

        score = 0.40 * sig_nrmse + 0.35 * sig_tv + 0.25 * sig_freq

        evidence = [
            f"pm_nrmse={nrmse:.4f} (suspicion={sig_nrmse:.2f})",
            f"tv_residual={tv_res:.4f} (suspicion={sig_tv:.2f})",
            f"hf_freq_residual={hf_ratio:.4f} (suspicion={sig_freq:.2f})",
        ]

        return build_layer_report(7, "DIRE Approximation", evidence, "success", 0, score=round(score, 4))

    except Exception as exc:
        logger.warning("[DIRE][L7] failed: %s", exc, exc_info=True)
        from utils.evidence_builder import build_layer_report
        return build_layer_report(7, "DIRE Approximation", [], "failure", 0, score=0.5)

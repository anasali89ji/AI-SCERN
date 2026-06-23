"""
Aiscern Detection Worker — Layer 6: Zero-Shot Entropy Detector (ZED)
CPU-only, target <100 ms.

Three forensic signals:
  1. Local-entropy variance  — AI images tend to have unnaturally uniform local
     entropy; real photos have higher spatial variance in information density.
  2. Spatial autocorrelation of entropy map  — Moran's I proxy: AI-generated
     entropy maps show higher long-range correlation (smoother gradients).
  3. Wavelet HH/LL sub-band energy ratio  — AI up-samplers suppress high-freq
     diagonal detail (HH), so HH/LL is lower than in camera images.

Outputs a dict compatible with build_layer_report (layerSuspicionScore in [0,1],
where 1.0 = very likely AI-generated).
"""

from __future__ import annotations

import logging
from typing import Any, Dict

import numpy as np

logger = logging.getLogger(__name__)

# ── helpers ───────────────────────────────────────────────────────────────────

def _local_entropy_map(gray: np.ndarray, block: int = 8) -> np.ndarray:
    """Return a 2-D array of Shannon entropy values computed over (block×block) tiles."""
    h, w = gray.shape
    rows = h // block
    cols = w // block
    emap = np.zeros((rows, cols), dtype=np.float32)
    for r in range(rows):
        for c in range(cols):
            tile = gray[r * block:(r + 1) * block, c * block:(c + 1) * block]
            hist, _ = np.histogram(tile.ravel(), bins=16, range=(0, 256))
            prob = hist / (hist.sum() + 1e-9)
            with np.errstate(divide="ignore", invalid="ignore"):
                ent = -np.where(prob > 0, prob * np.log2(prob + 1e-12), 0).sum()
            emap[r, c] = float(ent)
    return emap


def _spatial_autocorr(emap: np.ndarray) -> float:
    """Simple neighbour-mean autocorrelation proxy (Moran's I style)."""
    flat = emap.flatten()
    mean = flat.mean()
    centered = flat - mean
    var = float((centered ** 2).mean())
    if var < 1e-9:
        return 0.0
    # shift-and-correlate in both axes — fast approximation
    r_shift = emap[1:, :].flatten() - mean
    c_shift = emap[:, 1:].flatten() - mean
    r_base  = emap[:-1, :].flatten() - mean
    c_base  = emap[:, :-1].flatten() - mean
    rho_r = float((r_shift * r_base).mean()) / var
    rho_c = float((c_shift * c_base).mean()) / var
    return float(np.clip((rho_r + rho_c) / 2, -1, 1))


def _wavelet_hh_ll_ratio(gray: np.ndarray) -> float:
    """Energy ratio HH/LL using a manual Haar single-level DWT (no pywavelets dep)."""
    # Pad to even dims
    h, w = gray.shape
    if h % 2 != 0:
        gray = gray[:-1, :]
    if w % 2 != 0:
        gray = gray[:, :-1]
    g = gray.astype(np.float32)
    # Row-wise Haar
    lo_r = (g[:, 0::2] + g[:, 1::2]) / 2.0
    hi_r = (g[:, 0::2] - g[:, 1::2]) / 2.0
    # Col-wise Haar
    ll = (lo_r[0::2, :] + lo_r[1::2, :]) / 2.0
    hh = (hi_r[0::2, :] - hi_r[1::2, :]) / 2.0
    e_ll = float((ll ** 2).mean())
    e_hh = float((hh ** 2).mean())
    if e_ll < 1e-9:
        return 0.5
    ratio = e_hh / (e_ll + 1e-9)
    return float(np.clip(ratio, 0, 1))


# ── public API ────────────────────────────────────────────────────────────────

def analyze_zed(img_array: np.ndarray, img_pil: Any) -> Dict[str, Any]:
    """
    Run the Zero-Shot Entropy Detector.

    Parameters
    ----------
    img_array : np.ndarray  shape (H, W, 3) uint8
    img_pil   : PIL.Image   (unused here, kept for consistent engine signature)

    Returns
    -------
    dict compatible with the layer-report schema used across image_engine.py
    """
    from utils.evidence_builder import build_layer_report

    try:
        gray = np.mean(img_array, axis=2).astype(np.float32)

        # Signal 1 — local entropy variance
        emap = _local_entropy_map(gray.astype(np.uint8), block=8)
        with np.errstate(invalid="ignore"):
            entropy_var = float(np.nanvar(emap))
        # Normalise: real photos → high variance (>0.4), AI → low (<0.2)
        # Score: low variance → high suspicion
        sig_entropy = float(np.clip(1.0 - entropy_var / 0.6, 0, 1))

        # Signal 2 — spatial autocorrelation
        autocorr = _spatial_autocorr(emap)
        # High autocorr → smoother entropy map → higher AI suspicion
        sig_autocorr = float(np.clip((autocorr + 1) / 2, 0, 1))

        # Signal 3 — wavelet HH/LL ratio
        hh_ll = _wavelet_hh_ll_ratio(gray.astype(np.uint8))
        # Low ratio → high-freq detail suppressed → higher AI suspicion
        sig_wavelet = float(np.clip(1.0 - hh_ll * 4, 0, 1))

        # Weighted fusion
        score = 0.40 * sig_entropy + 0.35 * sig_autocorr + 0.25 * sig_wavelet

        evidence = [
            f"entropy_variance={entropy_var:.4f} (suspicion={sig_entropy:.2f})",
            f"spatial_autocorr={autocorr:.4f} (suspicion={sig_autocorr:.2f})",
            f"wavelet_hh_ll={hh_ll:.4f} (suspicion={sig_wavelet:.2f})",
        ]

        return build_layer_report(6, "Zero-Shot Entropy Detector", evidence, "success", 0, score=round(score, 4))

    except Exception as exc:
        logger.warning("[ZED][L6] failed: %s", exc, exc_info=True)
        from utils.evidence_builder import build_layer_report
        return build_layer_report(6, "Zero-Shot Entropy Detector", [], "failure", 0, score=0.5)

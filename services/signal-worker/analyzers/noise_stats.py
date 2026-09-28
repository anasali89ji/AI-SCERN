"""
Aiscern Signal Worker — Layer 3: Noise & Statistical Analysis
Signals: PRNU proxy (camera noise fingerprint), Noise Level Function (NLF).
"""

import time
import numpy as np
from PIL import Image
from scipy import ndimage

from utils.evidence_builder import evidence_node, build_layer_report


# ── PRNU Proxy ────────────────────────────────────────────────────────────────

def prnu_proxy_suspicion(img_array: np.ndarray) -> tuple[float, str, float]:
    """
    PRNU proxy: split image into tiles, measure noise std per tile.
    Real cameras: noise variance correlates with local brightness (photon shot noise).
    AI images:    noise is often uniform across all brightness levels.

    Returns (suspicion_score, detail, consistency_metric).
    """
    gray  = img_array.mean(axis=2).astype(np.float32)
    h, w  = gray.shape

    # Estimate noise in each tile using wavelet-based residual
    # Simple proxy: after Gaussian blur, residual = noise estimate
    blurred  = ndimage.gaussian_filter(gray, sigma=1.0)
    residual = gray - blurred

    tile_h, tile_w = max(h // 4, 16), max(w // 4, 16)
    tile_stds  = []
    tile_means = []

    for i in range(4):
        for j in range(4):
            tile = residual[i*tile_h:(i+1)*tile_h, j*tile_w:(j+1)*tile_w]
            orig = gray[i*tile_h:(i+1)*tile_h, j*tile_w:(j+1)*tile_w]
            if tile.size > 0:
                tile_stds.append(float(tile.std()))
                tile_means.append(float(orig.mean()))

    if len(tile_stds) < 4:
        return 0.5, "Insufficient tiles for PRNU analysis", 0.0

    # For real cameras: std should vary by brightness (higher brightness = less noise %)
    # For AI: std should be very uniform across tiles regardless of brightness
    std_of_stds = float(np.std(tile_stds))
    mean_std    = float(np.mean(tile_stds))

    # Coefficient of variation of noise stds across tiles
    cv = std_of_stds / (mean_std + 1e-8)

    if cv < 0.10:
        # Very uniform noise: suspicious
        score  = 0.85
        detail = (f"PRNU proxy: noise is suspiciously uniform across tiles "
                  f"(cv={cv:.3f}, mean_std={mean_std:.3f}). Real camera sensor noise varies with brightness.")
    elif cv < 0.20:
        score  = 0.55
        detail = f"PRNU proxy: moderate noise uniformity (cv={cv:.3f})"
    else:
        score  = 0.18
        detail = f"PRNU proxy: noise variation consistent with camera sensor (cv={cv:.3f})"

    return score, detail, cv


# ── Noise Level Function ──────────────────────────────────────────────────────

def nlf_suspicion(img_array: np.ndarray) -> tuple[float, str, float]:
    """
    Noise Level Function: fit σ²(y) = a*y + b to tiles.
    Real cameras: Poisson + Gaussian → linear NLF (higher brightness = more variance).
    AI images:    flat or non-physical NLF.

    Returns (suspicion_score, detail, r_squared).
    """
    gray = img_array.mean(axis=2).astype(np.float32) / 255.0

    blurred  = ndimage.gaussian_filter(gray, sigma=1.5)
    residual = gray - blurred

    h, w      = gray.shape
    tile_h    = max(h // 6, 16)
    tile_w    = max(w // 6, 16)
    xs, ys    = [], []

    for i in range(6):
        for j in range(6):
            gt = gray[i*tile_h:(i+1)*tile_h,     j*tile_w:(j+1)*tile_w]
            rt = residual[i*tile_h:(i+1)*tile_h,  j*tile_w:(j+1)*tile_w]
            if gt.size > 0:
                xs.append(float(gt.mean()))      # mean brightness
                ys.append(float(rt.var()))        # noise variance

    if len(xs) < 6:
        return 0.5, "Insufficient data for NLF analysis", 0.0

    xs_arr = np.array(xs)
    ys_arr = np.array(ys)

    # Linear regression: noise_var = a * brightness + b
    A = np.vstack([xs_arr, np.ones(len(xs_arr))]).T
    try:
        result   = np.linalg.lstsq(A, ys_arr, rcond=None)
        coeffs   = result[0]
        a, b     = float(coeffs[0]), float(coeffs[1])
        predicted = a * xs_arr + b
        ss_res   = float(np.sum((ys_arr - predicted) ** 2))
        ss_tot   = float(np.sum((ys_arr - ys_arr.mean()) ** 2))
        r2       = 1 - ss_res / (ss_tot + 1e-12)
    except Exception:
        return 0.5, "NLF regression failed", 0.0

    # High R² and positive slope: real camera (Poisson noise model)
    # Low R² or flat slope: AI image
    if r2 > 0.60 and a > 0:
        score  = 0.12
        detail = f"NLF fits Poisson model well (R²={r2:.3f}, slope={a:.5f}) — consistent with real camera"
    elif r2 < 0.20:
        score  = 0.80
        detail = f"NLF shows no meaningful correlation (R²={r2:.3f}) — noise pattern is non-physical, likely AI"
    else:
        score  = 0.45
        detail = f"NLF shows partial linear fit (R²={r2:.3f}) — inconclusive"

    return score, detail, r2


# ── Main Layer 3 function ─────────────────────────────────────────────────────

def analyze_noise_stats(img_array: np.ndarray, img_pil: Image.Image) -> dict:
    start = time.time()
    evidence = []

    # PRNU proxy
    prnu_score, prnu_detail, prnu_raw = prnu_proxy_suspicion(img_array)
    prnu_status = "anomalous" if prnu_score > 0.65 else "normal" if prnu_score < 0.30 else "inconclusive"
    evidence.append(evidence_node(
        layer=3, category="noise_analysis", artifact_type="prnu_absence",
        status=prnu_status, confidence=prnu_score, detail=prnu_detail, raw_value=prnu_raw,
    ))

    # NLF
    nlf_score, nlf_detail, nlf_raw = nlf_suspicion(img_array)
    nlf_status = "anomalous" if nlf_score > 0.65 else "normal" if nlf_score < 0.30 else "inconclusive"
    evidence.append(evidence_node(
        layer=3, category="noise_analysis", artifact_type="noise_level_function",
        status=nlf_status, confidence=nlf_score, detail=nlf_detail, raw_value=nlf_raw,
    ))

    elapsed_ms = int((time.time() - start) * 1000)
    return build_layer_report(3, "Noise & Statistical", evidence, "success", elapsed_ms)

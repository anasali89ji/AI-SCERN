"""
Aiscern Detection Worker — Layer 11: PAFRA
Polarization & Atmospheric Fresnel Reflection Analysis

Physics background
------------------
AI image generators predict RGB pixel values directly. They have no internal
model for electromagnetic wave polarization. Real cameras capture polarized
light through lenses, and atmospheric Rayleigh scattering creates measurable
polarization gradients in sky regions that AI simply cannot replicate.

Three forensic signals
----------------------
S1 — Sky polarization gradient
    Real sky: Rayleigh scattering produces polarization that peaks ~90° from
    the sun. This manifests as a gradient in blue-channel saturation across
    the sky region. AI: uniform flat-blue or overly smooth gradient.

S2 — Atmospheric haze coherence
    Real photos: luminance decreases toward the horizon in outdoor scenes
    (aerial perspective, Mie scattering). Lack of this aerial perspective
    falloff in what appears to be an outdoor scene is an AI tell.

S3 — Fresnel reflection plausibility
    Water/glass surfaces follow Fresnel equations: reflectance increases at
    grazing angles and follows a specific angular dependency. AI reflections
    are artistically placed without this constraint.

Returns
-------
Neutral score (0.5) when no sky or reflective surface is detected.
score=0.0 → strongly real  |  score=1.0 → strongly AI
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

# HSV thresholds for sky detection (blue hue region, low saturation tolerance)
_SKY_HUE_MIN    = 90   # H in [0,179] — cyan-to-blue
_SKY_HUE_MAX    = 135
_SKY_SAT_MIN    = 20   # some saturation required
_SKY_SAT_MAX    = 220
_SKY_VAL_MIN    = 80   # not too dark

# Minimum sky-region fraction of image height to consider the signal active
_SKY_MIN_FRAC   = 0.05  # 5% of image must be sky

# Reflective surface: bright region with low color variance (specular highlight)
_REFL_BRIGHT_THRESH = 200   # pixel brightness (gray)
_REFL_MAX_CHROMA    = 30    # max chroma in Lab A/B channels


# ── Sky detection ─────────────────────────────────────────────────────────────

def detect_sky_region(img: np.ndarray) -> np.ndarray:
    """
    Return a binary mask (uint8, 0/255) of sky pixels.

    Strategy: look for blue-ish, moderately saturated pixels in the upper half
    of the image, avoiding edge regions that are likely not sky.
    """
    h, w = img.shape[:2]
    # Focus on the upper 60% of the image
    upper = img[:int(h * 0.60), :]

    hsv = cv2.cvtColor(upper, cv2.COLOR_RGB2HSV)
    mask_upper = cv2.inRange(
        hsv,
        np.array([_SKY_HUE_MIN, _SKY_SAT_MIN, _SKY_VAL_MIN]),
        np.array([_SKY_HUE_MAX, _SKY_SAT_MAX, 255]),
    )

    # Morphological clean-up: remove noise, fill gaps
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    mask_upper = cv2.morphologyEx(mask_upper, cv2.MORPH_OPEN,  kernel)
    mask_upper = cv2.morphologyEx(mask_upper, cv2.MORPH_CLOSE, kernel)

    # Expand to full image (lower half always 0)
    full_mask = np.zeros((h, w), dtype=np.uint8)
    full_mask[:int(h * 0.60), :] = mask_upper
    return full_mask


def detect_reflective_surfaces(img: np.ndarray) -> np.ndarray:
    """
    Return a binary mask of specular/reflective surface pixels.

    Fresnel reflections are bright and near-achromatic. We look for bright
    patches with low colorfulness in the CIE L*a*b* space.
    """
    gray  = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    lab   = cv2.cvtColor(img, cv2.COLOR_RGB2LAB).astype(np.float32)

    # Bright pixels
    bright_mask = (gray.astype(np.float32) > _REFL_BRIGHT_THRESH).astype(np.uint8) * 255

    # Low chroma in Lab (a* and b* near 128 in uint8 → near 0 in float)
    a_centered = np.abs(lab[:, :, 1] - 128.0)
    b_centered = np.abs(lab[:, :, 2] - 128.0)
    chroma     = np.hypot(a_centered, b_centered)
    low_chroma = (chroma < _REFL_MAX_CHROMA).astype(np.uint8) * 255

    mask = cv2.bitwise_and(bright_mask, low_chroma)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    return mask


# ── Signal computation ────────────────────────────────────────────────────────

def _signal_sky_polarization(img: np.ndarray, sky_mask: np.ndarray) -> tuple[float, str]:
    """
    S1 — Sky polarization gradient.

    Real sky: blue-channel variance in the sky region is higher (due to
    Rayleigh polarization gradient) and the gradient correlates with vertical
    position (darker/more saturated at zenith).

    AI sky: variance tends to be low (flat-colored) or if a gradient exists it
    is too smooth (linear, no angular dependency).

    Returns: (score [0=real, 1=AI], detail_str)
    """
    sky_pixels_y, sky_pixels_x = np.where(sky_mask > 0)
    if len(sky_pixels_y) < 200:
        return 0.5, "insufficient_sky_pixels"

    h = img.shape[0]
    # Extract blue channel values at sky pixels
    blue_vals = img[sky_pixels_y, sky_pixels_x, 2].astype(np.float32)
    norm_y    = sky_pixels_y.astype(np.float32) / h  # 0=top, 1=horizon

    # Real sky: blue channel should correlate negatively with y (darker at top)
    # — compute Pearson r between y and blue
    if blue_vals.std() < 1.0:
        return 0.7, "flat_blue_no_variance"

    corr = float(np.corrcoef(norm_y, blue_vals)[0, 1])

    # Real sky: negative correlation (top = more polarized = darker saturated blue)
    # AI sky: near-zero correlation (uniform) or positive (impossible lighting)
    # Score: map corr in [-1, 0] → 0 (real); [0, +1] → AI; flat → AI
    blue_cv = float(blue_vals.std() / (blue_vals.mean() + 1e-9))  # coefficient of variation

    if corr < -0.15 and blue_cv > 0.04:
        score = max(0.0, 0.35 + corr * 0.5)   # negative corr → low (real)
        detail = f"sky_gradient_real: corr={corr:.3f} cv={blue_cv:.3f}"
    elif abs(corr) < 0.10 or blue_cv < 0.02:
        score = 0.68
        detail = f"sky_uniform_ai: corr={corr:.3f} cv={blue_cv:.3f}"
    else:
        score = 0.5 + abs(corr) * 0.1
        detail = f"sky_ambiguous: corr={corr:.3f} cv={blue_cv:.3f}"

    return float(np.clip(score, 0.0, 1.0)), detail


def _signal_aerial_perspective(img: np.ndarray, sky_mask: np.ndarray) -> tuple[float, str]:
    """
    S2 — Atmospheric haze / aerial perspective coherence.

    Real outdoor photos: distant objects are hazier (lower contrast, slightly
    bluer) due to Mie scattering. We measure the saturation falloff from the
    sky boundary toward the sky centre — real photos have a clear gradient;
    AI tends to paint uniform saturation.
    """
    sky_rows = np.where(sky_mask.any(axis=1))[0]
    if len(sky_rows) < 20:
        return 0.5, "insufficient_sky_rows"

    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV).astype(np.float32)

    # Compute per-row mean saturation within sky region
    row_sat = []
    for r in sky_rows:
        cols = np.where(sky_mask[r] > 0)[0]
        if len(cols) < 5:
            continue
        row_sat.append(float(hsv[r, cols, 1].mean()))

    if len(row_sat) < 10:
        return 0.5, "insufficient_sky_rows_with_pixels"

    row_sat = np.array(row_sat, dtype=np.float32)
    # Normalise row index
    norm_row = np.linspace(0, 1, len(row_sat))

    # Real: saturation increases toward horizon (bottom of sky region)
    # Fit linear regression
    if row_sat.std() < 0.5:
        return 0.65, f"flat_saturation_ai: std={row_sat.std():.2f}"

    corr = float(np.corrcoef(norm_row, row_sat)[0, 1])
    if corr > 0.25:
        score = max(0.0, 0.30 + (1.0 - corr) * 0.3)
        detail = f"aerial_perspective_real: corr={corr:.3f}"
    elif abs(corr) < 0.10:
        score = 0.62
        detail = f"no_sat_gradient_ai: corr={corr:.3f}"
    else:
        score = 0.50
        detail = f"ambiguous_gradient: corr={corr:.3f}"

    return float(np.clip(score, 0.0, 1.0)), detail


def _signal_fresnel_consistency(img: np.ndarray, refl_mask: np.ndarray) -> tuple[float, str]:
    """
    S3 — Fresnel reflection plausibility.

    Real reflective surfaces: brightness of the reflection increases as we move
    from center toward the edge (higher grazing angle → higher reflectance).
    AI reflections are often brightest at center or uniformly bright.

    We look at the radial gradient within each reflective patch.
    """
    if refl_mask.sum() < 200:
        return 0.5, "no_reflective_surface"

    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float32)

    # Find connected components of the reflective mask
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(refl_mask)
    if num_labels <= 1:
        return 0.5, "no_reflective_components"

    edge_center_ratios = []
    for i in range(1, min(num_labels, 6)):  # check up to 5 patches
        area = stats[i, cv2.CC_STAT_AREA]
        if area < 100:
            continue
        comp_mask = (labels == i).astype(np.uint8)
        # Erode to get center pixels
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        center_mask = cv2.erode(comp_mask, k, iterations=3)
        # Edge = component - center
        edge_mask = cv2.bitwise_xor(comp_mask, center_mask)

        center_vals = gray[center_mask > 0]
        edge_vals   = gray[edge_mask   > 0]
        if len(center_vals) < 10 or len(edge_vals) < 10:
            continue

        ratio = float(edge_vals.mean() / (center_vals.mean() + 1e-9))
        edge_center_ratios.append(ratio)

    if not edge_center_ratios:
        return 0.5, "no_valid_patches"

    mean_ratio = float(np.mean(edge_center_ratios))

    # Real (Fresnel): edge brighter than center → ratio > 1.0
    # AI: center brighter or uniform → ratio ≤ 1.0
    if mean_ratio > 1.08:
        score = max(0.0, 0.35 - (mean_ratio - 1.08) * 0.3)
        detail = f"fresnel_real: edge/center={mean_ratio:.3f}"
    elif mean_ratio < 0.95:
        score = min(1.0, 0.65 + (0.95 - mean_ratio) * 0.4)
        detail = f"fresnel_center_heavy_ai: edge/center={mean_ratio:.3f}"
    else:
        score = 0.50
        detail = f"fresnel_ambiguous: edge/center={mean_ratio:.3f}"

    return float(np.clip(score, 0.0, 1.0)), detail


# ── Public API ────────────────────────────────────────────────────────────────

def analyze_pafra(img: np.ndarray, img_pil: Any) -> Dict[str, Any]:
    """
    Run PAFRA analysis on a uint8 RGB numpy array.

    Parameters
    ----------
    img     : np.ndarray — H×W×3 uint8 RGB image
    img_pil : PIL.Image | None — unused, kept for API consistency

    Returns
    -------
    dict with keys:
        score   : float [0=real, 1=AI]
        status  : "success" | "failure"
        evidence: list of {"name", "score", "detail"} dicts
        elapsed_ms : int
    """
    t0 = time.monotonic()

    if img is None or img.ndim != 3 or img.shape[2] != 3:
        return {"score": 0.5, "status": "failure",
                "evidence": [], "elapsed_ms": 0}

    try:
        evidence = []
        active_signals = 0

        # Detect scene elements
        sky_mask  = detect_sky_region(img)
        refl_mask = detect_reflective_surfaces(img)

        sky_frac  = float(sky_mask.sum() / 255) / float(img.shape[0] * img.shape[1])
        has_sky   = sky_frac >= _SKY_MIN_FRAC
        has_refl  = float(refl_mask.sum() / 255) > 200

        if not has_sky and not has_refl:
            # No applicable scene elements — return neutral
            elapsed = int((time.monotonic() - t0) * 1000)
            return {
                "score": 0.5, "status": "success",
                "evidence": [{"name": "no_applicable_scene",
                               "score": 0.5,
                               "detail": f"sky_frac={sky_frac:.3f} refl_px={refl_mask.sum()//255}"}],
                "elapsed_ms": elapsed,
            }

        # S1 — Sky polarization gradient
        if has_sky:
            s1_score, s1_detail = _signal_sky_polarization(img, sky_mask)
            evidence.append({"name": "sky_polarization_gradient",
                             "score": s1_score, "detail": s1_detail})
            if s1_score != 0.5:
                active_signals += 1

        # S2 — Aerial perspective
        if has_sky:
            s2_score, s2_detail = _signal_aerial_perspective(img, sky_mask)
            evidence.append({"name": "aerial_perspective_coherence",
                             "score": s2_score, "detail": s2_detail})
            if s2_score != 0.5:
                active_signals += 1

        # S3 — Fresnel reflection consistency
        if has_refl:
            s3_score, s3_detail = _signal_fresnel_consistency(img, refl_mask)
            evidence.append({"name": "fresnel_reflection_plausibility",
                             "score": s3_score, "detail": s3_detail})
            if s3_score != 0.5:
                active_signals += 1

        if not evidence:
            composite = 0.5
        else:
            # Active signals (non-neutral) are weighted 2× vs neutral ones
            weighted_sum = sum(
                e["score"] * (2.0 if e["score"] != 0.5 else 1.0)
                for e in evidence
            )
            total_w = sum(
                2.0 if e["score"] != 0.5 else 1.0
                for e in evidence
            )
            composite = weighted_sum / total_w

        elapsed = int((time.monotonic() - t0) * 1000)
        return {
            "score":       round(float(np.clip(composite, 0.0, 1.0)), 4),
            "status":      "success",
            "evidence":    evidence,
            "elapsed_ms":  elapsed,
            "active_signals": active_signals,
        }

    except Exception as exc:
        logger.warning("[PAFRA] analysis failed: %s", exc)
        elapsed = int((time.monotonic() - t0) * 1000)
        return {"score": 0.5, "status": "failure",
                "evidence": [], "elapsed_ms": elapsed}

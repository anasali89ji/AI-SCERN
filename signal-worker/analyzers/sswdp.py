"""
Aiscern Detection Worker — Layer 13: SSWDP
Sub-Surface Wavelength Diffusion Profile

Physics background
------------------
Biological materials (skin, wax, marble) are translucent — light penetrates
below the surface, scatters internally, and re-emerges. This process, called
Subsurface Scattering (SSS), is highly wavelength-dependent:

  Red light   (≈700 nm) penetrates deeply     — 3–5 mm in skin
  Green light (≈550 nm) penetrates moderately — 1–2 mm in skin
  Blue light  (≈450 nm) scatters near-surface — 0.2–0.4 mm in skin

Consequence: at the edge of a skin region, the R channel decays more slowly
(spatially) than the B channel. The ratio R_decay / B_decay is physically
constrained to be ~8–12× in real human skin.

AI generators mimic the visual appearance of SSS but compute it
approximately (e.g. Stable Diffusion's VAE has no SSS model). The resulting
wavelength-dependent decay ratio is wrong — typically 1–3× instead of 8–12×.

Two signals
-----------
S1 — Skin SSS decay profile
    For each detected skin-edge pixel, we sample a perpendicular profile
    inward (into the skin) and outward (into the background). We fit an
    exponential decay to the falloff in each channel and compute the
    R/B decay-length ratio.

S2 — Cross-region colour variance anisotropy
    Real skin: variance in the R channel is higher across-edge than B channel.
    AI skin: variance is often isotropic (R ≈ G ≈ B variation).

Returns
-------
Neutral (0.5) when no skin regions detected.
score=0.0 → strongly real  |  score=1.0 → strongly AI
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ── Load SSS profiles ─────────────────────────────────────────────────────────
_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

def _load_sss_profiles() -> dict:
    path = os.path.join(_DATA_DIR, "sss_profiles.json")
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return {}

_SSS_PROFILES = _load_sss_profiles()
_SKIN_PROFILE = _SSS_PROFILES.get("human_skin", {
    "penetration_depth_mm": {"red": 4.2, "green": 1.8, "blue": 0.35},
    "ratio_min": 8.0,
})

# ── Skin detection ────────────────────────────────────────────────────────────

_SKIN_LOWER1 = np.array([0,   48,  80],  dtype=np.uint8)  # HSV lower bound
_SKIN_UPPER1 = np.array([20, 255, 255],  dtype=np.uint8)
_SKIN_LOWER2 = np.array([170, 48,  80],  dtype=np.uint8)  # Wrap-around hue
_SKIN_UPPER2 = np.array([180, 255, 255], dtype=np.uint8)


def detect_skin_regions(img: np.ndarray) -> np.ndarray:
    """
    Return a binary mask (uint8 0/255) of skin-coloured pixels.

    Uses HSV double-range for warm skin tones, plus a YCrCb confirmation.
    """
    if img.ndim != 3 or img.shape[2] != 3:
        return np.zeros(img.shape[:2], dtype=np.uint8)

    hsv  = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)
    mask1 = cv2.inRange(hsv, _SKIN_LOWER1, _SKIN_UPPER1)
    mask2 = cv2.inRange(hsv, _SKIN_LOWER2, _SKIN_UPPER2)
    hsv_mask = cv2.bitwise_or(mask1, mask2)

    # YCrCb confirmation — standard skin-tone range
    ycrcb = cv2.cvtColor(img, cv2.COLOR_RGB2YCrCb)
    ycrcb_mask = cv2.inRange(
        ycrcb,
        np.array([0, 135, 85], dtype=np.uint8),
        np.array([255, 180, 135], dtype=np.uint8),
    )

    mask = cv2.bitwise_and(hsv_mask, ycrcb_mask)
    # Clean up
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,  kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    return mask


def extract_perpendicular_profile(
    img: np.ndarray,
    edge_x: int,
    edge_y: int,
    skin_mask: np.ndarray,
    length: int = 30,
) -> Optional[np.ndarray]:
    """
    Extract a colour profile perpendicular to the skin boundary at (edge_x, edge_y).

    Samples `length` pixels inward (into skin). Returns array of shape (N, 3)
    with RGB values, or None if insufficient valid pixels.
    """
    h, w = img.shape[:2]

    # Find local gradient direction (normal to skin edge)
    sob_x = cv2.Sobel(skin_mask.astype(np.float32), cv2.CV_32F, 1, 0, ksize=3)
    sob_y = cv2.Sobel(skin_mask.astype(np.float32), cv2.CV_32F, 0, 1, ksize=3)

    gx = float(sob_x[edge_y, edge_x])
    gy = float(sob_y[edge_y, edge_x])
    norm = float(np.hypot(gx, gy))
    if norm < 1.0:
        return None

    # Inward direction (into skin): opposite to gradient direction
    dx, dy = -gx / norm, -gy / norm

    profile = []
    for k in range(length):
        px = int(edge_x + round(dx * k))
        py = int(edge_y + round(dy * k))
        if 0 <= px < w and 0 <= py < h:
            profile.append(img[py, px, :].tolist())

    if len(profile) < length // 2:
        return None

    return np.array(profile, dtype=np.float32)


# ── Signal computation ────────────────────────────────────────────────────────

def _fit_exponential_decay(values: np.ndarray) -> float:
    """
    Fit an exponential decay A*exp(-x/τ) to `values` and return τ.
    Returns 0.0 on failure.
    """
    n = len(values)
    if n < 4:
        return 0.0

    x = np.arange(n, dtype=np.float32)
    vals = np.clip(values, 1.0, None).astype(np.float32)
    log_vals = np.log(vals)

    # Linear regression on log(values) vs x → slope = -1/τ
    try:
        coeffs = np.polyfit(x, log_vals, 1)
        slope = float(coeffs[0])
        if slope >= 0.0:
            return 0.0  # no decay
        return float(-1.0 / slope)  # τ in pixels
    except Exception:
        return 0.0


def _signal_sss_decay(img: np.ndarray, skin_mask: np.ndarray) -> Tuple[float, str]:
    """
    S1 — Wavelength-dependent SSS decay profile.

    Sample edges of skin region, extract inward profiles per channel,
    fit exponential decay, compute R/B tau ratio.

    Real skin: tau_R / tau_B ≈ 8–12 (red penetrates much deeper than blue)
    AI skin:   tau_R / tau_B ≈ 1–3  (channels decay at similar rates)
    """
    if skin_mask.sum() < 100 * 255:
        return 0.5, "insufficient_skin_area"

    # Find edge pixels of skin mask
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    eroded = cv2.erode(skin_mask, kernel)
    edge_mask = cv2.subtract(skin_mask, eroded)

    edge_ys, edge_xs = np.where(edge_mask > 0)
    if len(edge_xs) < 20:
        return 0.5, "no_edge_pixels"

    # Sample up to 30 edge points
    n_sample = min(30, len(edge_xs))
    idx = np.random.choice(len(edge_xs), n_sample, replace=False)

    r_taus, b_taus = [], []

    for i in idx:
        ex, ey = int(edge_xs[i]), int(edge_ys[i])
        profile = extract_perpendicular_profile(img, ex, ey, skin_mask, length=25)
        if profile is None or profile.shape[0] < 8:
            continue

        r_prof = profile[:, 0]  # Red channel
        b_prof = profile[:, 2]  # Blue channel

        # Only valid if there's actual variation
        if r_prof.std() < 2.0 or b_prof.std() < 2.0:
            continue

        tau_r = _fit_exponential_decay(r_prof)
        tau_b = _fit_exponential_decay(b_prof)

        if tau_r > 0.5 and tau_b > 0.5:
            r_taus.append(tau_r)
            b_taus.append(tau_b)

    if len(r_taus) < 3:
        return 0.5, f"insufficient_profiles: n={len(r_taus)}"

    median_r = float(np.median(r_taus))
    median_b = float(np.median(b_taus))

    if median_b < 0.5:
        return 0.5, "blue_decay_too_short"

    rb_ratio = median_r / (median_b + 1e-9)
    ratio_min = float(_SKIN_PROFILE.get("ratio_min", 8.0))

    if rb_ratio >= ratio_min * 0.70:
        # Real-like SSS: R penetrates much deeper
        score = max(0.0, 0.35 - (rb_ratio - ratio_min * 0.70) / (ratio_min * 2) * 0.2)
        detail = f"sss_real: R/B_tau={rb_ratio:.2f} (min={ratio_min:.1f})"
    elif rb_ratio < 2.0:
        # AI-like: near-equal penetration
        score = min(1.0, 0.70 + (2.0 - rb_ratio) * 0.08)
        detail = f"sss_ai: R/B_tau={rb_ratio:.2f} (min={ratio_min:.1f})"
    else:
        score = 0.50
        detail = f"sss_ambiguous: R/B_tau={rb_ratio:.2f}"

    return float(np.clip(score, 0.0, 1.0)), detail


def _signal_rgb_variance_anisotropy(img: np.ndarray, skin_mask: np.ndarray) -> Tuple[float, str]:
    """
    S2 — Cross-region RGB variance anisotropy.

    Real skin: variance in R channel at skin edges is significantly higher
    than B channel variance (red SSS bleeds across boundaries).
    AI skin: R and B variances are similar (isotropic).
    """
    if skin_mask.sum() < 50 * 255:
        return 0.5, "insufficient_skin_area"

    # Dilation minus original = boundary zone
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    dilated = cv2.dilate(skin_mask, kernel)
    boundary_mask = cv2.subtract(dilated, skin_mask)

    by, bx = np.where(boundary_mask > 0)
    if len(by) < 100:
        return 0.5, "insufficient_boundary_pixels"

    r_vals = img[by, bx, 0].astype(np.float32)
    g_vals = img[by, bx, 1].astype(np.float32)
    b_vals = img[by, bx, 2].astype(np.float32)

    r_std = float(r_vals.std())
    g_std = float(g_vals.std())
    b_std = float(b_vals.std())

    if b_std < 1.0:
        return 0.5, "flat_blue_boundary"

    # Anisotropy: real skin R_std >> B_std
    rb_aniso = r_std / (b_std + 1e-9)

    if rb_aniso > 1.6:
        score = max(0.0, 0.38 - (rb_aniso - 1.6) * 0.15)
        detail = f"rgb_aniso_real: R_std/B_std={rb_aniso:.2f}"
    elif rb_aniso < 1.1:
        score = min(1.0, 0.62 + (1.1 - rb_aniso) * 0.3)
        detail = f"rgb_aniso_ai: R_std/B_std={rb_aniso:.2f}"
    else:
        score = 0.50
        detail = f"rgb_aniso_ambiguous: R_std/B_std={rb_aniso:.2f}"

    return float(np.clip(score, 0.0, 1.0)), detail


# ── Public API ────────────────────────────────────────────────────────────────

def analyze_sswdp(img: np.ndarray, img_pil: Any) -> Dict[str, Any]:
    """
    Run SSWDP analysis on a uint8 RGB numpy array.

    Parameters
    ----------
    img     : np.ndarray — H×W×3 uint8 RGB image
    img_pil : PIL.Image | None — unused, kept for API consistency

    Returns
    -------
    dict with keys:
        score      : float [0=real, 1=AI]
        status     : "success" | "failure"
        evidence   : list of {"name", "score", "detail"} dicts
        elapsed_ms : int
    """
    t0 = time.monotonic()

    if img is None or img.ndim != 3 or img.shape[2] != 3:
        return {"score": 0.5, "status": "failure",
                "evidence": [], "elapsed_ms": 0}

    try:
        skin_mask = detect_skin_regions(img)
        skin_px   = float(skin_mask.sum() / 255)
        total_px  = float(img.shape[0] * img.shape[1])

        if skin_px < 1000 or (skin_px / total_px) < 0.02:
            elapsed = int((time.monotonic() - t0) * 1000)
            return {
                "score": 0.5, "status": "success",
                "evidence": [{"name": "no_skin_detected",
                               "score": 0.5,
                               "detail": f"skin_px={int(skin_px)} frac={skin_px/total_px:.3f}"}],
                "elapsed_ms": elapsed,
            }

        # S1 — SSS decay profile
        s1_score, s1_detail = _signal_sss_decay(img, skin_mask)
        # S2 — RGB variance anisotropy
        s2_score, s2_detail = _signal_rgb_variance_anisotropy(img, skin_mask)

        evidence = [
            {"name": "sss_wavelength_decay", "score": s1_score, "detail": s1_detail},
            {"name": "rgb_variance_aniso",   "score": s2_score, "detail": s2_detail},
        ]

        # S1 (decay profile) is more informative → higher weight
        if s1_score == 0.5 and s2_score == 0.5:
            composite = 0.5
        else:
            w1, w2 = 1.6, 1.0
            composite = (s1_score * w1 + s2_score * w2) / (w1 + w2)

        elapsed = int((time.monotonic() - t0) * 1000)
        return {
            "score":       round(float(np.clip(composite, 0.0, 1.0)), 4),
            "status":      "success",
            "evidence":    evidence,
            "elapsed_ms":  elapsed,
        }

    except Exception as exc:
        logger.warning("[SSWDP] analysis failed: %s", exc)
        elapsed = int((time.monotonic() - t0) * 1000)
        return {"score": 0.5, "status": "failure",
                "evidence": [], "elapsed_ms": elapsed}

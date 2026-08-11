"""
Aiscern Detection Worker — Layer 14: QESM
Quantum Efficiency Spectral Mismatch

Physics background
------------------
Every digital camera sensor has a unique spectral response curve — the
Quantum Efficiency (QE) function Q(λ) that maps each wavelength of incident
light to a proportional electrical charge. Combined with the spectral power
distribution of the illuminant, this produces characteristic RGB ratios even
for a "neutral" gray surface.

Under D65 (standard daylight):
  Real sensor (e.g. Sony A7 IV): neutral gray → R/G ≈ 0.921, B/G ≈ 0.973
  Real sensor (e.g. iPhone 15):  neutral gray → R/G ≈ 0.942, B/G ≈ 0.957

In-camera AWB (Auto White Balance) attempts to correct these, but residual
sensor-specific color biases remain in the gray locus.

AI generators have no sensor model. They produce "ideal" RGB for neutral
surfaces (R ≈ G ≈ B after tonemapping), which matches NO real sensor's
residual gray-locus signature under any illuminant.

Two signals
-----------
S1 — Gray locus sensor mismatch
    Find neutral gray patches in the image. Compare their mean R/G and B/G
    ratios to the expected ranges from the sensor database. If the gray locus
    falls outside ALL known sensors' ranges, that's an AI signal.

S2 — Illuminant-specific chroma residual
    Under different illuminants, real sensors leave predictable chroma casts
    in gray patches. We estimate the scene illuminant and check if the gray
    patch chroma is consistent with that illuminant × any sensor combination.

Returns
-------
Neutral (0.5) when no suitable gray regions found or database absent.
score=0.0 → strongly real  |  score=1.0 → strongly AI
"""

from __future__ import annotations

import csv
import glob
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ── Data paths ────────────────────────────────────────────────────────────────
_DATA_DIR    = os.path.join(os.path.dirname(__file__), "..", "data")
_SENSOR_DIR  = os.path.join(_DATA_DIR, "sensor_profiles")
_ILLUM_DIR   = os.path.join(_DATA_DIR, "illuminant_spectra")

# ── Load sensor database (once, at import time) ───────────────────────────────

def _load_sensor_db() -> List[dict]:
    profiles = []
    pattern  = os.path.join(_SENSOR_DIR, "*.json")
    for path in glob.glob(pattern):
        try:
            with open(path) as f:
                profiles.append(json.load(f))
        except Exception as exc:
            logger.debug("[QESM] skipping %s: %s", path, exc)
    return profiles

_SENSOR_DB = _load_sensor_db()

# Precompute the union of all sensors' gray locus ranges per illuminant
_GRAY_LOCUS_RANGES: Dict[str, Dict[str, Tuple[float, float]]] = {}

def _build_gray_locus_ranges() -> None:
    """Build per-illuminant R/G and B/G min-max ranges across all sensors."""
    global _GRAY_LOCUS_RANGES
    illums = {"d65", "tungsten", "tl84", "f11"}
    for illum in illums:
        r_g_vals, b_g_vals = [], []
        for sensor in _SENSOR_DB:
            locus = sensor.get("gray_locus", {}).get(illum, {})
            if "r_g" in locus and "b_g" in locus:
                r_g_vals.append(float(locus["r_g"]))
                b_g_vals.append(float(locus["b_g"]))
        if r_g_vals:
            _GRAY_LOCUS_RANGES[illum] = {
                "r_g": (min(r_g_vals), max(r_g_vals)),
                "b_g": (min(b_g_vals), max(b_g_vals)),
            }

_build_gray_locus_ranges()


# ── Gray region detection ─────────────────────────────────────────────────────

def detect_gray_regions(img: np.ndarray, chroma_thresh: float = 18.0,
                        min_area: int = 200) -> List[dict]:
    """
    Find neutral gray patches in the image.

    A pixel is "gray" if its a* and b* values in CIE L*a*b* are both within
    chroma_thresh of the achromatic axis.

    Returns a list of region dicts: {"mean_r_g", "mean_b_g", "size", "centroid"}
    """
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB).astype(np.float32)
    a_c = np.abs(lab[:, :, 1] - 128.0)  # center at 0 (LAB stores A+128)
    b_c = np.abs(lab[:, :, 2] - 128.0)
    chroma = np.hypot(a_c, b_c)

    gray_mask = (chroma < chroma_thresh).astype(np.uint8) * 255
    # Reject very dark and very bright pixels (unreliable for AWB analysis)
    brightness = lab[:, :, 0]
    gray_mask[brightness < 30] = 0
    gray_mask[brightness > 220] = 0

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    gray_mask = cv2.morphologyEx(gray_mask, cv2.MORPH_OPEN, kernel)

    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(gray_mask)
    regions = []

    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        if area < min_area:
            continue
        mask_i = (labels == i)
        r_vals = img[mask_i, 0].astype(np.float32)
        g_vals = img[mask_i, 1].astype(np.float32)
        b_vals = img[mask_i, 2].astype(np.float32)
        mean_g = float(g_vals.mean())
        if mean_g < 5.0:
            continue
        regions.append({
            "mean_r_g":  float(r_vals.mean() / mean_g),
            "mean_b_g":  float(b_vals.mean() / mean_g),
            "size":      int(area),
            "centroid":  (float(centroids[i, 0]), float(centroids[i, 1])),
        })

    return regions


# ── Illuminant estimation ─────────────────────────────────────────────────────

def estimate_illuminant(img: np.ndarray) -> float:
    """
    Estimate the scene illuminant color temperature (Kelvin) using Gray World.

    Returns a colour temperature in [2000, 10000] K.
    """
    r_mean = float(img[:, :, 0].mean())
    g_mean = float(img[:, :, 1].mean())
    b_mean = float(img[:, :, 2].mean())

    if g_mean < 1.0:
        return 5500.0  # fallback D65

    # R/G ratio maps roughly to CCT:
    # Low R/G (bluer light) → high CCT
    # High R/G (redder light) → low CCT
    rg = r_mean / (g_mean + 1e-9)
    bg = b_mean / (g_mean + 1e-9)

    # Simple empirical mapping calibrated on standard illuminants:
    # Tungsten A (2856K): rg≈1.15, bg≈0.60
    # TL84 (4000K):       rg≈0.98, bg≈0.88
    # D65 (6500K):        rg≈0.93, bg≈0.97
    # D75 (7500K):        rg≈0.88, bg≈1.05
    #
    # CCT ≈ 9000 / rg is a rough first approximation
    cct_from_rg = min(max(float(9000.0 * (1.0 / (rg + 1e-9)) * 0.6), 2000.0), 12000.0)

    return round(float(cct_from_rg), 0)


def _cct_to_illuminant_key(cct: float) -> str:
    """Map a colour temperature to the nearest illuminant key."""
    if cct < 3500:
        return "tungsten"
    elif cct < 4800:
        return "tl84"
    elif cct < 7000:
        return "d65"
    else:
        return "f11"   # cool LED


# ── Signal computation ────────────────────────────────────────────────────────

def _signal_gray_locus_match(
    regions: List[dict],
    illum_key: str,
) -> Tuple[float, str]:
    """
    S1 — Gray locus sensor database match.

    Compare observed gray locus to all known sensors' expected ranges.
    If the locus falls WITHIN a sensor's range → real (that sensor could
    have taken this photo). If it falls OUTSIDE all sensors → AI.

    Returns: (score, detail)
    """
    if not regions:
        return 0.5, "no_gray_regions"

    if not _GRAY_LOCUS_RANGES:
        return 0.5, "no_sensor_database"

    illum_range = _GRAY_LOCUS_RANGES.get(illum_key, {})
    if not illum_range:
        return 0.5, f"no_range_for_{illum_key}"

    r_g_range = illum_range["r_g"]
    b_g_range = illum_range["b_g"]

    # Use the largest gray region (most reliable measurement)
    best = max(regions, key=lambda r: r["size"])
    obs_rg = best["mean_r_g"]
    obs_bg = best["mean_b_g"]

    # Tolerance: add ±4% to sensor range bounds (AWB variation)
    tol = 0.04
    rg_lo = r_g_range[0] * (1 - tol)
    rg_hi = r_g_range[1] * (1 + tol)
    bg_lo = b_g_range[0] * (1 - tol)
    bg_hi = b_g_range[1] * (1 + tol)

    in_rg = (rg_lo <= obs_rg <= rg_hi)
    in_bg = (bg_lo <= obs_bg <= bg_hi)

    # Distance from sensor range bounds (0 = inside range)
    rg_dist = max(0.0, rg_lo - obs_rg, obs_rg - rg_hi) / (rg_hi - rg_lo + 1e-9)
    bg_dist = max(0.0, bg_lo - obs_bg, obs_bg - bg_hi) / (bg_hi - bg_lo + 1e-9)
    total_dist = (rg_dist + bg_dist) / 2.0

    detail = (f"obs=({obs_rg:.3f},{obs_bg:.3f}) "
              f"range=({rg_lo:.3f}-{rg_hi:.3f},{bg_lo:.3f}-{bg_hi:.3f}) "
              f"illum={illum_key}")

    if in_rg and in_bg:
        # Inside sensor range → real
        score = max(0.0, 0.35 - total_dist * 0.5)
    elif total_dist > 0.5:
        # Far outside all sensors → AI
        score = min(1.0, 0.65 + total_dist * 0.3)
    else:
        # Borderline
        score = 0.50 + total_dist * 0.2

    return float(np.clip(score, 0.0, 1.0)), detail


def _signal_chroma_residual(regions: List[dict], cct: float) -> Tuple[float, str]:
    """
    S2 — Illuminant-consistent chroma residual.

    Under a given illuminant, real sensors leave a small but consistent
    chroma residual in gray patches (imperfect AWB). The residual
    should be correlated with the illuminant CCT.

    AI: gray patches are often perfectly neutral (R=G=B) regardless of
    estimated illuminant, which is physically implausible.
    """
    if not regions:
        return 0.5, "no_gray_regions"

    # Compute mean R/G and B/G across all gray regions (weighted by size)
    total_size = sum(r["size"] for r in regions)
    if total_size < 1:
        return 0.5, "zero_total_size"

    w_rg = sum(r["mean_r_g"] * r["size"] for r in regions) / total_size
    w_bg = sum(r["mean_b_g"] * r["size"] for r in regions) / total_size

    # Perfect neutral: R/G = B/G = 1.0 — AI generator fingerprint
    # Real cameras: R/G and B/G both deviate from 1.0 in a CCT-consistent way
    rg_dev = abs(w_rg - 1.0)
    bg_dev = abs(w_bg - 1.0)
    total_dev = (rg_dev + bg_dev) / 2.0

    # CCT-consistent direction check:
    # High CCT (cool, >5500K) → R/G < 1.0, B/G > 1.0
    # Low CCT (warm, <4000K) → R/G > 1.0, B/G < 1.0
    if cct > 5500:
        direction_correct = (w_rg < 1.0 and w_bg > 1.0)
    elif cct < 4000:
        direction_correct = (w_rg > 1.0 and w_bg < 1.0)
    else:
        # Midrange — either direction is plausible
        direction_correct = True

    detail = f"w_rg={w_rg:.3f} w_bg={w_bg:.3f} cct={cct:.0f}K dir_ok={direction_correct}"

    if total_dev < 0.01:
        # Nearly perfect neutral — very unusual for real sensors
        score = 0.72
        detail = f"perfect_neutral_ai: {detail}"
    elif total_dev > 0.05 and direction_correct:
        # Realistic AWB residual in the correct direction for the illuminant
        score = max(0.0, 0.35 - total_dev * 2.0)
        detail = f"realistic_residual_real: {detail}"
    elif total_dev > 0.05 and not direction_correct:
        # Deviant but wrong direction — uncommon but plausible (partial AWB)
        score = 0.50
    else:
        score = 0.50

    return float(np.clip(score, 0.0, 1.0)), detail


# ── Public API ────────────────────────────────────────────────────────────────

def analyze_qesm(img: np.ndarray, img_pil: Any) -> Dict[str, Any]:
    """
    Run QESM analysis on a uint8 RGB numpy array.

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
        # Estimate illuminant
        cct      = estimate_illuminant(img)
        illum    = _cct_to_illuminant_key(cct)

        # Detect gray regions
        regions  = detect_gray_regions(img)

        if not regions:
            elapsed = int((time.monotonic() - t0) * 1000)
            return {
                "score": 0.5, "status": "success",
                "evidence": [{"name": "no_gray_regions", "score": 0.5,
                               "detail": f"cct={cct:.0f}K illum={illum}"}],
                "elapsed_ms": elapsed,
            }

        # S1 — Gray locus sensor match
        s1_score, s1_detail = _signal_gray_locus_match(regions, illum)
        # S2 — Chroma residual
        s2_score, s2_detail = _signal_chroma_residual(regions, cct)

        evidence = [
            {"name": "gray_locus_sensor_match", "score": s1_score, "detail": s1_detail},
            {"name": "illuminant_chroma_residual", "score": s2_score, "detail": s2_detail},
        ]

        # S1 has a richer database and is more discriminative → higher weight
        w1, w2 = 1.5, 1.0
        if s1_score == 0.5 and s2_score == 0.5:
            composite = 0.5
        else:
            composite = (s1_score * w1 + s2_score * w2) / (w1 + w2)

        elapsed = int((time.monotonic() - t0) * 1000)
        return {
            "score":       round(float(np.clip(composite, 0.0, 1.0)), 4),
            "status":      "success",
            "evidence":    evidence,
            "elapsed_ms":  elapsed,
            "cct_kelvin":  cct,
            "illuminant":  illum,
            "gray_regions": len(regions),
        }

    except Exception as exc:
        logger.warning("[QESM] analysis failed: %s", exc)
        elapsed = int((time.monotonic() - t0) * 1000)
        return {"score": 0.5, "status": "failure",
                "evidence": [], "elapsed_ms": elapsed}

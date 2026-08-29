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

Three signals
-------------
S1 — Gray locus sensor mismatch (probabilistic)
    Find neutral gray patches in the image. Compute the Mahalanobis distance
    from the observed gray locus to each sensor's expected distribution.
    Return the top-3 sensor matches. If every sensor's distance exceeds the
    plausibility threshold, that's an AI signal. Cross-checked against every
    detected gray region (not just the largest) for multi-region consistency.

S2 — Illuminant-specific chroma residual (AWB pattern match)
    Under different illuminants, real AWB algorithms leave a residual chroma
    cast in gray patches whose magnitude and direction follow a predictable
    pattern. We estimate the scene illuminant with an ensemble of 5
    algorithms and check whether the observed residual matches a plausible
    AWB error pattern for that illuminant, versus a near-perfect-neutral
    "no sensor model" signature.

S3 — Spectral cross-talk (new)
    Real sensors leak a small, physically bounded amount of signal between
    adjacent color channels (R into G, etc.) because photosite filters are
    imperfect. We measure cross-channel gradient correlation at strong color
    edges. Near-zero or negative cross-talk is atypical for a real sensor.

Known scope limitation (flagged, not fabricated)
-------------------------------------------------
The optimization prompt asks for a 200+ sensor database with full spectral
response curves Q(λ) and per-ISO variation. We do not have access to
verified spectral-response measurements for 200+ camera sensors, and
inventing precise-looking numbers for cameras we haven't measured would be
worse than not having them — it would produce false confidence in S1/S2/S3
for sensors that were never actually characterized. We kept the existing
20-sensor database (real, publicly-documented gray-locus values) and instead
spent the implementation budget on making the *algorithms* around that data
rigorous (probabilistic matching, 5-algorithm illuminant ensemble, AWB
pattern modeling, cross-talk). Expanding the database is a data-sourcing
project, not a coding one — see `data/sensor_profiles/README.md` for the
schema so more sensors can be added as calibration data becomes available.

Each sensor JSON may optionally include a `gray_locus_std` field (fractional
std-dev per illuminant) from real calibration data. Where absent, we assume
a documented modeling default of 3% of the locus value — typical AWB /
manufacturing tolerance — clearly distinct from a measured figure.

Returns
-------
Neutral (0.5) when no suitable gray regions found or database absent.
score=0.0 → strongly real  |  score=1.0 → strongly AI
"""

from __future__ import annotations

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

# Modeling default when a sensor JSON doesn't supply measured std-dev.
# NOT a measured value — documented assumption, see module docstring.
_DEFAULT_LOCUS_STD_FRAC = 0.03


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
# (kept for the coarse fallback path / diagnostics)
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


def _sensor_locus_and_std(sensor: dict, illum: str) -> Optional[Tuple[float, float, float, float]]:
    """
    Return (mean_rg, mean_bg, std_rg, std_bg) for one sensor at one illuminant,
    or None if the sensor has no data for that illuminant.
    Falls back to _DEFAULT_LOCUS_STD_FRAC when the sensor lacks measured std.
    """
    locus = sensor.get("gray_locus", {}).get(illum, {})
    if "r_g" not in locus or "b_g" not in locus:
        return None
    mean_rg = float(locus["r_g"])
    mean_bg = float(locus["b_g"])
    std_block = sensor.get("gray_locus_std", {}).get(illum, {})
    std_rg = float(std_block.get("r_g", mean_rg * _DEFAULT_LOCUS_STD_FRAC))
    std_bg = float(std_block.get("b_g", mean_bg * _DEFAULT_LOCUS_STD_FRAC))
    # Floor to avoid division by ~0 for degenerate entries
    std_rg = max(std_rg, 1e-3)
    std_bg = max(std_bg, 1e-3)
    return mean_rg, mean_bg, std_rg, std_bg


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
#
# Public `estimate_illuminant` keeps its original Gray-World-only behaviour
# and signature for backward compatibility (it's imported directly by
# tests and by other modules). The enhanced 5-algorithm ensemble required by
# the optimization prompt lives in `estimate_illuminant_ensemble` and is what
# `analyze_qesm` actually uses for scoring.

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

    rg = r_mean / (g_mean + 1e-9)
    bg = b_mean / (g_mean + 1e-9)

    # Simple empirical mapping calibrated on standard illuminants:
    # Tungsten A (2856K): rg≈1.15, bg≈0.60
    # TL84 (4000K):       rg≈0.98, bg≈0.88
    # D65 (6500K):        rg≈0.93, bg≈0.97
    # D75 (7500K):        rg≈0.88, bg≈1.05
    cct_from_rg = min(max(float(9000.0 * (1.0 / (rg + 1e-9)) * 0.6), 2000.0), 12000.0)

    return round(float(cct_from_rg), 0)


def _rgb_to_cct(r: float, g: float, b: float) -> float:
    """Shared RG/BG → CCT empirical mapping (same curve as estimate_illuminant)."""
    if g < 1.0:
        return 5500.0
    rg = r / (g + 1e-9)
    return float(np.clip(9000.0 * (1.0 / (rg + 1e-9)) * 0.6, 2000.0, 12000.0))


def _illum_gray_world(img_f: np.ndarray) -> Tuple[float, float, float]:
    """Algorithm 1: Gray World — assume the average scene color is gray."""
    r, g, b = (float(img_f[:, :, c].mean()) for c in range(3))
    return r, g, b


def _illum_white_patch(img_f: np.ndarray) -> Tuple[float, float, float]:
    """Algorithm 2: White Patch (max-RGB) — assume the brightest pixels are white."""
    lum = img_f.sum(axis=2)
    thresh = np.percentile(lum, 99.0)
    mask = lum >= thresh
    if mask.sum() < 10:
        return _illum_gray_world(img_f)
    r = float(img_f[:, :, 0][mask].mean())
    g = float(img_f[:, :, 1][mask].mean())
    b = float(img_f[:, :, 2][mask].mean())
    return r, g, b


def _illum_shades_of_gray(img_f: np.ndarray, p: float = 6.0) -> Tuple[float, float, float]:
    """Algorithm 3: Shades of Gray — Minkowski p-norm generalization of Gray World."""
    out = []
    for c in range(3):
        ch = img_f[:, :, c].astype(np.float64)
        norm = (np.mean(np.power(ch, p))) ** (1.0 / p)
        out.append(float(norm))
    return tuple(out)  # type: ignore[return-value]


def _illum_gray_edge(img_f: np.ndarray, p: float = 6.0) -> Tuple[float, float, float]:
    """Algorithm 4: Gray Edge (order-1) — Minkowski norm of spatial gradients."""
    out = []
    for c in range(3):
        ch = img_f[:, :, c].astype(np.float32)
        gx = cv2.Sobel(ch, cv2.CV_32F, 1, 0, ksize=3)
        gy = cv2.Sobel(ch, cv2.CV_32F, 0, 1, ksize=3)
        grad_mag = np.abs(gx) + np.abs(gy)
        norm = (np.mean(np.power(grad_mag + 1e-6, p))) ** (1.0 / p)
        out.append(float(norm))
    # Gradient-domain illuminant is a direction, not an absolute level; rescale
    # to the image's own mean brightness so downstream RG/BG ratios stay sane.
    mean_level = float(img_f.mean())
    total = sum(out) + 1e-9
    out = [mean_level * 3.0 * (v / total) for v in out]
    return tuple(out)  # type: ignore[return-value]


def _illum_pca(img_f: np.ndarray) -> Tuple[float, float, float]:
    """
    Algorithm 5: PCA-based illuminant estimate.

    Project the pixel color cloud (subsampled) onto its principal axis in
    RGB space. For a scene lit by a single illuminant, that axis approximates
    the illuminant chromaticity (Cheng et al.-style shades-of-gray/PCA
    intuition: the dominant direction of color variation correlates with the
    light color, since surface reflectance varies far more than shading).
    """
    h, w, _ = img_f.shape
    flat = img_f.reshape(-1, 3).astype(np.float64)
    # Subsample for speed on large images
    if flat.shape[0] > 20000:
        idx = np.random.RandomState(0).choice(flat.shape[0], 20000, replace=False)
        flat = flat[idx]
    mean = flat.mean(axis=0)
    centered = flat - mean
    try:
        cov = np.cov(centered, rowvar=False)
        eigvals, eigvecs = np.linalg.eigh(cov)
        principal = eigvecs[:, np.argmax(eigvals)]
        # Orient the axis toward positive brightness
        if principal.sum() < 0:
            principal = -principal
        principal = np.abs(principal)
        principal = principal / (principal.sum() + 1e-9)
        mean_level = float(flat.mean())
        r, g, b = (float(mean_level * 3.0 * p) for p in principal)
        return r, g, b
    except Exception:
        return _illum_gray_world(img_f)


def _classify_scene_type(img_f: np.ndarray) -> str:
    """
    Lightweight heuristic scene classifier used only to weight the illuminant
    ensemble, per the optimization prompt's outdoor/indoor/document split.
    This is a coarse heuristic (brightness + saturation + edge density), not
    a trained classifier — documented as such.
    """
    hsv = cv2.cvtColor(np.clip(img_f, 0, 255).astype(np.uint8), cv2.COLOR_RGB2HSV)
    sat_mean = float(hsv[:, :, 1].mean())
    val_mean = float(hsv[:, :, 2].mean())
    gray = cv2.cvtColor(np.clip(img_f, 0, 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)
    std_val = float(gray.std())

    # Document heuristic: very bright, very low saturation, low texture variance
    if val_mean > 200 and sat_mean < 25 and std_val < 45:
        return "document"
    # Outdoor heuristic: bright and saturated (sky/foliage/daylight)
    if val_mean > 130 and sat_mean > 60:
        return "outdoor"
    return "indoor"


def estimate_illuminant_ensemble(img: np.ndarray) -> Dict[str, Any]:
    """
    Enhanced illuminant estimation: ensemble of 5 algorithms, weighted by a
    coarse scene-type heuristic, as specified for the L14 upgrade.

    Returns dict with per-algorithm CCTs, the scene type used for weighting,
    the weights applied, and the final ensembled CCT.
    """
    img_f = img.astype(np.float64)

    algos = {
        "gray_world":    _illum_gray_world(img_f),
        "white_patch":   _illum_white_patch(img_f),
        "shades_of_gray":_illum_shades_of_gray(img_f),
        "gray_edge":     _illum_gray_edge(img_f),
        "pca":           _illum_pca(img_f),
    }
    ccts = {name: _rgb_to_cct(r, g, b) for name, (r, g, b) in algos.items()}

    scene = _classify_scene_type(img_f)

    # Base weights: equal. Scene-type priority boosts one algorithm, per spec.
    weights = {k: 1.0 for k in algos}
    if scene == "outdoor":
        weights["gray_edge"] = 2.5
    elif scene == "indoor":
        weights["pca"] = 2.5
    elif scene == "document":
        weights["white_patch"] = 2.5

    total_w = sum(weights.values())
    ensembled_cct = sum(ccts[k] * weights[k] for k in ccts) / total_w

    return {
        "per_algo_cct": ccts,
        "scene_type":   scene,
        "weights":      weights,
        "cct":          float(round(ensembled_cct, 0)),
    }


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

def _mahalanobis_1d_pair(obs_rg: float, obs_bg: float,
                          mean_rg: float, mean_bg: float,
                          std_rg: float, std_bg: float) -> float:
    """
    Mahalanobis distance treating R/G and B/G as independent axes (diagonal
    covariance — we don't have measured off-diagonal covariance for these
    sensors, so we don't pretend to). Equivalent to a normalized Euclidean
    distance in (r_g, b_g) space scaled by each axis's std.
    """
    d_rg = (obs_rg - mean_rg) / std_rg
    d_bg = (obs_bg - mean_bg) / std_bg
    return float(np.sqrt(d_rg * d_rg + d_bg * d_bg))


def _signal_gray_locus_match(
    regions: List[dict],
    illum_key: str,
) -> Tuple[float, str, List[dict]]:
    """
    S1 — Probabilistic gray locus sensor match.

    For every gray region, compute the Mahalanobis distance to every
    sensor's distribution at the estimated illuminant. Rank sensors by
    distance and keep the top 3. Cross-check consistency across all
    regions (not just the largest) — real photos should agree on roughly
    the same sensor across every neutral patch; composites/AI often don't.

    Returns: (score, detail, top3_matches)
    """
    if not regions:
        return 0.5, "no_gray_regions", []

    if not _SENSOR_DB:
        return 0.5, "no_sensor_database", []

    # Distances for the largest (most reliable) region drive the primary score.
    best_region = max(regions, key=lambda r: r["size"])

    def _distances_for(region: dict) -> List[Tuple[str, float]]:
        dists = []
        for sensor in _SENSOR_DB:
            locus = _sensor_locus_and_std(sensor, illum_key)
            if locus is None:
                continue
            mean_rg, mean_bg, std_rg, std_bg = locus
            d = _mahalanobis_1d_pair(region["mean_r_g"], region["mean_b_g"],
                                      mean_rg, mean_bg, std_rg, std_bg)
            dists.append((sensor.get("name", "unknown"), d))
        dists.sort(key=lambda t: t[1])
        return dists

    primary_dists = _distances_for(best_region)
    if not primary_dists:
        return 0.5, f"no_sensor_data_for_{illum_key}", []

    top3 = [{"sensor": name, "distance": round(d, 3)} for name, d in primary_dists[:3]]
    best_dist = primary_dists[0][1]

    # Multi-region consistency: do other regions' best-match sensors agree?
    agree_count = 0
    other_regions = [r for r in regions if r is not best_region]
    for r in other_regions:
        d = _distances_for(r)
        if d and d[0][0] == top3[0]["sensor"]:
            agree_count += 1
    consistency = (agree_count / len(other_regions)) if other_regions else None

    # Distance → score. Mahalanobis distance ~1-2 is well within a plausible
    # sensor's distribution; >3 is increasingly implausible for any real
    # sensor at this illuminant (roughly a 3-sigma-per-axis joint bound).
    if best_dist <= 1.5:
        score = max(0.0, 0.30 - (1.5 - best_dist) * 0.05)
    elif best_dist <= 3.0:
        score = 0.30 + (best_dist - 1.5) / 1.5 * 0.35   # ramps 0.30 -> 0.65
    else:
        score = min(1.0, 0.65 + (best_dist - 3.0) * 0.12)

    # Multi-region disagreement nudges toward AI (composite/inconsistent lighting)
    if consistency is not None and consistency < 0.34 and len(other_regions) >= 2:
        score = min(1.0, score + 0.10)

    detail = (f"best={top3[0]['sensor']}(d={best_dist:.2f}) "
              f"illum={illum_key} n_regions={len(regions)} "
              f"consistency={'n/a' if consistency is None else round(consistency, 2)}")

    return float(np.clip(score, 0.0, 1.0)), detail, top3


# Expected AWB residual magnitude bands, keyed by CCT range. These describe
# the *pattern* (rough magnitude + sign convention) that common in-camera AWB
# algorithms (gray-world completion, iterative gray-world) tend to leave
# behind, not a fitted statistical model — flagged as a heuristic, not
# measured ground truth, same spirit as the sensor-std default above.
def _expected_awb_residual_band(cct: float) -> Tuple[float, float]:
    """Return (min_dev, max_dev) plausible total deviation from neutral for CCT."""
    if cct < 3500 or cct > 7500:
        # Far from D65 — AWB correction is harder, larger residual expected
        return 0.03, 0.14
    return 0.015, 0.09


def _signal_chroma_residual(regions: List[dict], cct: float) -> Tuple[float, str]:
    """
    S2 — AWB error pattern analysis.

    Real AWB algorithms leave a residual chroma cast in gray patches whose
    magnitude falls within a plausible band for the estimated illuminant,
    and whose sign is consistent with under/over-correction direction for
    that illuminant. AI generators tend toward one of two failure modes:
    (a) perfectly neutral gray (no sensor/AWB model at all), or
    (b) a residual with an implausible magnitude/direction combination
        (e.g. a VAE normalization artifact rather than a physical cast).
    """
    if not regions:
        return 0.5, "no_gray_regions"

    total_size = sum(r["size"] for r in regions)
    if total_size < 1:
        return 0.5, "zero_total_size"

    w_rg = sum(r["mean_r_g"] * r["size"] for r in regions) / total_size
    w_bg = sum(r["mean_b_g"] * r["size"] for r in regions) / total_size

    rg_dev = abs(w_rg - 1.0)
    bg_dev = abs(w_bg - 1.0)
    total_dev = (rg_dev + bg_dev) / 2.0

    lo_band, hi_band = _expected_awb_residual_band(cct)

    if cct > 5500:
        direction_correct = (w_rg < 1.0 and w_bg > 1.0)
    elif cct < 4000:
        direction_correct = (w_rg > 1.0 and w_bg < 1.0)
    else:
        direction_correct = True

    detail = (f"w_rg={w_rg:.3f} w_bg={w_bg:.3f} cct={cct:.0f}K "
              f"band=({lo_band:.3f}-{hi_band:.3f}) dir_ok={direction_correct}")

    if total_dev < 0.008:
        # Near-perfectly neutral — no plausible AWB algorithm does this well
        score = 0.75
        detail = f"perfect_neutral_ai: {detail}"
    elif lo_band <= total_dev <= hi_band and direction_correct:
        # Falls inside the expected AWB residual pattern for this illuminant
        score = max(0.05, 0.30 - (total_dev - lo_band) * 0.5)
        detail = f"in_band_real: {detail}"
    elif total_dev > hi_band * 1.8:
        # Residual far larger than any plausible AWB correction leaves behind
        score = min(1.0, 0.60 + (total_dev - hi_band) * 1.5)
        detail = f"implausibly_large: {detail}"
    elif not direction_correct and total_dev > lo_band:
        # Real magnitude, wrong sign for the illuminant — mixed lighting is
        # possible, so this is only a mild signal
        score = 0.55
        detail = f"wrong_direction: {detail}"
    else:
        score = 0.50

    return float(np.clip(score, 0.0, 1.0)), detail


def _signal_spectral_crosstalk(img: np.ndarray) -> Tuple[float, str]:
    """
    S3 — Spectral cross-talk analysis (new signal).

    Real Bayer-pattern sensors have imperfect color filters, so a fraction
    of the light meant for one channel leaks into its neighbors. At a sharp
    edge between two saturated, differently-colored regions, this shows up
    as small but nonzero *positive* correlation between the gradient of one
    channel and its neighbors (a "soft" edge in the leaking channel where
    the source channel has a hard edge). AI generators typically produce
    either perfectly independent channel edges (near-zero cross-talk) or
    edges with no physically-grounded leakage pattern at all.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 60, 160)
    if edges.sum() == 0:
        return 0.5, "no_edges_found"

    # Dilate to get a band around edges, then require the edge to separate
    # two distinctly colored (not just brightness-different) regions.
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edge_band = cv2.dilate(edges, kernel, iterations=1) > 0

    if edge_band.sum() < 100:
        return 0.5, "insufficient_edge_pixels"

    img_f = img.astype(np.float32)
    gx = [cv2.Sobel(img_f[:, :, c], cv2.CV_32F, 1, 0, ksize=3) for c in range(3)]
    gy = [cv2.Sobel(img_f[:, :, c], cv2.CV_32F, 0, 1, ksize=3) for c in range(3)]
    grad_mag = [np.hypot(gx[c], gy[c]) for c in range(3)]

    r_g_vals = grad_mag[0][edge_band]
    g_g_vals = grad_mag[1][edge_band]
    b_g_vals = grad_mag[2][edge_band]

    # Only consider edges that are meaningfully "colored" (channels disagree
    # on where the edge is / how strong it is) — pure luminance edges don't
    # test cross-talk.
    chroma_edge_mask = (np.abs(r_g_vals - b_g_vals) > (0.15 * (r_g_vals + b_g_vals + 1e-6)))
    if chroma_edge_mask.sum() < 50:
        return 0.5, "insufficient_chromatic_edges"

    r_g_vals = r_g_vals[chroma_edge_mask]
    g_g_vals = g_g_vals[chroma_edge_mask]
    b_g_vals = b_g_vals[chroma_edge_mask]

    def _safe_corr(a: np.ndarray, b: np.ndarray) -> float:
        if a.std() < 1e-6 or b.std() < 1e-6:
            return 0.0
        return float(np.corrcoef(a, b)[0, 1])

    corr_rg = _safe_corr(r_g_vals, g_g_vals)
    corr_gb = _safe_corr(g_g_vals, b_g_vals)
    corr_rb = _safe_corr(r_g_vals, b_g_vals)
    mean_corr = float(np.mean([corr_rg, corr_gb, corr_rb]))

    detail = f"corr_rg={corr_rg:.3f} corr_gb={corr_gb:.3f} corr_rb={corr_rb:.3f}"

    # Real sensor cross-talk: small-to-moderate positive correlation (~0.1-0.5)
    # from genuine photosite leakage. Near-zero/negative: no physical leakage
    # model (common AI signature). Very high (>0.85): suspiciously perfect
    # channel coupling, also atypical of leakage (more like a colorization
    # artifact) — treated as a weaker, not opposite, signal.
    if 0.10 <= mean_corr <= 0.55:
        score = max(0.10, 0.30 - (mean_corr - 0.10) * 0.2)
    elif mean_corr < 0.10:
        score = min(0.85, 0.55 + (0.10 - mean_corr) * 0.6)
    else:  # > 0.55
        score = 0.50 + min(0.25, (mean_corr - 0.55) * 0.5)

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
        # Enhanced 5-algorithm illuminant ensemble
        illum_info = estimate_illuminant_ensemble(img)
        cct   = illum_info["cct"]
        illum = _cct_to_illuminant_key(cct)

        # Detect gray regions
        regions = detect_gray_regions(img)

        if not regions:
            elapsed = int((time.monotonic() - t0) * 1000)
            return {
                "score": 0.5, "status": "success",
                "evidence": [{"name": "no_gray_regions", "score": 0.5,
                               "detail": f"cct={cct:.0f}K illum={illum}"}],
                "elapsed_ms": elapsed,
                "illuminant_ensemble": illum_info,
            }

        # S1 — Probabilistic gray locus sensor match
        s1_score, s1_detail, s1_top3 = _signal_gray_locus_match(regions, illum)
        # S2 — AWB error pattern chroma residual
        s2_score, s2_detail = _signal_chroma_residual(regions, cct)
        # S3 — Spectral cross-talk (new)
        s3_score, s3_detail = _signal_spectral_crosstalk(img)

        evidence = [
            {"name": "gray_locus_sensor_match", "score": s1_score, "detail": s1_detail,
             "top3_sensors": s1_top3},
            {"name": "illuminant_chroma_residual", "score": s2_score, "detail": s2_detail},
            {"name": "spectral_crosstalk", "score": s3_score, "detail": s3_detail},
        ]

        # S1 has the richest database and is most discriminative → highest weight.
        # S3 is a newer, less-validated signal → lowest weight until it's been
        # calibrated against a labeled benchmark.
        w1, w2, w3 = 1.5, 1.0, 0.7
        scored = [(s1_score, w1), (s2_score, w2)]
        if s3_score != 0.5:
            scored.append((s3_score, w3))

        if all(sc == 0.5 for sc, _ in scored):
            composite = 0.5
        else:
            composite = sum(sc * w for sc, w in scored) / sum(w for _, w in scored)

        elapsed = int((time.monotonic() - t0) * 1000)
        return {
            "score":       round(float(np.clip(composite, 0.0, 1.0)), 4),
            "status":      "success",
            "evidence":    evidence,
            "elapsed_ms":  elapsed,
            "cct_kelvin":  cct,
            "illuminant":  illum,
            "illuminant_ensemble": illum_info,
            "gray_regions": len(regions),
        }

    except Exception as exc:
        logger.warning("[QESM] analysis failed: %s", exc)
        elapsed = int((time.monotonic() - t0) * 1000)
        return {"score": 0.5, "status": "failure",
                "evidence": [], "elapsed_ms": elapsed}

"""
Aiscern Signal Worker — Layers 15-19: Object Physics Ensemble
Production implementation for universal object-agnostic AI image detection.

Phase 1 — L15: Object Boundary Physics (OBP)
"""

from __future__ import annotations

import json
import logging
import math
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

from utils.cv_compat import normalize_hough_lines

logger = logging.getLogger(__name__)

# ── Threshold Loader ─────────────────────────────────────────────────────────

_CONFIG_PATH = Path(__file__).parent.parent / "config" / "object_physics_thresholds.json"


def _load_thresholds(layer_key: str) -> dict:
    """
    Load per-layer thresholds from external JSON.

    Never hardcode thresholds. If the config file is missing or the key
    is absent, returns an empty dict so that the caller can apply safe
    defaults.

    Parameters
    ----------
    layer_key : str
        Top-level key in the JSON (e.g. "l15_obp").

    Returns
    -------
    dict
        Threshold dictionary or empty dict on failure.
    """
    try:
        with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        return cfg.get(layer_key, {})
    except Exception as exc:
        logger.warning("[ObjectPhysics] Failed to load thresholds: %s", exc)
        return {}


# ── Safe Numeric Helpers ────────────────────────────────────────────────────


def _safe_float(value: Any) -> float:
    """
    Convert a value to float safely.

    Returns 0.0 for None, NaN, or Infinity. Uses ``float(value or 0)``
    per project convention.

    Parameters
    ----------
    value : Any
        Input to convert.

    Returns
    -------
    float
        Sanitized float in (-inf, inf) → 0.0 on failure.
    """
    try:
        v = float(value or 0)
        if not math.isfinite(v):
            return 0.0
        return v
    except Exception:
        return 0.0


def _score_from_metric(value: float, real_thresh: float, ai_thresh: float) -> float:
    r"""
    Map a physical metric to a suspicion score in [0, 1].

    .. math::
        s(v) =
        egin{cases}
        0.0 & v \ge t_{real} \
        1.0 & v \le t_{ai} \
        \dfrac{t_{real} - v}{t_{real} - t_{ai}} & 	ext{otherwise}
    \end{cases}

    Parameters
    ----------
    value : float
        Observed metric value (larger = more real by convention).
    real_thresh : float
        Value above which the image is considered strongly real.
    ai_thresh : float
        Value below which the image is considered strongly AI.

    Returns
    -------
    float
        Suspicion score in [0, 1] where 0 = real, 1 = AI.
    """
    value = _safe_float(value)
    real_thresh = _safe_float(real_thresh)
    ai_thresh = _safe_float(ai_thresh)

    if real_thresh <= ai_thresh:
        return 0.5

    if value >= real_thresh:
        return 0.0
    if value <= ai_thresh:
        return 1.0

    return (real_thresh - value) / (real_thresh - ai_thresh)


def _map_suspicion_to_status_confidence(suspicion: float) -> Tuple[str, float]:
    """
    Convert a 0=real / 1=AI suspicion score into the standard
    (status, confidence) pair used by the evidence schema.

    Parameters
    ----------
    suspicion : float
        Suspicion score in [0, 1].

    Returns
    -------
    Tuple[str, float]
        (status, confidence) where status ∈ {"normal","anomalous","inconclusive"}
        and confidence = |suspicion − 0.5| × 2.0.
    """
    suspicion = float(np.clip(suspicion, 0.0, 1.0))
    confidence = abs(suspicion - 0.5) * 2.0

    if suspicion > 0.55:
        return "anomalous", confidence
    if suspicion < 0.45:
        return "normal", confidence
    return "inconclusive", confidence


# ── Schema Builders ─────────────────────────────────────────────────────────


def _build_evidence_node(
    layer: int,
    artifact_type: str,
    status: str,
    confidence: float,
    detail: str,
    raw_value: float,
) -> dict:
    """
    Build a single EvidenceNode conforming to the AISCERN object-physics schema.

    Parameters
    ----------
    layer : int
        Layer number (15 for OBP).
    artifact_type : str
        Machine-readable artifact class.
    status : str
        "normal" | "anomalous" | "inconclusive".
    confidence : float
        Certainty of the status (0 = uncertain, 1 = certain).
    detail : str
        Human-readable explanation, truncated to 200 chars.
    raw_value : float
        Untransformed metric value for calibration/debugging.

    Returns
    -------
    dict
        Evidence node dictionary.
    """
    return {
        "layer": layer,
        "category": "object_physics",
        "artifactType": artifact_type,
        "status": status,
        "confidence": round(float(np.clip(confidence, 0.0, 1.0)), 4),
        "detail": str(detail)[:200],
        "rawValue": _safe_float(raw_value),
    }


def build_layer_report(
    layer: int,
    layer_name: str,
    evidence: List[dict],
    status: str,
    elapsed_ms: int,
    score: Optional[float] = None,
) -> dict:
    r"""
    Build a LayerReport conforming to the common output schema.

    If ``score`` is not provided, the composite is derived from evidence:

    .. math::
        s_{composite} = rac{1}{N}\sum_{i=1}^{N}
        egin{cases}
        c_i      & 	ext{status}_i = 	ext{anomalous} \
        1 - c_i  & 	ext{status}_i = 	ext{normal} \
        0.5      & 	ext{otherwise}
        \end{cases}

    Parameters
    ----------
    layer : int
        Layer identifier.
    layer_name : str
        Human-readable layer name.
    evidence : List[dict]
        List of evidence nodes.
    status : str
        "success" | "failure" | "neutral_scene_type".
    elapsed_ms : int
        Wall-clock time in milliseconds.
    score : Optional[float]
        Pre-computed suspicion score. If None, derived from evidence.

    Returns
    -------
    dict
        Standard LayerReport dictionary.
    """
    if score is None and evidence:
        scores = []
        for ev in evidence:
            c = ev.get("confidence", 0.5)
            s = ev.get("status", "inconclusive")
            if s == "anomalous":
                scores.append(c)
            elif s == "normal":
                scores.append(1.0 - c)
            else:
                scores.append(0.5)
        computed = sum(scores) / len(scores) if scores else 0.5
    else:
        computed = score if score is not None else 0.5

    return {
        "layer": layer,
        "layerName": layer_name,
        "status": status,
        "layerSuspicionScore": round(float(np.clip(computed, 0.0, 1.0)), 4),
        # Fix (v4.7.0 integration): was "elapsedMs" — every other analyzer in
        # the pipeline (utils/evidence_builder.build_layer_report, and the
        # L11-L14 wrapper in physical_consistency.py) uses "processingTimeMs"
        # for the LayerReport schema and "elapsed_ms" for the raw per-analyzer
        # dict. The mismatched key meant timing data from L15-L19 would have
        # silently vanished from both the API response schema and the
        # slog.layer_complete() structured logging (which reads elapsed_ms).
        "processingTimeMs": int(elapsed_ms),
        "elapsed_ms": int(elapsed_ms),
        "evidence": evidence,
    }


# ── L15 Internal Helpers ───────────────────────────────────────────────────


def _create_object_mask(img: np.ndarray, cfg: dict) -> np.ndarray:
    r"""
    Create a binary object mask using adaptive thresholding and morphology.

    Algorithm
    ---------
    1. Convert RGB → grayscale.
    2. Apply Gaussian blur (:math:`\sigma=1.5`) to suppress fine noise.
    3. Adaptive Gaussian threshold (51 px block, C=5) to separate objects
       from background under non-uniform illumination.
    4. Morphological close + open with a 5×5 ellipse kernel to fill gaps and
       remove speckles.

    Complexity: :math:`O(H \cdot W)` — dominated by blur and morphology.

    Parameters
    ----------
    img : np.ndarray
        H×W×3 uint8 RGB image.
    cfg : dict
        Threshold configuration (unused keys are ignored).

    Returns
    -------
    np.ndarray
        H×W uint8 binary mask (0 or 255).
    """
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 1.5)

    mask = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, 51, 5
    )

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    return mask


# ── L15 Internal Helpers ───────────────────────────────────────────────────
#
# Module 6 (L15 OBP) upgrade notes
# ---------------------------------
# The original implementation only sampled contact shadows straight down,
# used a flat edge/interior brightness ratio for "Fresnel", and measured
# roughness at one fixed scale. This block replaces those three internal
# helpers with gravity-aware multi-direction shadow + penumbra sampling,
# BRDF-type-classified Fresnel curve fitting, and multi-scale + chromatic
# edge roughness — per the L15 section of the optimization prompt.
#
# Two spots where we deliberately fell short of the literal spec, flagged
# rather than faked:
#
# 1. Gravity direction estimation is line-based only. The spec also lists
#    EXIF orientation and face-orientation as gravity cues; this analyzer
#    receives only a raw numpy array (no EXIF, no face detector wired in
#    here), so we fall back to "no confident vertical-line cluster -> assume
#    straight down", the same default the old code always used. If EXIF/face
#    data becomes available to this function later, it should be blended in
#    ahead of the line-based estimate, not instead of it.
#
# 2. "Multi-angle sampling by analyzing curved surfaces" for Fresnel fitting
#    would require actual 3D surface normal estimation, which this codebase
#    doesn't have. We use distance-from-boundary as a monotonic proxy for
#    grazing angle (edge-adjacent pixels ~ grazing, interior pixels ~ normal
#    incidence) and fit Schlick-family curves against that proxy. It's a
#    real curve fit against real per-pixel data, but the x-axis is a
#    geometric approximation, not a measured viewing angle — documented in
#    `_fit_fresnel_curve`.


def _rotate_vector(v: Tuple[float, float], degrees: float) -> Tuple[float, float]:
    """Rotate a 2-D vector by `degrees` (image coordinates: +y is down)."""
    rad = math.radians(degrees)
    cos_a, sin_a = math.cos(rad), math.sin(rad)
    x, y = v
    return (x * cos_a - y * sin_a, x * sin_a + y * cos_a)


def _estimate_gravity_direction(gray: np.ndarray, cfg: dict) -> Tuple[Tuple[float, float], float]:
    r"""
    Estimate the image-space gravity direction from dominant vertical lines.

    Real photographs of built/structured scenes contain verticals (door
    frames, walls, poles, standing figures) that align with true gravity.
    We detect line segments, keep those within ``vertical_tolerance_deg`` of
    vertical, and take the median deviation as the scene tilt.

    Returns
    -------
    (unit_vector, confidence) : ((float, float), float)
        unit_vector points in the gravity ("down") direction in image space.
        confidence in [0, 1] is the fraction of detected lines that were
        near-vertical; low confidence means "fell back to the default
        straight-down assumption", not "gravity is sideways".
    """
    default_dir = (0.0, 1.0)
    h, w = gray.shape
    tol = _safe_float(cfg.get("vertical_tolerance_deg", 25.0))

    edges = cv2.Canny(gray, 50, 150)
    min_len = max(20, min(h, w) // 8)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=40,
                             minLineLength=min_len, maxLineGap=8)
    lines = normalize_hough_lines(lines)
    if lines.shape[0] == 0:
        return default_dir, 0.0

    dx = (lines[:, 2] - lines[:, 0]).astype(np.float64)
    dy = (lines[:, 3] - lines[:, 1]).astype(np.float64)
    valid = (np.abs(dx) + np.abs(dy)) > 0
    if not valid.any():
        return default_dir, 0.0
    angles = np.degrees(np.arctan2(dy[valid], dx[valid])) % 180.0

    near_vertical = angles[(angles > (90.0 - tol)) & (angles < (90.0 + tol))]
    confidence = float(near_vertical.size) / float(angles.size)

    if near_vertical.size < 3:
        return default_dir, 0.0

    tilt_deg = float(np.median(near_vertical)) - 90.0
    tilt_rad = math.radians(tilt_deg)
    gx, gy = math.sin(tilt_rad), math.cos(tilt_rad)
    norm = math.hypot(gx, gy) or 1.0
    return (gx / norm, gy / norm), float(np.clip(confidence, 0.0, 1.0))


def _get_boundary_points(mask: np.ndarray, max_points: int = 1500) -> np.ndarray:
    """External-contour points of the object mask, subsampled for cost control."""
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not contours:
        return np.empty((0, 2), dtype=np.int32)
    pts = np.concatenate([c.reshape(-1, 2) for c in contours], axis=0)
    if pts.shape[0] > max_points:
        idx = np.linspace(0, pts.shape[0] - 1, max_points).astype(int)
        pts = pts[idx]
    return pts


def _sample_directional_contact_shadow(
    gray_f: np.ndarray,
    mask: np.ndarray,
    cfg: dict,
    direction: Tuple[float, float],
    boundary_pts: np.ndarray,
) -> Tuple[float, int, float]:
    r"""
    Sample contact-shadow signature and penumbra width along one direction.

    Generalizes the original vertical-only column scan to an arbitrary unit
    direction, sampled at boundary-contour points rather than per-column
    (needed once direction isn't guaranteed axis-aligned). Uses a single
    global direction per call, same simplification the original code made
    for the vertical case (a true per-point outward surface normal is not
    computed) — kept consistent rather than silently upgraded in one branch.

    Returns
    -------
    (ratio, valid_samples, penumbra_width_px)
    """
    h, w = gray_f.shape
    inner = int(cfg.get("inner_offset", 2))
    near = int(cfg.get("outer_near_offset", 1))
    far = int(cfg.get("outer_far_offset", 6))
    drop_thresh = _safe_float(cfg.get("intensity_drop_threshold", 0.12))
    dx, dy = direction

    if boundary_pts.shape[0] == 0:
        return 0.0, 0, 0.0

    xs = boundary_pts[:, 0].astype(np.float64)
    ys = boundary_pts[:, 1].astype(np.float64)

    def sample_at(offset: float):
        sx = np.clip(np.round(xs + dx * offset), 0, w - 1).astype(np.int32)
        sy = np.clip(np.round(ys + dy * offset), 0, h - 1).astype(np.int32)
        return gray_f[sy, sx] / 255.0, sx, sy

    interior_vals, _, _ = sample_at(-inner)   # into the object
    near_vals, nsx, nsy = sample_at(near)
    far_vals, fsx, fsy = sample_at(far)

    bg_near = mask[nsy, nsx] == 0
    bg_far = mask[fsy, fsx] == 0
    valid = bg_near & bg_far

    n_valid = int(valid.sum())
    if n_valid == 0:
        return 0.0, 0, 0.0

    with np.errstate(invalid="ignore"):
        shadow_sig = valid & (near_vals < far_vals) & ((interior_vals - near_vals) > drop_thresh)

    ratio = float(np.count_nonzero(shadow_sig)) / float(n_valid)

    # Penumbra width: for points with a detected shadow signature, sample a
    # short profile between `near` and `far` and measure the 10%-90%
    # intensity-transition width. Capped sample count for cost control.
    penumbra = 0.0
    sig_idx = np.nonzero(shadow_sig)[0]
    if sig_idx.size > 0:
        step = max(1, sig_idx.size // 200)
        sample_idx = sig_idx[::step]
        offsets = np.linspace(near, far, 6)
        profile_cols = []
        for off in offsets:
            v, _, _ = sample_at(off)
            profile_cols.append(v[sample_idx])
        profile = np.stack(profile_cols, axis=1)  # (n_pts, 6)
        lo = profile[:, 0]
        hi = profile[:, -1]
        span = np.clip(hi - lo, 1e-6, None)
        widths = []
        for row, l, s in zip(profile, lo, span):
            frac = np.clip((row - l) / s, 0.0, 1.0)
            below10 = np.nonzero(frac >= 0.1)[0]
            above90 = np.nonzero(frac >= 0.9)[0]
            if below10.size and above90.size and above90[0] >= below10[0]:
                w_px = float(offsets[above90[0]] - offsets[below10[0]])
                if w_px > 0:
                    widths.append(w_px)
        if widths:
            penumbra = float(np.median(widths))

    return ratio, n_valid, penumbra


def _sample_multi_direction_shadows(
    gray_f: np.ndarray,
    mask: np.ndarray,
    cfg: dict,
) -> Dict[str, Any]:
    """
    Sample contact shadows along the estimated gravity direction plus its
    two perpendiculars and its opposite (4 directions total), instead of
    vertical-only. Real objects should show a shadow signature concentrated
    in the gravity direction; AI composites sometimes show shadow-like
    intensity drops in an arbitrary or inconsistent direction, or none at
    all in any direction.
    """
    gray_u8 = np.clip(gray_f, 0, 255).astype(np.uint8)
    gravity_dir, gravity_conf = _estimate_gravity_direction(gray_u8, cfg)
    boundary_pts = _get_boundary_points(mask)

    directions = {
        "gravity":      gravity_dir,
        "perp_a":       _rotate_vector(gravity_dir, 90.0),
        "perp_b":       _rotate_vector(gravity_dir, -90.0),
        "opposite":     _rotate_vector(gravity_dir, 180.0),
    }

    per_direction = {}
    for name, d in directions.items():
        ratio, n, penumbra = _sample_directional_contact_shadow(
            gray_f, mask, cfg, d, boundary_pts
        )
        per_direction[name] = {"ratio": ratio, "samples": n, "penumbra_px": penumbra}

    gravity_ratio = per_direction["gravity"]["ratio"]
    other_ratios = [per_direction[k]["ratio"] for k in ("perp_a", "perp_b", "opposite")]
    max_other = max(other_ratios) if other_ratios else 0.0

    # A real grounded object should show its strongest shadow signature in
    # the gravity direction. If a non-gravity direction shows a
    # substantially stronger "shadow" than gravity does, that's more
    # consistent with a random dark region than a physical contact shadow.
    directional_consistency = (
        gravity_ratio >= max_other - 0.05 if per_direction["gravity"]["samples"] > 0 else None
    )

    return {
        "per_direction": per_direction,
        "gravity_direction": gravity_dir,
        "gravity_confidence": gravity_conf,
        "gravity_ratio": gravity_ratio,
        "max_other_ratio": max_other,
        "directional_consistency": directional_consistency,
        "penumbra_px": per_direction["gravity"]["penumbra_px"],
    }


def _classify_surface_type(
    img: np.ndarray,
    dist_in: np.ndarray,
    edge_depth: int,
    interior_depth: int,
    smooth_mask: np.ndarray,
) -> Tuple[str, float]:
    r"""
    Coarse BRDF-type classification: dielectric / conductor / translucent.

    Heuristic, not a trained classifier:
    - conductor: the brightest edge-band pixels share the body's hue
      (metals tint their specular reflection with body color).
    - dielectric: the brightest edge-band pixels are desaturated/white
      relative to the body (plastics/wood/most non-metals reflect white
      specular highlights regardless of body color).
    - translucent: edge-band color correlates with what's just outside the
      object (transmission bleed-through) more than with the body color.

    Returns (surface_type, confidence).
    """
    edge_band = (dist_in <= edge_depth) & (dist_in > 0) & smooth_mask
    interior_band = (dist_in > edge_depth) & (dist_in <= edge_depth + interior_depth) & smooth_mask

    if edge_band.sum() < 50 or interior_band.sum() < 50:
        return "unknown", 0.0

    img_f = img.astype(np.float32)
    body_color = img_f[interior_band].mean(axis=0)

    edge_gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float32)
    edge_vals = edge_gray[edge_band]
    bright_thresh = np.percentile(edge_vals, 85.0)
    bright_mask_local = edge_vals >= bright_thresh
    edge_pixels = img_f[edge_band]
    highlight_color = edge_pixels[bright_mask_local].mean(axis=0) if bright_mask_local.any() else body_color

    def _hsv_sat(rgb: np.ndarray) -> float:
        arr = np.uint8(np.clip(rgb, 0, 255)).reshape(1, 1, 3)
        return float(cv2.cvtColor(arr, cv2.COLOR_RGB2HSV)[0, 0, 1]) / 255.0

    highlight_sat = _hsv_sat(highlight_color)

    def _cos_sim(a: np.ndarray, b: np.ndarray) -> float:
        na, nb = np.linalg.norm(a) + 1e-6, np.linalg.norm(b) + 1e-6
        return float(np.dot(a, b) / (na * nb))

    body_highlight_sim = _cos_sim(body_color, highlight_color)

    if highlight_sat < 0.15:
        return "dielectric", 1.0 - highlight_sat / 0.15

    if body_highlight_sim > 0.90 and highlight_sat >= 0.15:
        return "conductor", float(np.clip(body_highlight_sim, 0.0, 1.0))

    return "translucent", float(np.clip(1.0 - body_highlight_sim, 0.0, 1.0))


def _fit_fresnel_curve(
    gray_f: np.ndarray,
    dist_in: np.ndarray,
    edge_depth: int,
    interior_depth: int,
    smooth_mask: np.ndarray,
) -> Tuple[float, float, float, int]:
    r"""
    Fit a Schlick-family reflectance curve against a distance-from-boundary
    proxy for grazing angle (see module note above on this approximation).

    .. math::
        I(\theta) \approx I_{min} + (I_{max}-I_{min})\bigl[R_0 + (1-R_0)(1-\cos\theta)^n\bigr]

    where :math:`\theta(d) = 90^\circ \cdot (1 - d / d_{max})` — grazing at
    the boundary, near-normal at the far edge of the interior band.

    Returns
    -------
    (R0, n_exponent, r_squared, n_profile_points)
        r_squared measures how well the profile follows *any* member of the
        Schlick family; a genuinely flat/no-brightening profile fits R0≈1
        with a poor or degenerate r_squared, which is itself informative.
    """
    d_max = edge_depth + interior_depth
    if d_max < 2:
        return 1.0, 0.0, 0.0, 0

    distances = np.arange(0, d_max + 1)
    profile = []
    for d in distances:
        band = (dist_in > d) & (dist_in <= d + 1) & smooth_mask
        if band.sum() < 20:
            profile.append(np.nan)
        else:
            profile.append(float(gray_f[band].mean()))
    profile = np.array(profile, dtype=np.float64)

    valid = ~np.isnan(profile)
    if valid.sum() < 4:
        return 1.0, 0.0, 0.0, int(valid.sum())

    d_valid = distances[valid].astype(np.float64)
    i_valid = profile[valid]

    i_min, i_max = i_valid.min(), i_valid.max()
    span = i_max - i_min
    if span < 1e-6:
        # Perfectly flat intensity vs distance from boundary — no grazing
        # brightening at all, the strongest "no Fresnel" signature.
        return 1.0, 0.0, 0.0, int(valid.sum())

    i_norm = (i_valid - i_min) / span
    theta = np.radians(90.0 * (1.0 - d_valid / d_max))
    cos_term = 1.0 - np.cos(theta)

    best = (1.0, 0.0, -np.inf)  # (R0, n, neg_sse) -> maximize
    ss_tot = float(np.sum((i_norm - i_norm.mean()) ** 2)) + 1e-9
    for n_exp in (1.0, 1.5, 2.0, 3.0, 5.0, 8.0):
        ct_n = cos_term ** n_exp
        # Closed-form least-squares R0 for fixed n:
        # model = R0 + (1-R0)*ct_n = R0*(1-ct_n) + ct_n
        # residual = i_norm - ct_n - R0*(1-ct_n)  -> linear in R0
        basis = 1.0 - ct_n
        denom = float(np.sum(basis * basis)) + 1e-9
        r0 = float(np.sum((i_norm - ct_n) * basis) / denom)
        r0 = float(np.clip(r0, 0.0, 1.0))
        model = r0 + (1.0 - r0) * ct_n
        sse = float(np.sum((i_norm - model) ** 2))
        if -sse > best[2]:
            best = (r0, n_exp, -sse)

    r0, n_exp, neg_sse = best
    r_squared = float(np.clip(1.0 - (-neg_sse) / ss_tot, 0.0, 1.0))
    return r0, n_exp, r_squared, int(valid.sum())


def _compute_edge_fresnel_v2(
    img: np.ndarray,
    gray: np.ndarray,
    mask: np.ndarray,
    cfg: dict,
) -> Dict[str, Any]:
    """
    BRDF-type-classified Fresnel analysis. Wraps the original edge/interior
    ratio (kept for score-threshold backward compatibility) with surface
    classification and curve-fit quality as additional evidence.
    """
    interior_depth = int(cfg.get("interior_depth", 4))
    edge_depth = int(cfg.get("edge_depth", 2))
    var_thresh = _safe_float(cfg.get("smooth_surface_variance_threshold", 400.0))

    dist_in = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
    gray_f = gray.astype(np.float32)

    mean_box = cv2.blur(gray_f, (7, 7))
    mean_sq_box = cv2.blur(gray_f ** 2, (7, 7))
    with np.errstate(invalid="ignore"):
        local_var = mean_sq_box - mean_box ** 2
    smooth_mask = local_var < var_thresh

    edge_band = (dist_in <= edge_depth) & (dist_in > 0) & smooth_mask
    interior_band = (dist_in > edge_depth) & (dist_in <= edge_depth + interior_depth) & smooth_mask

    valid_edge_count = int(np.count_nonzero(edge_band))
    valid_interior_count = int(np.count_nonzero(interior_band))

    if valid_edge_count < 100 or valid_interior_count < 100:
        return {"ratio": 1.0, "samples": 0, "surface_type": "unknown",
                "surface_confidence": 0.0, "r0": 1.0, "n_exponent": 0.0,
                "r_squared": 0.0}

    edge_mean = float(gray_f[edge_band].mean())
    interior_mean = float(gray_f[interior_band].mean()) + 1e-9
    with np.errstate(divide="ignore", invalid="ignore"):
        ratio = edge_mean / interior_mean

    surface_type, surface_conf = _classify_surface_type(
        img, dist_in, edge_depth, interior_depth, smooth_mask
    )
    r0, n_exp, r_squared, n_pts = _fit_fresnel_curve(
        gray_f, dist_in, edge_depth, interior_depth, smooth_mask
    )

    return {
        "ratio": float(ratio),
        "samples": valid_edge_count,
        "surface_type": surface_type,
        "surface_confidence": round(surface_conf, 3),
        "r0": round(r0, 3),
        "n_exponent": n_exp,
        "r_squared": round(r_squared, 3),
        "fit_points": n_pts,
    }


def _compute_multiscale_roughness(
    gray: np.ndarray,
    edge_mask: np.ndarray,
    cfg: dict,
) -> Dict[str, Any]:
    r"""
    Roughness (Laplacian std in an edge band) at scales 1/2/4/8 px, via
    increasing structuring-element radius rather than a literal wavelet
    decomposition (cheaper, and behaviourally equivalent for "does the
    micro-roughness spectrum fall off like a real edge's" purposes — flagged
    as a simplification of the spec's wavelet-decomposition wording).

    Real edges: roughness varies meaningfully across scales in a roughly
    monotonic, power-law-like way (self-similar micro-structure). AI edges:
    roughness stays low and nearly flat across all scales (no real structure
    at any scale to reveal).
    """
    scales = (1, 2, 4, 8)
    lap = cv2.Laplacian(gray, cv2.CV_32F)
    edge_u8 = edge_mask.astype(np.uint8)

    per_scale: Dict[int, float] = {}
    for s in scales:
        k = cv2.getStructuringElement(cv2.MORPH_CROSS, (s * 2 + 1, s * 2 + 1))
        dilated = cv2.dilate(edge_u8, k)
        eroded = cv2.erode(edge_u8, k)
        band = dilated ^ eroded
        if band.sum() < 50:
            continue
        per_scale[s] = float(lap[band > 0].std())

    if len(per_scale) < 2:
        finest = per_scale.get(1, 0.0)
        return {"per_scale": per_scale, "mean_roughness": finest,
                "cv": 0.0, "log_log_r_squared": 0.0}

    values = np.array(list(per_scale.values()))
    mean_roughness = float(values.mean())
    cv_val = float(values.std() / (values.mean() + 1e-6))

    log_scales = np.log(np.array(list(per_scale.keys()), dtype=np.float64))
    log_vals = np.log(np.clip(values, 1e-6, None))
    if len(log_scales) >= 2 and log_scales.std() > 0:
        slope, intercept = np.polyfit(log_scales, log_vals, 1)
        pred = slope * log_scales + intercept
        ss_res = float(np.sum((log_vals - pred) ** 2))
        ss_tot = float(np.sum((log_vals - log_vals.mean()) ** 2)) + 1e-9
        r_squared = float(np.clip(1.0 - ss_res / ss_tot, 0.0, 1.0))
    else:
        r_squared = 0.0

    return {"per_scale": per_scale, "mean_roughness": mean_roughness,
            "cv": cv_val, "log_log_r_squared": r_squared}


def _measure_chromatic_edge_misalignment(
    img: np.ndarray,
    edge_mask: np.ndarray,
    cfg: dict,
    max_samples: int = 150,
) -> Tuple[float, int]:
    r"""
    Estimate sub-pixel R/B channel edge misalignment (chromatic aberration).

    Real lenses focus different wavelengths at slightly different points,
    so R and B channel edges are offset by a small sub-pixel amount at
    high-contrast boundaries. AI generators produce perfectly channel-
    aligned edges. We estimate the shift via phase correlation between R
    and B gradient-magnitude patches centred on a subsample of edge points.

    Phase correlation is degenerate along a perfectly straight edge (the
    classic aperture problem: sliding a patch along the edge direction
    doesn't change it, so any shift along that axis "matches" equally well,
    producing spurious large results). Synthetic flat-color test images are
    made of nothing but straight edges and hit this constantly; real photos
    hit it far less often but not never. We guard against it by requiring
    genuine 2-D corner-like structure in the patch (via the Harris/Shi-Tomasi
    structure-tensor eigenvalue ratio) before trusting a phase-correlation
    result, rather than trusting every high-"response" match.

    Returns (median_shift_px, n_samples_used).
    """
    ys, xs = np.nonzero(edge_mask)
    if ys.size == 0:
        return 0.0, 0

    if ys.size > max_samples:
        idx = np.random.RandomState(0).choice(ys.size, max_samples, replace=False)
        ys, xs = ys[idx], xs[idx]

    r_f = img[:, :, 0].astype(np.float32)
    b_f = img[:, :, 2].astype(np.float32)
    gr = cv2.magnitude(cv2.Sobel(r_f, cv2.CV_32F, 1, 0, ksize=3),
                        cv2.Sobel(r_f, cv2.CV_32F, 0, 1, ksize=3))
    gb = cv2.magnitude(cv2.Sobel(b_f, cv2.CV_32F, 1, 0, ksize=3),
                        cv2.Sobel(b_f, cv2.CV_32F, 0, 1, ksize=3))

    gray_f = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float32)

    h, w = img.shape[:2]
    half = 8
    max_plausible_shift = 3.0  # px; beyond this a result is treated as noise, not signal
    shifts = []
    for y, x in zip(ys, xs):
        y0, y1 = y - half, y + half
        x0, x1 = x - half, x + half
        if y0 < 0 or x0 < 0 or y1 >= h or x1 >= w:
            continue
        patch_r = gr[y0:y1, x0:x1]
        patch_b = gb[y0:y1, x0:x1]
        if patch_r.std() < 1e-3 or patch_b.std() < 1e-3:
            continue

        # Corner-like structure check: reject patches that are just one
        # straight edge (aperture-problem-prone) before trusting the
        # correlation result.
        patch_gray = gray_f[y0:y1, x0:x1]
        gx = cv2.Sobel(patch_gray, cv2.CV_32F, 1, 0, ksize=3)
        gy = cv2.Sobel(patch_gray, cv2.CV_32F, 0, 1, ksize=3)
        sxx, syy, sxy = float(np.sum(gx * gx)), float(np.sum(gy * gy)), float(np.sum(gx * gy))
        trace = sxx + syy
        if trace < 1e-6:
            continue
        det = sxx * syy - sxy * sxy
        # Eigenvalues of the 2x2 structure tensor
        disc = max(trace * trace - 4.0 * det, 0.0)
        lam1 = (trace + math.sqrt(disc)) / 2.0
        lam2 = (trace - math.sqrt(disc)) / 2.0
        if lam1 < 1e-6 or (lam2 / lam1) < 0.12:
            continue  # too edge-like / 1-D, skip (aperture problem)

        try:
            (dx, dy), response = cv2.phaseCorrelate(patch_r, patch_b)
        except cv2.error:
            continue
        if response < 0.1:
            continue
        shift = math.hypot(dx, dy)
        if shift > max_plausible_shift:
            continue
        shifts.append(shift)

    if not shifts:
        return 0.0, 0
    return float(np.median(shifts)), len(shifts)


# ── L15 Public API ───────────────────────────────────────────────────────────


def analyze_obp(
    img: np.ndarray,
    img_pil: Any = None,
) -> Dict[str, Any]:
    r"""
    Layer 15: Object Boundary Physics (OBP) — Module 6 upgrade.

    Five signals (up from three):

    1. **Multi-direction contact shadows** — sampled in an estimated gravity
       direction (from vertical-line clustering, not a fixed "down"
       assumption) plus 3 other directions, with a directional-consistency
       check: real grounding shadows should be strongest in the gravity
       direction specifically.
    2. **Shadow penumbra width** — transition width of the shadow gradient;
       a literal zero-width cutoff is a vector-edge/AI-like signature.
    3. **Edge Fresnel, BRDF-classified** — surface classified as
       dielectric/conductor/translucent, then a Schlick-family reflectance
       curve is fit against a distance-from-boundary grazing-angle proxy
       (see module docstring for the "proxy angle, not measured angle"
       caveat); fit quality and R0 feed the score alongside the original
       edge/interior ratio.
    4. **Multi-scale edge roughness** — Laplacian-std roughness at 1/2/4/8 px
       scales instead of one fixed scale, plus a log-log power-law fit
       quality diagnostic.
    5. **Chromatic edge misalignment** — sub-pixel R/B edge shift via phase
       correlation; real lenses show a small nonzero shift, AI edges tend
       toward perfect channel alignment.

    Performance target: kept under the existing 400 ms test budget; the new
    per-boundary-point sampling is capped at 1500 contour points and the
    chromatic-shift check at 150 sampled edge points specifically to hold
    that budget on large images.
    """
    t0 = time.monotonic()
    layer_num = 15
    layer_name = "Object Boundary Physics"

    # ── Input validation ─────────────────────────────────────────────────
    if img is None or not isinstance(img, np.ndarray):
        return build_layer_report(
            layer_num, layer_name, [], "failure", 0, score=0.5
        )
    if img.ndim != 3 or img.shape[2] != 3:
        return build_layer_report(
            layer_num, layer_name, [], "failure", 0, score=0.5
        )
    if img.dtype != np.uint8:
        try:
            img = np.clip(img, 0, 255).astype(np.uint8)
        except Exception:
            return build_layer_report(
                layer_num, layer_name, [], "failure", 0, score=0.5
            )

    try:
        cfg = _load_thresholds("l15_obp")
        if not cfg:
            logger.warning("[OBP] Empty threshold config; using safe defaults.")

        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        gray_f = gray.astype(np.float32)

        canny_low = int(cfg.get("canny_low_threshold", 50))
        canny_high = int(cfg.get("canny_high_threshold", 150))
        edge_mask = cv2.Canny(gray, canny_low, canny_high) > 0

        mask = _create_object_mask(img, cfg)

        min_area = int(cfg.get("contour_filters", {}).get("min_object_area", 400))
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
            mask, connectivity=8
        )
        area_lut = np.zeros(num_labels, dtype=np.uint8)
        for i in range(1, num_labels):
            area_lut[i] = 255 if stats[i, cv2.CC_STAT_AREA] >= min_area else 0
        mask = area_lut[labels].astype(np.uint8) * 255

        if mask.sum() < min_area:
            elapsed = int((time.monotonic() - t0) * 1000)
            ev = _build_evidence_node(
                layer_num, "no_significant_objects", "inconclusive",
                0.0, "No significant objects detected for boundary analysis", 0.0
            )
            return build_layer_report(
                layer_num, layer_name, [ev], "success", elapsed, score=0.5
            )

        evidence: List[dict] = []

        # ── Signal 1+2: Multi-direction contact shadow + penumbra ────────
        cs_cfg = cfg.get("contact_shadow", {})
        shadow_info = _sample_multi_direction_shadows(gray_f, mask, cs_cfg)
        cs_ratio = shadow_info["gravity_ratio"]
        cs_samples = shadow_info["per_direction"]["gravity"]["samples"]

        cs_real = _safe_float(cs_cfg.get("real_threshold", 0.85))
        cs_ai = _safe_float(cs_cfg.get("ai_threshold", 0.70))
        cs_suspicion = _score_from_metric(cs_ratio, cs_real, cs_ai)

        # Directional-consistency penalty: a stronger "shadow" signal in a
        # non-gravity direction than in the gravity direction is atypical
        # of a genuine contact shadow.
        if shadow_info["directional_consistency"] is False:
            cs_suspicion = float(np.clip(cs_suspicion + 0.15, 0.0, 1.0))

        cs_status, cs_conf = _map_suspicion_to_status_confidence(cs_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "contact_shadow_ratio", cs_status, cs_conf,
            f"Contact shadow ratio={cs_ratio:.3f} (n={cs_samples}, "
            f"gravity_conf={shadow_info['gravity_confidence']:.2f}, "
            f"max_other_dir={shadow_info['max_other_ratio']:.3f}). "
            f"Sampled in estimated gravity direction + 3 others.",
            cs_ratio,
        ))

        penumbra_cfg = cfg.get("shadow_penumbra", {})
        penumbra_px = shadow_info["penumbra_px"]
        pen_real = _safe_float(penumbra_cfg.get("real_threshold", 1.2))
        pen_ai = _safe_float(penumbra_cfg.get("ai_threshold", 0.2))
        # Only score penumbra when a contact shadow was actually found;
        # penumbra width is meaningless without a shadow to measure.
        if cs_ratio > 0.3 and cs_samples > 0:
            pen_suspicion = _score_from_metric(penumbra_px, pen_real, pen_ai)
            pen_status, pen_conf = _map_suspicion_to_status_confidence(pen_suspicion)
            evidence.append(_build_evidence_node(
                layer_num, "shadow_penumbra_width", pen_status, pen_conf,
                f"Penumbra transition width={penumbra_px:.2f}px. Sharp/zero-width "
                f"cutoffs are atypical of physically cast shadows.",
                penumbra_px,
            ))
        else:
            pen_suspicion = 0.5

        # ── Signal 3: BRDF-classified edge Fresnel ────────────────────────
        fres_cfg = cfg.get("edge_fresnel", {})
        fres = _compute_edge_fresnel_v2(img, gray, mask, fres_cfg)

        fres_real = _safe_float(fres_cfg.get("real_threshold", 1.20))
        fres_ai = _safe_float(fres_cfg.get("ai_threshold", 1.00))
        fres_ratio_suspicion = _score_from_metric(fres["ratio"], fres_real, fres_ai)

        # Fit-quality modifier: a well-fit Schlick curve with real
        # brightening (R0 meaningfully < 1) supports "real"; a degenerate
        # fit (R0≈1, i.e. no grazing brightening at all) supports "AI".
        # Only applied when we had enough profile points to fit meaningfully.
        if fres.get("fit_points", 0) >= 4:
            if fres["r0"] > 0.92 and fres["r_squared"] < 0.3:
                fit_suspicion = 0.75
            elif fres["r0"] < 0.85 and fres["r_squared"] > 0.5:
                fit_suspicion = 0.20
            else:
                fit_suspicion = 0.5
            fres_suspicion = float(np.clip(0.6 * fres_ratio_suspicion + 0.4 * fit_suspicion, 0.0, 1.0))
        else:
            fres_suspicion = fres_ratio_suspicion

        fres_status, fres_conf = _map_suspicion_to_status_confidence(fres_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "edge_fresnel_ratio", fres_status, fres_conf,
            f"Edge Fresnel ratio={fres['ratio']:.3f} (n={fres['samples']}), "
            f"surface={fres['surface_type']}({fres['surface_confidence']:.2f}), "
            f"R0={fres['r0']:.2f} n={fres['n_exponent']:.1f} "
            f"fit_R2={fres['r_squared']:.2f}.",
            fres["ratio"],
        ))

        # ── Signal 4: Multi-scale + chromatic edge roughness ─────────────
        rough_cfg = cfg.get("edge_roughness", {})
        multiscale = _compute_multiscale_roughness(gray, edge_mask, rough_cfg)

        rough_real = _safe_float(rough_cfg.get("real_threshold", 18.0))
        rough_ai = _safe_float(rough_cfg.get("ai_threshold", 7.0))
        rough_suspicion = _score_from_metric(multiscale["mean_roughness"], rough_real, rough_ai)

        # Flat-spectrum modifier: low cross-scale variability alongside low
        # absolute roughness reinforces "no real micro-structure at any
        # scale" beyond what the single-scale magnitude already says.
        if multiscale["mean_roughness"] < rough_ai and multiscale["cv"] < 0.15:
            rough_suspicion = float(np.clip(rough_suspicion + 0.1, 0.0, 1.0))

        rough_status, rough_conf = _map_suspicion_to_status_confidence(rough_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "edge_roughness", rough_status, rough_conf,
            f"Multi-scale roughness mean={multiscale['mean_roughness']:.2f} "
            f"cv={multiscale['cv']:.2f} log-log_R2={multiscale['log_log_r_squared']:.2f} "
            f"scales={list(multiscale['per_scale'].keys())}.",
            multiscale["mean_roughness"],
        ))

        chroma_cfg = cfg.get("chromatic_roughness", {})
        chroma_shift, chroma_n = _measure_chromatic_edge_misalignment(img, edge_mask, chroma_cfg)
        if chroma_n >= 8:
            chroma_real = _safe_float(chroma_cfg.get("real_threshold", 0.15))
            chroma_ai = _safe_float(chroma_cfg.get("ai_threshold", 0.03))
            chroma_suspicion = _score_from_metric(chroma_shift, chroma_real, chroma_ai)
            chroma_status, chroma_conf = _map_suspicion_to_status_confidence(chroma_suspicion)
            evidence.append(_build_evidence_node(
                layer_num, "chromatic_edge_misalignment", chroma_status, chroma_conf,
                f"Median R/B edge shift={chroma_shift:.3f}px (n={chroma_n}). Real "
                f"lenses show a small nonzero chromatic-aberration shift.",
                chroma_shift,
            ))
        else:
            chroma_suspicion = 0.5

        # ── Composite Fusion ─────────────────────────────────────────────
        scores = [cs_suspicion, pen_suspicion, fres_suspicion, rough_suspicion, chroma_suspicion]
        weights = [1.2, 0.5, 1.0, 0.9, 0.6]

        active = [(s, w) for s, w in zip(scores, weights) if s != 0.5]
        if active:
            composite = sum(s * w for s, w in active) / sum(w for _, w in active)
        else:
            composite = 0.5

        elapsed = int((time.monotonic() - t0) * 1000)
        return build_layer_report(
            layer_num, layer_name, evidence, "success", elapsed,
            score=round(float(np.clip(composite, 0.0, 1.0)), 4)
        )

    except Exception as exc:
        logger.warning("[OBP] Analysis failed: %s", exc, exc_info=True)
        elapsed = int((time.monotonic() - t0) * 1000)
        return build_layer_report(
            layer_num, layer_name, [], "failure", elapsed, score=0.5
        )


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — L16: MATERIAL REFLECTANCE CONSISTENCY (MRC)
# ═══════════════════════════════════════════════════════════════════════════════


def _signal_specular_uniformity(
    gray: np.ndarray,
    hsv: np.ndarray,
    img: np.ndarray,
    cfg: dict,
) -> Tuple[float, int, str]:
    r"""
    Signal 1 — Specular Highlight Realism (Module 7 upgrade).

    Keeps the original circularity + intensity-variance proxies (still a
    valid, cheap first pass) and adds two more, per the L16 spec:

    **Roughness ("alpha") proxy via radial falloff.**
    True Beckmann/SGGX roughness-parameter fitting needs the light, view and
    surface-normal directions, which a single 2-D image doesn't give us. We
    use a defensible proxy instead: the radius of gyration of each
    highlight's intensity profile,

    .. math::
        \sigma \approx \sqrt{\frac{\sum_i I_i r_i^2}{\sum_i I_i}}

    normalized by the highlight's equivalent radius. A tight, steep falloff
    (small normalized sigma) reads as a polished/low-roughness lobe; a
    broad, gradual falloff reads as a rougher/matte lobe. This is a radial
    spread statistic, not a fitted microfacet parameter — flagged as such.
    We flag near-identical alpha proxies across multiple, differently
    colored highlight regions as suspicious (spec: "AI: alpha is often
    uniform across materials").

    **Anisotropy consistency.**
    Fit an ellipse to each highlight region and compare its elongation and
    orientation against the dominant local texture orientation of the
    surrounding body region (via the 2x2 gradient structure tensor). A
    material with strong directional texture (e.g. brushed metal) but an
    isotropic (round) or misaligned highlight is a plausible AI tell per
    spec; a material with weak/no directional texture gives no reliable
    signal either way and is treated as neutral, not scored.

    Returns
    -------
    Tuple[float, int, str]
        (uniformity_suspicion, region_count, detail_string).
    """
    v = hsv[:, :, 2].astype(np.float32)
    p = int(cfg.get("highlight_percentile", 92))
    thresh = float(np.percentile(v, p))
    highlight_mask = v > thresh

    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    highlight_mask = cv2.morphologyEx(highlight_mask.astype(np.uint8), cv2.MORPH_OPEN, k)
    highlight_mask = cv2.morphologyEx(highlight_mask, cv2.MORPH_CLOSE, k)
    highlight_mask = highlight_mask > 0

    if highlight_mask.sum() < 50:
        return 0.5, 0, "no_highlights_detected"

    contours, _ = cv2.findContours(
        highlight_mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )

    min_area = int(cfg.get("min_highlight_area", 25))
    max_regions = int(cfg.get("max_highlight_regions", 15))

    circularities: List[float] = []
    variances: List[float] = []
    alpha_proxies: List[float] = []
    anisotropy_mismatches: List[bool] = []
    anisotropy_evaluated = 0
    gray_f = gray.astype(np.float32)

    for cnt in contours[:max_regions]:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue
        peri = cv2.arcLength(cnt, True)
        if peri < 3.0:
            continue
        circ = (4.0 * np.pi * area) / (peri ** 2)
        circularities.append(float(min(circ, 1.0)))

        region_mask = np.zeros(gray.shape, dtype=np.uint8)
        cv2.drawContours(region_mask, [cnt], -1, 255, -1)
        vals = gray[region_mask > 0]
        if vals.size > 0:
            variances.append(float(vals.var()))

        # ── Alpha (roughness) proxy: radius of gyration of the intensity
        # profile in a window around the highlight, normalized by its
        # equivalent radius.
        M = cv2.moments(cnt)
        if M["m00"] > 0:
            cx, cy = M["m10"] / M["m00"], M["m01"] / M["m00"]
            eq_radius = math.sqrt(area / math.pi)
            win = int(max(8, eq_radius * 3))
            y0, y1 = int(max(0, cy - win)), int(min(gray.shape[0], cy + win))
            x0, x1 = int(max(0, cx - win)), int(min(gray.shape[1], cx + win))
            if y1 - y0 > 4 and x1 - x0 > 4:
                patch = gray_f[y0:y1, x0:x1]
                yy, xx = np.mgrid[y0:y1, x0:x1]
                rr2 = (xx - cx) ** 2 + (yy - cy) ** 2
                w_i = np.clip(patch - float(np.percentile(patch, 20)), 0, None)
                total_w = float(w_i.sum())
                if total_w > 1e-6 and eq_radius > 0.5:
                    sigma = math.sqrt(float((w_i * rr2).sum()) / total_w)
                    alpha_proxies.append(sigma / eq_radius)

        # ── Anisotropy consistency check
        if len(cnt) >= 5:
            try:
                (ecx, ecy), (ma, MA), h_angle = cv2.fitEllipse(cnt)
            except cv2.error:
                ma = MA = h_angle = None
            if ma is not None and ma > 0.5:
                aspect = MA / ma
                # Body/texture region: ring around the highlight, excluding it.
                ring_outer = int(max(6, eq_radius * 4)) if M["m00"] > 0 else 15
                ry0, ry1 = int(max(0, cy - ring_outer)), int(min(gray.shape[0], cy + ring_outer))
                rx0, rx1 = int(max(0, cx - ring_outer)), int(min(gray.shape[1], cx + ring_outer))
                if ry1 - ry0 > 6 and rx1 - rx0 > 6:
                    ring_gray = gray_f[ry0:ry1, rx0:rx1]
                    ring_hl = highlight_mask[ry0:ry1, rx0:rx1]
                    gx = cv2.Sobel(ring_gray, cv2.CV_32F, 1, 0, ksize=3)
                    gy = cv2.Sobel(ring_gray, cv2.CV_32F, 0, 1, ksize=3)
                    body = ~ring_hl
                    if body.sum() >= 40:
                        sxx = float(np.sum(gx[body] ** 2))
                        syy = float(np.sum(gy[body] ** 2))
                        sxy = float(np.sum(gx[body] * gy[body]))
                        trace = sxx + syy
                        if trace > 1e-6:
                            det = sxx * syy - sxy * sxy
                            disc = max(trace * trace - 4.0 * det, 0.0)
                            lam1 = (trace + math.sqrt(disc)) / 2.0
                            lam2 = (trace - math.sqrt(disc)) / 2.0
                            coherence = (lam1 - lam2) / (lam1 + lam2 + 1e-9)
                            if coherence > 0.30:
                                # Dominant texture orientation from the structure tensor
                                tex_angle_rad = 0.5 * math.atan2(2 * sxy, sxx - syy)
                                tex_angle_deg = math.degrees(tex_angle_rad) % 180.0
                                anisotropy_evaluated += 1
                                if aspect < 1.3:
                                    # Directional texture present but highlight stayed round
                                    anisotropy_mismatches.append(True)
                                else:
                                    ang_diff = abs(((h_angle - tex_angle_deg) + 90.0) % 180.0 - 90.0)
                                    anisotropy_mismatches.append(ang_diff > 35.0)

    if not circularities:
        return 0.5, 0, "no_valid_highlight_regions"

    mean_circ = float(np.mean(circularities))
    mean_var = float(np.mean(variances)) if variances else 0.0

    var_real = _safe_float(cfg.get("highlight_var_real_threshold", 250.0))
    var_ai = _safe_float(cfg.get("highlight_var_ai_threshold", 60.0))
    var_suspicion = _score_from_metric(mean_var, var_real, var_ai)

    circ_real = _safe_float(cfg.get("highlight_circularity_real_threshold", 0.40))
    circ_ai = _safe_float(cfg.get("highlight_circularity_ai_threshold", 0.75))
    circ_suspicion = _score_from_metric(mean_circ, circ_real, circ_ai)

    uniformity = 0.6 * circ_suspicion + 0.4 * var_suspicion

    # Alpha-uniformity modifier: multiple highlights with near-identical
    # roughness proxy despite being distinct regions is a mild AI tell.
    alpha_note = "n/a"
    if len(alpha_proxies) >= 2:
        alpha_arr = np.array(alpha_proxies)
        alpha_cv = float(alpha_arr.std() / (alpha_arr.mean() + 1e-6))
        alpha_note = f"cv={alpha_cv:.2f}"
        if alpha_cv < 0.08:
            uniformity = float(np.clip(uniformity + 0.10, 0.0, 1.0))

    # Anisotropy-mismatch modifier
    aniso_note = "n/a"
    if anisotropy_evaluated > 0:
        mismatch_frac = sum(anisotropy_mismatches) / anisotropy_evaluated
        aniso_note = f"mismatch_frac={mismatch_frac:.2f}(n={anisotropy_evaluated})"
        if mismatch_frac >= 0.5:
            uniformity = float(np.clip(uniformity + 0.12, 0.0, 1.0))

    detail = (
        f"circ={mean_circ:.3f} var={mean_var:.1f} n={len(circularities)} "
        f"alpha_{alpha_note} aniso_{aniso_note}"
    )
    return float(np.clip(uniformity, 0.0, 1.0)), len(circularities), detail


def _fit_dichromatic_model(
    rgb_pixels: np.ndarray,
    body_color: np.ndarray,
    interface_color: np.ndarray,
) -> Tuple[float, float]:
    r"""
    Least-squares fit of C = m_d*C_b + m_s*C_i per pixel, with proper
    non-negativity constraints (2-variable active-set NNLS, not a solve-
    then-clip approximation — see note below), reported as an aggregate
    goodness-of-fit.

    Returns
    -------
    (r_squared_2component, mean_m_s)
        r_squared_2component compares the 2-component (body + interface)
        model's residual against a null 1-component (body-only) model —
        i.e. "does adding an interface-color term actually explain more
        of the pixel variance", not an absolute fit quality.

        Caveat: this R^2 has a mild one-sided optimism bias even under a
        genuinely body-only (m_s=0) null, because the extra non-negative
        free parameter can still fit some of the residual noise (it can
        only help, never hurt, versus forcing m_s=0). Empirically this
        showed up as roughly R^2~0.25 on a synthetic pure-body-color test
        with realistic pixel noise, not exactly 0 as a naive reading of
        "no interface term" would suggest. Treated here as a threshold-
        calibration caveat (the real_threshold used downstream is set
        above that empirical noise floor), not a fixed bug — a proper
        fix would need a permutation test or F-test p-value, which is out
        of scope for this pass.
    """
    cb = body_color.astype(np.float64)
    ci = interface_color.astype(np.float64)
    pixels = rgb_pixels.astype(np.float64)

    # Solve the 2x2 normal equations per pixel batch (vectorized):
    # [cb.cb  cb.ci] [m_d]   [pixel.cb]
    # [cb.ci  ci.ci] [m_s] = [pixel.ci]
    a11 = float(np.dot(cb, cb)) + 1e-9
    a22 = float(np.dot(ci, ci)) + 1e-9
    a12 = float(np.dot(cb, ci))
    det = a11 * a22 - a12 * a12

    b1 = pixels @ cb
    b2 = pixels @ ci

    if abs(det) < 1e-6:
        return 0.0, 0.0

    m_d = (b1 * a22 - b2 * a12) / det
    m_s = (b2 * a11 - b1 * a12) / det

    # Naively clipping a negative unconstrained solution to 0 is NOT the
    # least-squares-optimal non-negative solution and can fit worse than
    # the null (body-only) model, corrupting R^2 into meaningless negative
    # values. The correct closed-form 2-variable NNLS solution: when the
    # unconstrained solution has exactly one negative component, the
    # constrained optimum sets that component to 0 and re-solves the
    # other as a 1-D least-squares fit (standard active-set result for a
    # 2-variable NNLS problem); when both are negative, both are 0.
    neg_d = m_d < 0
    neg_s = m_s < 0
    only_d_neg = neg_d & ~neg_s
    only_s_neg = neg_s & ~neg_d
    both_neg = neg_d & neg_s

    m_d = m_d.copy()
    m_s = m_s.copy()
    m_d[only_d_neg] = 0.0
    m_s[only_d_neg] = np.clip(b2[only_d_neg] / a22, 0.0, None)
    m_s[only_s_neg] = 0.0
    m_d[only_s_neg] = np.clip(b1[only_s_neg] / a11, 0.0, None)
    m_d[both_neg] = 0.0
    m_s[both_neg] = 0.0

    model_2c = m_d[:, None] * cb[None, :] + m_s[:, None] * ci[None, :]
    resid_2c = float(np.sum((pixels - model_2c) ** 2))

    # Null model: body-only (m_s forced to 0), best-fit scalar m_d
    m_d0 = np.clip(b1 / a11, 0.0, None)
    model_1c = m_d0[:, None] * cb[None, :]
    resid_1c = float(np.sum((pixels - model_1c) ** 2)) + 1e-9

    r_squared = float(np.clip(1.0 - resid_2c / resid_1c, 0.0, 1.0))
    return r_squared, float(np.mean(m_s))


def _signal_metallic_correlation(
    img: np.ndarray,
    hsv: np.ndarray,
    cfg: dict,
) -> Tuple[float, int, str]:
    r"""
    Signal 2 — Metallic Colour Consistency (Module 7 upgrade).

    Keeps the original V-S correlation and body/highlight cosine-similarity
    proxies, and adds:

    **Per-pixel dichromatic model fit.** Using the body color (mid-brightness
    metal pixels) and interface color (brightest metal pixels) as the two
    basis colors, fit C = m_d*C_b + m_s*C_i per pixel and compare against a
    body-only null model (see `_fit_dichromatic_model`). A meaningfully
    better 2-component fit with a non-trivial specular contribution (m_s)
    supports "real dichromatic reflectance"; near-zero improvement suggests
    the highlight isn't actually behaving like a colored interface term.

    **Metallic Fresnel color shift.** Real metals (gold, copper) show a
    measurable hue shift between the object's center and its grazing edge
    (wavelength-dependent Fresnel reflectance); AI tends toward uniform
    color regardless of distance from center. Measured via mean hue in
    near-center vs near-edge distance bins of the metal mask.

    Returns
    -------
    Tuple[float, int, str]
        (correlation_score, pixel_count, detail).
        correlation_score in [0,1], 1 = strongly real.
    """
    s = hsv[:, :, 1].astype(np.float32)
    v = hsv[:, :, 2].astype(np.float32)
    h_channel = hsv[:, :, 0].astype(np.float32)

    sat_thresh = float(np.percentile(s, int(cfg.get("metal_saturation_percentile", 70))))
    metal_mask = (s > sat_thresh) & (v > int(cfg.get("metal_min_brightness", 40)))

    min_pixels = int(cfg.get("min_metal_pixels", 200))
    if metal_mask.sum() < min_pixels:
        return 0.5, 0, "no_metal_detected"

    v_metal = v[metal_mask]
    s_metal = s[metal_mask]

    if v_metal.std() < 1.0 or s_metal.std() < 1.0:
        vs_corr = 0.0
    else:
        with np.errstate(invalid="ignore"):
            vs_corr = float(np.corrcoef(v_metal, s_metal)[0, 1])

    vs_real = _safe_float(cfg.get("vs_corr_real_threshold", 0.20))
    vs_ai = _safe_float(cfg.get("vs_corr_ai_threshold", -0.25))
    vs_suspicion = _score_from_metric(vs_corr, vs_real, vs_ai)
    vs_realness = 1.0 - vs_suspicion

    rgb_metal = img[metal_mask].astype(np.float32)
    p40 = float(np.percentile(v_metal, 40))
    p80 = float(np.percentile(v_metal, 80))
    body_idx = (v_metal >= p40) & (v_metal <= p80)
    highlight_idx = v_metal >= p80

    rgb_corr = 0.5
    dichromatic_r2 = None
    mean_m_s = None
    if body_idx.sum() >= 10 and highlight_idx.sum() >= 5:
        body_rgb = rgb_metal[body_idx].mean(axis=0)
        highlight_rgb = rgb_metal[highlight_idx].mean(axis=0)

        body_n = body_rgb / (np.linalg.norm(body_rgb) + 1e-9)
        highlight_n = highlight_rgb / (np.linalg.norm(highlight_rgb) + 1e-9)
        cos_sim = float(np.dot(body_n, highlight_n))
        rgb_corr = (cos_sim + 1.0) / 2.0

        # NOTE: body_idx and highlight_idx can overlap substantially (e.g.
        # when v_metal has very low variance, the p40/p80 percentiles can
        # collapse together), so body_idx.sum() + highlight_idx.sum() is
        # NOT a reliable stand-in for the actual union population size —
        # using it as one previously caused choice() to be asked for more
        # samples than the true (smaller) union population. Compute the
        # union count directly instead.
        fit_candidates = rgb_metal[body_idx | highlight_idx]
        union_count = fit_candidates.shape[0]
        if union_count <= 20000:
            fit_pixels = fit_candidates
        else:
            idx_sub = np.random.RandomState(0).choice(union_count, 20000, replace=False)
            fit_pixels = fit_candidates[idx_sub]
        dichromatic_r2, mean_m_s = _fit_dichromatic_model(fit_pixels, body_rgb, highlight_rgb)

    rgb_real = _safe_float(cfg.get("rgb_corr_real_threshold", 0.70))
    rgb_ai = _safe_float(cfg.get("rgb_corr_ai_threshold", 0.35))
    rgb_suspicion = _score_from_metric(rgb_corr, rgb_real, rgb_ai)
    rgb_realness = 1.0 - rgb_suspicion

    correlation = 0.4 * vs_realness + 0.6 * rgb_realness

    # Dichromatic fit modifier: a well-explained 2-component model with a
    # genuine specular contribution nudges toward "real"; a fit that adds
    # nothing over body-only nudges toward "AI" (no coherent interface term).
    dichromatic_note = "n/a"
    if dichromatic_r2 is not None:
        dichromatic_note = f"r2={dichromatic_r2:.2f} m_s={mean_m_s:.3f}"
        # Thresholds set above the ~0.25 empirical noise floor found for a
        # synthetic pure-body-color null (see _fit_dichromatic_model note).
        if dichromatic_r2 > 0.40 and mean_m_s > 0.05:
            correlation = float(np.clip(correlation + 0.08, 0.0, 1.0))
        elif dichromatic_r2 < 0.03:
            correlation = float(np.clip(correlation - 0.08, 0.0, 1.0))

    # Metallic Fresnel color shift via distance-from-centroid hue bins.
    #
    # Hue is numerically unstable (essentially noise) for low-saturation
    # pixels, and `metal_mask`'s relative-percentile threshold can end up
    # very low on images where metal-like pixels are a small fraction of
    # the frame (admitting near-gray boundary/background pixels). Those
    # pixels' "hue" would otherwise dominate a spurious shift. Apply an
    # absolute saturation floor for this specific sub-signal only — it
    # doesn't affect the broader metal_mask used by the other proxies.
    fresnel_note = "n/a"
    sat_floor = _safe_float(cfg.get("fresnel_min_saturation", 50.0))
    hue_stable_mask = metal_mask & (s > sat_floor)
    ys, xs = np.nonzero(hue_stable_mask)
    if ys.size >= min_pixels:
        cy, cx = float(ys.mean()), float(xs.mean())
        dist = np.hypot(ys - cy, xs - cx)
        d_max = float(np.percentile(dist, 95)) + 1e-6
        norm_dist = dist / d_max
        inner = norm_dist < 0.33
        outer = (norm_dist > 0.66) & (norm_dist <= 1.0)
        if inner.sum() >= 30 and outer.sum() >= 30:
            hue_inner = h_channel[ys[inner], xs[inner]]
            hue_outer = h_channel[ys[outer], xs[outer]]
            # Circular mean hue difference (OpenCV hue range [0,179])
            def _circ_mean(h_vals: np.ndarray) -> float:
                rad = h_vals.astype(np.float64) * (2 * np.pi / 180.0)
                return float(np.degrees(np.arctan2(np.mean(np.sin(rad)), np.mean(np.cos(rad)))) % 180.0)
            hi, ho = _circ_mean(hue_inner), _circ_mean(hue_outer)
            hue_shift = abs(((hi - ho) + 90.0) % 180.0 - 90.0)
            fresnel_note = f"hue_shift={hue_shift:.1f}deg"
            fresnel_real = _safe_float(cfg.get("fresnel_hue_shift_real_threshold", 4.0))
            fresnel_ai = _safe_float(cfg.get("fresnel_hue_shift_ai_threshold", 0.8))
            fresnel_suspicion = _score_from_metric(hue_shift, fresnel_real, fresnel_ai)
            correlation = float(np.clip(correlation - 0.10 * (fresnel_suspicion - 0.5), 0.0, 1.0))

    detail = (
        f"vs_corr={vs_corr:.3f} rgb_corr={rgb_corr:.3f} n={int(metal_mask.sum())} "
        f"dichrom_{dichromatic_note} fresnel_{fresnel_note}"
    )
    return float(np.clip(correlation, 0.0, 1.0)), int(metal_mask.sum()), detail


def _measure_dispersion_shift(
    img: np.ndarray,
    edges: np.ndarray,
    inner_band: np.ndarray,
    max_samples: int = 100,
) -> Tuple[float, int]:
    r"""
    Chromatic dispersion at candidate transparent-boundary pixels: sub-pixel
    shift between R and B gradient patches, same structure-tensor-gated
    phase-correlation technique used for lens chromatic aberration in L15,
    scoped here to the transparency inner band specifically. Real glass/
    prism edges show "rainbow fringing" (nonzero, often larger than typical
    lens CA, dispersion shift); AI alpha-blended transparency shows uniform
    color fringing (near-zero channel-to-channel shift).

    We deliberately do NOT attempt refractive-index estimation from apparent
    background magnification: recovering a true index of refraction needs
    known reference geometry (a known undistorted background, camera pose,
    or stereo baseline) that a single flat RGB image doesn't provide.
    Claiming a fitted "n" here would be presenting a guess as a measurement.

    Returns (median_shift_px, n_samples_used).
    """
    ys, xs = np.nonzero(edges & inner_band)
    if ys.size == 0:
        return 0.0, 0
    if ys.size > max_samples:
        idx = np.random.RandomState(1).choice(ys.size, max_samples, replace=False)
        ys, xs = ys[idx], xs[idx]

    r_f = img[:, :, 0].astype(np.float32)
    b_f = img[:, :, 2].astype(np.float32)
    gray_f = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float32)
    gr = cv2.magnitude(cv2.Sobel(r_f, cv2.CV_32F, 1, 0, ksize=3),
                        cv2.Sobel(r_f, cv2.CV_32F, 0, 1, ksize=3))
    gb = cv2.magnitude(cv2.Sobel(b_f, cv2.CV_32F, 1, 0, ksize=3),
                        cv2.Sobel(b_f, cv2.CV_32F, 0, 1, ksize=3))

    h, w = img.shape[:2]
    half = 8
    max_plausible_shift = 4.0
    shifts = []
    for y, x in zip(ys, xs):
        y0, y1 = y - half, y + half
        x0, x1 = x - half, x + half
        if y0 < 0 or x0 < 0 or y1 >= h or x1 >= w:
            continue
        patch_r, patch_b = gr[y0:y1, x0:x1], gb[y0:y1, x0:x1]
        if patch_r.std() < 1e-3 or patch_b.std() < 1e-3:
            continue

        patch_gray = gray_f[y0:y1, x0:x1]
        gx = cv2.Sobel(patch_gray, cv2.CV_32F, 1, 0, ksize=3)
        gy = cv2.Sobel(patch_gray, cv2.CV_32F, 0, 1, ksize=3)
        sxx, syy, sxy = float(np.sum(gx * gx)), float(np.sum(gy * gy)), float(np.sum(gx * gy))
        trace = sxx + syy
        if trace < 1e-6:
            continue
        det = sxx * syy - sxy * sxy
        disc = max(trace * trace - 4.0 * det, 0.0)
        lam1 = (trace + math.sqrt(disc)) / 2.0
        lam2 = (trace - math.sqrt(disc)) / 2.0
        if lam1 < 1e-6 or (lam2 / lam1) < 0.12:
            continue

        try:
            (dx, dy), response = cv2.phaseCorrelate(patch_r, patch_b)
        except cv2.error:
            continue
        if response < 0.1:
            continue
        shift = math.hypot(dx, dy)
        if shift > max_plausible_shift:
            continue
        shifts.append(shift)

    if not shifts:
        return 0.0, 0
    return float(np.median(shifts)), len(shifts)


def _signal_transparency_distortion(
    img: np.ndarray,
    gray: np.ndarray,
    cfg: dict,
) -> Tuple[float, int, str]:
    r"""
    Signal 3 — Transparency & Glass Distortion Physics (Module 7 upgrade).

    Keeps the original edge-doubling ratio and gradient-orientation
    Bhattacharyya-coefficient distortion measure, and adds chromatic
    dispersion detection (see `_measure_dispersion_shift`). Deliberately
    does NOT add refractive-index estimation from apparent magnification —
    see that function's docstring for why it isn't physically recoverable
    from a single image here, flagged rather than faked.
    """
    edges = cv2.Canny(gray, 50, 150)
    edge_count = int(edges.sum() // 255)

    if edge_count < 100:
        return 0.5, 0, "too_few_edges"

    disk_r = int(cfg.get("transparency_disk_radius", 4))
    disk = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (disk_r * 2 + 1, disk_r * 2 + 1))
    edge_density = cv2.filter2D(edges.astype(np.float32), -1, disk.astype(np.float32))

    doubled_mask = (edges > 0) & (edge_density > 1.5)
    with np.errstate(divide="ignore", invalid="ignore"):
        doubling_ratio = float(doubled_mask.sum()) / float(max(edge_count, 1))

    dist = cv2.distanceTransform(255 - edges, cv2.DIST_L2, 5)

    sobelx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    orient = np.arctan2(sobely, sobelx)

    inner_band = (dist > 1) & (dist < 4)
    outer_band = (dist > 8) & (dist < 15)

    bc = 1.0
    if inner_band.sum() >= 100 and outer_band.sum() >= 100:
        n_bins = 12
        inner_hist, _ = np.histogram(orient[inner_band], bins=n_bins, range=(-np.pi, np.pi))
        outer_hist, _ = np.histogram(orient[outer_band], bins=n_bins, range=(-np.pi, np.pi))
        with np.errstate(divide="ignore", invalid="ignore"):
            inner_hist = inner_hist / (inner_hist.sum() + 1e-9)
            outer_hist = outer_hist / (outer_hist.sum() + 1e-9)
        bc = float(np.sum(np.sqrt(inner_hist * outer_hist)))

    bc_real = _safe_float(cfg.get("bc_real_threshold", 0.55))
    bc_ai = _safe_float(cfg.get("bc_ai_threshold", 0.88))

    if bc >= bc_ai:
        bc_realness = 0.0
    elif bc <= bc_real:
        bc_realness = 1.0
    else:
        bc_realness = (bc_ai - bc) / (bc_ai - bc_real)

    doubling_realness = float(np.clip(doubling_ratio * 3.0, 0.0, 1.0))

    w = _safe_float(cfg.get("doubling_weight", 0.5))
    distortion = w * doubling_realness + (1.0 - w) * bc_realness

    dispersion_note = "n/a"
    disp_cfg = cfg.get("chromatic_dispersion", {})
    disp_shift, disp_n = _measure_dispersion_shift(img, edges > 0, inner_band)
    if disp_n >= 6:
        disp_real = _safe_float(disp_cfg.get("real_threshold", 0.35))
        disp_ai = _safe_float(disp_cfg.get("ai_threshold", 0.05))
        disp_suspicion = _score_from_metric(disp_shift, disp_real, disp_ai)
        dispersion_note = f"shift={disp_shift:.3f}px(n={disp_n})"
        # Blend in gently — dispersion is a supplementary cue, not primary.
        distortion = float(np.clip(distortion + 0.15 * ((1.0 - disp_suspicion) - 0.5), 0.0, 1.0))

    detail = f"doubling={doubling_ratio:.3f} bc={bc:.3f} dispersion_{dispersion_note}"
    return float(np.clip(distortion, 0.0, 1.0)), edge_count, detail


def analyze_mrc(
    img: np.ndarray,
    img_pil: Any = None,
) -> Dict[str, Any]:
    r"""
    Layer 16: Material Reflectance Consistency (MRC) — Module 7 upgrade.

    Three signals, each enhanced beyond the original circularity/variance,
    V-S+cosine, and doubling/BC-only versions:

    1. **Specular highlight realism** — original circularity + variance,
       plus a radial-falloff roughness ("alpha") proxy and an anisotropy-
       vs-local-texture-orientation consistency check.
    2. **Metallic color correlation** — original V-S correlation + body/
       highlight cosine similarity, plus a per-pixel dichromatic model fit
       (C = m_d*C_b + m_s*C_i) and a metallic Fresnel hue-shift check
       (center vs edge).
    3. **Transparency distortion** — original edge-doubling + gradient-
       orientation Bhattacharyya distortion, plus a chromatic dispersion
       (rainbow-fringing) check. Refractive-index estimation from apparent
       magnification was deliberately not implemented — see
       `_measure_dispersion_shift` docstring for why a single RGB image
       doesn't support that measurement without known reference geometry.

    Input validation, performance envelope, and return schema are unchanged
    from the original implementation.
    """
    t0 = time.monotonic()
    layer_num = 16
    layer_name = "Material Reflectance Consistency"

    if img is None or not isinstance(img, np.ndarray):
        return build_layer_report(
            layer_num, layer_name, [], "failure", 0, score=0.5
        )
    if img.ndim != 3 or img.shape[2] != 3:
        return build_layer_report(
            layer_num, layer_name, [], "failure", 0, score=0.5
        )
    if img.dtype != np.uint8:
        try:
            img = np.clip(img, 0, 255).astype(np.uint8)
        except Exception:
            return build_layer_report(
                layer_num, layer_name, [], "failure", 0, score=0.5
            )

    try:
        cfg = _load_thresholds("l16_mrc")
        if not cfg:
            logger.warning("[MRC] Empty threshold config; using safe defaults.")

        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)

        evidence: List[dict] = []
        fw = cfg.get("fusion_weights", {})

        sig1_score, sig1_raw, sig1_detail = _signal_specular_uniformity(gray, hsv, img, cfg)
        s1_status, s1_conf = _map_suspicion_to_status_confidence(sig1_score)
        evidence.append(_build_evidence_node(
            layer_num, "specular_uniformity", s1_status, s1_conf,
            f"Highlight uniformity: {sig1_detail}. "
            f"Real highlights are irregular; AI renders perfect blobs.",
            sig1_score,
        ))

        sig2_score, sig2_raw, sig2_detail = _signal_metallic_correlation(img, hsv, cfg)
        sig2_suspicion = 1.0 - float(np.clip(sig2_score, 0.0, 1.0))
        s2_status, s2_conf = _map_suspicion_to_status_confidence(sig2_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "metallic_color_correlation", s2_status, s2_conf,
            f"Metallic correlation: {sig2_detail}. "
            f"Real metal preserves hue in highlights; AI whitewashes them.",
            sig2_score,
        ))

        sig3_score, sig3_raw, sig3_detail = _signal_transparency_distortion(img, gray, cfg)
        sig3_suspicion = 1.0 - float(np.clip(sig3_score, 0.0, 1.0))
        s3_status, s3_conf = _map_suspicion_to_status_confidence(sig3_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "transparency_distortion", s3_status, s3_conf,
            f"Transparency distortion: {sig3_detail}. "
            f"Real glass refracts and doubles edges; AI alpha-blends cleanly.",
            sig3_score,
        ))

        scores = [
            sig1_score,
            1.0 - float(np.clip(sig2_score, 0.0, 1.0)),
            1.0 - float(np.clip(sig3_score, 0.0, 1.0)),
        ]
        weights = [
            _safe_float(fw.get("specular_uniformity", 1.0)),
            _safe_float(fw.get("metallic_correlation", 1.0)),
            _safe_float(fw.get("transparency_distortion", 0.8)),
        ]

        active = [(s, w) for s, w in zip(scores, weights) if s != 0.5]
        if active:
            composite = sum(s * w for s, w in active) / sum(w for _, w in active)
        else:
            composite = 0.5

        elapsed = int((time.monotonic() - t0) * 1000)
        return build_layer_report(
            layer_num, layer_name, evidence, "success", elapsed,
            score=round(float(np.clip(composite, 0.0, 1.0)), 4)
        )

    except Exception as exc:
        logger.warning("[MRC] Analysis failed: %s", exc, exc_info=True)
        elapsed = int((time.monotonic() - t0) * 1000)
        return build_layer_report(
            layer_num, layer_name, [], "failure", elapsed, score=0.5
        )


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 3 — L17: 3D GEOMETRY & PERSPECTIVE CONSISTENCY (GPC)
# ═══════════════════════════════════════════════════════════════════════════════


def _is_neutral_scene(
    gray: np.ndarray,
    lines: np.ndarray,
    cfg: dict,
) -> Tuple[bool, str]:
    r"""
    Detect scenes where perspective analysis is not applicable.

    Heuristic Rules
    ---------------
    1. **Low edge density** — If Canny edge pixels / total pixels <
       ``edge_density_threshold``, the image is likely a macro shot, texture,
       or abstract gradient with no meaningful 3-D structure.
    2. **Insufficient line segments** — If ``len(lines) < min_lines_for_analysis``,
       there are too few straight edges to estimate vanishing points reliably.

    These are heuristics, not physical laws.  They reduce false positives on
    images where perspective geometry is genuinely absent.

    Parameters
    ----------
    gray : np.ndarray
        H×W uint8 grayscale image.
    lines : np.ndarray
        N×4 array of line segments from HoughLinesP [x1,y1,x2,y2].
    cfg : dict
        ``l17_gpc`` threshold block.

    Returns
    -------
    Tuple[bool, str]
        (is_neutral, reason).  ``is_neutral=True`` → skip perspective analysis.
    """
    edge_density = float((cv2.Canny(gray, 50, 150) > 0).sum()) / float(gray.size)
    thresh = _safe_float(cfg.get("edge_density_threshold", 0.008))
    if edge_density < thresh:
        return True, f"low_edge_density={edge_density:.4f}"

    min_lines = int(cfg.get("min_lines_for_analysis", 8))
    if lines is None or len(lines) < min_lines:
        return True, f"too_few_lines={0 if lines is None else len(lines)}"

    return False, ""


def _detect_scene_lines(
    gray: np.ndarray,
    cfg: dict,
) -> np.ndarray:
    r"""
    Detect straight line segments using the Probabilistic Hough Transform.

    Algorithm
    ---------
    1. Canny edge detection.
    2. ``cv2.HoughLinesP`` with configurable rho, theta, threshold,
       minLineLength, and maxLineGap.
    3. Filter to at most ``max_lines`` segments to keep runtime bounded.

    Complexity: :math:`O(E \cdot \theta_{bins})` where :math:`E` is edge-pixel
    count.  In practice < 30 ms on 512 px.

    Parameters
    ----------
    gray : np.ndarray
        H×W uint8 grayscale image.
    cfg : dict
        ``l17_gpc`` threshold block.

    Returns
    -------
    np.ndarray
        N×4 int32 array of segments [x1, y1, x2, y2].
        Empty array (shape (0,4)) if no lines found.
    """
    edges = cv2.Canny(
        gray,
        int(cfg.get("canny_low", 50)),
        int(cfg.get("canny_high", 150)),
    )

    theta_rad = np.deg2rad(float(cfg.get("hough_theta_deg", 1)))
    lines = cv2.HoughLinesP(
        edges,
        rho=float(cfg.get("hough_rho", 1)),
        theta=theta_rad,
        threshold=int(cfg.get("hough_threshold", 40)),
        minLineLength=int(cfg.get("hough_min_line_length", 40)),
        maxLineGap=int(cfg.get("hough_max_line_gap", 10)),
    )

    # Fix (2026-08-19 calibration run): cv2.HoughLinesP's return shape is
    # build-dependent — some OpenCV builds return (N,1,4), others (N,4).
    # `lines[:, 0, :]` crashed with IndexError on the latter (this layer
    # showed 0/100 active votes in the calibration report as a result).
    # normalize_hough_lines() handles both shapes safely.
    lines = normalize_hough_lines(lines)
    if len(lines) == 0:
        return np.empty((0, 4), dtype=np.int32)

    max_lines = int(cfg.get("max_lines", 200))
    if len(lines) > max_lines:
        # Keep longest lines (most reliable for VP estimation)
        lengths = np.hypot(lines[:, 2] - lines[:, 0], lines[:, 3] - lines[:, 1])
        idx = np.argsort(lengths)[-max_lines:]
        lines = lines[idx]

    return lines


def _line_to_normal_form(
    x1: float, y1: float, x2: float, y2: float
) -> Tuple[float, float, float]:
    r"""
    Convert a line segment to normalised implicit form :math:`ax + by + c = 0`
    with :math:`a^2 + b^2 = 1`.

    Parameters
    ----------
    x1, y1, x2, y2 : float
        Endpoints of the line segment.

    Returns
    -------
    Tuple[float, float, float]
        Normalised coefficients (a, b, c).
    """
    dx = x2 - x1
    dy = y2 - y1
    norm = math.hypot(dx, dy)
    if norm < 1e-9:
        return 0.0, 0.0, 0.0
    a = -dy / norm
    b = dx / norm
    c = -(a * x1 + b * y1)
    return a, b, c


def _cluster_lines_by_angle(
    lines: np.ndarray,
    cfg: dict,
) -> List[np.ndarray]:
    r"""
    Cluster line segments by orientation using a histogram over :math:`[0, \pi)`.

    Mathematical Reasoning
    ----------------------
    Parallel lines in 3-D share the same vanishing point.  In the image,
    their orientations are identical modulo :math:`\pi`.  By binning angles
    into ``angle_bins`` buckets and extracting contiguous peaks, we obtain
    dominant direction clusters.

    A line with angle :math:`\theta = \arctan2(dy, dx)` (mod :math:`\pi`)
    votes into bin :math:`b = \lfloor \theta \cdot B / \pi \rfloor`.
    Peaks with at least ``min_cluster_size`` lines are retained.

    Parameters
    ----------
    lines : np.ndarray
        N×4 array of segments.
    cfg : dict
        ``l17_gpc`` threshold block.

    Returns
    -------
    List[np.ndarray]
        List of boolean masks, one per cluster.
    """
    if len(lines) == 0:
        return []

    dx = lines[:, 2] - lines[:, 0]
    dy = lines[:, 3] - lines[:, 1]
    angles = np.arctan2(dy, dx) % np.pi  # [0, pi)

    n_bins = int(cfg.get("angle_bins", 8))
    hist, bin_edges = np.histogram(angles, bins=n_bins, range=(0.0, np.pi))

    min_size = int(cfg.get("min_cluster_size", 3))
    clusters = []

    for i in range(n_bins):
        if hist[i] < min_size:
            continue
        lo = bin_edges[i]
        hi = bin_edges[i + 1]
        mask = (angles >= lo) & (angles < hi)
        if mask.sum() >= min_size:
            clusters.append(mask)

    return clusters


def _compute_vanishing_point(
    lines: np.ndarray,
    mask: np.ndarray,
) -> Optional[Tuple[float, float, float]]:
    r"""
    Compute the vanishing point of a line cluster via least-squares intersection.

    Mathematical Model
    ------------------
    Each line is represented in normalised implicit form
    :math:`a_i x + b_i y + c_i = 0` with :math:`a_i^2 + b_i^2 = 1`.
    The point :math:`\mathbf{p} = (x, y)` that minimises the sum of squared
    orthogonal distances to all lines solves:

    .. math::
        \begin{bmatrix}
        \sum a_i^2 & \sum a_i b_i \\
        \sum a_i b_i & \sum b_i^2
        \end{bmatrix}
        \begin{bmatrix} x \\ y \end{bmatrix}
        =
        -\begin{bmatrix} \sum a_i c_i \\ \sum b_i c_i \end{bmatrix}

    This is a linear least-squares problem solvable via ``np.linalg.lstsq``.
    The residual (mean squared distance) measures how well the lines truly
    converge — low residual = consistent VP.

    Parameters
    ----------
    lines : np.ndarray
        N×4 array of all detected segments.
    mask : np.ndarray
        Boolean mask selecting the cluster subset.

    Returns
    -------
    Optional[Tuple[float, float, float]]
        (vp_x, vp_y, residual) or ``None`` if the system is ill-conditioned.
    """
    cluster = lines[mask]
    if len(cluster) < 3:
        return None

    A = []
    c_vec = []
    for (x1, y1, x2, y2) in cluster:
        a, b, c = _line_to_normal_form(float(x1), float(y1), float(x2), float(y2))
        if a == 0.0 and b == 0.0:
            continue
        A.append([a, b])
        c_vec.append(c)

    if len(A) < 3:
        return None

    A_mat = np.array(A, dtype=np.float64)
    c_mat = np.array(c_vec, dtype=np.float64)

    try:
        # Solve A * p = -c  in least-squares sense
        result = np.linalg.lstsq(A_mat, -c_mat, rcond=None)
        p = result[0]
        residual = float(result[1][0] / len(A)) if len(result[1]) > 0 else 0.0
        return float(p[0]), float(p[1]), residual
    except Exception:
        return None


def _compute_vanishing_point_ransac(
    lines: np.ndarray,
    mask: np.ndarray,
    cfg: dict,
    rng: np.random.Generator,
) -> Optional[Tuple[float, float, float, int, float, bool]]:
    r"""
    RANSAC-robustified vanishing point estimate for one orientation cluster.

    Mathematical Model
    -------------------
    Same normalised-implicit-line model as :func:`_compute_vanishing_point`,
    but instead of a single global least-squares solve (which one outlier
    line can drag arbitrarily far), we:

    1. Repeatedly sample 2 lines at random, solve their exact intersection
       (closed-form 2x2 linear system).
    2. Count "inliers" — lines whose perpendicular distance to that
       candidate point is below ``ransac_inlier_threshold_px``.
    3. Keep the candidate with the most inlier support.
    4. Refine the final point with an ordinary least-squares solve using
       *only* the inlier subset, and report the inlier residual.

    This directly targets the AI-generation failure mode the spec calls
    out: a handful of genuinely converging lines plus one or two stray
    lines that a plain LSQ fit — which minimises total squared error, not
    inlier count — would let dominate the fit and inflate the residual.

    Parameters
    ----------
    lines : np.ndarray
        N×4 array of all detected segments.
    mask : np.ndarray
        Boolean mask selecting the cluster subset.
    cfg : dict
        ``l17_gpc`` threshold block.
    rng : np.random.Generator
        Deterministic RNG (seeded once per ``analyze_gpc`` call) so results
        are reproducible run-to-run for the same image.

    Returns
    -------
    Optional[Tuple[float, float, float, int, float]]
        ``(vp_x, vp_y, residual, inlier_count, inlier_ratio)`` or ``None``
        if the cluster is too small to fit.
    """
    cluster = lines[mask]
    n = len(cluster)
    if n < 3:
        return None

    normals = []
    for (x1, y1, x2, y2) in cluster:
        a, b, c = _line_to_normal_form(float(x1), float(y1), float(x2), float(y2))
        if a == 0.0 and b == 0.0:
            continue
        normals.append((a, b, c))

    if len(normals) < 3:
        return None

    normals_arr = np.array(normals, dtype=np.float64)
    n_valid = len(normals_arr)
    inlier_thresh = _safe_float(cfg.get("ransac_inlier_threshold_px", 4.0))
    n_iter = int(cfg.get("ransac_iterations", 60))

    # ── Degeneracy check ─────────────────────────────────────────────────
    # Bug caught by functional smoke testing: when a cluster's lines are
    # (near-)exactly parallel in the image -- a common, perfectly ordinary
    # real-photo case (e.g. window rows on a wall shot straight-on) -- the
    # 2x2 normal-equations matrix A^T A is rank-deficient (every line
    # shares ~the same (a,b) normal direction). `np.linalg.lstsq` then
    # returns a minimum-norm solution for the *degenerate* direction (its
    # x-coordinate here is arbitrary, not a real intersection) and an
    # *empty* residual array, which an earlier version of this code read
    # as "residual=0.0", i.e. "perfect finite convergence" -- exactly
    # backwards: it's not that the lines converge tightly to a point, it's
    # that there is no meaningful finite point at all (the true vanishing
    # point is at infinity, which is the geometrically correct answer for
    # parallel lines and not suspicious). We detect this directly via the
    # condition number of A^T A rather than trusting the residual, and
    # treat it as maximal, well-founded consistency (all lines genuinely
    # agree with a single shared direction) rather than running it through
    # machinery built for a finite point that doesn't exist here.
    ata = normals_arr[:, :2].T @ normals_arr[:, :2]
    eigvals = np.linalg.eigvalsh(ata)
    degenerate = eigvals[0] < 1e-9 or (eigvals[0] / max(eigvals[-1], 1e-12)) < 1e-6
    if degenerate:
        # No finite point is well-defined (true VP at infinity). vp_x/vp_y
        # are not meaningful here -- callers must check the is_at_infinity
        # flag and not use the coordinates for distance-based logic.
        return 0.0, 0.0, 0.0, n_valid, 1.0, True

    best_inlier_mask = None
    best_count = -1

    idx_pool = np.arange(n_valid)
    for _ in range(n_iter):
        i, j = rng.choice(idx_pool, size=2, replace=False)
        a1, b1, c1 = normals_arr[i]
        a2, b2, c2 = normals_arr[j]
        det = a1 * b2 - a2 * b1
        if abs(det) < 1e-9:
            continue  # near-parallel sample pair -> unstable intersection

        px = (-c1 * b2 + c2 * b1) / det
        py = (-a1 * c2 + a2 * c1) / det

        dists = np.abs(normals_arr[:, 0] * px + normals_arr[:, 1] * py + normals_arr[:, 2])
        inlier_mask = dists < inlier_thresh
        count = int(inlier_mask.sum())

        if count > best_count:
            best_count = count
            best_inlier_mask = inlier_mask

    if best_inlier_mask is None or best_count < 3:
        # RANSAC's pairwise-sample-and-intersect step is *itself*
        # ill-conditioned when a cluster's lines are near-perfectly
        # parallel (every 2-line intersection has det ~ 0, so consensus
        # search systematically fails) -- this is exactly the case of a
        # genuinely well-behaved, highly-consistent real-photo direction
        # (e.g. a front-on wall), not a bad fit. Bug caught via functional
        # smoke test: an earlier version of this fallback unconditionally
        # returned inlier_count=0 here, which punished this common,
        # perfectly legitimate real-photo geometry as if it were
        # non-converging. Fix: fall back to the plain whole-cluster LSQ
        # fit, then *measure* inlier support against that fitted point
        # (rather than assuming zero) -- a genuinely consistent cluster
        # will still show high inlier support this way; a genuinely
        # scattered one will correctly show low support.
        fallback = _compute_vanishing_point(lines, mask)
        if fallback is None:
            return None
        vp_x, vp_y, residual = fallback
        dists = np.abs(normals_arr[:, 0] * vp_x + normals_arr[:, 1] * vp_y + normals_arr[:, 2])
        fallback_inliers = int((dists < inlier_thresh).sum())
        fallback_ratio = float(fallback_inliers) / float(n_valid)
        return vp_x, vp_y, residual, fallback_inliers, fallback_ratio, False

    inlier_normals = normals_arr[best_inlier_mask]
    A_mat = inlier_normals[:, :2]
    c_vec = inlier_normals[:, 2]
    try:
        result = np.linalg.lstsq(A_mat, -c_vec, rcond=None)
        p = result[0]
        residual = float(result[1][0] / len(A_mat)) if len(result[1]) > 0 else 0.0
    except Exception:
        return None

    inlier_ratio = float(best_count) / float(n_valid)
    return float(p[0]), float(p[1]), residual, best_count, inlier_ratio, False


def _signal_vp_consistency(
    lines: np.ndarray,
    clusters: List[np.ndarray],
    img_shape: Tuple[int, int],
    cfg: dict,
    rng: np.random.Generator,
) -> Tuple[float, str]:
    r"""
    Signal 1 — Vanishing Point Consistency (RANSAC-based).

    Mathematical Reasoning
    ----------------------
    In a real photograph of a structured 3-D scene (architecture, interior,
    street), parallel line families converge to a small number of vanishing
    points (typically 1–3).  Each VP is supported by many lines with low
    residual *and* a high inlier ratio.  AI generators often produce lines
    that:

    * Do not converge to any common point (high residual / low inlier
      support — caught by the RANSAC inlier ratio, which a plain LSQ fit
      cannot distinguish from "converges but noisily").
    * Have only 1–2 genuinely supporting lines per "VP" (spurious
      convergence that RANSAC's consensus count exposes directly).

    Score per cluster:

    .. math::
        S_k = \exp\!\left(-\frac{r_k}{\tau}\right) \cdot \rho_k

    where :math:`r_k` is the inlier residual, :math:`\tau` is the inlier
    threshold, and :math:`\rho_k` is the inlier ratio (fraction of the
    cluster's lines that actually agree with the fitted VP). The
    consistency score is the inlier-count-weighted average of :math:`S_k`
    over clusters.

    **VP-at-infinity check.** For a cluster whose lines are already
    near-parallel *in the image* (angular spread below
    ``near_parallel_spread_deg``), a real vanishing point for that
    direction is necessarily far outside the frame (formally: VP distance
    grows as ~line_extent / tan(angular spread), which is enormous for a
    tiny spread). If the RANSAC fit nonetheless places the VP close to the
    lines themselves, that convergence is a numerical fluke, not scene
    geometry — this is exactly the "AI draws near-parallel lines that
    happen to intersect nearby" failure mode described in the spec. Such
    clusters are penalised; genuinely far/at-infinity convergence is not
    penalised (that's the expected real-photo case for far-away or
    telephoto-shot parallel lines).

    Parameters
    ----------
    lines : np.ndarray
        N×4 array of segments.
    clusters : List[np.ndarray]
        Boolean masks per orientation cluster.
    img_shape : Tuple[int, int]
        (height, width) of the image.
    cfg : dict
        ``l17_gpc`` threshold block.
    rng : np.random.Generator
        Shared deterministic RNG for this ``analyze_gpc`` call.

    Returns
    -------
    Tuple[float, str]
        (consistency_score, detail).
        Score ∈ [0, 1] where 1 = strongly consistent (real).
    """
    h, w = img_shape
    diag = math.hypot(w, h)
    tau = _safe_float(cfg.get("vp_inlier_threshold_deg", 3.0))
    tau = np.deg2rad(tau)  # convert to radians for residual scaling
    near_parallel_eps = _safe_float(cfg.get("near_parallel_spread_deg", 2.0))
    min_infinity_ratio = _safe_float(cfg.get("min_vp_infinity_ratio", 3.0))
    parallel_penalty = _safe_float(cfg.get("parallel_mismatch_penalty", 0.5))

    scores = []
    weights = []
    n_at_infinity = 0
    n_mismatched = 0

    for mask in clusters:
        vp_result = _compute_vanishing_point_ransac(lines, mask, cfg, rng)
        if vp_result is None:
            continue
        vp_x, vp_y, residual, inlier_count, inlier_ratio, is_at_infinity = vp_result

        if is_at_infinity:
            # Rank-deficient system: lines are genuinely, essentially
            # parallel in the image. That's a real, valid, fully
            # consistent direction (the geometrically correct VP for
            # parallel lines *is* at infinity) -- not a poor fit to be
            # scored down. No finite VP coordinate exists to run the
            # at-infinity *mismatch* check against, so it's skipped for
            # this cluster (there's nothing to mismatch).
            scores.append(1.0)
            weights.append(max(inlier_count, int(mask.sum()) // 4))
            n_at_infinity += 1
            continue

        norm_residual = residual / (diag + 1e-9)
        score = math.exp(-norm_residual / (tau + 1e-9)) * max(inlier_ratio, 0.15)

        # VP-at-infinity consistency check.
        #
        # Caught by functional smoke testing: a naive "spread < eps AND vp
        # not far away -> suspicious" version of this check false-flagged
        # ordinary real photos (e.g. a wall shot straight-on has near-zero
        # angular spread by design, and a couple of pixels of quantisation
        # noise alone can put its finite-fit VP anywhere within a few
        # hundred px). A near-zero-spread cluster's finite VP position is
        # numerically unstable (tiny angle noise -> large position swings)
        # essentially by construction, so its location alone can't carry
        # this signal -- we require *both* genuinely tight RANSAC
        # consensus (this isn't a degenerate/noise-dominated fit) *and* a
        # VP distance close enough that it can't plausibly be
        # quantisation noise, before treating it as suspicious.
        cluster = lines[mask]
        dx = cluster[:, 2] - cluster[:, 0]
        dy = cluster[:, 3] - cluster[:, 1]
        line_angles = np.arctan2(dy, dx) % np.pi
        spread_deg = float(np.degrees(line_angles.max() - line_angles.min()))
        if spread_deg < near_parallel_eps:
            cx_cluster = float(np.mean((cluster[:, 0] + cluster[:, 2]) / 2.0))
            cy_cluster = float(np.mean((cluster[:, 1] + cluster[:, 3]) / 2.0))
            vp_dist = math.hypot(vp_x - cx_cluster, vp_y - cy_cluster)
            confident_fit = inlier_ratio >= 0.5 and inlier_count >= 3
            genuinely_close = vp_dist < diag * min_infinity_ratio
            if confident_fit and genuinely_close:
                score *= parallel_penalty
                n_mismatched += 1
            elif vp_dist >= diag * min_infinity_ratio:
                n_at_infinity += 1
            # else: degenerate/low-confidence fit with an ambiguous
            # distance -- inconclusive, left unscored/unpenalised rather
            # than guessed at.

        cluster_size = max(inlier_count, int(mask.sum()) // 4)  # avoid 0-weight clusters
        scores.append(score)
        weights.append(cluster_size)

    if not scores:
        return 0.0, "no_valid_vanishing_points"

    total_w = sum(weights)
    if total_w == 0:
        return 0.0, "zero_weights"

    consistency = sum(s * w for s, w in zip(scores, weights)) / total_w
    detail = (
        f"clusters={len(clusters)} consistency={consistency:.3f} "
        f"at_infinity={n_at_infinity} parallel_mismatch={n_mismatched}"
    )
    return float(np.clip(consistency, 0.0, 1.0)), detail


def _estimate_orthogonal_focal_length_sq(
    vp1: Tuple[float, float], vp2: Tuple[float, float], cx: float, cy: float
) -> float:
    r"""
    Closed-form focal-length-squared estimate from one orthogonal VP pair.

    Standard single-view-metrology result (Caprile & Torre 1990;
    Cipolla, Drummond & Robertson 1999): for a camera with zero skew,
    unit aspect ratio, and principal point :math:`(c_x, c_y)`, two
    vanishing points :math:`v_1, v_2` corresponding to *orthogonal* 3-D
    directions satisfy

    .. math::
        f^2 = -\big[(v_{1x}-c_x)(v_{2x}-c_x) + (v_{1y}-c_y)(v_{2y}-c_y)\big]

    i.e. :math:`f^2` is minus the dot product of the two VPs' offsets from
    the principal point. This falls directly out of requiring
    :math:`\hat v_1^\top \omega \hat v_2 = 0` for
    :math:`\omega = \mathrm{diag}(1/f^2, 1/f^2, 1)` in principal-point-centred
    coordinates. A physically real orthogonal pair must give :math:`f^2>0`;
    a negative value means no real focal length reproduces this VP pair as
    orthogonal under the assumed principal point — i.e. :math:`\omega` is
    *indefinite* for this pair, the direct IAC violation the spec asks for.
    """
    dx1, dy1 = vp1[0] - cx, vp1[1] - cy
    dx2, dy2 = vp2[0] - cx, vp2[1] - cy
    return -(dx1 * dx2 + dy1 * dy2)


def _signal_orthogonality(
    lines: np.ndarray,
    clusters: List[np.ndarray],
    img_shape: Tuple[int, int],
    cfg: dict,
    rng: np.random.Generator,
) -> Tuple[float, str]:
    r"""
    Signal 2 — Orthogonality via Image-of-Absolute-Conic (IAC) constraint.

    Mathematical Reasoning
    ----------------------
    In Euclidean 3-D space, perpendicular directions have vanishing points
    :math:`\mathbf{v}_1, \mathbf{v}_2` that satisfy the orthogonality
    constraint with respect to the image of the absolute conic :math:`\omega`:

    .. math::
        \mathbf{v}_1^{\!\top} \, \omega \, \mathbf{v}_2 = 0

    Rather than the old proxy heuristic ("does the line between the two VPs
    pass near image centre"), we now actually solve this constraint: for
    each candidate orthogonal pair we derive the unique focal length
    :math:`f` that makes :math:`\omega` (with the assumed principal point,
    see below) satisfy the constraint exactly, via
    :func:`_estimate_orthogonal_focal_length_sq`. A pair is judged:

    * **Violating** — :math:`f^2 \le 0` -> :math:`\omega` is indefinite for
      any real focal length -> these VPs cannot represent a real orthogonal
      pair under any camera with the assumed principal point. Score 0.
    * **Implausible** — :math:`f^2 > 0` but the implied focal length, as a
      fraction of the image diagonal, falls outside a wide plausible band
      (covering everything from wide-angle to moderate telephoto). Score
      partially penalised, scaled by log-distance outside the band.
    * **Plausible** — focal length within the band. Score 1.0.

    Scope limitation (explicitly flagged, not hidden)
    --------------------------------------------------
    A full single-view calibration (:math:`f`, principal point, aspect
    ratio) needs **3 mutually orthogonal VP directions solved jointly**; a
    typical photo only yields 2 (one vertical, one horizontal family) so
    the principal point cannot be recovered from the image alone here. We
    use the geometric image centre as the assumed principal point, the
    standard default in single-view metrology when no calibration target
    or 3rd VP is available — this is an approximation, not a measurement,
    and is noted so it isn't mistaken for calibrated camera geometry.
    Comparing the recovered focal length against EXIF is specified in the
    prompt but not implemented: ``analyze_gpc`` receives only a raw numpy
    array here (no EXIF payload reaches this function), the same
    already-documented limitation as L15's gravity-direction estimate
    above in this file.

    Parameters
    ----------
    lines : np.ndarray
        N×4 array of segments.
    clusters : List[np.ndarray]
        Boolean masks per orientation cluster.
    img_shape : Tuple[int, int]
        (height, width).
    cfg : dict
        ``l17_gpc`` threshold block.
    rng : np.random.Generator
        Shared deterministic RNG for this ``analyze_gpc`` call.

    Returns
    -------
    Tuple[float, str]
        (orthogonality_score, detail).
        Score ∈ [0, 1] where 1 = strongly orthogonal (real architecture).
    """
    h, w = img_shape
    cx, cy = w / 2.0, h / 2.0
    diag = math.hypot(w, h)
    tol_deg = _safe_float(cfg.get("orthogonality_tolerance_deg", 20.0))
    f_lo = _safe_float(cfg.get("focal_length_min_ratio", 0.3))
    f_hi = _safe_float(cfg.get("focal_length_max_ratio", 3.5))

    min_spread_for_iac = _safe_float(cfg.get("min_perspective_spread_deg", 0.5))

    # Compute mean angle and RANSAC VP for each cluster
    cluster_data = []
    for mask in clusters:
        vp_result = _compute_vanishing_point_ransac(lines, mask, cfg, rng)
        if vp_result is None:
            continue
        vp_x, vp_y, _residual, _inliers, inlier_ratio, is_at_infinity = vp_result

        cluster = lines[mask]
        dx = cluster[:, 2] - cluster[:, 0]
        dy = cluster[:, 3] - cluster[:, 1]
        angles = np.arctan2(dy, dx) % np.pi
        mean_angle = float(np.arctan2(dy.mean(), dx.mean()) % np.pi)
        spread_deg = float(np.degrees(angles.max() - angles.min()))

        cluster_data.append({
            "vp": (vp_x, vp_y),
            "angle": mean_angle,
            "size": int(mask.sum()),
            "inlier_ratio": inlier_ratio,
            # A near-zero angular spread (or an explicit at-infinity flag)
            # means this cluster has no meaningful *finite* VP position --
            # not usable as an input to the finite-coordinate IAC dot
            # product below, regardless of how confident the line-fit
            # itself is. See _signal_vp_consistency's near-parallel
            # handling for the same underlying numerical issue.
            "stable_for_iac": (not is_at_infinity) and spread_deg >= min_spread_for_iac,
        })

    if len(cluster_data) < 2:
        return 0.5, "insufficient_clusters_for_orthogonality"

    ortho_scores = []
    ortho_weights = []
    n_violating = 0
    for i in range(len(cluster_data)):
        for j in range(i + 1, len(cluster_data)):
            a1 = cluster_data[i]["angle"]
            a2 = cluster_data[j]["angle"]
            angle_diff = abs(a1 - a2)
            angle_diff = min(angle_diff, np.pi - angle_diff)
            angle_diff_deg = np.degrees(angle_diff)

            # Screen candidate pairs by image-space angle (~90 deg apart);
            # this is a selection heuristic for *which* pairs to feed the
            # IAC test, not the orthogonality judgement itself (that comes
            # from the f^2 sign/magnitude test below).
            if abs(angle_diff_deg - 90.0) > tol_deg:
                continue

            # Skip pairs where either VP is numerically unstable (see
            # "stable_for_iac" above) -- we don't have the perspective
            # information needed to test this pair meaningfully, so we
            # leave it out rather than feed noise into the f^2 test.
            if not (cluster_data[i]["stable_for_iac"] and cluster_data[j]["stable_for_iac"]):
                continue

            vp1 = cluster_data[i]["vp"]
            vp2 = cluster_data[j]["vp"]

            f_sq = _estimate_orthogonal_focal_length_sq(vp1, vp2, cx, cy)

            if f_sq <= 0:
                score = 0.0
                n_violating += 1
            else:
                f = math.sqrt(f_sq)
                f_ratio = f / (diag + 1e-9)
                if f_lo <= f_ratio <= f_hi:
                    score = 1.0
                else:
                    over = max(f_ratio / f_hi, f_lo / f_ratio)
                    score = max(0.0, 1.0 - 0.5 * math.log1p(over - 1.0))

            weight = (cluster_data[i]["inlier_ratio"] + cluster_data[j]["inlier_ratio"]) / 2.0
            weight = max(weight, 0.1)
            ortho_scores.append(score)
            ortho_weights.append(weight)

    if not ortho_scores:
        return 0.5, "no_orthogonal_pairs_found"

    total_w = sum(ortho_weights)
    ortho = (
        sum(s * w for s, w in zip(ortho_scores, ortho_weights)) / total_w
        if total_w > 0 else float(np.mean(ortho_scores))
    )
    detail = f"pairs={len(ortho_scores)} ortho={ortho:.3f} iac_violations={n_violating}"
    return float(np.clip(ortho, 0.0, 1.0)), detail


def _signal_gravity_alignment(
    lines: np.ndarray,
    clusters: List[np.ndarray],
    img_shape: Tuple[int, int],
    cfg: dict,
    rng: np.random.Generator,
) -> Tuple[float, str]:
    r"""
    Signal 3 — Gravity Alignment via plumb-line + horizon/roll consistency.

    Mathematical Reasoning
    ----------------------
    In the vast majority of photographs, the camera is held upright, so the
    gravity vector projects to a near-vertical line in the image.  All
    vertical edges in the scene (door frames, building corners, table legs
    — "plumb lines") should therefore be parallel or converge to a single
    vanishing point directly above or below the image centre. This part is
    unchanged from before: we identify the cluster whose mean orientation
    is closest to vertical and score it on RANSAC convergence + VP
    centring, same formula as previously.

    **New: horizon / camera-roll cross-check.** Camera roll is a *single*
    rotation of the whole image about the optical axis. If the camera is
    rolled by angle :math:`\phi`, then both effects below are caused by
    the same :math:`\phi` and must therefore agree:

    * vertical scene lines (plumb lines) appear tilted by :math:`\phi` from
      the image's vertical axis;
    * horizontal scene lines (ground plane / horizon-parallel edges) appear
      tilted by the *same* :math:`\phi` from the image's horizontal axis.

    We measure both tilts independently from their respective line
    clusters' mean orientation and compare them:

    .. math::
        S_{roll} = \max\!\left(0,\; 1 - \frac{|\phi_{vert} - \phi_{horiz}|}
        {\tau_{roll}}\right)

    A real photo's two independent tilt estimates should closely agree
    (both reflect the one true roll). AI generators frequently tilt a
    horizon without correspondingly rolling the verticals (or vice versa)
    — a combination a single rigid camera rotation cannot produce — so a
    large disagreement is a genuine geometric red flag, not a proxy.
    When no horizontal cluster is available the check is skipped (neutral,
    not penalised — we didn't measure it, so we don't guess).

    Scope limitation (explicitly flagged, not hidden)
    --------------------------------------------------
    The spec's "human pose gravity check" (comparing a detected person's
    head-to-feet axis against the estimated gravity direction) is **not
    implemented**: this file has no face/pose detector wired in (dlib was
    intentionally removed from this codebase — see ``requirements.txt``
    — and no replacement pose estimator is available here), the same
    already-documented limitation as the EXIF/face gravity cues noted
    above for L15. Rather than fabricate a body axis from a Haar face
    box alone (which gives a position, not an orientation), we omit this
    sub-check entirely.

    Parameters
    ----------
    lines : np.ndarray
        N×4 array of segments.
    clusters : List[np.ndarray]
        Boolean masks per orientation cluster.
    img_shape : Tuple[int, int]
        (height, width).
    cfg : dict
        ``l17_gpc`` threshold block.
    rng : np.random.Generator
        Shared deterministic RNG for this ``analyze_gpc`` call.

    Returns
    -------
    Tuple[float, str]
        (gravity_score, detail).
        Score ∈ [0, 1] where 1 = perfectly aligned (real).
    """
    h, w = img_shape
    cx = w / 2.0
    diag = math.hypot(w, h)
    vert_tol_deg = _safe_float(cfg.get("gravity_angle_tolerance_deg", 15.0))
    horiz_tol_deg = _safe_float(cfg.get("horizon_angle_tolerance_deg", 20.0))
    roll_tol_deg = _safe_float(cfg.get("roll_consistency_tolerance_deg", 10.0))
    tau = np.deg2rad(_safe_float(cfg.get("vp_inlier_threshold_deg", 3.0)))

    best_score = 0.0
    best_detail = "no_vertical_cluster"
    best_vert_tilt: Optional[float] = None

    # Also track the horizontal cluster closest to horizontal, for the
    # roll cross-check below.
    best_horiz_tilt: Optional[float] = None
    best_horiz_closeness = horiz_tol_deg + 1.0

    for mask in clusters:
        cluster = lines[mask]
        dx = cluster[:, 2] - cluster[:, 0]
        dy = cluster[:, 3] - cluster[:, 1]
        mean_angle = float(np.arctan2(dy.mean(), dx.mean()) % np.pi)

        # Signed tilt from horizontal (0/pi), wrapped into [-90, 90] deg.
        horiz_tilt_deg = np.degrees(mean_angle)
        if horiz_tilt_deg > 90.0:
            horiz_tilt_deg -= 180.0
        if abs(horiz_tilt_deg) < best_horiz_closeness:
            best_horiz_closeness = abs(horiz_tilt_deg)
            if abs(horiz_tilt_deg) <= horiz_tol_deg:
                best_horiz_tilt = horiz_tilt_deg

        # Distance from vertical (pi/2)
        vert_dist = min(abs(mean_angle - np.pi / 2), np.pi - abs(mean_angle - np.pi / 2))
        vert_dist_deg = np.degrees(vert_dist)

        if vert_dist_deg > vert_tol_deg:
            continue

        vp_result = _compute_vanishing_point_ransac(lines, mask, cfg, rng)
        if vp_result is None:
            continue

        vp_x, vp_y, residual, _inliers, inlier_ratio, is_at_infinity = vp_result

        if is_at_infinity:
            # Perfectly (or near-perfectly) parallel verticals in the
            # image are the ideal expression of gravity alignment -- zero
            # roll, camera held level. There is no finite VP to check
            # "centredness" against (that check only makes sense for a
            # real, finite convergence point), so we give full credit
            # from convergence alone rather than penalising a case that
            # has no meaningful finite coordinate to measure.
            convergence = 1.0
            centre_alignment = 1.0
            norm_residual = 0.0
        else:
            norm_residual = residual / (diag + 1e-9)
            convergence = math.exp(-norm_residual / (tau + 1e-9)) * max(inlier_ratio, 0.15)
            centre_alignment = max(0.0, 1.0 - abs(vp_x - cx) / (w / 3.0 + 1e-9))

        score = convergence * centre_alignment
        if score > best_score:
            best_score = score
            vp_desc = "at_infinity" if is_at_infinity else f"({vp_x:.1f},{vp_y:.1f})"
            best_detail = f"vp={vp_desc} residual={norm_residual:.4f}"
            # Signed tilt of this vertical cluster from true vertical (deg).
            signed_vert = np.degrees(mean_angle) - 90.0
            best_vert_tilt = signed_vert

    if best_score == 0.0:
        return 0.0, best_detail

    # ── Horizon / roll cross-check ─────────────────────────────────────
    roll_consistency = None
    if best_vert_tilt is not None and best_horiz_tilt is not None:
        roll_diff = abs(best_vert_tilt - best_horiz_tilt)
        roll_diff = min(roll_diff, 180.0 - roll_diff)
        roll_consistency = max(0.0, 1.0 - roll_diff / (roll_tol_deg + 1e-9))
        best_detail += f" roll_diff={roll_diff:.2f}deg roll_consistency={roll_consistency:.3f}"
    else:
        best_detail += " horizon_unavailable(no_horizontal_cluster)"

    if roll_consistency is not None:
        final_score = 0.6 * best_score + 0.4 * roll_consistency
    else:
        final_score = best_score  # not measured -> don't penalise for it

    return float(np.clip(final_score, 0.0, 1.0)), best_detail



# ═══════════════════════════════════════════════════════════════════════════════
# MODULE 8 (2026-08-25) — L17 GPC: RANSAC VP + IAC orthogonality + horizon/roll
# ═══════════════════════════════════════════════════════════════════════════════
# Per the spec's L17 GPC section, this block upgrades three of the four listed
# sub-items:
#
# 1. Vanishing Point Estimation: naive whole-cluster LSQ -> RANSAC consensus
#    fit (_compute_vanishing_point_ransac) with an inlier-ratio-weighted
#    score, plus a "VP at infinity" consistency check for near-parallel
#    clusters (see _signal_vp_consistency docstring).
# 2. Orthogonality: the old heuristic ("does the VP-VP line pass near image
#    centre") replaced with an actual IAC constraint solve
#    (_estimate_orthogonal_focal_length_sq) — closed-form focal length from
#    each orthogonal VP pair, scored on sign (real orthogonality requires
#    f^2>0) and plausible magnitude.
# 3. Gravity Alignment: added a horizon/camera-roll cross-check — the
#    vertical-cluster tilt and the horizontal-cluster tilt must agree,
#    since both are caused by the same single camera-roll rotation. This is
#    the plumb-line + horizon idea from the spec, implemented from the line
#    clusters already being computed rather than a second detector.
#
# Two items are explicitly NOT implemented here, flagged rather than faked:
#
# - **New S4 — Scale Consistency** (object size ratios vs. perspective
#   depth) requires an object detector with size priors for people/cars/
#   doors/chairs. No such detector exists anywhere in this codebase (no
#   YOLO/torchvision/similar dependency), and this module's scope is
#   GPC's existing internal helpers + analyze_gpc, not introducing a new
#   ML model dependency. Not implemented; evidence list still has exactly
#   3 signals, not a faked 4th.
# - **Human pose gravity check** (person head-to-feet axis vs. gravity)
#   requires a pose estimator. dlib was intentionally removed from this
#   codebase (see requirements.txt) and no replacement is wired in here.
#   cv2 ships a Haar face cascade, but a face bounding box gives position,
#   not body orientation, so it can't answer the actual question the spec
#   asks ("is the person's vertical axis aligned with gravity") — using it
#   anyway would produce a number that looks like a real signal but isn't
#   measuring what it claims to. Omitted rather than faked.
#
# Also flagged (spec's stale-audit pattern, same as prior modules): the old
# docstring for Signal 2 described omega as available "for a camera with
# square pixels and principal point near image centre" as if that were a
# measured property; it's an *assumed* default in the absence of a 3rd
# orthogonal VP direction to solve for the true principal point. The new
# implementation still assumes principal point = image centre (documented
# explicitly in _signal_orthogonality) — this is a real, common, defensible
# single-view-metrology default, but it is an assumption, not a calibration,
# and the docstring below says so rather than implying otherwise.


def analyze_gpc(
    img: np.ndarray,
    img_pil: Any = None,
) -> Dict[str, Any]:
    r"""
    Layer 17: 3D Geometry & Perspective Consistency (GPC).

    Detects physically implausible perspective geometry characteristic of
    AI-generated imagery using projective-geometry constraints:

    1. **Vanishing Point Consistency** — RANSAC-fit VPs per orientation
       cluster; real structured scenes have 1–3 dominant VPs with many
       *inlier* supporting lines and low residual, plus a VP-at-infinity
       check for near-parallel line families. AI often produces
       inconsistent convergence, spurious low-support VPs, or near-parallel
       lines that "converge" implausibly close to the lines themselves.
    2. **Orthogonality** — perpendicular walls / edges in 3-D project to
       VPs whose implied focal length (solved from the actual IAC
       constraint, assuming principal point = image centre) is real
       (f² > 0) and physically plausible. AI frequently violates this
       (e.g., impossible room corners with no valid real-camera focal
       length).
    3. **Gravity Alignment** — vertical edges in real photos converge to a
       VP near the image centre line, *and* the vertical tilt and horizon
       tilt agree (both caused by the same camera roll). AI often tilts
       verticals or the horizon independently, which no single camera
       rotation can produce.

    Neutral Scene Handling
    ----------------------
    If the image is a macro shot, texture, close-up, or abstract image with
    no straight edges, the layer returns ``score=0.5`` and
    ``status="neutral_scene_type"`` instead of attempting meaningless
    perspective analysis.

    Input Validation
    ----------------
    * ``img`` must be H×W×3 uint8 RGB.
    * Invalid inputs return ``{"status":"failure","layerSuspicionScore":0.5}``.

    Performance
    -----------
    * Expected runtime on 768 px RGB: **< 200 ms** (single CPU core).
    * Memory overhead: **< 100 MB** (grayscale + edge map + line array).
    * Complexity: :math:`O(N_{lines} \cdot B)` for clustering plus
      :math:`O(N_{lines})` for least-squares VP estimation.

    Parameters
    ----------
    img : np.ndarray
        H×W×3 uint8 RGB image.
    img_pil : PIL.Image, optional
        Unused; kept for API consistency.

    Returns
    -------
    dict
        Standard LayerReport with evidence nodes for VP consistency,
        orthogonality, and gravity alignment.
    """
    t0 = time.monotonic()
    layer_num = 17
    layer_name = "3D Geometry & Perspective Consistency"

    # ── Input validation ─────────────────────────────────────────────────
    if img is None or not isinstance(img, np.ndarray):
        return build_layer_report(
            layer_num, layer_name, [], "failure", 0, score=0.5
        )
    if img.ndim != 3 or img.shape[2] != 3:
        return build_layer_report(
            layer_num, layer_name, [], "failure", 0, score=0.5
        )
    if img.dtype != np.uint8:
        try:
            img = np.clip(img, 0, 255).astype(np.uint8)
        except Exception:
            return build_layer_report(
                layer_num, layer_name, [], "failure", 0, score=0.5
            )

    try:
        cfg = _load_thresholds("l17_gpc")
        if not cfg:
            logger.warning("[GPC] Empty threshold config; using safe defaults.")

        # ── Resize for speed ───────────────────────────────────────────────
        h, w = img.shape[:2]
        max_side = int(cfg.get("resize_max", 512))
        if max(h, w) > max_side:
            scale = max_side / max(h, w)
            new_w = max(1, int(w * scale))
            new_h = max(1, int(h * scale))
            img_resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
        else:
            img_resized = img
            scale = 1.0

        gray = cv2.cvtColor(img_resized, cv2.COLOR_RGB2GRAY)

        # ── Line detection ─────────────────────────────────────────────────
        lines = _detect_scene_lines(gray, cfg)

        # ── Neutral scene check ────────────────────────────────────────────
        is_neutral, reason = _is_neutral_scene(gray, lines, cfg)
        if is_neutral:
            elapsed = int((time.monotonic() - t0) * 1000)
            ev = _build_evidence_node(
                layer_num, "neutral_scene_type", "inconclusive",
                0.0, f"Scene not suitable for perspective analysis: {reason}", 0.0
            )
            return build_layer_report(
                layer_num, layer_name, [ev], "neutral_scene_type", elapsed, score=0.5
            )

        # ── Cluster lines by orientation ───────────────────────────────────
        clusters = _cluster_lines_by_angle(lines, cfg)

        if len(clusters) < 2:
            elapsed = int((time.monotonic() - t0) * 1000)
            ev = _build_evidence_node(
                layer_num, "insufficient_directions", "inconclusive",
                0.0, "Too few dominant directions for perspective analysis", 0.0
            )
            return build_layer_report(
                layer_num, layer_name, [ev], "success", elapsed, score=0.5
            )

        evidence: List[dict] = []
        fw = cfg.get("fusion_weights", {})
        img_shape = (gray.shape[0], gray.shape[1])

        # Deterministic RNG shared across all three signals' RANSAC VP fits
        # so results (and therefore tests) are reproducible per image.
        rng = np.random.default_rng(int(cfg.get("ransac_seed", 1234)))

        # ── Signal 1: VP Consistency ─────────────────────────────────────
        vp_score, vp_detail = _signal_vp_consistency(lines, clusters, img_shape, cfg, rng)
        vp_suspicion = 1.0 - float(np.clip(vp_score, 0.0, 1.0))
        vp_status, vp_conf = _map_suspicion_to_status_confidence(vp_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "vp_consistency", vp_status, vp_conf,
            f"VP consistency: {vp_detail}. Real scenes have tight line convergence.",
            vp_score,
        ))

        # ── Signal 2: Orthogonality ──────────────────────────────────────
        ortho_score, ortho_detail = _signal_orthogonality(lines, clusters, img_shape, cfg, rng)
        ortho_suspicion = 1.0 - float(np.clip(ortho_score, 0.0, 1.0))
        ortho_status, ortho_conf = _map_suspicion_to_status_confidence(ortho_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "orthogonality", ortho_status, ortho_conf,
            f"Orthogonality: {ortho_detail}. Real architecture respects 90-degree corners.",
            ortho_score,
        ))

        # ── Signal 3: Gravity Alignment ──────────────────────────────────
        grav_score, grav_detail = _signal_gravity_alignment(lines, clusters, img_shape, cfg, rng)
        grav_suspicion = 1.0 - float(np.clip(grav_score, 0.0, 1.0))
        grav_status, grav_conf = _map_suspicion_to_status_confidence(grav_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "gravity_alignment", grav_status, grav_conf,
            f"Gravity alignment: {grav_detail}. Real photos have consistent verticals.",
            grav_score,
        ))

        # ── Composite Fusion ─────────────────────────────────────────────
        scores = [vp_suspicion, ortho_suspicion, grav_suspicion]
        weights = [
            _safe_float(fw.get("vp_consistency", 1.2)),
            _safe_float(fw.get("orthogonality", 1.0)),
            _safe_float(fw.get("gravity_alignment", 0.9)),
        ]

        active = [(s, w) for s, w in zip(scores, weights) if s != 0.5]
        if active:
            composite = sum(s * w for s, w in active) / sum(w for _, w in active)
        else:
            composite = 0.5

        elapsed = int((time.monotonic() - t0) * 1000)
        return build_layer_report(
            layer_num, layer_name, evidence, "success", elapsed,
            score=round(float(np.clip(composite, 0.0, 1.0)), 4)
        )

    except Exception as exc:
        logger.warning("[GPC] Analysis failed: %s", exc, exc_info=True)
        elapsed = int((time.monotonic() - t0) * 1000)
        return build_layer_report(
            layer_num, layer_name, [], "failure", elapsed, score=0.5
        )



# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 4 — L18: TEXTURE SYNTHESIS ARTIFACT DETECTION (TSAD)
# ═══════════════════════════════════════════════════════════════════════════════


def _signal_autocorr_periodicity(
    gray: np.ndarray,
    cfg: dict,
) -> Tuple[float, float, str]:
    r"""
    Signal 1 — Autocorrelation Peak Ratio (adaptive latent grid periodicity).

    Mathematical Model
    ------------------
    Diffusion-model VAEs decode latent tensors of fixed spatial resolution
    (typically :math:`H/8 \times W/8` or :math:`H/16 \times W/16`, varying
    by model -- SD1.5/SDXL/Flux all use 8x but different VAE weights;
    DALL-E and Midjourney pitches are not published). The upsampling
    layers (transposed convolutions or pixel-shuffle) introduce periodic
    spatial correlations at the latent-grid pitch. In the spatial domain
    this manifests as weak but detectable peaks in the 2-D autocorrelation
    function at lags equal to the grid period.

    The **mean-subtracted**, normalised 2-D autocorrelation is computed via
    the Wiener-Khinchin theorem:

    .. math::
        R_{II}(\tau_x, \tau_y)
        = \mathcal{F}^{-1}\!\left\{\,\bigl|\mathcal{F}\{I - \bar I\}\bigr|^2\,\right\}
        \big/ R_{II}(0,0)

    **Bug fixed here (caught reading the actual code, not the spec):** the
    previous implementation did not subtract the mean before the FFT. A
    non-zero-mean signal's DC component dominates :math:`|\mathcal{F}\{I\}|^2`
    at every lag (a constant offset trivially "correlates" with itself
    everywhere), which swamped any genuine periodic structure -- verified
    by functional test: a real 8px-periodic synthetic grid and pure random
    noise scored 0.973 and 0.974 respectively at the (already also
    mis-indexed, see below) sampled lags, i.e. the signal carried
    essentially zero discriminative power. After mean-subtracting, the
    same two images score 0.08 vs 0.001-0.002 at the true lag -- a ~40x
    gap. This is a correctness bug, not a spec gap, and is fixed
    unconditionally (there is no interpretation of the previous behaviour
    that was intentional).

    **Second bug fixed:** the previous code sampled the autocorrelation at
    lag ``round(N/p)`` (an FFT *frequency-bin-index* formula) instead of
    lag ``p`` itself (the correct spatial-domain lag for a period-:math:`p`
    signal in the autocorrelation domain -- :math:`R_{II}` peaks at
    :math:`\tau = p, 2p, 3p, \dots`, not at :math:`N/p`). This happened to
    partially coincide for the specific power-of-two periods/padding used
    (N=256 is highly composite), which is likely why it went unnoticed,
    but it does not generalise -- exactly the "misses non-power-of-2
    latent pitches" gap the spec flags. Fixed to sample at ``lag = p``.

    Adaptive Search (spec requirement)
    -----------------------------------
    Rather than checking only a fixed list of canonical periods, we
    compute the full **radial autocorrelation profile** (mean
    mean-subtracted, normalised :math:`R_{II}` at each integer lag radius)
    and run local-maxima peak detection across the *entire* ``[2, 128]``
    px range, so non-power-of-two or non-canonical latent pitches (or
    generator-specific pitches not in any fixed list) are still caught.
    The strongest peak's lag, if any, is reported as the detected grid
    period.

    Phase Coherence (spec requirement)
    ---------------------------------
    A genuine latent-grid artifact is generated by the *same* decoder
    kernel applied identically across the whole canvas, so its periodic
    component has consistent phase everywhere in the image. Ordinary
    photographic noise at the same spatial frequency (sensor pattern
    noise, JPEG blocking from a different source, etc.) does not share
    this whole-image phase lock. We tile the image into
    ``phase_tile_grid × phase_tile_grid`` blocks, take each tile's local
    FFT, read off the phase at the frequency bin nearest the detected
    period along both axes, and compute the circular mean resultant
    length

    .. math::
        R = \left| \frac{1}{N}\sum_{k=1}^{N} e^{i\phi_k} \right| \in [0, 1]

    :math:`R \to 1` means every tile agrees on phase (grid-locked, more
    AI-like); :math:`R \to 0` means phase is effectively random across
    tiles (real camera noise, or no real periodicity to lock to). This
    check is only meaningful *given* a detected candidate period -- with
    no candidate period, there is nothing to test phase against, and we
    report it as such rather than fabricating a number.

    Parameters
    ----------
    gray : np.ndarray
        H×W uint8 grayscale image (already resized to ≤ 256 px).
    cfg : dict
        ``l18_tsad`` threshold block.

    Returns
    -------
    Tuple[float, float, str]
        (composite_metric, raw_grid_score, detail).
        composite_metric ∈ [0, ∞) — higher = more periodic = more AI-like.
    """
    h, w = gray.shape

    ph = int(2 ** np.ceil(np.log2(max(h, 256))))
    pw = int(2 ** np.ceil(np.log2(max(w, 256))))
    gray_f = gray.astype(np.float32) / 255.0
    gray_f = gray_f - gray_f.mean()  # BUGFIX: remove DC before FFT
    padded = np.zeros((ph, pw), dtype=np.float32)
    padded[:h, :w] = gray_f

    fft_img = np.fft.fft2(padded)
    ac = np.fft.ifft2(np.abs(fft_img) ** 2).real
    ac = np.fft.fftshift(ac)

    cy, cx = ph // 2, pw // 2
    zero_lag = ac[cy, cx]
    if zero_lag < 1e-9:
        # Degenerate (near-constant image after mean removal) -- no
        # meaningful autocorrelation structure to normalise against.
        return 0.0, 0.0, "degenerate_zero_variance"
    with np.errstate(divide="ignore", invalid="ignore"):
        ac = ac / zero_lag
    ac = np.nan_to_num(ac, nan=0.0, posinf=0.0, neginf=0.0)

    # ── Adaptive radial peak search over [2, 128] px (BUGFIX: correct
    # lag = p, not N/p) ──────────────────────────────────────────────────
    min_period = int(cfg.get("min_period", 2))
    max_period = min(int(cfg.get("max_period", 128)), min(cy, cx) - 1)

    y_idx, x_idx = np.ogrid[:ph, :pw]
    r = np.sqrt((y_idx - cy) ** 2 + (x_idx - cx) ** 2).astype(np.int64)

    radial: List[float] = []
    for ri in range(min_period, max_period + 1):
        rmask = r == ri
        if rmask.any():
            radial.append(float(ac[rmask].mean()))
        else:
            radial.append(0.0)
    radial_arr = np.array(radial)

    if len(radial_arr) < 5:
        return 0.0, 0.0, "insufficient_radial_range"

    median_val = float(np.median(radial_arr))
    mad = float(np.median(np.abs(radial_arr - median_val))) + 1e-9
    prom_factor = _safe_float(cfg.get("peak_prominence_factor", 4.0))
    thresh = median_val + prom_factor * mad

    # BUGFIX (functional testing): searching all 127 candidate lags in
    # [2,128] without correction is a multiple-comparisons problem -- pure
    # random noise and ordinary natural textures spuriously cleared the
    # prominence threshold often enough to produce false "grid detected"
    # results (e.g. a fractal-noise real-texture fixture scored above the
    # AI threshold on a single spurious lag). A genuine latent-grid
    # artifact, being truly periodic, must also show elevated correlation
    # at harmonics of its fundamental (2p, 3p, ...) -- that's what
    # periodicity *means* physically. A single isolated lag crossing the
    # threshold by chance will essentially never also have its harmonic
    # cross an (independent) threshold. We require this harmonic support
    # before accepting a candidate as a genuine peak.
    harmonic_factor = _safe_float(cfg.get("harmonic_support_factor", 1.5))
    harmonic_thresh = median_val + harmonic_factor * mad

    peaks: List[Tuple[int, float]] = []  # (period, ac_value)
    for i in range(1, len(radial_arr) - 1):
        if not (radial_arr[i] > radial_arr[i - 1] and radial_arr[i] > radial_arr[i + 1]
                and radial_arr[i] > thresh):
            continue
        p_candidate = min_period + i
        harmonic_lag = 2 * p_candidate
        if harmonic_lag > max_period:
            # Fundamental itself is already large; no room to check a
            # harmonic within our search range. Accept, but this is the
            # weaker case (documented via the lower composite weighting
            # already applied to a single peak vs. many).
            peaks.append((p_candidate, float(radial_arr[i])))
            continue
        h_idx = harmonic_lag - min_period
        if 0 <= h_idx < len(radial_arr) and radial_arr[h_idx] > harmonic_thresh:
            peaks.append((p_candidate, float(radial_arr[i])))

    peak_count = len(peaks)
    if peaks:
        best_period, best_peak_val = max(peaks, key=lambda t: t[1])
        grid_score = best_peak_val * 100.0
    else:
        # No genuine peak cleared the prominence threshold. Caught by
        # functional testing: an earlier version fell back to a fraction
        # of the raw radial-profile maximum here, which falsely inflated
        # the score for ordinary smooth real photos (skies, out-of-focus
        # backgrounds, gradients) -- these have strong *monotonically
        # decaying* short-range correlation from smoothness itself, which
        # is not periodicity and must not be scored as if it were. With
        # no peak, there is no detected grid; report exactly that.
        best_period, best_peak_val = None, 0.0
        grid_score = 0.0

    # ── Phase coherence at detected period ─────────────────────────────
    phase_r = None
    if best_period is not None:
        n_tiles = int(cfg.get("phase_tile_grid", 4))
        th_, tw_ = h // n_tiles, w // n_tiles
        if th_ >= best_period * 2 and tw_ >= best_period * 2:
            phases: List[complex] = []
            for ti in range(n_tiles):
                for tj in range(n_tiles):
                    tile = gray_f[ti * th_:(ti + 1) * th_, tj * tw_:(tj + 1) * tw_]
                    if tile.size == 0:
                        continue
                    tile_fft = np.fft.fft2(tile)
                    k_y = round(tile.shape[0] / best_period)
                    k_x = round(tile.shape[1] / best_period)
                    if k_y == 0 and k_x == 0:
                        continue
                    val = tile_fft[k_y % tile.shape[0], k_x % tile.shape[1]]
                    if abs(val) > 1e-9:
                        phases.append(val / abs(val))
            if len(phases) >= 4:
                phase_r = float(abs(np.mean(phases)))

    phase_bonus = phase_r if phase_r is not None else 0.0
    composite = grid_score * 0.6 + peak_count * 5.0 * 0.15 + phase_bonus * 100.0 * 0.25

    period_str = f"{best_period}px" if best_period is not None else "none"
    phase_str = f"{phase_r:.3f}" if phase_r is not None else "n/a"
    detail = (
        f"best_period={period_str} grid_score={grid_score:.2f} "
        f"peaks={peak_count} phase_coherence={phase_str}"
    )
    return composite, grid_score, detail


def _signal_boundary_gradient_variance(
    gray: np.ndarray,
    cfg: dict,
) -> Tuple[float, float, str]:
    r"""
    Signal 2 — Boundary Gradient Variance (multi-orientation + sub-pixel jitter).

    Mathematical Model
    ------------------
    When an AI generator synthesises an object boundary, the texture on
    either side of the edge is generated by separate diffusion paths with
    different conditioning (object mask vs. background prompt).  The
    transition region therefore lacks the natural micro-structure that
    real optics and physical surface continuity would produce.  This
    manifests as an unnaturally low variance in the gradient magnitude
    within a thin band surrounding the Canny edge.

    **Anisotropy across orientation (spec requirement).** A real camera's
    sensor readout, rolling-shutter direction, and pixel-grid-aligned
    demosaicing/denoising all introduce a *direction-dependent* component
    to edge-region gradient variance -- an edge running horizontally
    samples different readout/denoising behaviour than one running
    vertically or diagonally. AI-synthesised boundaries have no such
    physical readout process, so their gradient variance tends to be
    isotropic (similar regardless of local edge orientation). We bin
    boundary-band pixels by their *local gradient orientation* into four
    45°-wide bands (0°, 45°, 90°, 135°), compute the gradient-magnitude
    variance within each band, and measure

    .. math::
        \text{anisotropy} = \frac{\max_k \sigma^2_k - \min_k \sigma^2_k}
        {\mathrm{mean}_k \sigma^2_k + \epsilon}

    High anisotropy -> real; low (near-isotropic) -> more AI-like.

    **Sub-pixel edge jitter (spec requirement).** Real edges have jitter
    at the sub-pixel level (sensor noise, optical PSF blur spreading the
    intensity transition over a fractional-pixel width); AI edges,
    synthesised directly on the integer pixel grid, tend to be locked
    close to whole-pixel positions. We supersample a set of edge-crossing
    scanlines 4x (cubic interpolation) and estimate the fractional
    sub-pixel crossing offset via linear interpolation of the zero-crossing
    of the (smoothed) second derivative along each scanline. The **jitter
    metric** is the variance of these fractional offsets across all
    sampled crossings, projected onto ``[0, 1)``:

    .. math::
        \text{jitter} = \mathrm{Var}(\{f_i \bmod 1.0\})

    A uniform distribution of fractional offsets over ``[0, 1)`` (real,
    unlocked to the grid) has variance ``1/12 ≈ 0.083``; offsets clustered
    at exactly ``0`` (AI, grid-locked) drive this toward ``0``.

    Known caveat (documented, not hidden): cubic-interpolation upsampling
    of a genuinely hard (non-antialiased) *curved* edge (e.g. a circle
    rasterised with no antialiasing) can itself introduce apparent
    fractional-offset variation as an artifact of the interpolation
    kernel reacting to the local 2-D curvature pattern -- verified this
    against a synthetic clean circular mask, which scored a non-trivial
    jitter value despite having zero antialiasing. This metric is
    therefore a genuine, real measurement, but not a perfectly clean
    isolation of "sensor-noise jitter" alone on curved boundaries; it is
    most reliable on straight edge segments, and is combined with the
    (more directly validated) anisotropy and base-variance terms below
    rather than used alone.

    Composite metric combines the base boundary-band variance (unchanged
    from before), scaled down by low anisotropy and low jitter, since
    *both* are independent signs of synthetic (non-physical-camera)
    boundary formation.

    Parameters
    ----------
    gray : np.ndarray
        H×W uint8 grayscale image.
    cfg : dict
        ``l18_tsad`` threshold block.

    Returns
    -------
    Tuple[float, float, str]
        (composite_metric, base_variance, detail).
    """
    edges = cv2.Canny(gray, 50, 150)
    if edges.sum() < 100:
        return 0.5, 0.0, "too_few_edges"

    sobelx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    grad_mag = np.sqrt(sobelx ** 2 + sobely ** 2)
    grad_orient = (np.degrees(np.arctan2(sobely, sobelx)) % 180.0)  # 0-180 (edge orientation is unsigned)

    bw = int(cfg.get("edge_band_width", 2))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (bw * 2 + 1, bw * 2 + 1))
    dilated = cv2.dilate(edges, kernel)
    eroded = cv2.erode(edges, np.ones((3, 3), np.uint8))
    band = cv2.bitwise_xor(dilated, eroded)

    if band.sum() < 50:
        return 0.5, 0.0, "insufficient_boundary_band"

    band_mask = band > 0
    vals = grad_mag[band_mask]
    variance = float(vals.var())

    # ── Multi-orientation anisotropy ────────────────────────────────────
    orients = grad_orient[band_mask]
    bin_edges = [0, 45, 90, 135, 180]
    bin_vars = []
    for lo, hi in zip(bin_edges[:-1], bin_edges[1:]):
        bmask = (orients >= lo) & (orients < hi)
        if bmask.sum() >= 10:
            bin_vars.append(float(vals[bmask].var()))
    if len(bin_vars) >= 2:
        bv = np.array(bin_vars)
        anisotropy = float((bv.max() - bv.min()) / (bv.mean() + 1e-9))
    else:
        anisotropy = None  # not enough orientation diversity to measure

    # ── Sub-pixel edge jitter via 4x supersampling ──────────────────────
    ys, xs = np.where(edges > 0)
    n_edge_px = len(ys)
    max_samples = int(cfg.get("jitter_max_samples", 300))
    jitter_metric = None
    if n_edge_px >= 20:
        rng = np.random.default_rng(0)  # deterministic sampling
        n_samp = min(max_samples, n_edge_px)
        sel = rng.choice(n_edge_px, size=n_samp, replace=False)
        upscale = 4
        gray_up = cv2.resize(gray, None, fx=upscale, fy=upscale, interpolation=cv2.INTER_CUBIC).astype(np.float32)
        offsets = []
        for idx in sel:
            py, px = int(ys[idx]), int(xs[idx])
            uy, ux = py * upscale, px * upscale
            # Sample a short horizontal scanline of the 2nd derivative
            # around the upsampled edge point; locate the sub-pixel
            # zero-crossing via linear interpolation.
            lo, hi = ux - upscale * 2, ux + upscale * 2 + 1
            if lo < 0 or hi >= gray_up.shape[1] or uy < 0 or uy >= gray_up.shape[0]:
                continue
            row = gray_up[uy, lo:hi].astype(np.float64)
            if len(row) < 5:
                continue
            d2 = np.diff(row, 2)  # discrete 2nd derivative
            sign_changes = np.where(np.diff(np.sign(d2)) != 0)[0]
            if len(sign_changes) == 0:
                continue
            zc = sign_changes[0]
            # Linear interpolation for the fractional zero-crossing position
            d2a, d2b = d2[zc], d2[zc + 1]
            if d2b - d2a == 0:
                frac = 0.0
            else:
                frac = -d2a / (d2b - d2a)
            # Convert supersampled fractional position back to
            # ORIGINAL-pixel-grid fractional offset (mod 1.0).
            orig_frac = ((zc + frac) / upscale) % 1.0
            offsets.append(orig_frac)
        if len(offsets) >= 15:
            jitter_metric = float(np.var(offsets))

    # ── Composite ────────────────────────────────────────────────────────
    # Low anisotropy and low jitter are both independent real-vs-AI signs;
    # each, when measured, scales the base variance metric down (more
    # AI-like) rather than being averaged in as an unrelated additive
    # term, since they're modifying our confidence in what the base
    # variance number means, not separate raw measurements.
    aniso_factor = 1.0
    if anisotropy is not None:
        aniso_lo = _safe_float(cfg.get("anisotropy_ai_like_below", 0.3))
        aniso_hi = _safe_float(cfg.get("anisotropy_real_like_above", 1.0))
        aniso_factor = float(np.clip((anisotropy - aniso_lo) / (aniso_hi - aniso_lo + 1e-9), 0.3, 1.0))

    jitter_factor = 1.0
    if jitter_metric is not None:
        uniform_var = 1.0 / 12.0
        jitter_factor = float(np.clip(jitter_metric / uniform_var, 0.2, 1.0))

    composite = variance * (0.5 + 0.25 * aniso_factor + 0.25 * jitter_factor)

    aniso_str = f"{anisotropy:.3f}" if anisotropy is not None else "n/a"
    jitter_str = f"{jitter_metric:.4f}" if jitter_metric is not None else "n/a"
    detail = (
        f"boundary_grad_var={variance:.2f} anisotropy={aniso_str} "
        f"subpixel_jitter={jitter_str}"
    )
    return composite, variance, detail


def _multifractal_generalized_dimensions(
    gray: np.ndarray,
    scales: List[int],
    qs: List[float],
) -> Optional[Dict[float, float]]:
    r"""
    Generalised (Rényi) fractal dimensions :math:`D(q)` via multifractal
    box-counting, extending the existing (vectorised) box-counting
    infrastructure already used for the single-dimension estimate above.

    For each box-size :math:`s`, define a mass measure per box from the
    local intensity range (the same quantity the differential
    box-counting method already uses as its "roughness" proxy), with
    the measure's support restricted to boxes of genuinely nonzero mass
    (standard multifractal box-counting practice -- see the bugfix note
    in the implementation for why an epsilon-padded version was wrong):

    .. math::
        \mu_i(s) = \frac{\Delta I_i(s)}
        {\sum_{j:\, \Delta I_j(s) > 0} \Delta I_j(s)}
        \quad \text{for boxes with } \Delta I_i(s) > 0

    The :math:`q`-th order partition function is
    :math:`Z(q,s) = \sum_i \mu_i(s)^q`, and the generalised dimension is
    the scaling exponent

    .. math::
        D(q) = \frac{1}{q-1} \lim_{s\to 0} \frac{\log Z(q,s)}{\log s}

    estimated here via linear regression of :math:`\log Z(q,s)` against
    :math:`\log s` across the available scales (standard multifractal
    box-counting practice). :math:`q=1` (the information dimension) is a
    removable singularity of this formula; we approximate it with
    :math:`q=1.001`, a standard numerical practice for this method, not a
    separate model.

    Scope note: this is standard multifractal *box-counting*, not the
    wavelet-leader multifractal analysis the spec separately lists as a
    supplementary "add" -- see the module-level note on that.

    Returns
    -------
    Optional[Dict[float, float]]
        ``{q: D(q)}`` or ``None`` if too few scales produced usable data.
    """
    h, w = gray.shape
    per_scale_measures: Dict[int, np.ndarray] = {}

    for s in scales:
        if s > min(h, w) // 2:
            continue
        n_h, n_w = h // s, w // s
        if n_h < 1 or n_w < 1:
            continue
        crop = gray[:n_h * s, :n_w * s]
        reshaped = crop.reshape(n_h, s, n_w, s)
        box_max = reshaped.max(axis=(1, 3)).astype(np.float64)
        box_min = reshaped.min(axis=(1, 3)).astype(np.float64)
        delta = (box_max - box_min).ravel()
        # Standard multifractal box-counting practice: restrict the
        # measure's support to boxes with genuinely nonzero mass, rather
        # than epsilon-padding zero-delta (perfectly flat) boxes. Bug
        # caught via functional testing: an epsilon-padding version made
        # a heavily oversmoothed (AI-like) test image score a much WIDER
        # spectrum than an unsmoothed real-texture fixture -- backwards
        # from the intended physics -- because oversmoothing creates many
        # near-identical flat boxes whose epsilon-dominated mass then gets
        # amplified under negative q, measuring "count of flat boxes"
        # rather than genuine roughness variation. Excluding zero/near-
        # zero-delta boxes from the measure's support entirely avoids
        # this artifact.
        nonzero = delta > 0.5
        if nonzero.sum() < 4:
            continue
        mass = delta[nonzero]
        mass = mass / mass.sum()
        per_scale_measures[s] = mass

    if len(per_scale_measures) < 3:
        return None

    result: Dict[float, float] = {}
    for q in qs:
        q_eff = 1.001 if abs(q - 1.0) < 1e-6 else q
        log_s: List[float] = []
        log_z: List[float] = []
        for s, mass in per_scale_measures.items():
            z = float(np.sum(mass ** q_eff))
            if z > 0:
                log_s.append(float(np.log(s)))
                log_z.append(float(np.log(z)))
        if len(log_s) < 3:
            continue
        slope = float(np.polyfit(log_s, log_z, 1)[0])
        d_q = slope / (q_eff - 1.0)
        result[q] = d_q

    return result if len(result) >= 3 else None


def _signal_fractal_consistency(
    gray: np.ndarray,
    cfg: dict,
) -> Tuple[float, float, str]:
    r"""
    Signal 3 — Fractal Dimension Consistency + Multifractal Spectrum Width.

    Mathematical Model (base, unchanged)
    --------------------------------------
    Natural textures exhibit statistical self-similarity: their intensity
    surface is a fractal with dimension :math:`D \in [2, 3)`.  The
    differential box-counting method (Sarkar & Chaudhuri, 1994) estimates
    :math:`D` by tiling the image with boxes of size :math:`s \times s`
    and counting how many boxes of height :math:`s` are needed to cover
    the surface:

    .. math::
        N(s) = \sum_{i,j} \left\lceil
        \frac{\max(I_{s\times s}) - \min(I_{s\times s})}{s}
        \right\rceil

    The fractal dimension is the slope of :math:`\log N(s)` versus
    :math:`\log(1/s)`:

    .. math::
        D = -\frac{\mathrm{d}\log N(s)}{\mathrm{d}\log s}

    **Why this detects AI:**
    Real textures maintain a consistent :math:`D` across scale ranges
    because the underlying physical process (surface roughness, material
    micro-structure) is scale-invariant.  AI generators apply aggressive
    spectral filtering and denoising at fine scales, causing an abrupt
    drop in :math:`D` when :math:`s` becomes small (oversmoothing).
    We detect this by measuring the **consistency** of local slopes:

    .. math::
        C = 1 - \frac{\sigma_{D_{local}}}{|\bar{D}_{local}| + \varepsilon}

    where :math:`\sigma_{D_{local}}` is the standard deviation of
    slope estimates between adjacent scale pairs.  High :math:`C` = real;
    low :math:`C` = AI.

    Multifractal Spectrum Width (spec enhancement)
    -------------------------------------------------
    A single box-counting dimension only captures the *average* scaling
    behaviour (equivalent to :math:`D(1)`, weighting all regions equally).
    Real textures typically have genuinely varying local roughness --
    smooth patches next to rough ones -- which is exactly what makes a
    texture *multifractal*: different generalised dimensions
    :math:`D(q)` for different moment orders :math:`q`, since large
    positive :math:`q` emphasises the roughest regions and large negative
    :math:`q` emphasises the smoothest. AI-generated textures, produced
    by a spatially-uniform denoising/smoothing process, tend to have a
    much narrower spread of local roughness, i.e. a **narrower**
    :math:`D(q)` spectrum. We compute :math:`D(q)` for
    :math:`q \in \{-2,-1,0,1,2\}` via
    :func:`_multifractal_generalized_dimensions` and use the spectrum
    width :math:`W = D(-2) - D(2)` (should be non-negative for
    well-behaved multifractal spectra) as a second, independent measure
    of the same underlying physical claim, blended with the base
    consistency score below.

    Not implemented (flagged, not faked): the spec separately lists
    **wavelet-leader multifractal analysis** as a more robust alternative
    to box-counting. This module implements box-counting-based
    multifractality (a real, standard, and already partly-infrastructure-
    supported technique) rather than a full wavelet-leader pipeline
    (which needs a genuinely different estimator built on PyWavelets'
    wavelet-coefficient leaders and their own scaling-exponent
    regression) -- that is a substantially larger, separate piece of work
    than "add one more D(q) alongside the existing box count," and
    combining an unfinished/under-tested version of it would risk
    contributing noise rather than signal to the composite score.

    Parameters
    ----------
    gray : np.ndarray
        H×W uint8 grayscale image.
    cfg : dict
        ``l18_tsad`` threshold block.

    Returns
    -------
    Tuple[float, float, str]
        (composite_score, fractal_dimension, detail).
        composite_score ∈ [0, 1] where 1 = strongly consistent/broad (real).
    """
    h, w = gray.shape
    scales = cfg.get("scales", [2, 4, 8, 16, 32])

    log_n: List[float] = []
    log_inv_s: List[float] = []

    for s in scales:
        if s > min(h, w) // 2:
            continue
        n_h = h // s
        n_w = w // s
        if n_h < 1 or n_w < 1:
            continue

        # Vectorised differential box counting
        crop = gray[:n_h * s, :n_w * s]
        reshaped = crop.reshape(n_h, s, n_w, s)
        box_max = reshaped.max(axis=(1, 3))
        box_min = reshaped.min(axis=(1, 3))

        with np.errstate(divide="ignore", invalid="ignore"):
            n_boxes = np.ceil((box_max - box_min) / s).astype(np.int64)
        count = int(n_boxes.sum())

        if count > 0:
            log_n.append(float(np.log(count)))
            log_inv_s.append(float(np.log(1.0 / s)))

    if len(log_n) < 3:
        return 0.5, 0.0, "insufficient_scales"

    # Overall fractal dimension (slope of log-log fit)
    coeffs = np.polyfit(log_inv_s, log_n, 1)
    fd = float(coeffs[0])

    # Local slopes between adjacent scale pairs
    local_slopes: List[float] = []
    for i in range(len(log_n) - 1):
        dy = log_n[i + 1] - log_n[i]
        dx = log_inv_s[i + 1] - log_inv_s[i]
        if abs(dx) > 1e-9:
            local_slopes.append(dy / dx)

    if len(local_slopes) < 2:
        return 0.5, fd, "insufficient_local_slopes"

    mean_slope = float(np.mean(local_slopes))
    std_slope = float(np.std(local_slopes, ddof=0))

    with np.errstate(divide="ignore", invalid="ignore"):
        base_consistency = 1.0 - std_slope / (abs(mean_slope) + 1e-9)
    base_consistency = float(np.clip(base_consistency, 0.0, 1.0))

    # ── Multifractal spectrum width ─────────────────────────────────────
    qs = cfg.get("multifractal_qs", [-2, -1, 0, 1, 2])
    dq = _multifractal_generalized_dimensions(gray, scales, qs)

    width_factor = None
    width = None
    if dq is not None and -2 in dq and 2 in dq:
        width = dq[-2] - dq[2]
        w_real = _safe_float(cfg.get("multifractal_width_real_threshold", 0.15))
        w_ai = _safe_float(cfg.get("multifractal_width_ai_threshold", 0.03))
        width_factor = float(np.clip((width - w_ai) / (w_real - w_ai + 1e-9), 0.0, 1.0))

    if width_factor is not None:
        composite = 0.6 * base_consistency + 0.4 * width_factor
    else:
        composite = base_consistency

    width_str = f"{width:.4f}" if width is not None else "n/a"
    detail = f"fd={fd:.3f} consistency={base_consistency:.3f} mf_width={width_str}"
    return float(np.clip(composite, 0.0, 1.0)), fd, detail


def _local_binary_pattern(gray: np.ndarray) -> np.ndarray:
    r"""
    Vectorised 8-neighbour, radius-1 Local Binary Pattern (Ojala et al.,
    1994). Each pixel's code encodes whether each of its 8 neighbours is
    ``>=`` the centre value, giving a compact local micro-texture
    descriptor that is far more specific than a tile's mean/std/gradient
    summary alone (two tiles can share mean, std, and gradient statistics
    while having completely different micro-structure -- LBP captures the
    difference). Border pixels (no full 3x3 neighbourhood) are coded 0.
    """
    h, w = gray.shape
    center = gray[1:-1, 1:-1].astype(np.int16)
    shifts = [(-1, -1), (-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1)]
    code = np.zeros_like(center, dtype=np.uint8)
    for i, (dy, dx) in enumerate(shifts):
        neighbor = gray[1 + dy:h - 1 + dy, 1 + dx:w - 1 + dx].astype(np.int16)
        code = code | ((neighbor >= center).astype(np.uint8) << i)
    full = np.zeros(gray.shape, dtype=np.uint8)
    full[1:-1, 1:-1] = code
    return full


def _signal_texture_repetition(
    gray: np.ndarray,
    cfg: dict,
) -> Tuple[float, float, str]:
    r"""
    Signal 4 — Texture Repetition & Non-Local Self-Similarity Offset Analysis.

    Mathematical Model (base, enriched descriptor)
    -------------------------------------------------
    AI diffusion models decode fixed-size latent patches.  When the
    spatial extent of the generated texture exceeds the receptive field
    of a single latent position, the model may repeat similar feature
    vectors, producing quasi-periodic tile-like structures that are rare
    in natural textures.

    We detect this by dividing the image into non-overlapping
    :math:`t \times t` tiles and computing a descriptor per tile. The
    original 4-D statistical descriptor (mean, std, mean/std of gradient
    magnitude) is **enriched** here with an 8-bin Local Binary Pattern
    histogram (:func:`_local_binary_pattern`) per tile, giving a 12-D
    descriptor:

    .. math::
        \mathbf{d} = \left[
        \frac{\mu}{255},\;
        \frac{\sigma}{255},\;
        \frac{\bar{|\nabla I|}}{255},\;
        \frac{\sigma_{|\nabla I|}}{255},\;
        h_0, \dots, h_7
        \right]^{\!\top}

    LBP is a real (if lighter-weight than a CNN) local micro-texture
    fingerprint: two tiles can trivially share mean/std/gradient
    statistics while differing completely in fine structure, which the
    original 4-D descriptor could not tell apart. Tiles whose descriptors
    are within Euclidean distance ``duplicate_threshold`` are flagged as
    duplicates, same as before.

    Not implemented (flagged, not faked): the spec's suggested **deep
    CNN feature repetition** (a frozen MobileNetV3 backbone extracting
    128-D features per tile) is not implemented. This codebase has no
    ``torchvision`` dependency (only bare ``torch``, used elsewhere for
    HF text/audio models) and no pretrained-vision-model loading path;
    adding one means a new network dependency (weight download), a new
    inference cost per tile that risks blowing this layer's documented
    <250ms budget, and is a materially larger scope than this module's
    "existing TSAD helpers" charter. The LBP-enriched classical descriptor
    above is a real, if less powerful, substitute within the codebase's
    existing dependency footprint.

    Non-Local Self-Similarity Offset Analysis (spec requirement,
    the genuinely new discriminative signal)
    -------------------------------------------------------------
    A raw duplicate *count* alone is a weak signal: real photos routinely
    contain large uniform regions (sky, walls, out-of-focus backgrounds)
    that legitimately produce many similar tiles, with no AI involved.
    What the spec actually asks for is more specific and more diagnostic:
    whether highly-similar tile *pairs* recur at **specific, consistent
    spatial offsets** -- the fingerprint of a genuine fixed-pitch latent
    grid -- versus being scattered at many different offsets, which is
    what ordinary large-uniform-region duplication produces (a sky
    duplicates with *every* other sky tile, at every possible offset
    between them, not preferentially at one particular offset).

    For every pair of tiles whose descriptor distance clears the
    duplicate threshold, we record their tile-grid offset
    :math:`(\Delta r, \Delta c)` (sign-normalised so :math:`(i,j)` and
    :math:`(j,i)` count as the same offset) and build a histogram over
    observed offsets. The **offset regularity** is

    .. math::
        \text{regularity} = \frac{\max_k \text{count}(\text{offset}_k)}
        {\sum_k \text{count}(\text{offset}_k)}

    High regularity (many duplicate pairs sharing one specific offset) is
    the AI-consistent signature; low regularity (duplicate pairs spread
    across many different offsets, as ordinary uniform-region duplication
    produces) is real-consistent. This is only computed when there are
    enough duplicate pairs to assess a distribution over
    (``min_pairs_for_offset_analysis``, default 5) -- with too few pairs
    there's nothing meaningful to say about their spatial pattern, and we
    report that rather than guessing.

    Parameters
    ----------
    gray : np.ndarray
        H×W uint8 grayscale image.
    cfg : dict
        ``l18_tsad`` threshold block.

    Returns
    -------
    Tuple[float, float, str]
        (composite_metric, base_repetition_ratio, detail).
    """
    h, w = gray.shape
    tile_size = int(cfg.get("tile_size", 16))

    n_h = h // tile_size
    n_w = w // tile_size
    if n_h < 2 or n_w < 2:
        return 0.5, 0.0, "image_too_small"

    # ── Vectorised base descriptor (unchanged) ──────────────────────────
    crop = gray[:n_h * tile_size, :n_w * tile_size].astype(np.float32)
    tiles = crop.reshape(n_h, tile_size, n_w, tile_size)

    means = tiles.mean(axis=(1, 3)) / 255.0
    stds = tiles.std(axis=(1, 3)) / 255.0

    gx = cv2.Sobel(crop, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(crop, cv2.CV_32F, 0, 1, ksize=3)
    grad = np.sqrt(gx ** 2 + gy ** 2)
    grad_tiles = grad.reshape(n_h, tile_size, n_w, tile_size)
    grad_means = grad_tiles.mean(axis=(1, 3)) / 255.0
    grad_stds = grad_tiles.std(axis=(1, 3)) / 255.0

    # ── LBP histogram enrichment ─────────────────────────────────────────
    lbp = _local_binary_pattern(gray.astype(np.uint8))
    lbp_crop = lbp[:n_h * tile_size, :n_w * tile_size]
    n_bins = int(cfg.get("lbp_hist_bins", 8))
    lbp_hists = np.zeros((n_h, n_w, n_bins), dtype=np.float32)
    for i in range(n_h):
        for j in range(n_w):
            block = lbp_crop[i * tile_size:(i + 1) * tile_size, j * tile_size:(j + 1) * tile_size]
            hist, _ = np.histogram(block, bins=n_bins, range=(0, 256))
            total = hist.sum()
            if total > 0:
                lbp_hists[i, j] = hist / total

    descriptors = np.concatenate([
        np.stack([means, stds, grad_means, grad_stds], axis=2),
        lbp_hists,
    ], axis=2).reshape(n_h * n_w, 4 + n_bins).astype(np.float32)

    n_tiles = descriptors.shape[0]
    if n_tiles < 4:
        return 0.5, 0.0, "too_few_tiles"

    # ── Pairwise Euclidean distances (n_tiles is small: <= ~256 for a
    # 256px image with 16px tiles, so O(n^2) is cheap and lets us reuse
    # the exact pair list for the offset analysis below) ────────────────
    dup_thresh = _safe_float(cfg.get("duplicate_threshold", 0.15))
    diffs = descriptors[:, None, :] - descriptors[None, :, :]
    dist_mat = np.sqrt(np.sum(diffs ** 2, axis=2))
    np.fill_diagonal(dist_mat, np.inf)

    dup_pairs = np.argwhere((dist_mat < dup_thresh) & (np.triu(np.ones_like(dist_mat, dtype=bool), k=1)))
    dup_tiles = set(dup_pairs.ravel().tolist())
    repetition = len(dup_tiles) / max(n_tiles, 1)

    # ── Non-local self-similarity offset analysis ───────────────────────
    offset_regularity = None
    min_pairs = int(cfg.get("min_pairs_for_offset_analysis", 5))
    if len(dup_pairs) >= min_pairs:
        offset_counts: Dict[Tuple[int, int], int] = {}
        for a, b in dup_pairs:
            ra, ca = divmod(int(a), n_w)
            rb, cb = divmod(int(b), n_w)
            dr, dc = ra - rb, ca - cb
            if dr < 0 or (dr == 0 and dc < 0):
                dr, dc = -dr, -dc
            offset_counts[(dr, dc)] = offset_counts.get((dr, dc), 0) + 1
        total_pairs = sum(offset_counts.values())
        max_offset_count = max(offset_counts.values())
        offset_regularity = max_offset_count / total_pairs

    # ── Composite ────────────────────────────────────────────────────────
    # Offset regularity is the more specific, harder-to-confound signal
    # (see docstring); when available it dominates the composite. When
    # unavailable (too few duplicate pairs to assess), fall back to the
    # base repetition ratio alone.
    if offset_regularity is not None:
        composite = 0.4 * repetition + 0.6 * offset_regularity
    else:
        composite = repetition

    offset_str = f"{offset_regularity:.3f}" if offset_regularity is not None else "n/a"
    detail = (
        f"repetition={repetition:.3f} duplicates={len(dup_tiles)}/{n_tiles} "
        f"offset_regularity={offset_str} pairs={len(dup_pairs)}"
    )
    return float(np.clip(composite, 0.0, 1.0)), repetition, detail



# ═══════════════════════════════════════════════════════════════════════════════
# MODULE 9 (2026-08-27) — L18 TSAD: adaptive periodicity, orientation/jitter,
# multifractal spectrum, non-local offset analysis
# ═══════════════════════════════════════════════════════════════════════════════
# Per the spec's L18 TSAD section, scoped strictly to the four _signal_* helpers
# above and analyze_tsad() in this file.
#
# Implemented:
# 1. Autocorrelation Periodicity: adaptive full-range [2,128]px radial peak
#    search (was a fixed [8,16,32,64] list) + phase coherence at the detected
#    period. Two real correctness bugs found and fixed via functional testing
#    (see _compute is n/a here -- see _signal_autocorr_periodicity docstring):
#    missing mean-subtraction before the FFT (made the signal carry ~zero
#    discriminative power -- a genuine 8px grid and pure noise scored
#    identically), and a mis-derived lag formula (sampled at N/p instead of
#    p). A multiple-comparisons false-positive issue from the wide adaptive
#    search was also caught and fixed via a harmonic-support requirement.
# 2. Boundary Gradient Variance: added 4-orientation (0/45/90/135deg)
#    anisotropy and sub-pixel edge jitter via 4x supersampling, both feeding
#    into the composite as confidence modifiers on the (unchanged) base
#    variance metric.
# 3. Fractal Consistency: added a real multifractal D(q) spectrum (q in
#    [-2,2]) via generalised box-counting, blended with the existing
#    single-dimension consistency score. A measure-regularisation bug (found
#    via functional testing) that made an oversmoothed/AI-like test image
#    score a WIDER spectrum than an unsmoothed real texture -- backwards --
#    was fixed by excluding zero-mass boxes from the measure's support
#    instead of epsilon-padding them.
# 4. Texture Repetition: enriched the 4-D statistical descriptor with an
#    8-bin LBP histogram per tile, and added the spec's actual headline ask
#    -- non-local self-similarity OFFSET analysis (do duplicate tile pairs
#    cluster at one consistent spatial offset, the latent-grid fingerprint,
#    vs. scattered offsets, which is what ordinary large-uniform-region
#    duplication in real photos produces). The duplicate-distance threshold
#    required real recalibration for the new 12-D descriptor (see bugfix
#    note in _signal_texture_repetition) -- an unchanged 0.15 threshold
#    caused ~97% of all tile pairs in an ordinary non-repeating real texture
#    to register as "duplicate".
#
# Not implemented (flagged, not faked):
# - Autocorrelation: a "database of expected grid signatures per model"
#   (SD1.5/SDXL/Flux/DALL-E/Midjourney) is a curated-fingerprint-library
#   effort, not a per-image analyzer change -- out of this module's scope.
# - Fractal: wavelet-leader multifractal analysis (spec's suggested more
#   robust alternative to box-counting) is a materially different estimator
#   built on PyWavelets wavelet-coefficient leaders, not a small addition to
#   the existing box-counting infra -- not implemented; the (real,
#   functioning) box-counting-based D(q) spectrum above is what ships.
# - Texture Repetition: a frozen MobileNetV3 deep-feature extractor is not
#   implemented -- no torchvision dependency exists in this codebase, and
#   adding pretrained-CNN inference risks this layer's documented <250ms
#   budget. The LBP-enriched classical descriptor is the real, in-scope
#   substitute.


def analyze_tsad(
    img: np.ndarray,
    img_pil: Any = None,
) -> Dict[str, Any]:
    r"""
    Layer 18: Texture Synthesis Artifact Detection (TSAD).

    Detects statistical artifacts introduced by AI texture synthesis:

    1. **Latent Grid Periodicity** — adaptive radial peak search across
       2-128 px lags (not a fixed period list) in the mean-subtracted 2-D
       autocorrelation, plus phase coherence across image tiles at the
       detected period. AI decoders apply the same kernel everywhere, so
       a genuine latent-grid artifact is both periodic *and* phase-locked
       across the whole frame; ordinary noise at the same frequency is
       not.
    2. **Boundary Gradient Suppression** — AI-generated object boundaries
       lack the natural micro-roughness of real edges; gradient variance
       in the boundary band is anomalously low and close to isotropic
       across edge orientation, with edges close to pixel-grid-locked
       (near-zero sub-pixel jitter).
    3. **Fractal Dimension Inconsistency** — real textures are
       statistically self-similar across scales and genuinely
       multifractal (broad D(q) spectrum, varying local roughness); AI
       textures show an abrupt dimension drop at fine scales and a
       narrower multifractal spectrum from spatially-uniform smoothing.
    4. **Texture Repetition** — latent-grid decoding produces
       near-duplicate tiles that recur at one consistent spatial offset
       (the grid pitch); real photos' duplicate regions (skies, walls)
       instead pair up at many different offsets.

    Input Validation
    ----------------
    * ``img`` must be H×W×3 uint8 RGB.
    * Invalid inputs return ``{"status":"failure","layerSuspicionScore":0.5}``.

    Performance
    -----------
    * Expected runtime on 768 px RGB: **< 250 ms** (single CPU core).
    * Memory overhead: **< 120 MB** (FFT buffers + tile descriptors).
    * Complexity: :math:`O(H \cdot W \log(H \cdot W))` dominated by FFT.

    Parameters
    ----------
    img : np.ndarray
        H×W×3 uint8 RGB image.
    img_pil : PIL.Image, optional
        Unused; kept for API consistency.

    Returns
    -------
    dict
        Standard LayerReport with evidence nodes for autocorrelation,
        boundary variance, fractal consistency, and texture repetition.
    """
    t0 = time.monotonic()
    layer_num = 18
    layer_name = "Texture Synthesis Artifact Detection"

    # ── Input validation ─────────────────────────────────────────────────
    if img is None or not isinstance(img, np.ndarray):
        return build_layer_report(
            layer_num, layer_name, [], "failure", 0, score=0.5
        )
    if img.ndim != 3 or img.shape[2] != 3:
        return build_layer_report(
            layer_num, layer_name, [], "failure", 0, score=0.5
        )
    if img.dtype != np.uint8:
        try:
            img = np.clip(img, 0, 255).astype(np.uint8)
        except Exception:
            return build_layer_report(
                layer_num, layer_name, [], "failure", 0, score=0.5
            )

    try:
        cfg = _load_thresholds("l18_tsad")
        if not cfg:
            logger.warning("[TSAD] Empty threshold config; using safe defaults.")

        # ── Resize for speed (texture analysis is scale-robust) ──────────
        h, w = img.shape[:2]
        max_side = int(cfg.get("resize_max", 256))
        if max(h, w) > max_side:
            scale = max_side / max(h, w)
            new_w = max(1, int(w * scale))
            new_h = max(1, int(h * scale))
            img_resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
        else:
            img_resized = img

        gray = cv2.cvtColor(img_resized, cv2.COLOR_RGB2GRAY)

        # Neutral scene check: insufficient texture variation
        gray_f = gray.astype(np.float32)
        if gray_f.var() < 20.0:
            elapsed = int((time.monotonic() - t0) * 1000)
            ev = _build_evidence_node(
                layer_num, "low_texture_variance", "inconclusive",
                0.0, "Image lacks sufficient texture variation for analysis", 0.0
            )
            return build_layer_report(
                layer_num, layer_name, [ev], "success", elapsed, score=0.5
            )

        evidence: List[dict] = []
        fw = cfg.get("fusion_weights", {})

        # ── Signal 1: Autocorrelation Periodicity ────────────────────────
        ac_cfg = cfg.get("autocorr", {})
        ac_metric, ac_raw, ac_detail = _signal_autocorr_periodicity(gray, ac_cfg)
        ac_real = _safe_float(ac_cfg.get("real_threshold", 5.0))
        ac_ai = _safe_float(ac_cfg.get("ai_threshold", 8.0))
        ac_suspicion = _score_from_metric(ac_metric, ac_real, ac_ai)
        ac_status, ac_conf = _map_suspicion_to_status_confidence(ac_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "autocorr_peak_ratio", ac_status, ac_conf,
            f"Autocorrelation: {ac_detail}. "
            f"AI shows periodic, phase-coherent peaks at latent-grid lags.",
            ac_metric,
        ))

        # ── Signal 2: Boundary Gradient Variance ─────────────────────────
        bd_cfg = cfg.get("boundary", {})
        bd_metric, bd_raw, bd_detail = _signal_boundary_gradient_variance(gray, bd_cfg)
        bd_real = _safe_float(bd_cfg.get("real_threshold", 45.0))
        bd_ai = _safe_float(bd_cfg.get("ai_threshold", 12.0))
        bd_suspicion = _score_from_metric(bd_metric, bd_real, bd_ai)
        bd_status, bd_conf = _map_suspicion_to_status_confidence(bd_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "boundary_gradient_variance", bd_status, bd_conf,
            f"Boundary variance: {bd_detail}. "
            f"Real edges have micro-roughness; AI edges are unnaturally smooth.",
            bd_metric,
        ))

        # ── Signal 3: Fractal Consistency ────────────────────────────────
        fr_cfg = cfg.get("fractal", {})
        fr_metric, fr_raw, fr_detail = _signal_fractal_consistency(gray, fr_cfg)
        fr_real = _safe_float(fr_cfg.get("real_threshold", 0.85))
        fr_ai = _safe_float(fr_cfg.get("ai_threshold", 0.55))
        fr_suspicion = _score_from_metric(fr_metric, fr_real, fr_ai)
        fr_status, fr_conf = _map_suspicion_to_status_confidence(fr_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "fractal_dimension_consistency", fr_status, fr_conf,
            f"Fractal: {fr_detail}. "
            f"Real textures are self-similar; AI shows scale-dependent cutoff.",
            fr_metric,
        ))

        # ── Signal 4: Texture Repetition ───────────────────────────────
        rp_cfg = cfg.get("repetition", {})
        rp_metric, rp_raw, rp_detail = _signal_texture_repetition(gray, rp_cfg)
        rp_real = _safe_float(rp_cfg.get("real_threshold", 0.15))
        rp_ai = _safe_float(rp_cfg.get("ai_threshold", 0.40))
        rp_suspicion = _score_from_metric(rp_metric, rp_real, rp_ai)
        rp_status, rp_conf = _map_suspicion_to_status_confidence(rp_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "texture_repetition", rp_status, rp_conf,
            f"Repetition: {rp_detail}. "
            f"AI latent grids produce near-duplicate tiles.",
            rp_metric,
        ))

        # ── Composite Fusion ─────────────────────────────────────────────
        scores = [ac_suspicion, bd_suspicion, fr_suspicion, rp_suspicion]
        weights = [
            _safe_float(fw.get("autocorr", 1.0)),
            _safe_float(fw.get("boundary", 0.9)),
            _safe_float(fw.get("fractal", 1.1)),
            _safe_float(fw.get("repetition", 0.8)),
        ]

        active = [(s, w) for s, w in zip(scores, weights) if s != 0.5]
        if active:
            composite = sum(s * w for s, w in active) / sum(w for _, w in active)
        else:
            composite = 0.5

        elapsed = int((time.monotonic() - t0) * 1000)
        return build_layer_report(
            layer_num, layer_name, evidence, "success", elapsed,
            score=round(float(np.clip(composite, 0.0, 1.0)), 4)
        )

    except Exception as exc:
        logger.warning("[TSAD] Analysis failed: %s", exc, exc_info=True)
        elapsed = int((time.monotonic() - t0) * 1000)
        return build_layer_report(
            layer_num, layer_name, [], "failure", elapsed, score=0.5
        )



# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 5 — L19: OBJECT-SCENE INTERACTION PHYSICS (OSIP)
# ═══════════════════════════════════════════════════════════════════════════════


def _shadow_signature_for_component(
    gray_f: np.ndarray,
    comp_mask: np.ndarray,
    cfg: dict,
) -> Optional[Dict[str, Any]]:
    r"""
    Per-object shadow signature: contact attachment, dark-band principal
    axis (estimated cast-shadow direction), and penumbra width, computed
    from a single connected-component object mask.

    This is the per-object building block used by
    :func:`_signal_shadow_binding` to (a) test contact attachment for each
    object independently and (b) collect one shadow-direction estimate per
    object so that multi-object scenes can be checked for a **single
    consistent light source** rather than only testing one global boundary
    band as the previous implementation did.

    Returns ``None`` if the component has too few boundary pixels to judge.
    """
    inner = int(cfg.get("inner_offset", 2))
    band = int(cfg.get("shadow_band_width", 6))
    dark_thresh = _safe_float(cfg.get("darkness_threshold", 0.15))

    dist_in = cv2.distanceTransform(comp_mask, cv2.DIST_L2, 5)
    dist_out = cv2.distanceTransform(255 - comp_mask, cv2.DIST_L2, 5)

    near_band = (dist_out >= 1) & (dist_out <= band)
    far_band = (dist_out > band) & (dist_out <= band + 4)
    inner_band = (dist_in >= 1) & (dist_in <= inner + 2)

    if near_band.sum() < 40:
        return None

    near_vals = gray_f[near_band]
    far_vals = gray_f[far_band] if far_band.sum() > 20 else np.array([1.0])
    inner_vals = gray_f[inner_band] if inner_band.sum() > 20 else np.array([1.0])

    near_mean = float(near_vals.mean())
    far_mean = float(far_vals.mean())
    inner_mean = float(inner_vals.mean())

    binding = 0.0
    if near_mean + dark_thresh < inner_mean and near_mean + dark_thresh < far_mean:
        binding = 1.0
    elif near_mean < inner_mean and near_mean < far_mean:
        binding = 0.6
    elif near_mean < max(inner_mean, far_mean):
        binding = 0.3

    # Dark-band principal axis: the eigenvector of the largest eigenvalue of
    # the dark-pixel coordinate covariance approximates the cast-shadow
    # direction (the axis the shadow extends along), and its eccentricity
    # approximates how directionally concentrated (vs. blob-like/ambient)
    # that darkening is.
    dark_band = (gray_f < near_mean + 0.05) & near_band
    axis_angle: Optional[float] = None
    eccentricity = 0.5
    centroid = None
    coords = np.argwhere(dark_band)
    if coords.shape[0] > 10:
        coords_f = coords.astype(np.float32)
        centroid = coords_f.mean(axis=0)  # (y, x)
        centered = coords_f - centroid
        cov = np.cov(centered.T)
        eigvals, eigvecs = np.linalg.eigh(cov)
        with np.errstate(divide="ignore", invalid="ignore"):
            eccentricity = float(np.clip(
                1.0 - np.sqrt(np.min(eigvals) / (np.max(eigvals) + 1e-9)), 0.0, 1.0
            ))
        major = eigvecs[:, int(np.argmax(eigvals))]  # (dy, dx)
        # Orient the axis outward, away from the object's own centroid, so
        # direction comparisons across objects are on a comparable footing.
        obj_coords = np.argwhere(comp_mask > 0)
        if obj_coords.shape[0] > 0 and centroid is not None:
            obj_centroid = obj_coords.mean(axis=0)
            outward = centroid - obj_centroid
            if float(np.dot(outward, major)) < 0:
                major = -major
        axis_angle = float(math.atan2(major[0], major[1]))  # image-space angle

    penumbra = 0.0
    if axis_angle is not None:
        direction = (math.cos(axis_angle), math.sin(axis_angle))
        boundary_pts = _get_boundary_points(comp_mask, max_points=600)
        _, _, penumbra = _sample_directional_contact_shadow(
            gray_f * 255.0, comp_mask, cfg, direction, boundary_pts
        )

    return {
        "binding": binding,
        "near_mean": near_mean,
        "far_mean": far_mean,
        "inner_mean": inner_mean,
        "axis_angle": axis_angle,
        "eccentricity": eccentricity,
        "penumbra_px": penumbra,
        "near_band_mask": near_band,
        "far_band_mask": far_band,
        "area": float(comp_mask.sum() / 255.0),
    }


def _shadow_color_signature(
    img_color: np.ndarray,
    sig: Dict[str, Any],
) -> Optional[float]:
    r"""
    Blue-shift check for one object's shadow.

    Real cast shadows are lit primarily by scattered skylight rather than
    the direct (often warmer) key light, so the shadowed region tends to
    read bluer relative to its own lit surround than pure attenuation of
    the same surface color would predict:

    .. math::
        \Delta_{blue} = \frac{B_{near}}{R_{near}+\epsilon} - \frac{B_{far}}{R_{far}+\epsilon}

    AI-generated shadows are frequently produced by a flat multiplicative
    darkening of the same pixels, which preserves chromaticity
    (:math:`\Delta_{blue} \approx 0`) or, in some generators, skews the
    shadow toward neutral gray/black instead.

    This is a heuristic proxy, not a colorimetric measurement (no white
    balance / illuminant estimation is performed here) — it is intended as
    a weak corroborating signal, not a standalone verdict.
    """
    near_mask = sig.get("near_band_mask")
    far_mask = sig.get("far_band_mask")
    if near_mask is None or far_mask is None:
        return None
    if near_mask.sum() < 20 or far_mask.sum() < 20:
        return None

    img_f = img_color.astype(np.float32)
    near_rgb = img_f[near_mask]
    far_rgb = img_f[far_mask]

    near_br = float(near_rgb[:, 2].mean()) / (float(near_rgb[:, 0].mean()) + 1e-6)
    far_br = float(far_rgb[:, 2].mean()) / (float(far_rgb[:, 0].mean()) + 1e-6)
    return near_br - far_br


def _signal_shadow_binding(
    gray: np.ndarray,
    mask: np.ndarray,
    cfg: dict,
    img_color: Optional[np.ndarray] = None,
) -> Tuple[float, float, str, Dict[str, Any]]:
    r"""
    Signal 1 — Full Shadow-Physics Consistency.

    Enhanced from a single global boundary-band scan to a **per-object,
    multi-shadow consistency check**, which is what actually lets us test
    the "single light source" constraint the spec calls for — a single
    object can only ever give you one direction estimate, never a
    consistency check.

    For every connected component of the object mask we independently
    measure:

    1. **Contact attachment** — as before: near-boundary intensity must be
       darker than both the object interior and the far background.
    2. **Cast-shadow direction** — the principal axis of the dark band
       just outside the object, oriented outward from the object centroid.
    3. **Penumbra width** — the 10%-90% intensity transition width along
       that axis (reuses the OBP directional sampler, which already
       implements this profile measurement).
    4. **Shadow color** — B/R ratio shift between the near (shadow) band
       and the far (lit background) band.

    Across all objects with a valid direction estimate we then test:

    * **Single-light-source consistency** — circular standard deviation of
      the per-object shadow-axis angles (using the doubled-angle trick
      since a PCA axis has no inherent sign). Real scenes lit by one
      dominant source (sun, single lamp) should show low dispersion;
      shadows glued on independently per object should not.
    * **Softness (penumbra) consistency** — coefficient of variation of
      penumbra widths, each normalized by :math:`\sqrt{\text{object area}}`
      as a coarse stand-in for object scale/distance, since the spec's
      "penumbra scales with distance to light" claim needs an actual
      distance estimate we don't have from a single 2-D image; we
      therefore only check that normalized softness is *consistent*
      across objects, not that it follows a specific distance law.

    With only one object detected, cross-object checks are not
    computable and are reported as neutral (0.5) rather than guessed.

    Parameters
    ----------
    gray : np.ndarray
        H×W uint8 grayscale image.
    mask : np.ndarray
        H×W uint8 binary object mask (0 or 255), may contain multiple
        disjoint components.
    cfg : dict
        ``l19_osip`` → ``shadow`` threshold block.
    img_color : np.ndarray, optional
        H×W×3 uint8 RGB image, same resolution as ``gray``/``mask``. Used
        for the shadow-color blue-shift check; if omitted, that check is
        skipped (reported neutral).

    Returns
    -------
    Tuple[float, float, str, dict]
        (binding_score, direction_consistency, detail, extras) where
        ``extras`` carries the color/softness sub-scores for separate
        evidence nodes. binding_score ∈ [0, 1], 1 = strongly real.
    """
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    components = [i for i in range(1, num_labels) if stats[i, cv2.CC_STAT_AREA] >= 60]

    if not components:
        extras = {"color_score": 0.5, "softness_score": 0.5, "light_source_deg": None}
        return 0.5, 0.5, "no_significant_objects", extras

    gray_f = gray.astype(np.float32) / 255.0
    sigs: List[Dict[str, Any]] = []
    for lbl in components:
        comp_mask = np.where(labels == lbl, 255, 0).astype(np.uint8)
        sig = _shadow_signature_for_component(gray_f, comp_mask, cfg)
        if sig is not None:
            sigs.append(sig)

    if not sigs:
        extras = {"color_score": 0.5, "softness_score": 0.5, "light_source_deg": None}
        return 0.5, 0.5, "insufficient_boundary_pixels", extras

    bindings = [s["binding"] for s in sigs]
    mean_binding = float(np.mean(bindings))

    angled = [s for s in sigs if s["axis_angle"] is not None]
    n_objects = len(sigs)

    if len(angled) >= 2:
        # Doubled-angle circular statistics: a PCA axis is a *line*, not a
        # *vector* (no head/tail), so angle and angle+pi are the same axis.
        doubled = np.array([2.0 * a["axis_angle"] for a in angled])
        c = float(np.mean(np.cos(doubled)))
        s = float(np.mean(np.sin(doubled)))
        resultant = math.hypot(c, s)
        circ_std = math.sqrt(max(0.0, -2.0 * math.log(max(resultant, 1e-9))))
        direction_consistency = float(np.clip(1.0 - circ_std / (math.pi / 2.0), 0.0, 1.0))
        light_source_deg = float(np.degrees(0.5 * math.atan2(s, c)))
        cross_check_note = f"n_objects={n_objects} circ_std={circ_std:.2f}rad"
    else:
        mean_ecc = float(np.mean([s["eccentricity"] for s in sigs]))
        direction_consistency = mean_ecc
        light_source_deg = angled[0]["axis_angle"] and float(np.degrees(angled[0]["axis_angle"]))
        cross_check_note = "single_object_no_cross_light_check"

    # ── Softness (penumbra) consistency across objects ─────────────────
    softness_score = 0.5
    penumbras = [(s["penumbra_px"], s["area"]) for s in sigs if s["penumbra_px"] > 0 and s["area"] > 0]
    if len(penumbras) >= 2:
        normed = np.array([p / math.sqrt(a) for p, a in penumbras])
        mean_n = float(normed.mean())
        if mean_n > 1e-6:
            cv = float(normed.std() / mean_n)
            softness_score = float(np.clip(1.0 - cv, 0.0, 1.0))

    # ── Shadow color / blue-shift ───────────────────────────────────────
    color_score = 0.5
    if img_color is not None and img_color.shape[:2] == gray.shape[:2]:
        shifts = [_shadow_color_signature(img_color, s) for s in sigs]
        shifts = [v for v in shifts if v is not None]
        if shifts:
            mean_shift = float(np.mean(shifts))
            # Heuristic mapping (not colorimetrically calibrated): a
            # positive shift (near band relatively bluer than far band)
            # is consistent with skylight-filled real shadows.
            color_score = float(np.clip(0.5 + mean_shift * 4.0, 0.0, 1.0))

    score = (
        mean_binding * 0.40
        + direction_consistency * 0.20
        + color_score * 0.20
        + softness_score * 0.20
    )

    extras = {
        "color_score": color_score,
        "softness_score": softness_score,
        "light_source_deg": light_source_deg,
    }
    detail = (
        f"binding={mean_binding:.2f} dir_cons={direction_consistency:.2f} "
        f"color={color_score:.2f} softness={softness_score:.2f} ({cross_check_note})"
    )
    return float(np.clip(score, 0.0, 1.0)), direction_consistency, detail, extras


def _best_symmetry_band_at_angle(
    grad: np.ndarray,
    theta_deg: float,
    band: int,
) -> Tuple[Optional[int], List[float]]:
    r"""
    Rotate the gradient-magnitude image so a candidate reflection axis at
    ``theta_deg`` becomes horizontal, then run the row-band symmetry scan
    (upper strip vs. flipped lower strip) used by the original
    horizontal-only implementation. Returns the row (in rotated
    coordinates) with the best correlation and the full per-row score list
    used later for ripple analysis, or ``(None, [])`` if nothing usable.

    This generalizes reflection-plane detection from "horizontal only" to
    an arbitrary orientation by search rather than by deriving a closed-form
    axis (a true closed-form estimate would need calibrated camera geometry
    we don't have from a single 2-D image without further scene priors).
    """
    h, w = grad.shape
    if theta_deg == 0.0:
        rotated = grad
    else:
        center = (w / 2.0, h / 2.0)
        m = cv2.getRotationMatrix2D(center, theta_deg, 1.0)
        rotated = cv2.warpAffine(grad, m, (w, h), flags=cv2.INTER_LINEAR)

    rh = rotated.shape[0]
    row_step = max(1, rh // 40)
    best_row = None
    best_corr = -2.0
    scores: List[float] = []
    for y in range(band, rh - band, row_step):
        upper = rotated[y - band:y, :].ravel()
        lower = rotated[y:y + band, :][::-1, :].ravel()
        if upper.std() > 1.0 and lower.std() > 1.0:
            with np.errstate(invalid="ignore"):
                c = float(np.corrcoef(upper, lower)[0, 1])
            if math.isfinite(c):
                scores.append(c)
                if c > best_corr:
                    best_corr = c
                    best_row = y
    return best_row, scores


def _reflection_color_attenuation(
    img_color: np.ndarray,
    theta_deg: float,
    row: int,
    band: int,
) -> Optional[Tuple[float, float]]:
    r"""
    Compare mean brightness and blue-ness of the "source" strip against the
    flipped "reflected" strip around the winning symmetry axis (in the
    rotated frame used to find that axis).

    Real reflections attenuate and cool the reflected image slightly
    (Fresnel reflectance drops below 1 at near-normal incidence, and water
    adds selective absorption that skews toward blue); a naive copy/paste
    or AI-hallucinated reflection often has equal or wrong-direction
    attenuation.

    Returns (delta_brightness, delta_blue_ratio) where positive values mean
    the reflected strip is darker/bluer than the source strip (real-like),
    or ``None`` if the strip is degenerate.
    """
    h, w = img_color.shape[:2]
    center = (w / 2.0, h / 2.0)
    if theta_deg == 0.0:
        rotated = img_color
    else:
        m = cv2.getRotationMatrix2D(center, theta_deg, 1.0)
        rotated = cv2.warpAffine(img_color, m, (w, h), flags=cv2.INTER_LINEAR)

    rh = rotated.shape[0]
    if row - band < 0 or row + band > rh:
        return None
    source = rotated[row - band:row, :, :].astype(np.float32)
    reflected = rotated[row:row + band, :, :].astype(np.float32)
    if source.size == 0 or reflected.size == 0:
        return None

    src_bright = float(source.mean())
    refl_bright = float(reflected.mean())
    src_br_ratio = float(source[..., 2].mean()) / (float(source[..., 0].mean()) + 1e-6)
    refl_br_ratio = float(reflected[..., 2].mean()) / (float(reflected[..., 0].mean()) + 1e-6)

    delta_brightness = src_bright - refl_bright
    delta_blue = refl_br_ratio - src_br_ratio
    return delta_brightness, delta_blue


def _signal_reflection_consistency(
    gray: np.ndarray,
    cfg: dict,
    img_color: Optional[np.ndarray] = None,
) -> Tuple[float, float, str, Dict[str, Any]]:
    r"""
    Signal 2 — Reflection Consistency (Mirror / Water Realism), generalized
    to arbitrary reflection-plane orientation.

    Mathematical Model
    ------------------
    Real reflections obey the law of reflection: the angle of incidence
    equals the angle of reflection, which for a planar reflector implies
    geometric symmetry across the reflection plane. The previous
    implementation only ever tested a horizontal plane. We instead search
    a small bank of candidate plane orientations (0°/horizontal,
    90°/vertical, and several intermediate angles), rotate the
    gradient-magnitude image so each candidate becomes horizontal, and
    reuse the row-band correlation scan at each orientation, keeping the
    orientation and row with the strongest symmetry response.

    At the winning axis we additionally check:

    * **Color/attenuation** — real reflections are dimmer and slightly
      bluer than their source (Fresnel falloff + selective absorption in
      water); a flat color copy or backwards attenuation is suspicious.
    * **Ripple / spatial variation** — real water reflections have
      spatially-varying distortion (never perfectly uniform along the
      axis); we approximate this via the standard deviation of
      block-wise correlation along the winning row, since a full ripple
      field reconstruction is not identifiable from a single frame.

    Parameters
    ----------
    gray : np.ndarray
        H×W uint8 grayscale image.
    cfg : dict
        ``l19_osip`` → ``reflection`` threshold block.
    img_color : np.ndarray, optional
        H×W×3 uint8 RGB image for the color/attenuation check.

    Returns
    -------
    Tuple[float, float, str, dict]
        (reflection_score, mean_correlation, detail, extras).
        reflection_score ∈ [0, 1], 1 = strongly real reflection.
    """
    h, w = gray.shape
    band = int(cfg.get("symmetry_search_band", 8))
    angle_candidates = cfg.get("angle_candidates_deg", [0.0, 90.0, 20.0, -20.0, 45.0, -45.0])

    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    grad = np.sqrt(gx ** 2 + gy ** 2)

    best_theta = None
    best_row = None
    best_scores: List[float] = []
    best_mean_corr = -2.0
    for theta in angle_candidates:
        row, scores = _best_symmetry_band_at_angle(grad, float(theta), band)
        if row is None or not scores:
            continue
        mean_c = float(np.mean(scores))
        if mean_c > best_mean_corr:
            best_mean_corr = mean_c
            best_theta = float(theta)
            best_row = row
            best_scores = scores

    extras: Dict[str, Any] = {"axis_deg": None, "color_score": 0.5, "ripple_score": 0.5}
    if best_theta is None:
        return 0.5, 0.0, "no_symmetry_bands_detected", extras

    mean_corr = best_mean_corr
    max_corr = float(np.max(best_scores))
    extras["axis_deg"] = best_theta

    if mean_corr < 0.3:
        symmetry_score = mean_corr
    elif max_corr > 0.98 and mean_corr > 0.90:
        symmetry_score = 0.4
    else:
        symmetry_score = mean_corr

    # ── Ripple / spatial variation along the winning axis ──────────────
    ripple_score = 0.5
    if len(best_scores) >= 6:
        std_along_axis = float(np.std(best_scores))
        # Some spatial variation (moderate std) is consistent with real
        # water/imperfect-mirror ripple; near-zero variation (perfectly
        # uniform symmetry everywhere) or chaotic variation (essentially
        # no coherent reflection at all) are both suspicious.
        if std_along_axis < 0.02:
            ripple_score = 0.35  # suspiciously uniform
        elif std_along_axis > 0.45:
            ripple_score = 0.35  # too chaotic to be a coherent reflection
        else:
            ripple_score = float(np.clip(0.5 + (std_along_axis - 0.02) * 1.5, 0.0, 1.0))
    extras["ripple_score"] = ripple_score

    # ── Color / attenuation at the winning axis ─────────────────────────
    color_score = 0.5
    if img_color is not None and img_color.shape[:2] == gray.shape[:2] and best_row is not None:
        result = _reflection_color_attenuation(img_color, best_theta, best_row, band)
        if result is not None:
            delta_brightness, delta_blue = result
            # Real: reflected strip modestly darker and/or bluer.
            combined = (delta_brightness / 255.0) + delta_blue
            color_score = float(np.clip(0.5 + combined * 3.0, 0.0, 1.0))
    extras["color_score"] = color_score

    score = symmetry_score * 0.5 + color_score * 0.25 + ripple_score * 0.25

    detail = (
        f"axis={best_theta:.0f}deg mean_corr={mean_corr:.3f} max_corr={max_corr:.3f} "
        f"color={color_score:.2f} ripple={ripple_score:.2f} bands={len(best_scores)}"
    )
    return float(np.clip(score, 0.0, 1.0)), mean_corr, detail, extras


def _classify_junction(
    neighbours: np.ndarray,
    centre_y: int,
    centre_x: int,
    tol: float,
) -> Optional[str]:
    r"""
    Classify a degree-3 or degree-4 edge branch point into a junction type
    from the angular pattern of its neighbours, generalizing the previous
    T-only classifier to T / Y / X (L-junctions, degree-2 corners, are
    handled separately by :func:`_classify_corner` since they are not
    branch points).

    * **T-junction**: one gap ≈ 180° (the continuous "bar" — foreground
      occluder boundary) and two gaps ≈ 90° (the "stem" — terminating
      background boundary).
    * **Y-junction**: three gaps each ≈ 120° (three surfaces meeting at a
      convex/concave corner, no single continuous edge).
    * **X-junction**: four gaps each ≈ 90° (two edges crossing, e.g. two
      independent occluders overlapping at a point).
    """
    angles = sorted(
        math.atan2(dy - centre_y, dx - centre_x) for (dy, dx) in neighbours
    )
    n = len(angles)
    diffs = []
    for i in range(n):
        a1 = angles[i]
        a2 = angles[(i + 1) % n]
        diffs.append(abs((a2 - a1 + math.pi) % (2 * math.pi) - math.pi))

    if n == 3:
        sd = sorted(diffs, reverse=True)
        if (abs(sd[0] - math.pi) < tol * 2 and
                abs(sd[1] - math.pi / 2) < tol and
                abs(sd[2] - math.pi / 2) < tol):
            return "T"
        target = 2.0 * math.pi / 3.0
        if all(abs(d - target) < tol * 1.3 for d in diffs):
            return "Y"
        return None
    if n == 4:
        target = math.pi / 2.0
        if all(abs(d - target) < tol for d in diffs):
            return "X"
        return None
    return None


def _classify_corner(
    neighbours: np.ndarray,
    centre_y: int,
    centre_x: int,
    tol: float,
) -> bool:
    """L-junction: a degree-2 edge point whose two arms meet at ~90° (a
    sharp turn), as opposed to ~180° (a straight edge segment, not a
    corner)."""
    if len(neighbours) != 2:
        return False
    a1 = math.atan2(neighbours[0][0] - centre_y, neighbours[0][1] - centre_x)
    a2 = math.atan2(neighbours[1][0] - centre_y, neighbours[1][1] - centre_x)
    gap = abs((a2 - a1 + math.pi) % (2 * math.pi) - math.pi)
    return abs(gap - math.pi / 2.0) < tol


def _signal_occlusion_t_junctions(
    gray: np.ndarray,
    cfg: dict,
    labels: Optional[np.ndarray] = None,
) -> Tuple[float, int, str, Dict[str, Any]]:
    r"""
    Signal 3 — Dense Occlusion-Junction Detection + Depth-Ordering Graph.

    Mathematical Model
    ------------------
    When one object partially occludes another, the boundary of the
    foreground object meets the boundary of the background object at a
    **T-junction** (Kanizsa, 1979). Natural scenes produce a characteristic
    *distribution* of junction types dominated by T-junctions, with fewer
    Y (three-surface corners), L (silhouette corners) and X (crossing
    occluders) junctions. AI generators frequently under-produce
    T-junctions specifically, because diffusion models don't reason about
    explicit depth ordering the way real occlusion geometry enforces it.

    **Algorithm:**
    1. Detect Canny edges, dilate slightly for 8-connectivity robustness.
    2. At each sampled edge pixel, classify by neighbour count/pattern into
       T, Y, X (branch points) or L (2-neighbour corners).
    3. Score the junction-type distribution against the expected natural
       ranking T ≥ Y ≥ L ≥ X (rank-inversion penalty).
    4. **Depth-ordering cycle check** (scoped-down, approximate): at each
       T-junction, the perpendicular "stem" arm points into the occluded
       (background) region and the collinear "bar" arms belong to the
       occluder's continuous silhouette. Where a T-junction's bar/stem
       sides fall on two *different* connected components of the object
       mask, we record a directed "front of" edge between those two
       components. Real scenes should yield a consistent partial order
       (no A-in-front-of-B and B-in-front-of-A both implied); AI composites
       more often produce contradictory local cues, which shows up as
       cycles in this graph.

       This uses the coarse adaptive-threshold mask's own connected
       components as a stand-in for object identity, not true instance
       segmentation — it can only flag contradictions *between components
       that mask segmentation actually separated*, and is reported as
       "insufficient" rather than guessed when fewer than two components
       with inter-component junctions are found.

    Parameters
    ----------
    gray : np.ndarray
        H×W uint8 grayscale image.
    cfg : dict
        ``l19_osip`` → ``occlusion`` threshold block.
    labels : np.ndarray, optional
        H×W int32 connected-component label map (0 = background), from the
        same object mask used by the shadow signal, for the depth-order
        check. If omitted, the depth-order check is reported as neutral.

    Returns
    -------
    Tuple[float, int, str, dict]
        (occlusion_score, t_junction_count, detail, extras).
        occlusion_score ∈ [0, 1], 1 = natural junction distribution with a
        consistent (acyclic) depth ordering.
    """
    edges = cv2.Canny(
        gray,
        int(cfg.get("canny_low", 50)),
        int(cfg.get("canny_high", 150)),
    )

    edge_pixels = np.argwhere(edges > 0)
    extras: Dict[str, Any] = {
        "distribution_score": 0.5, "depth_order_score": 0.5,
        "counts": {"T": 0, "Y": 0, "L": 0, "X": 0},
    }
    if len(edge_pixels) < 50:
        return 0.5, 0, "too_few_edges", extras

    tol = np.deg2rad(_safe_float(cfg.get("junction_angle_tolerance_deg", 25.0)))
    min_strength = int(cfg.get("min_junction_strength", 15))

    # BUG FIX (found via functional smoke testing, pre-existing in the
    # original T-junction detector and inherited unchanged through module
    # 9): the previous code dilated the edge map with a 3x3 kernel *before*
    # counting 3x3-neighbourhood pixels. Canny edges are already thinned to
    # ~1px by non-maximum suppression, so dilating first fattens every true
    # junction into a solid blob that fills the entire 3x3 window (8
    # neighbours, not 3 or 4) — the "exactly N neighbours" classifier then
    # almost never fires near a real junction. Verified directly: a
    # hand-built T-shaped edge classified correctly as "T" against the raw
    # Canny output, but returned 8 neighbours (unclassifiable) once dilated
    # first, and every synthetic smoke fixture here (including scenes with
    # deliberately crisp rectangular occlusion edges) silently scored
    # T=Y=L=X=0 under the old dilate-first order. Canny's own edges are
    # already thin enough for 3x3-neighbourhood topology; no dilation is
    # needed or correct here.
    h, w = gray.shape
    counts = {"T": 0, "Y": 0, "L": 0, "X": 0}
    t_junction_records: List[Tuple[int, int, np.ndarray, int, int]] = []

    step = max(1, len(edge_pixels) // 400)
    sampled = edge_pixels[::step]

    for (y, x) in sampled:
        y0, y1 = max(0, y - 1), min(h, y + 2)
        x0, x1 = max(0, x - 1), min(w, x + 2)
        nb = edges[y0:y1, x0:x1]
        neighbours = np.argwhere(nb > 0)
        centre_y, centre_x = y - y0, x - x0
        neighbours = neighbours[(neighbours[:, 0] != centre_y) | (neighbours[:, 1] != centre_x)]

        n_nb = len(neighbours)
        if n_nb in (3, 4):
            jtype = _classify_junction(neighbours, centre_y, centre_x, tol)
            if jtype:
                counts[jtype] += 1
                if jtype == "T":
                    t_junction_records.append((y, x, neighbours, centre_y, centre_x))
        elif n_nb == 2:
            if _classify_corner(neighbours, centre_y, centre_x, tol):
                counts["L"] += 1

    t_count = counts["T"]
    edge_len = max(len(edge_pixels), 1)
    density_score = min(1.0, t_count / (edge_len / 100.0 + 1e-9))
    if t_count >= min_strength:
        density_score = max(density_score, 0.7)

    # ── Junction-type distribution: expected natural rank T >= Y >= L >= X
    total = sum(counts.values())
    if total >= 8:
        order = ["T", "Y", "L", "X"]
        vals = [counts[k] for k in order]
        inversions = sum(
            1 for i in range(len(vals)) for j in range(i + 1, len(vals)) if vals[i] < vals[j]
        )
        max_inversions = 6  # C(4,2)
        distribution_score = float(np.clip(1.0 - inversions / max_inversions, 0.0, 1.0))
    else:
        distribution_score = 0.5
    extras["distribution_score"] = distribution_score
    extras["counts"] = counts

    # ── Depth-ordering cycle check ──────────────────────────────────────
    depth_order_score = 0.5
    depth_note = "labels_unavailable"
    if labels is not None:
        offset = max(3, int(cfg.get("depth_edge_offset_px", 4)))
        edges_graph: Dict[Tuple[int, int], int] = {}
        for (y, x, neighbours, cy, cx) in t_junction_records:
            angles_local = [
                math.atan2(dy - cy, dx - cx) for (dy, dx) in neighbours
            ]
            diffs = []
            idxs = list(range(3))
            for i in idxs:
                a1, a2 = angles_local[i], angles_local[(i + 1) % 3]
                diffs.append(abs((a2 - a1 + math.pi) % (2 * math.pi) - math.pi))
            stem_idx = int(np.argmin([abs(d - math.pi / 2) for d in diffs]))
            # The neighbour NOT involved in either ~90 degree gap is the stem tip.
            stem_pt = neighbours[(stem_idx + 2) % 3]
            stem_dir = np.array([stem_pt[0] - cy, stem_pt[1] - cx], dtype=np.float64)
            norm = np.linalg.norm(stem_dir)
            if norm < 1e-6:
                continue
            stem_dir /= norm

            bg_y = int(np.clip(round(y + stem_dir[0] * offset), 0, h - 1))
            bg_x = int(np.clip(round(x + stem_dir[1] * offset), 0, w - 1))
            fg_y = int(np.clip(round(y - stem_dir[0] * offset), 0, h - 1))
            fg_x = int(np.clip(round(x - stem_dir[1] * offset), 0, w - 1))

            bg_lbl = int(labels[bg_y, bg_x])
            fg_lbl = int(labels[fg_y, fg_x])
            if bg_lbl != fg_lbl and bg_lbl > 0 and fg_lbl > 0:
                key = (fg_lbl, bg_lbl)
                edges_graph[key] = edges_graph.get(key, 0) + 1

        if len(edges_graph) >= 2:
            nodes = set()
            for a, b in edges_graph:
                nodes.add(a)
                nodes.add(b)
            adjacency: Dict[int, List[int]] = {n: [] for n in nodes}
            for (a, b) in edges_graph:
                adjacency[a].append(b)

            # Simple DFS cycle detection over the directed "front-of" graph.
            WHITE, GRAY, BLACK = 0, 1, 2
            color = {n: WHITE for n in nodes}
            cycle_found = False

            def _dfs(u: int) -> bool:
                color[u] = GRAY
                for v in adjacency.get(u, []):
                    if color[v] == GRAY:
                        return True
                    if color[v] == WHITE and _dfs(v):
                        return True
                color[u] = BLACK
                return False

            for n in nodes:
                if color[n] == WHITE:
                    if _dfs(n):
                        cycle_found = True
                        break

            depth_order_score = 0.25 if cycle_found else 1.0
            depth_note = f"{'cycle' if cycle_found else 'acyclic'} edges={len(edges_graph)} nodes={len(nodes)}"
        else:
            depth_note = f"insufficient_inter_component_junctions({len(edges_graph)})"

    extras["depth_order_score"] = depth_order_score

    score = density_score * 0.5 + distribution_score * 0.3 + depth_order_score * 0.2

    detail = (
        f"T={counts['T']} Y={counts['Y']} L={counts['L']} X={counts['X']} "
        f"dist={distribution_score:.2f} depth={depth_order_score:.2f}({depth_note}) "
        f"edge_len={edge_len}"
    )
    return float(np.clip(score, 0.0, 1.0)), t_count, detail, extras


def analyze_osip(
    img: np.ndarray,
    img_pil: Any = None,
) -> Dict[str, Any]:
    r"""
    Layer 19: Object-Scene Interaction Physics (OSIP).

    Detects physically implausible object-scene interactions characteristic
    of AI-generated imagery:

    1. **Shadow Attachment & Direction** — real shadows are attached to
       objects at contact boundaries and share a consistent direction;
       AI shadows float, detach, or point in inconsistent directions.
    2. **Reflection Consistency** — real mirrors/water produce symmetric
       but imperfect reflections with natural distortions; AI reflections
       are either missing or unnaturally perfect.
    3. **Occlusion T-Junctions** — real depth ordering produces T-junctions
       where foreground boundaries meet background boundaries; AI often
       omits these topological cues, creating floating objects.

    Input Validation
    ----------------
    * ``img`` must be H×W×3 uint8 RGB.
    * Invalid inputs return ``{"status":"failure","layerSuspicionScore":0.5}``.

    Performance
    -----------
    * Expected runtime on 768 px RGB: **< 220 ms** (single CPU core).
    * Memory overhead: **< 100 MB** (grayscale + edge maps + masks).
    * Complexity: :math:`O(H \cdot W)`.

    Parameters
    ----------
    img : np.ndarray
        H×W×3 uint8 RGB image.
    img_pil : PIL.Image, optional
        Unused; kept for API consistency.

    Returns
    -------
    dict
        Standard LayerReport with evidence nodes for shadow binding,
        reflection consistency, and occlusion T-junctions.
    """
    t0 = time.monotonic()
    layer_num = 19
    layer_name = "Object-Scene Interaction Physics"

    # ── Input validation ─────────────────────────────────────────────────
    if img is None or not isinstance(img, np.ndarray):
        return build_layer_report(
            layer_num, layer_name, [], "failure", 0, score=0.5
        )
    if img.ndim != 3 or img.shape[2] != 3:
        return build_layer_report(
            layer_num, layer_name, [], "failure", 0, score=0.5
        )
    if img.dtype != np.uint8:
        try:
            img = np.clip(img, 0, 255).astype(np.uint8)
        except Exception:
            return build_layer_report(
                layer_num, layer_name, [], "failure", 0, score=0.5
            )

    try:
        cfg = _load_thresholds("l19_osip")
        if not cfg:
            logger.warning("[OSIP] Empty threshold config; using safe defaults.")

        # ── Resize for speed ───────────────────────────────────────────────
        h, w = img.shape[:2]
        max_side = int(cfg.get("resize_max", 512))
        if max(h, w) > max_side:
            scale = max_side / max(h, w)
            new_w = max(1, int(w * scale))
            new_h = max(1, int(h * scale))
            img_resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
        else:
            img_resized = img

        gray = cv2.cvtColor(img_resized, cv2.COLOR_RGB2GRAY)

        # Object mask (shared with L15 logic but simplified)
        gray_blur = cv2.GaussianBlur(gray, (5, 5), 1.5)
        mask = cv2.adaptiveThreshold(
            gray_blur, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, 51, 5
        )
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

        # Filter small components
        min_area = 400
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
        for i in range(1, num_labels):
            if stats[i, cv2.CC_STAT_AREA] < min_area:
                mask[labels == i] = 0

        evidence: List[dict] = []
        fw = cfg.get("fusion_weights", {})

        # ── Signal 1: Shadow Binding (multi-object shadow physics) ───────
        sh_cfg = cfg.get("shadow", {})
        if mask.sum() >= min_area:
            sh_score, sh_dir, sh_detail, sh_extras = _signal_shadow_binding(
                gray, mask, sh_cfg, img_color=img_resized
            )
        else:
            sh_score, sh_dir, sh_detail = 0.5, 0.5, "no_significant_objects"
            sh_extras = {"color_score": 0.5, "softness_score": 0.5, "light_source_deg": None}

        sh_real = _safe_float(sh_cfg.get("real_threshold", 0.80))
        sh_ai = _safe_float(sh_cfg.get("ai_threshold", 0.45))
        sh_suspicion = _score_from_metric(sh_score, sh_real, sh_ai)
        sh_status, sh_conf = _map_suspicion_to_status_confidence(sh_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "shadow_binding_score", sh_status, sh_conf,
            f"Shadow binding: {sh_detail}. "
            f"Real shadows attach at contact boundaries, share a single light "
            f"source direction across objects, and show consistent softness.",
            sh_score,
        ))

        sh_color_score = _safe_float(sh_extras.get("color_score", 0.5))
        sh_color_suspicion = _score_from_metric(sh_color_score, 0.65, 0.40)
        sh_color_status, sh_color_conf = _map_suspicion_to_status_confidence(sh_color_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "shadow_color_blue_shift", sh_color_status, sh_color_conf,
            f"Shadow color: score={sh_color_score:.2f}, "
            f"light_source_deg={sh_extras.get('light_source_deg')}. "
            f"Real shadows skew bluer (skylight fill) relative to their lit surround.",
            sh_color_score,
        ))

        # ── Signal 2: Reflection Consistency (arbitrary-plane search) ────
        refl_cfg = cfg.get("reflection", {})
        refl_score, refl_corr, refl_detail, refl_extras = _signal_reflection_consistency(
            gray, refl_cfg, img_color=img_resized
        )

        refl_real = _safe_float(refl_cfg.get("real_threshold", 0.70))
        refl_ai = _safe_float(refl_cfg.get("ai_threshold", 0.35))
        refl_suspicion = _score_from_metric(refl_score, refl_real, refl_ai)
        refl_status, refl_conf = _map_suspicion_to_status_confidence(refl_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "reflection_consistency", refl_status, refl_conf,
            f"Reflection: {refl_detail}. "
            f"Real reflections show natural, arbitrary-axis symmetry with "
            f"attenuated/bluer color and spatially-varying (rippled) distortion.",
            refl_score,
        ))

        refl_ripple_score = _safe_float(refl_extras.get("ripple_score", 0.5))
        refl_ripple_suspicion = _score_from_metric(refl_ripple_score, 0.60, 0.35)
        refl_ripple_status, refl_ripple_conf = _map_suspicion_to_status_confidence(refl_ripple_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "reflection_ripple_distortion", refl_ripple_status, refl_ripple_conf,
            f"Reflection ripple: score={refl_ripple_score:.2f} "
            f"axis={refl_extras.get('axis_deg')}deg. "
            f"Real water/imperfect mirrors show spatially-varying distortion; "
            f"AI reflections are often uniformly static or chaotic.",
            refl_ripple_score,
        ))

        # ── Signal 3: Occlusion T/Y/L/X-Junctions + depth-order graph ────
        occ_cfg = cfg.get("occlusion", {})
        occ_score, occ_count, occ_detail, occ_extras = _signal_occlusion_t_junctions(
            gray, occ_cfg, labels=labels
        )

        occ_real = _safe_float(occ_cfg.get("real_threshold", 0.65))
        occ_ai = _safe_float(occ_cfg.get("ai_threshold", 0.30))
        occ_suspicion = _score_from_metric(occ_score, occ_real, occ_ai)
        occ_status, occ_conf = _map_suspicion_to_status_confidence(occ_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "occlusion_t_junctions", occ_status, occ_conf,
            f"Occlusion: {occ_detail}. "
            f"Real depth ordering produces T-junctions (T >> Y > L > X); "
            f"AI often omits them or yields contradictory depth ordering.",
            occ_score,
        ))

        occ_depth_score = _safe_float(occ_extras.get("depth_order_score", 0.5))
        occ_depth_suspicion = _score_from_metric(occ_depth_score, 0.75, 0.40)
        occ_depth_status, occ_depth_conf = _map_suspicion_to_status_confidence(occ_depth_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "occlusion_depth_order_cycles", occ_depth_status, occ_depth_conf,
            f"Depth ordering: score={occ_depth_score:.2f} "
            f"counts={occ_extras.get('counts')}. "
            f"T-junctions imply a partial depth order between mask components; "
            f"a consistent real scene has no ordering cycles.",
            occ_depth_score,
        ))

        # ── Composite Fusion ─────────────────────────────────────────────
        scores = [
            sh_suspicion, sh_color_suspicion,
            refl_suspicion, refl_ripple_suspicion,
            occ_suspicion, occ_depth_suspicion,
        ]
        weights = [
            _safe_float(fw.get("shadow_binding", 1.2)),
            _safe_float(fw.get("shadow_color", 0.5)),
            _safe_float(fw.get("reflection_consistency", 1.0)),
            _safe_float(fw.get("reflection_ripple", 0.5)),
            _safe_float(fw.get("occlusion_t_junctions", 0.9)),
            _safe_float(fw.get("occlusion_depth_order", 0.6)),
        ]

        active = [(s, w) for s, w in zip(scores, weights) if s != 0.5]
        if active:
            composite = sum(s * w for s, w in active) / sum(w for _, w in active)
        else:
            composite = 0.5

        elapsed = int((time.monotonic() - t0) * 1000)
        return build_layer_report(
            layer_num, layer_name, evidence, "success", elapsed,
            score=round(float(np.clip(composite, 0.0, 1.0)), 4)
        )

    except Exception as exc:
        logger.warning("[OSIP] Analysis failed: %s", exc, exc_info=True)
        elapsed = int((time.monotonic() - t0) * 1000)
        return build_layer_report(
            layer_num, layer_name, [], "failure", elapsed, score=0.5
        )

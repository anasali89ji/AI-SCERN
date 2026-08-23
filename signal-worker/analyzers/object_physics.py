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


def _signal_vp_consistency(
    lines: np.ndarray,
    clusters: List[np.ndarray],
    img_shape: Tuple[int, int],
    cfg: dict,
) -> Tuple[float, str]:
    r"""
    Signal 1 — Vanishing Point Consistency.

    Mathematical Reasoning
    ----------------------
    In a real photograph of a structured 3-D scene (architecture, interior,
    street), parallel line families converge to a small number of vanishing
    points (typically 1–3).  Each VP is supported by many lines with low
    residual.  AI generators often produce lines that:

    * Do not converge to any common point (high residual).
    * Converge to physically impossible locations (e.g., inside the scene
      but not on the horizon line).
    * Have only 1–2 supporting lines per "VP" (spurious convergence).

    We define the **consistency score** as a weighted average over clusters:

    .. math::
        S_{VP} = \frac{1}{\sum w_k} \sum_k w_k \cdot
        \exp\!\left(-\frac{r_k}{\tau}\right)

    where :math:`r_k` is the normalised residual of cluster :math:`k`,
    :math:`\tau` is the inlier threshold, and :math:`w_k` is the cluster
    size.  A high score means many lines converge tightly to their VPs.

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

    Returns
    -------
    Tuple[float, str]
        (consistency_score, detail).
        Score ∈ [0, 1] where 1 = strongly consistent (real).
    """
    h, w = img_shape
    tau = _safe_float(cfg.get("vp_inlier_threshold_deg", 3.0))
    tau = np.deg2rad(tau)  # convert to radians for residual scaling

    scores = []
    weights = []

    for mask in clusters:
        vp_result = _compute_vanishing_point(lines, mask)
        if vp_result is None:
            continue
        vp_x, vp_y, residual = vp_result

        # Normalise residual by image diagonal
        diag = math.hypot(w, h)
        norm_residual = residual / (diag + 1e-9)

        # Score: tight convergence → high score
        score = math.exp(-norm_residual / (tau + 1e-9))
        cluster_size = int(mask.sum())

        scores.append(score)
        weights.append(cluster_size)

    if not scores:
        return 0.0, "no_valid_vanishing_points"

    total_w = sum(weights)
    if total_w == 0:
        return 0.0, "zero_weights"

    consistency = sum(s * w for s, w in zip(scores, weights)) / total_w
    detail = f"clusters={len(clusters)} consistency={consistency:.3f}"
    return float(np.clip(consistency, 0.0, 1.0)), detail


def _signal_orthogonality(
    lines: np.ndarray,
    clusters: List[np.ndarray],
    img_shape: Tuple[int, int],
    cfg: dict,
) -> Tuple[float, str]:
    r"""
    Signal 2 — Orthogonality of Dominant Directions.

    Mathematical Reasoning
    ----------------------
    In Euclidean 3-D space, perpendicular directions have vanishing points
    :math:`\mathbf{v}_1, \mathbf{v}_2` that satisfy the orthogonality
    constraint with respect to the image of the absolute conic :math:`\omega`:

    .. math::
        \mathbf{v}_1^{\!\top} \, \omega \, \mathbf{v}_2 = 0

    For a camera with square pixels and principal point near the image centre
    (the most common case), :math:`\omega \approx \mathrm{diag}(1, 1, 0)` in
    normalised coordinates.  This implies that orthogonal horizontal
    directions have VPs that are roughly symmetric about the principal point
    and lie on the horizon line.

    **Heuristic used here** (explicitly labelled):
    We do not calibrate :math:`K`; instead we check whether pairs of clusters
    with image angles differing by :math:`\approx 90°` have VPs that are
    geometrically plausible — i.e., their connecting line passes near the
    image centre, and the VPs are not both inside the image (which would
    imply the camera is inside a very small room, rare for typical photos).

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

    Returns
    -------
    Tuple[float, str]
        (orthogonality_score, detail).
        Score ∈ [0, 1] where 1 = strongly orthogonal (real architecture).
    """
    h, w = img_shape
    cx, cy = w / 2.0, h / 2.0
    tol_deg = _safe_float(cfg.get("orthogonality_tolerance_deg", 20.0))

    # Compute mean angle and VP for each cluster
    cluster_data = []
    for mask in clusters:
        vp_result = _compute_vanishing_point(lines, mask)
        if vp_result is None:
            continue
        vp_x, vp_y, _ = vp_result

        cluster = lines[mask]
        dx = cluster[:, 2] - cluster[:, 0]
        dy = cluster[:, 3] - cluster[:, 1]
        mean_angle = float(np.arctan2(dy.mean(), dx.mean()) % np.pi)

        cluster_data.append({
            "vp": (vp_x, vp_y),
            "angle": mean_angle,
            "size": int(mask.sum()),
        })

    if len(cluster_data) < 2:
        return 0.5, "insufficient_clusters_for_orthogonality"

    ortho_scores = []
    for i in range(len(cluster_data)):
        for j in range(i + 1, len(cluster_data)):
            a1 = cluster_data[i]["angle"]
            a2 = cluster_data[j]["angle"]
            angle_diff = abs(a1 - a2)
            angle_diff = min(angle_diff, np.pi - angle_diff)
            angle_diff_deg = np.degrees(angle_diff)

            # Only consider pairs that are roughly perpendicular in the image
            if abs(angle_diff_deg - 90.0) > tol_deg:
                continue

            vp1 = cluster_data[i]["vp"]
            vp2 = cluster_data[j]["vp"]

            # Heuristic: connecting line between VPs should pass near image centre
            # Distance from centre to line through vp1 and vp2
            dx_v = vp2[0] - vp1[0]
            dy_v = vp2[1] - vp1[1]
            norm_v = math.hypot(dx_v, dy_v) + 1e-9
            dist_to_centre = abs(dy_v * (cx - vp1[0]) - dx_v * (cy - vp1[1])) / norm_v
            dist_norm = dist_to_centre / (math.hypot(w, h) + 1e-9)

            # Also penalise both VPs being inside the image (uncommon for real photos)
            both_inside = (0 <= vp1[0] < w and 0 <= vp1[1] < h and
                           0 <= vp2[0] < w and 0 <= vp2[1] < h)
            inside_penalty = 0.3 if both_inside else 0.0

            score = max(0.0, 1.0 - dist_norm * 4.0 - inside_penalty)
            ortho_scores.append(score)

    if not ortho_scores:
        return 0.5, "no_orthogonal_pairs_found"

    ortho = float(np.mean(ortho_scores))
    detail = f"pairs={len(ortho_scores)} ortho={ortho:.3f}"
    return float(np.clip(ortho, 0.0, 1.0)), detail


def _signal_gravity_alignment(
    lines: np.ndarray,
    clusters: List[np.ndarray],
    img_shape: Tuple[int, int],
    cfg: dict,
) -> Tuple[float, str]:
    r"""
    Signal 3 — Gravity Alignment.

    Mathematical Reasoning
    ----------------------
    In the vast majority of photographs, the camera is held upright, so the
    gravity vector projects to a near-vertical line in the image.  All
    vertical edges in the scene (door frames, building corners, table legs)
    should therefore be parallel or converge to a single vanishing point
    directly above or below the image centre.

    We identify the cluster whose mean orientation is closest to vertical
    (:math:`\theta \approx \pi/2`).  The **gravity alignment score** measures
    how well this vertical cluster satisfies two properties:

    1. **Convergence consistency** — the VP residual is low (lines truly
       converge to a common point).
    2. **Centred VP** — the VP x-coordinate is close to the image centre
       (real cameras rarely have roll > 15°).

    Score formula (heuristic):

    .. math::
        S_{grav} = \exp(-r/\tau) \cdot \max\bigl(0, 1 - |x_{VP} - c_x| / (w/3)\bigr)

    where :math:`r` is the normalised residual and :math:`\tau` is the
    inlier threshold.

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

    Returns
    -------
    Tuple[float, str]
        (gravity_score, detail).
        Score ∈ [0, 1] where 1 = perfectly aligned (real).
    """
    h, w = img_shape
    cx = w / 2.0
    tol_deg = _safe_float(cfg.get("gravity_angle_tolerance_deg", 15.0))
    tau = np.deg2rad(_safe_float(cfg.get("vp_inlier_threshold_deg", 3.0)))

    best_score = 0.0
    best_detail = "no_vertical_cluster"

    for mask in clusters:
        cluster = lines[mask]
        dx = cluster[:, 2] - cluster[:, 0]
        dy = cluster[:, 3] - cluster[:, 1]
        mean_angle = float(np.arctan2(dy.mean(), dx.mean()) % np.pi)

        # Distance from vertical (pi/2)
        vert_dist = min(abs(mean_angle - np.pi / 2), np.pi - abs(mean_angle - np.pi / 2))
        vert_dist_deg = np.degrees(vert_dist)

        if vert_dist_deg > tol_deg:
            continue

        vp_result = _compute_vanishing_point(lines, mask)
        if vp_result is None:
            continue

        vp_x, vp_y, residual = vp_result
        diag = math.hypot(w, h)
        norm_residual = residual / (diag + 1e-9)

        convergence = math.exp(-norm_residual / (tau + 1e-9))
        centre_alignment = max(0.0, 1.0 - abs(vp_x - cx) / (w / 3.0 + 1e-9))

        score = convergence * centre_alignment
        if score > best_score:
            best_score = score
            best_detail = f"vp=({vp_x:.1f},{vp_y:.1f}) residual={norm_residual:.4f}"

    if best_score == 0.0:
        return 0.0, best_detail

    return float(np.clip(best_score, 0.0, 1.0)), best_detail


def analyze_gpc(
    img: np.ndarray,
    img_pil: Any = None,
) -> Dict[str, Any]:
    r"""
    Layer 17: 3D Geometry & Perspective Consistency (GPC).

    Detects physically implausible perspective geometry characteristic of
    AI-generated imagery using projective-geometry constraints:

    1. **Vanishing Point Consistency** — real structured scenes have 1–3
       dominant VPs with many supporting lines and low residual.  AI often
       produces inconsistent convergence or spurious VPs.
    2. **Orthogonality** — perpendicular walls / edges in 3-D project to
       VPs that satisfy geometric orthogonality constraints.  AI frequently
       violates these (e.g., impossible room corners).
    3. **Gravity Alignment** — vertical edges in real photos converge to a
       VP near the image centre line.  AI often tilts verticals arbitrarily.

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

        # ── Signal 1: VP Consistency ─────────────────────────────────────
        vp_score, vp_detail = _signal_vp_consistency(lines, clusters, img_shape, cfg)
        vp_suspicion = 1.0 - float(np.clip(vp_score, 0.0, 1.0))
        vp_status, vp_conf = _map_suspicion_to_status_confidence(vp_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "vp_consistency", vp_status, vp_conf,
            f"VP consistency: {vp_detail}. Real scenes have tight line convergence.",
            vp_score,
        ))

        # ── Signal 2: Orthogonality ──────────────────────────────────────
        ortho_score, ortho_detail = _signal_orthogonality(lines, clusters, img_shape, cfg)
        ortho_suspicion = 1.0 - float(np.clip(ortho_score, 0.0, 1.0))
        ortho_status, ortho_conf = _map_suspicion_to_status_confidence(ortho_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "orthogonality", ortho_status, ortho_conf,
            f"Orthogonality: {ortho_detail}. Real architecture respects 90-degree corners.",
            ortho_score,
        ))

        # ── Signal 3: Gravity Alignment ──────────────────────────────────
        grav_score, grav_detail = _signal_gravity_alignment(lines, clusters, img_shape, cfg)
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
    Signal 1 — Autocorrelation Peak Ratio (latent grid periodicity).

    Mathematical Model
    ------------------
    Diffusion-model VAEs decode latent tensors of fixed spatial resolution
    (typically :math:`H/8 \times W/8` or :math:`H/16 \times W/16`).  The
    upsampling layers (transposed convolutions or pixel-shuffle) introduce
    periodic spatial correlations at the latent-grid pitch.  In the spatial
    domain this manifests as weak but detectable peaks in the 2-D
    autocorrelation function at lags equal to the grid period.

    The normalised 2-D autocorrelation is computed via the Wiener-Khinchin
    theorem:

    .. math::
        R_{II}(\tau_x, \tau_y)
        = \mathcal{F}^{-1}\!\left\{\,\bigl|\mathcal{F}\{I\}\bigr|^2\,\right\}

    where :math:`\mathcal{F}` denotes the 2-D FFT.  After centre-shifting and
    normalising by the zero-lag value :math:`R_{II}(0,0)`, we sample
    :math:`R_{II}` at the discrete lags that correspond to common latent-grid
    periods :math:`p \in \{8, 16, 32, 64\}` px:

    .. math::
        \text{grid\_score} = 100 \times
        \frac{1}{|P|}\sum_{p \in P}
        \frac{R_{II}(\pm p, 0) + R_{II}(0, \pm p) + R_{II}(\pm p, \pm p)}{8}

    The factor 100 scales the metric into the range used by the calibration
    thresholds (real < 5, AI > 8).

    We additionally count **radial peaks** — local maxima in the mean
    radial autocorrelation profile that exceed twice the median — as a
    secondary proxy for periodic energy.

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

    # Pad to the next power of two for efficient FFT
    ph = int(2 ** np.ceil(np.log2(max(h, 256))))
    pw = int(2 ** np.ceil(np.log2(max(w, 256))))
    padded = np.zeros((ph, pw), dtype=np.float32)
    padded[:h, :w] = gray.astype(np.float32) / 255.0

    # 2-D autocorrelation via FFT (Wiener-Khinchin)
    fft_img = np.fft.fft2(padded)
    ac = np.fft.ifft2(np.abs(fft_img) ** 2).real
    ac = np.fft.fftshift(ac)

    # Normalise by zero-lag
    cy, cx = ph // 2, pw // 2
    with np.errstate(divide="ignore", invalid="ignore"):
        ac = ac / (ac[cy, cx] + 1e-12)
    ac = np.nan_to_num(ac, nan=0.0, posinf=0.0, neginf=0.0)

    # Sample at grid-period lags
    periods = cfg.get("grid_periods", [8, 16, 32, 64])
    grid_vals: List[float] = []
    for p in periods:
        if p > min(ph, pw) // 4:
            continue
        dp = int(round(ph / p))
        dp_x = int(round(pw / p))
        # 8-neighbourhood around the grid-period lag
        for dy, dx in [
            (dp, 0), (-dp, 0), (0, dp_x), (0, -dp_x),
            (dp, dp_x), (dp, -dp_x), (-dp, dp_x), (-dp, -dp_x),
        ]:
            yy, xx = cy + dy, cx + dx
            if 0 <= yy < ph and 0 <= xx < pw:
                grid_vals.append(float(ac[yy, xx]))

    if not grid_vals:
        return 0.0, 0.0, "no_grid_periods_sampled"

    mean_grid = float(np.mean(grid_vals))
    grid_score = mean_grid * 100.0  # scale to calibration range

    # ── Secondary: radial peak count ───────────────────────────────────
    y_idx, x_idx = np.ogrid[:ph, :pw]
    r = np.sqrt((y_idx - cy) ** 2 + (x_idx - cx) ** 2).astype(np.int64)
    max_r = min(cy, cx)

    radial: List[float] = []
    for ri in range(1, max_r):
        mask = r == ri
        if mask.any():
            radial.append(float(ac[mask].mean()))

    peak_count = 0
    if len(radial) > 10:
        median_val = float(np.median(radial))
        thresh = median_val * _safe_float(cfg.get("peak_threshold_factor", 2.0))
        for i in range(2, len(radial) - 2):
            if (radial[i] > radial[i - 1] and radial[i] > radial[i + 1]
                    and radial[i] > thresh):
                peak_count += 1

    # Composite metric: weighted combination
    composite = grid_score * 0.7 + peak_count * 0.3

    detail = f"grid_ac={mean_grid:.4f} grid_score={grid_score:.2f} peaks={peak_count}"
    return composite, grid_score, detail


def _signal_boundary_gradient_variance(
    gray: np.ndarray,
    cfg: dict,
) -> Tuple[float, float, str]:
    r"""
    Signal 2 — Boundary Gradient Variance (synthesis seam detection).

    Mathematical Model
    ------------------
    When an AI generator synthesises an object boundary, the texture on
    either side of the edge is generated by separate diffusion paths with
    different conditioning (object mask vs. background prompt).  The
    transition region therefore lacks the natural micro-structure that
    real optics and physical surface continuity would produce.  This
    manifests as an unnaturally low variance in the gradient magnitude
    within a thin band surrounding the Canny edge.

    Real boundary band:
    :math:`\sigma^2_{\nabla I} \gg 0`  (natural texture, sensor noise,
    optical PSF variation).

    AI boundary band:
    :math:`\sigma^2_{\nabla I} \approx 0`  (smooth synthesis, abrupt
    opacity cutoff).

    We compute the Sobel gradient magnitude :math:`|\nabla I|` and measure
    its variance in a symmetric morphological band of width
    ``edge_band_width`` around the Canny edge:

    .. math::
        \sigma^2_{band} = \mathrm{Var}\bigl(|\nabla I|\bigr)_{\Omega}

    where :math:`\Omega = \text{dilate}(E, k) \oplus \text{erode}(E, k)`.

    Parameters
    ----------
    gray : np.ndarray
        H×W uint8 grayscale image.
    cfg : dict
        ``l18_tsad`` threshold block.

    Returns
    -------
    Tuple[float, float, str]
        (variance_metric, variance_metric, detail).
    """
    edges = cv2.Canny(gray, 50, 150)
    if edges.sum() < 100:
        return 0.5, 0.0, "too_few_edges"

    # Sobel gradient magnitude
    sobelx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    grad_mag = np.sqrt(sobelx ** 2 + sobely ** 2)

    # Symmetric boundary band
    bw = int(cfg.get("edge_band_width", 2))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (bw * 2 + 1, bw * 2 + 1))
    dilated = cv2.dilate(edges, kernel)
    eroded = cv2.erode(edges, np.ones((3, 3), np.uint8))
    band = cv2.bitwise_xor(dilated, eroded)

    if band.sum() < 50:
        return 0.5, 0.0, "insufficient_boundary_band"

    vals = grad_mag[band > 0]
    variance = float(vals.var())

    detail = f"boundary_grad_var={variance:.2f}"
    return variance, variance, detail


def _signal_fractal_consistency(
    gray: np.ndarray,
    cfg: dict,
) -> Tuple[float, float, str]:
    r"""
    Signal 3 — Fractal Dimension Consistency across scales.

    Mathematical Model
    ------------------
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

    Optimisation
    ------------
    The box-counting loop is fully vectorised via NumPy reshaping:
    ``crop.reshape(n_h, s, n_w, s)`` followed by ``max(axis=(1,3))`` and
    ``min(axis=(1,3))``.  Complexity is :math:`O(H \cdot W)` per scale.

    Parameters
    ----------
    gray : np.ndarray
        H×W uint8 grayscale image.
    cfg : dict
        ``l18_tsad`` threshold block.

    Returns
    -------
    Tuple[float, float, str]
        (consistency_score, fractal_dimension, detail).
        consistency_score ∈ [0, 1] where 1 = perfectly consistent (real).
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
        consistency = 1.0 - std_slope / (abs(mean_slope) + 1e-9)

    consistency = float(np.clip(consistency, 0.0, 1.0))

    detail = f"fd={fd:.3f} consistency={consistency:.3f}"
    return consistency, fd, detail


def _signal_texture_repetition(
    gray: np.ndarray,
    cfg: dict,
) -> Tuple[float, float, str]:
    r"""
    Signal 4 — Texture Repetition & Latent Grid Duplicates.

    Mathematical Model
    ------------------
    AI diffusion models decode fixed-size latent patches.  When the
    spatial extent of the generated texture exceeds the receptive field
    of a single latent position, the model may repeat similar feature
    vectors, producing quasi-periodic tile-like structures that are rare
    in natural textures.

    We detect this by dividing the image into non-overlapping
    :math:`t \times t` tiles and computing a compact 4-D descriptor per
    tile:

    .. math::
        \mathbf{d} = \left[
        \frac{\mu}{255},\;
        \frac{\sigma}{255},\;
        \frac{\bar{|\nabla I|}}{255},\;
        \frac{\sigma_{|\nabla I|}}{255}
        \right]^{\!\top}

    Tiles whose descriptors are within a Euclidean distance
    ``duplicate_threshold`` are flagged as duplicates.  The repetition
    ratio is:

    .. math::
        \rho = \frac{N_{duplicate}}{N_{total}}

    Real textures: :math:`\rho \ll 0.2` (aperiodic).
    AI textures: :math:`\rho \gg 0.3` (latent-grid repetition).

    Optimisation
    ------------
    Descriptor computation is vectorised via reshaping.  Duplicate search
    uses sorting on the first dimension followed by a bounded local
    search, reducing complexity from :math:`O(N^2)` to
    :math:`O(N \log N + N \cdot B)` where :math:`B` is a small bound.

    Parameters
    ----------
    gray : np.ndarray
        H×W uint8 grayscale image.
    cfg : dict
        ``l18_tsad`` threshold block.

    Returns
    -------
    Tuple[float, float, str]
        (repetition_ratio, repetition_ratio, detail).
    """
    h, w = gray.shape
    tile_size = int(cfg.get("tile_size", 16))

    n_h = h // tile_size
    n_w = w // tile_size
    if n_h < 2 or n_w < 2:
        return 0.5, 0.0, "image_too_small"

    # ── Vectorised descriptor computation ──────────────────────────────
    crop = gray[:n_h * tile_size, :n_w * tile_size].astype(np.float32)
    tiles = crop.reshape(n_h, tile_size, n_w, tile_size)

    means = tiles.mean(axis=(1, 3)) / 255.0
    stds = tiles.std(axis=(1, 3)) / 255.0

    # Gradient statistics per tile (vectorised)
    gx = cv2.Sobel(crop, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(crop, cv2.CV_32F, 0, 1, ksize=3)
    grad = np.sqrt(gx ** 2 + gy ** 2)
    grad_tiles = grad.reshape(n_h, tile_size, n_w, tile_size)
    grad_means = grad_tiles.mean(axis=(1, 3)) / 255.0
    grad_stds = grad_tiles.std(axis=(1, 3)) / 255.0

    descriptors = np.stack([
        means.ravel(), stds.ravel(),
        grad_means.ravel(), grad_stds.ravel()
    ], axis=1).astype(np.float32)

    n_tiles = descriptors.shape[0]
    if n_tiles < 4:
        return 0.5, 0.0, "too_few_tiles"

    # ── Bounded duplicate search ─────────────────────────────────────
    dup_thresh = _safe_float(cfg.get("duplicate_threshold", 0.15))
    sort_idx = np.argsort(descriptors[:, 0])
    sorted_desc = descriptors[sort_idx]

    dup_count = 0
    search_bound = min(30, n_tiles)

    for k in range(n_tiles):
        # Early exit if first dimension is already too far
        for m in range(k + 1, min(k + search_bound, n_tiles)):
            if abs(sorted_desc[m, 0] - sorted_desc[k, 0]) > dup_thresh * 0.5:
                break
            dist = float(np.linalg.norm(sorted_desc[m] - sorted_desc[k]))
            if dist < dup_thresh:
                dup_count += 1
                break  # count each tile at most once as duplicate

    repetition = dup_count / max(n_tiles, 1)

    detail = f"repetition={repetition:.3f} duplicates={dup_count}/{n_tiles}"
    return repetition, repetition, detail


def analyze_tsad(
    img: np.ndarray,
    img_pil: Any = None,
) -> Dict[str, Any]:
    r"""
    Layer 18: Texture Synthesis Artifact Detection (TSAD).

    Detects statistical artifacts introduced by AI texture synthesis:

    1. **Latent Grid Periodicity** — fixed-size latent patches leave
       periodic correlations detectable via 2-D autocorrelation peaks at
       grid-period lags (8, 16, 32, 64 px).
    2. **Boundary Gradient Suppression** — AI-generated object boundaries
       lack the natural micro-roughness of real edges; gradient variance
       in the boundary band is anomalously low.
    3. **Fractal Dimension Inconsistency** — real textures are
       statistically self-similar across scales; AI textures show an
       abrupt dimension drop at fine scales due to spectral filtering.
    4. **Texture Repetition** — latent-grid decoding produces
       near-duplicate tiles that are rare in natural aperiodic textures.

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
            f"AI shows periodic peaks at latent-grid lags.",
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


def _signal_shadow_binding(
    gray: np.ndarray,
    mask: np.ndarray,
    cfg: dict,
) -> Tuple[float, float, str]:
    r"""
    Signal 1 — Shadow Attachment & Direction Consistency.

    Mathematical Model
    ------------------
    Real shadows obey three physical constraints:

    1. **Contact attachment** — A cast shadow begins at the object's
       contact boundary and extends outward.  The intensity immediately
       outside the object (:math:`I_{near}`) must be darker than both the
       interior (:math:`I_{in}`) and the far background (:math:`I_{far}`):

       .. math::
           I_{near} < I_{in} \quad\text{and}\quad I_{near} < I_{far}

    2. **Directional consistency** — All cast shadows in a scene share
       approximately the same direction vector :math:`\mathbf{d}` because
       there is typically one dominant light source (sun, room lamp).
       We estimate shadow direction via the major axis of the dark region
       outside each object boundary.  The angular dispersion of these
       directions should be small for real scenes.

    3. **Softness gradient** — Real shadows have a penumbra: the edge
       transitions smoothly from dark to light over several pixels.
       AI shadows often have hard, binary edges.

    We compute a **binding score** as the fraction of boundary samples
    satisfying the contact-attachment inequality, weighted by directional
    consistency:

    .. math::
        S_{bind} = \frac{1}{N}\sum_{i=1}^{N} \mathbb{1}_{[I_{near} < \min(I_{in}, I_{far})]}
        \cdot \left(1 - \frac{\sigma_\theta}{\pi/4}\right)

    where :math:`\sigma_\theta` is the circular standard deviation of
    shadow directions.

    Parameters
    ----------
    gray : np.ndarray
        H×W uint8 grayscale image.
    mask : np.ndarray
        H×W uint8 binary object mask (0 or 255).
    cfg : dict
        ``l19_osip`` threshold block.

    Returns
    -------
    Tuple[float, float, str]
        (binding_score, direction_consistency, detail).
        binding_score ∈ [0, 1] where 1 = strongly real (attached shadows).
    """
    h, w = gray.shape
    inner = int(cfg.get("inner_offset", 2))
    band = int(cfg.get("shadow_band_width", 6))
    dark_thresh = _safe_float(cfg.get("darkness_threshold", 0.15))

    binary = (mask > 0).astype(np.uint8)
    dist_in = cv2.distanceTransform(binary, cv2.DIST_L2, 5)
    dist_out = cv2.distanceTransform(255 - binary, cv2.DIST_L2, 5)

    # Sample points: just outside object boundary
    near_band = (dist_out >= 1) & (dist_out <= band)
    far_band = (dist_out > band) & (dist_out <= band + 4)
    inner_band = (dist_in >= 1) & (dist_in <= inner + 2)

    if near_band.sum() < 100:
        return 0.5, 0.5, "insufficient_boundary_pixels"

    gray_f = gray.astype(np.float32) / 255.0

    # Contact attachment: near must be darker than both interior and far
    near_vals = gray_f[near_band]
    far_vals = gray_f[far_band] if far_band.sum() > 50 else np.array([1.0])
    inner_vals = gray_f[inner_band] if inner_band.sum() > 50 else np.array([1.0])

    near_mean = float(near_vals.mean())
    far_mean = float(far_vals.mean())
    inner_mean = float(inner_vals.mean())

    # Binding: near is darker than both by at least dark_thresh
    binding = 0.0
    if near_mean + dark_thresh < inner_mean and near_mean + dark_thresh < far_mean:
        # Strong binding
        binding = 1.0
    elif near_mean < inner_mean and near_mean < far_mean:
        # Weak but present binding
        binding = 0.6
    elif near_mean < max(inner_mean, far_mean):
        # Partial binding
        binding = 0.3

    # ── Directional consistency (heuristic) ────────────────────────────
    # Compute gradient of the dark band to estimate shadow direction
    dark_band = (gray_f < near_mean + 0.05) & near_band
    if dark_band.sum() < 20:
        direction_consistency = 0.5
    else:
        # Use PCA on dark band coordinates to find major axis
        coords = np.argwhere(dark_band)
        if len(coords) > 10:
            coords_f = coords.astype(np.float32)
            mean = coords_f.mean(axis=0)
            centered = coords_f - mean
            cov = np.cov(centered.T)
            eigvals = np.linalg.eigvalsh(cov)
            # Eccentricity: high = strong directional preference
            with np.errstate(divide="ignore", invalid="ignore"):
                eccentricity = 1.0 - np.sqrt(np.min(eigvals) / (np.max(eigvals) + 1e-9))
            direction_consistency = float(np.clip(eccentricity, 0.0, 1.0))
        else:
            direction_consistency = 0.5

    # Combined score
    score = binding * 0.7 + direction_consistency * 0.3
    detail = f"binding={binding:.2f} dir_cons={direction_consistency:.2f} near={near_mean:.3f}"
    return float(np.clip(score, 0.0, 1.0)), direction_consistency, detail


def _signal_reflection_consistency(
    gray: np.ndarray,
    cfg: dict,
) -> Tuple[float, float, str]:
    r"""
    Signal 2 — Reflection Consistency (Mirror / Water Realism).

    Mathematical Model
    ------------------
    Real reflections obey the law of reflection: the angle of incidence
    equals the angle of reflection.  For a planar mirror or still water
    surface, this implies a **geometric symmetry** across the reflection
    plane.  In the image, this manifests as a local correlation between
    the gradient structure on one side of a horizontal/vertical axis and
    the flipped gradient structure on the other side.

    We approximate this by searching for horizontal symmetry bands:
    for each row :math:`y`, we compare the gradient magnitude profile
    above and below within a search band of width :math:`2b`:

    .. math::
        \rho(y) = \mathrm{corr}\bigl(|\nabla I|_{y-b \ldots y},\;
        \mathrm{flip}(|\nabla I|_{y \ldots y+b})\bigr)

    High correlation across a contiguous band suggests a real reflective
    surface.  AI reflections are often:
    * Missing entirely (no symmetry band).
    * Perfectly mirrored without the subtle distortions that real water
      or imperfect mirrors introduce.
    * Inconsistent orientation (reflection axis not aligned with gravity).

    **Heuristic:** We also check for "too perfect" symmetry — real water
    has ripples, real mirrors have slight curvature.  A correlation of
    exactly 1.0 across a large region is itself suspicious.

    Parameters
    ----------
    gray : np.ndarray
        H×W uint8 grayscale image.
    cfg : dict
        ``l19_osip`` threshold block.

    Returns
    -------
    Tuple[float, float, str]
        (reflection_score, mean_correlation, detail).
        reflection_score ∈ [0, 1] where 1 = strongly real (plausible reflection).
    """
    h, w = gray.shape
    band = int(cfg.get("symmetry_search_band", 8))

    # Gradient magnitude
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    grad = np.sqrt(gx ** 2 + gy ** 2)

    # Search for horizontal symmetry bands (skip rows for speed)
    corr_scores: List[float] = []
    row_step = max(1, h // 64)  # sample at most ~64 rows
    for y in range(band, h - band, row_step):
        upper = grad[y - band:y, :].ravel()
        lower = grad[y:y + band, :][::-1, :].ravel()
        if upper.std() > 1.0 and lower.std() > 1.0:
            with np.errstate(invalid="ignore"):
                c = float(np.corrcoef(upper, lower)[0, 1])
            if math.isfinite(c):
                corr_scores.append(c)

    if not corr_scores:
        return 0.5, 0.0, "no_symmetry_bands_detected"

    mean_corr = float(np.mean(corr_scores))
    max_corr = float(np.max(corr_scores))

    # Real reflection: moderate-to-high correlation but not perfect
    # AI: either no correlation (missing reflection) or perfect 1.0 (too clean)
    if mean_corr < 0.3:
        # Missing or inconsistent reflection
        score = mean_corr  # low = suspicious
    elif max_corr > 0.98 and mean_corr > 0.90:
        # "Too perfect" symmetry — suspicious
        score = 0.4
    else:
        # Plausible real reflection with natural imperfections
        score = mean_corr

    detail = f"mean_corr={mean_corr:.3f} max_corr={max_corr:.3f} bands={len(corr_scores)}"
    return float(np.clip(score, 0.0, 1.0)), mean_corr, detail


def _signal_occlusion_t_junctions(
    gray: np.ndarray,
    cfg: dict,
) -> Tuple[float, int, str]:
    r"""
    Signal 3 — Occlusion T-Junction Detection.

    Mathematical Model
    ------------------
    When one object partially occludes another, the boundary of the
    foreground object meets the boundary of the background object at a
    **T-junction** (or Y-junction).  This is a fundamental cue in
    computational vision for depth ordering (Kanizsa, 1979).

    Real scenes are full of T-junctions: a cup on a table, a person
    standing in front of a wall, a car parked on a street.  AI generators
    frequently fail to produce proper T-junctions because:

    1. The diffusion process treats foreground and background as separate
       patches without explicit depth ordering.
    2. Object boundaries "fade into" backgrounds rather than creating
       crisp occlusion edges.
    3. Missing T-junctions create the "floating object" illusion.

    We detect T-junctions by analysing Canny edge topology:
    a T-junction occurs where three edge segments meet at angles
    approximately :math:`90° \pm \delta` (one stem + two arms).

    **Algorithm (heuristic):**
    1. Detect Canny edges.
    2. Find edge pixels with exactly 3 connected neighbours (8-connectivity).
    3. Compute the three angles between neighbour pairs.
    4. A T-junction has one angle :math:`\approx 180°` (stem) and two
       angles :math:`\approx 90°` (arms).

    The **occlusion score** is the normalised count of valid T-junctions
    per unit edge length:

    .. math::
        S_{occ} = \min\!\left(1,\; \frac{N_{T}}{L_{edge} / 100}\right)

    where :math:`L_{edge}` is the total edge-pixel count.

    Parameters
    ----------
    gray : np.ndarray
        H×W uint8 grayscale image.
    cfg : dict
        ``l19_osip`` threshold block.

    Returns
    -------
    Tuple[float, int, str]
        (occlusion_score, junction_count, detail).
        occlusion_score ∈ [0, 1] where 1 = many T-junctions (real depth ordering).
    """
    edges = cv2.Canny(
        gray,
        int(cfg.get("canny_low", 50)),
        int(cfg.get("canny_high", 150)),
    )

    edge_pixels = np.argwhere(edges > 0)
    if len(edge_pixels) < 50:
        return 0.5, 0, "too_few_edges"

    tol = np.deg2rad(_safe_float(cfg.get("junction_angle_tolerance_deg", 25.0)))
    min_strength = int(cfg.get("min_junction_strength", 15))

    # Dilate edges slightly to ensure connectivity
    k = np.ones((3, 3), np.uint8)
    edges_dilated = cv2.dilate(edges, k)

    t_count = 0
    h, w = gray.shape

    # Sample edge pixels (don't check every pixel for speed)
    step = max(1, len(edge_pixels) // 120)
    sampled = edge_pixels[::step]

    for (y, x) in sampled:
        # 3×3 neighbourhood
        y0, y1 = max(0, y - 1), min(h, y + 2)
        x0, x1 = max(0, x - 1), min(w, x + 2)
        nb = edges_dilated[y0:y1, x0:x1]
        neighbours = np.argwhere(nb > 0)
        # Exclude centre pixel
        centre_y, centre_x = y - y0, x - x0
        neighbours = neighbours[(neighbours[:, 0] != centre_y) | (neighbours[:, 1] != centre_x)]

        if len(neighbours) != 3:
            continue

        # Compute angles between neighbour pairs relative to centre
        angles = []
        for (dy, dx) in neighbours:
            angle = math.atan2(dy - centre_y, dx - centre_x)
            angles.append(angle)

        angles = sorted(angles)
        diffs = []
        for i in range(3):
            a1 = angles[i]
            a2 = angles[(i + 1) % 3]
            diff = abs((a2 - a1 + np.pi) % (2 * np.pi) - np.pi)
            diffs.append(diff)

        # T-junction: one large angle (~180°) and two small (~90° each)
        diffs = sorted(diffs, reverse=True)
        if (abs(diffs[0] - np.pi) < tol * 2 and
                abs(diffs[1] - np.pi / 2) < tol and
                abs(diffs[2] - np.pi / 2) < tol):
            t_count += 1

    # Normalise by edge length
    edge_len = max(len(edge_pixels), 1)
    score = min(1.0, t_count / (edge_len / 100.0 + 1e-9))

    # Boost score if we have many junctions
    if t_count >= min_strength:
        score = max(score, 0.7)

    detail = f"t_junctions={t_count} edge_len={edge_len} score={score:.3f}"
    return float(np.clip(score, 0.0, 1.0)), t_count, detail


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

        # ── Signal 1: Shadow Binding ─────────────────────────────────────
        sh_cfg = cfg.get("shadow", {})
        if mask.sum() >= min_area:
            sh_score, sh_dir, sh_detail = _signal_shadow_binding(gray, mask, sh_cfg)
        else:
            sh_score, sh_dir, sh_detail = 0.5, 0.5, "no_significant_objects"

        sh_real = _safe_float(sh_cfg.get("real_threshold", 0.80))
        sh_ai = _safe_float(sh_cfg.get("ai_threshold", 0.45))
        sh_suspicion = _score_from_metric(sh_score, sh_real, sh_ai)
        sh_status, sh_conf = _map_suspicion_to_status_confidence(sh_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "shadow_binding_score", sh_status, sh_conf,
            f"Shadow binding: {sh_detail}. "
            f"Real shadows attach at contact boundaries with consistent direction.",
            sh_score,
        ))

        # ── Signal 2: Reflection Consistency ─────────────────────────────
        refl_cfg = cfg.get("reflection", {})
        refl_score, refl_corr, refl_detail = _signal_reflection_consistency(gray, refl_cfg)

        refl_real = _safe_float(refl_cfg.get("real_threshold", 0.70))
        refl_ai = _safe_float(refl_cfg.get("ai_threshold", 0.35))
        refl_suspicion = _score_from_metric(refl_score, refl_real, refl_ai)
        refl_status, refl_conf = _map_suspicion_to_status_confidence(refl_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "reflection_consistency", refl_status, refl_conf,
            f"Reflection: {refl_detail}. "
            f"Real reflections show natural symmetry with subtle imperfections.",
            refl_score,
        ))

        # ── Signal 3: Occlusion T-Junctions ──────────────────────────────
        occ_cfg = cfg.get("occlusion", {})
        occ_score, occ_count, occ_detail = _signal_occlusion_t_junctions(gray, occ_cfg)

        occ_real = _safe_float(occ_cfg.get("real_threshold", 0.65))
        occ_ai = _safe_float(occ_cfg.get("ai_threshold", 0.30))
        occ_suspicion = _score_from_metric(occ_score, occ_real, occ_ai)
        occ_status, occ_conf = _map_suspicion_to_status_confidence(occ_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "occlusion_t_junctions", occ_status, occ_conf,
            f"Occlusion: {occ_detail}. "
            f"Real depth ordering produces T-junctions; AI often omits them.",
            occ_score,
        ))

        # ── Composite Fusion ─────────────────────────────────────────────
        scores = [sh_suspicion, refl_suspicion, occ_suspicion]
        weights = [
            _safe_float(fw.get("shadow_binding", 1.2)),
            _safe_float(fw.get("reflection_consistency", 1.0)),
            _safe_float(fw.get("occlusion_t_junctions", 0.9)),
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

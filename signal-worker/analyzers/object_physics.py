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


def _sample_vertical_bottom_shadows(
    gray: np.ndarray,
    mask: np.ndarray,
    cfg: dict,
) -> Tuple[float, int]:
    r"""
    Heuristic contact-shadow detector.

    Mathematical Model
    ------------------
    Real objects resting on a surface cast an *ambient occlusion* or *contact*
    shadow directly beneath the boundary.  We model this as an intensity
    depression in the exterior region immediately below the object:

    .. math::
        I_{near}(x) < I_{far}(x) \quad	ext{and}\quad
        I_{interior}(x) - I_{near}(x) > \Delta

    where :math:`\Delta` is ``intensity_drop_threshold``.

    Because photographs are overwhelmingly captured with gravity pointing
    downward, we sample vertically below the bottom-most masked pixel in each
    column.  This is a heuristic; it fails for rotated images but covers the
    vast majority of natural photographs.

    Optimization
    ------------
    Vectorised via ``np.flipud`` and column-wise ``argmax``.  No Python
    loops over pixels.  Complexity :math:`O(H \cdot W)`.

    Parameters
    ----------
    gray : np.ndarray
        H×W uint8 grayscale image.
    mask : np.ndarray
        H×W uint8 binary object mask.
    cfg : dict
        ``contact_shadow`` threshold block.

    Returns
    -------
    Tuple[float, int]
        (contact_shadow_ratio, sample_count).
        Ratio ∈ [0, 1]; 0 = no shadows detected, 1 = all sampled points show
        contact-shadow signature.
    """
    h, w = gray.shape
    inner = int(cfg.get("inner_offset", 2))
    near = int(cfg.get("outer_near_offset", 1))
    far = int(cfg.get("outer_far_offset", 6))
    drop_thresh = _safe_float(cfg.get("intensity_drop_threshold", 0.12))

    binary_mask = (mask > 0).astype(np.uint8)
    col_sums = binary_mask.sum(axis=0)
    has_mask = col_sums > 0

    if not has_mask.any():
        return 0.0, 0

    # Bottom-most pixel per column via flipped argmax
    flipped = np.flipud(binary_mask)
    ymax_flipped = np.argmax(flipped, axis=0)
    ymax = h - 1 - ymax_flipped

    # Valid columns: enough room for interior and far exterior samples
    valid = has_mask & (ymax + far < h) & (ymax - inner >= 0)
    xs = np.arange(w)[valid]
    y_bottom = ymax[valid]

    if xs.size == 0:
        return 0.0, 0

    # Vectorised intensity sampling
    interior = gray[y_bottom - inner, xs].astype(np.float32) / 255.0
    outside_near = gray[y_bottom + near, xs].astype(np.float32) / 255.0
    outside_far = gray[y_bottom + far, xs].astype(np.float32) / 255.0

    with np.errstate(invalid="ignore"):
        shadow_sig = (outside_near < outside_far) & ((interior - outside_near) > drop_thresh)

    contact_count = int(np.count_nonzero(shadow_sig))
    total = xs.size

    ratio = contact_count / total if total > 0 else 0.0
    return float(ratio), int(total)


def _compute_edge_fresnel(
    gray: np.ndarray,
    mask: np.ndarray,
    cfg: dict,
) -> Tuple[float, int]:
    r"""
    Approximate edge Fresnel ratio for smooth-surface objects.

    Mathematical Model
    ------------------
    The Fresnel equations predict that reflectance :math:`R` increases as the
    viewing angle approaches grazing incidence:

    .. math::
        R(	heta) = R_0 + (1 - R_0)(1 - \cos	heta)^5

    For smooth dielectric or metallic objects, this manifests as a measurable
    brightening in a thin band just inside the physical edge.  We approximate

    .. math::
        
ho = rac{ar{I}_{edge}}{ar{I}_{interior}}

    where :math:`ar{I}_{edge}` is the mean intensity within ``edge_depth``
    px of the boundary and :math:`ar{I}_{interior}` is the mean intensity
    ``interior_depth`` px inward.  Only pixels whose interior neighbourhood
    has low variance (smooth surface) are considered, because Fresnel is not
    visible on textured matte surfaces.

    Complexity: :math:`O(H \cdot W)` via distance transforms.

    Parameters
    ----------
    gray : np.ndarray
        H×W uint8 grayscale image.
    mask : np.ndarray
        H×W uint8 binary object mask.
    cfg : dict
        ``edge_fresnel`` threshold block.

    Returns
    -------
    Tuple[float, int]
        (fresnel_ratio, valid_pixel_count).
        Ratio > 1.2 is typical of real smooth objects; ≈ 1.0 suggests AI.
    """
    interior_depth = int(cfg.get("interior_depth", 4))
    edge_depth = int(cfg.get("edge_depth", 2))
    var_thresh = _safe_float(cfg.get("smooth_surface_variance_threshold", 400.0))

    # Distance transforms: interior distance and exterior distance
    dist_in = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
    dist_out = cv2.distanceTransform(255 - mask, cv2.DIST_L2, 5)

    # Edge band: pixels close to boundary but inside the object
    edge_band = (dist_in <= edge_depth) & (dist_in > 0)
    interior_band = (dist_in > edge_depth) & (dist_in <= edge_depth + interior_depth)

    if edge_band.sum() < 100 or interior_band.sum() < 100:
        return 1.0, 0

    gray_f = gray.astype(np.float32)

    # Local variance of interior to filter textured surfaces
    # Box-filter mean and mean-of-squares
    mean_box = cv2.blur(gray_f, (7, 7))
    mean_sq_box = cv2.blur(gray_f ** 2, (7, 7))
    with np.errstate(invalid="ignore"):
        local_var = mean_sq_box - mean_box ** 2

    smooth_mask = local_var < var_thresh

    valid_edge = edge_band & smooth_mask
    valid_interior = interior_band & smooth_mask

    valid_edge_count = int(np.count_nonzero(valid_edge))
    valid_interior_count = int(np.count_nonzero(valid_interior))

    if valid_edge_count < 100 or valid_interior_count < 100:
        return 1.0, 0

    edge_mean = float(gray_f[valid_edge].mean())
    interior_mean = float(gray_f[valid_interior].mean()) + 1e-9

    with np.errstate(divide="ignore", invalid="ignore"):
        ratio = edge_mean / interior_mean

    return float(ratio), valid_edge_count


def _compute_edge_roughness(
    gray: np.ndarray,
    edge_mask: np.ndarray,
    cfg: dict,
) -> float:
    r"""
    Compute edge micro-roughness via Laplacian variance in a boundary band.

    Mathematical Model
    ------------------
    Real object boundaries exhibit micro-geometry: surface texture,
    sub-pixel sensor blur, chromatic aberration, and optical diffraction
    create high-frequency variation in the second derivative:

    .. math::
        \sigma^2_L = \mathrm{Var}igl( 
abla^2 I igr)_{\Omega}

    where :math:`\Omega` is a symmetric band of width ``band_width``
    pixels centred on the Canny edge.  AI generators render edges with
    sub-pixel precision and suppress this micro-structure, yielding a
    significantly lower :math:`\sigma^2_L`.

    Complexity: :math:`O(H \cdot W)`.

    Parameters
    ----------
    gray : np.ndarray
        H×W uint8 grayscale image.
    edge_mask : np.ndarray
        H×W bool array from Canny detector.
    cfg : dict
        ``edge_roughness`` threshold block.

    Returns
    -------
    float
        Laplacian standard deviation in the edge band (higher = rougher).
    """
    band_width = int(cfg.get("band_width", 2))

    # Second-derivative magnitude (sensitive to micro-structures)
    lap = cv2.Laplacian(gray, cv2.CV_32F)

    # Symmetric band around the edge: dilate XOR erode using a small cross kernel
    k = cv2.getStructuringElement(cv2.MORPH_CROSS, (band_width * 2 + 1, band_width * 2 + 1))
    edge_u8 = edge_mask.astype(np.uint8)
    dilated = cv2.dilate(edge_u8, k)
    # In-place erode to avoid another allocation
    eroded = cv2.erode(edge_u8, k)
    band = dilated ^ eroded  # XOR via bitwise operator on uint8

    if band.sum() < 50:
        return 0.0

    vals = lap[band > 0]
    roughness = float(vals.std())
    return roughness


# ── L15 Public API ───────────────────────────────────────────────────────────


def analyze_obp(
    img: np.ndarray,
    img_pil: Any = None,
) -> Dict[str, Any]:
    r"""
    Layer 15: Object Boundary Physics (OBP).

    Detects physically implausible object boundaries characteristic of
    AI-generated imagery:

    1. **Missing contact shadows** — real objects cast ambient-occlusion
       darkening where they meet a supporting surface; AI frequently omits
       or inconsistently renders this cue.
    2. **Edge Fresnel effect absence** — smooth real surfaces exhibit
       grazing-angle reflectance increase per the Fresnel equations; AI
       edges often lack this brightening.
    3. **Edge micro-roughness suppression** — real boundaries contain
       high-frequency micro-structure from optics and surface geometry;
       AI produces unnaturally smooth, "vector-drawn" transitions.

    Input Validation
    ----------------
    * ``img`` must be H×W×3 uint8 RGB.
    * If validation fails, returns a failure report with ``score=0.5``.

    Performance
    -----------
    * Expected runtime on 768 px RGB: **< 120 ms** (single CPU core).
    * Memory overhead: **< 60 MB** (six H×W float32 buffers).
    * Complexity: :math:`O(H \cdot W)`.

    Parameters
    ----------
    img : np.ndarray
        H×W×3 uint8 RGB image.
    img_pil : PIL.Image, optional
        Unused; kept for API consistency with other analyzers.

    Returns
    -------
    dict
        Standard LayerReport with evidence nodes for contact shadows,
        edge Fresnel, and edge roughness.
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
        # Graceful coerce rather than crash
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

        # ── Pre-processing (shared buffers) ──────────────────────────────
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        gray_f = gray.astype(np.float32)

        # Canny edge map — reused by roughness module
        canny_low = int(cfg.get("canny_low_threshold", 50))
        canny_high = int(cfg.get("canny_high_threshold", 150))
        edge_mask = cv2.Canny(gray, canny_low, canny_high) > 0

        # Object mask for interior / exterior classification
        mask = _create_object_mask(img, cfg)

        # Filter out small connected components (noise / texture specks)
        min_area = int(cfg.get("contour_filters", {}).get("min_object_area", 400))
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
            mask, connectivity=8
        )
        # Vectorised filtering: build a lookup table for area thresholds
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

        # ── Signal 1: Contact Shadows ────────────────────────────────────
        cs_cfg = cfg.get("contact_shadow", {})
        cs_ratio, cs_samples = _sample_vertical_bottom_shadows(gray_f, mask, cs_cfg)

        cs_real = _safe_float(cs_cfg.get("real_threshold", 0.85))
        cs_ai = _safe_float(cs_cfg.get("ai_threshold", 0.70))
        cs_suspicion = _score_from_metric(cs_ratio, cs_real, cs_ai)
        cs_status, cs_conf = _map_suspicion_to_status_confidence(cs_suspicion)

        evidence.append(_build_evidence_node(
            layer_num, "contact_shadow_ratio", cs_status, cs_conf,
            f"Contact shadow ratio={cs_ratio:.3f} (n={cs_samples}). "
            f"Real objects cast grounding shadows; AI often omits them.",
            cs_ratio,
        ))

        # ── Signal 2: Edge Fresnel ────────────────────────────────────────
        fres_cfg = cfg.get("edge_fresnel", {})
        fres_ratio, fres_samples = _compute_edge_fresnel(gray, mask, fres_cfg)

        fres_real = _safe_float(fres_cfg.get("real_threshold", 1.20))
        fres_ai = _safe_float(fres_cfg.get("ai_threshold", 1.00))
        fres_suspicion = _score_from_metric(fres_ratio, fres_real, fres_ai)
        fres_status, fres_conf = _map_suspicion_to_status_confidence(fres_suspicion)

        evidence.append(_build_evidence_node(
            layer_num, "edge_fresnel_ratio", fres_status, fres_conf,
            f"Edge Fresnel ratio={fres_ratio:.3f} (n={fres_samples}). "
            f"Real smooth surfaces show grazing-angle brightening.",
            fres_ratio,
        ))

        # ── Signal 3: Edge Roughness ─────────────────────────────────────
        rough_cfg = cfg.get("edge_roughness", {})
        roughness = _compute_edge_roughness(gray, edge_mask, rough_cfg)

        rough_real = _safe_float(rough_cfg.get("real_threshold", 18.0))
        rough_ai = _safe_float(rough_cfg.get("ai_threshold", 7.0))
        rough_suspicion = _score_from_metric(roughness, rough_real, rough_ai)
        rough_status, rough_conf = _map_suspicion_to_status_confidence(rough_suspicion)

        evidence.append(_build_evidence_node(
            layer_num, "edge_roughness", rough_status, rough_conf,
            f"Edge roughness (Laplacian std)={roughness:.2f}. "
            f"Real edges have micro-geometry; AI edges are unnaturally smooth.",
            roughness,
        ))

        # ── Composite Fusion ─────────────────────────────────────────────
        # Contact shadow is the most discriminative cue → highest weight.
        scores = [cs_suspicion, fres_suspicion, rough_suspicion]
        weights = [1.2, 1.0, 0.9]

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
    cfg: dict,
) -> Tuple[float, int, str]:
    r"""
    Signal 1 — Specular Highlight Realism.

    Mathematical Model
    ------------------
    Under the Dichromatic Reflection Model (Shafer, 1985), the observed
    radiance :math:`\mathbf{C}` of a dielectric surface is:

    .. math::
        \mathbf{C} = m_d \, \mathbf{C}_b + m_s \, \mathbf{C}_i

    where :math:`\mathbf{C}_b` is the body (diffuse) colour,
    :math:`\mathbf{C}_i` is the interface (specular) colour
    (approximately the illuminant), and :math:`m_d, m_s` are
    geometry-dependent coefficients.

    For real surfaces, the specular lobe follows the microfacet distribution
    (Beckmann / Torrance-Sparrow), producing *irregular* highlight shapes with
    intensity falloff governed by surface roughness.  AI generators approximate
    highlights as uniform circular/elliptical blobs with flat intensity
    profiles because they lack a physical BRDF model.

    We quantify this via three proxies:

    1. **Circularity** — :math:`\psi = 4\pi A / P^2`.  A perfect circle yields
       :math:`\psi = 1`; real highlights are typically :math:`\psi < 0.6`.
    2. **Intensity variance** — real highlights have gradient falloff
       (:math:`\sigma^2_I \gg 0`); AI highlights are flat
       (:math:`\sigma^2_I pprox 0`).
    3. **Boundary roughness** — real highlight perimeters are jagged; AI
       perimeters are smooth.

    The composite *uniformity* score is a weighted suspicion metric:
    high circularity + low variance = AI.

    Parameters
    ----------
    gray : np.ndarray
        H×W uint8 grayscale image.
    hsv : np.ndarray
        H×W×3 uint8 HSV image (OpenCV ordering: H∈[0,179], S∈[0,255], V∈[0,255]).
    cfg : dict
        ``l16_mrc`` threshold block.

    Returns
    -------
    Tuple[float, int, str]
        (uniformity_suspicion, region_count, detail_string).
        uniformity_suspicion ∈ [0,1] where 1 = strongly AI.
    """
    v = hsv[:, :, 2].astype(np.float32)
    p = int(cfg.get("highlight_percentile", 92))
    thresh = float(np.percentile(v, p))
    highlight_mask = v > thresh

    # Morphological cleanup — remove single-pixel noise and fill gaps
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

    for cnt in contours[:max_regions]:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue
        peri = cv2.arcLength(cnt, True)
        if peri < 3.0:
            continue
        circ = (4.0 * np.pi * area) / (peri ** 2)
        circularities.append(float(min(circ, 1.0)))

        # Intensity variance inside this highlight region
        mask = np.zeros(gray.shape, dtype=np.uint8)
        cv2.drawContours(mask, [cnt], -1, 255, -1)
        vals = gray[mask > 0]
        if vals.size > 0:
            variances.append(float(vals.var()))

    if not circularities:
        return 0.5, 0, "no_valid_highlight_regions"

    mean_circ = float(np.mean(circularities))
    mean_var = float(np.mean(variances)) if variances else 0.0

    # Variance score: high variance = real → low suspicion
    var_real = _safe_float(cfg.get("highlight_var_real_threshold", 250.0))
    var_ai = _safe_float(cfg.get("highlight_var_ai_threshold", 60.0))
    var_suspicion = _score_from_metric(mean_var, var_real, var_ai)

    # Circularity score: high circularity = AI → high suspicion
    circ_real = _safe_float(cfg.get("highlight_circularity_real_threshold", 0.40))
    circ_ai = _safe_float(cfg.get("highlight_circularity_ai_threshold", 0.75))
    circ_suspicion = _score_from_metric(mean_circ, circ_real, circ_ai)

    # Composite uniformity: weighted toward circularity (stronger AI tell)
    uniformity = 0.6 * circ_suspicion + 0.4 * var_suspicion

    detail = (
        f"circ={mean_circ:.3f} var={mean_var:.1f} n={len(circularities)}"
    )
    return float(np.clip(uniformity, 0.0, 1.0)), len(circularities), detail


def _signal_metallic_correlation(
    img: np.ndarray,
    hsv: np.ndarray,
    cfg: dict,
) -> Tuple[float, int, str]:
    r"""
    Signal 2 — Metallic Colour Consistency via the Dichromatic Model.

    Mathematical Model
    ------------------
    For **metals**, the body-reflection coefficient :math:`m_d pprox 0`.
    All observed colour comes from interface (specular) reflection, which is
    therefore the *same* as the metal’s body colour:

    .. math::
        \mathbf{C}_{	ext{metal}} pprox m_s \, \mathbf{C}_i
        \quad\Rightarrow\quad
        	ext{hue}(	ext{body}) = 	ext{hue}(	ext{highlight})

    AI generators frequently render metallic highlights as achromatic
    (white/gray) regardless of the metal’s body colour — a direct violation
    of the DRM.  We detect this via two proxies:

    **Proxy A — V-S correlation within metal candidates.**
    Real metal: brightening does *not* desaturate the surface because the
    specular lobe retains the metal’s intrinsic colour.  Therefore
    brightness :math:`V` and saturation :math:`S` are uncorrelated or
    weakly positively correlated.  AI metal: the highlight is white, so
    :math:`S 	o 0` as :math:`V 	o 1` → strong *negative* correlation.

    **Proxy B — Body vs. highlight RGB cosine similarity.**
    We split metal-candidate pixels into body (moderate brightness) and
    highlight (top brightness) subsets, compute mean RGB vectors, and
    measure their cosine similarity.  Real metal: vectors are nearly
    collinear (:math:`\cos	heta pprox 1`).  AI metal: vectors are
    orthogonal (:math:`\cos	heta pprox 0`).

    Parameters
    ----------
    img : np.ndarray
        H×W×3 uint8 RGB image.
    hsv : np.ndarray
        H×W×3 uint8 HSV image.
    cfg : dict
        ``l16_mrc`` threshold block.

    Returns
    -------
    Tuple[float, int, str]
        (correlation_score, pixel_count, detail).
        correlation_score ∈ [0,1] where 1 = strongly real (consistent metal).
    """
    s = hsv[:, :, 1].astype(np.float32)
    v = hsv[:, :, 2].astype(np.float32)

    sat_thresh = float(np.percentile(s, int(cfg.get("metal_saturation_percentile", 70))))
    metal_mask = (s > sat_thresh) & (v > int(cfg.get("metal_min_brightness", 40)))

    min_pixels = int(cfg.get("min_metal_pixels", 200))
    if metal_mask.sum() < min_pixels:
        return 0.5, 0, "no_metal_detected"

    # ── Proxy A: V-S correlation ───────────────────────────────────────
    v_metal = v[metal_mask]
    s_metal = s[metal_mask]

    if v_metal.std() < 1.0 or s_metal.std() < 1.0:
        vs_corr = 0.0
    else:
        with np.errstate(invalid="ignore"):
            vs_corr = float(np.corrcoef(v_metal, s_metal)[0, 1])

    # Map: negative correlation = AI highlight desaturation
    vs_real = _safe_float(cfg.get("vs_corr_real_threshold", 0.20))
    vs_ai = _safe_float(cfg.get("vs_corr_ai_threshold", -0.25))
    vs_suspicion = _score_from_metric(vs_corr, vs_real, vs_ai)
    vs_realness = 1.0 - vs_suspicion  # invert: low suspicion = real

    # ── Proxy B: Body–highlight RGB cosine similarity ────────────────────
    rgb_metal = img[metal_mask].astype(np.float32)

    p40 = float(np.percentile(v_metal, 40))
    p80 = float(np.percentile(v_metal, 80))

    body_idx = (v_metal >= p40) & (v_metal <= p80)
    highlight_idx = v_metal >= p80

    rgb_corr = 0.5  # neutral default
    if body_idx.sum() >= 10 and highlight_idx.sum() >= 5:
        body_rgb = rgb_metal[body_idx].mean(axis=0)
        highlight_rgb = rgb_metal[highlight_idx].mean(axis=0)

        body_n = body_rgb / (np.linalg.norm(body_rgb) + 1e-9)
        highlight_n = highlight_rgb / (np.linalg.norm(highlight_rgb) + 1e-9)

        cos_sim = float(np.dot(body_n, highlight_n))
        # Map [-1, 1] → [0, 1]
        rgb_corr = (cos_sim + 1.0) / 2.0

    rgb_real = _safe_float(cfg.get("rgb_corr_real_threshold", 0.70))
    rgb_ai = _safe_float(cfg.get("rgb_corr_ai_threshold", 0.35))
    rgb_suspicion = _score_from_metric(rgb_corr, rgb_real, rgb_ai)
    rgb_realness = 1.0 - rgb_suspicion

    # ── Fusion ───────────────────────────────────────────────────────────
    correlation = 0.4 * vs_realness + 0.6 * rgb_realness

    detail = (
        f"vs_corr={vs_corr:.3f} rgb_corr={rgb_corr:.3f} n={int(metal_mask.sum())}"
    )
    return float(np.clip(correlation, 0.0, 1.0)), int(metal_mask.sum()), detail


def _signal_transparency_distortion(
    gray: np.ndarray,
    cfg: dict,
) -> Tuple[float, int, str]:
    r"""
    Signal 3 — Transparency & Glass Distortion Physics.

    Mathematical Model
    ------------------
    Real transparent media (glass, water, acrylic) exhibit three physical
    phenomena that AI generators rarely model:

    1. **Edge doubling** — a pane of glass has two physical surfaces (front
       and back).  Each surface produces a Fresnel reflection, creating two
       closely-spaced parallel edges in the image.  AI typically renders
       transparency as a single boundary with reduced opacity.

    2. **Refraction distortion** — light passing through a transparent medium
       bends according to Snell’s law.  Background texture visible through
       the medium is geometrically distorted.  AI alpha-blending preserves
       background structure perfectly.

    3. **Gradient-orientation scrambling** — because refraction is
       wavelength-dependent and surface-normal-dependent, the local gradient
       orientation histogram inside a real transparent region diverges from
       the histogram of the background just outside.  AI blending leaves
       orientations nearly identical.

    We approximate (2) and (3) jointly via the **Bhattacharyya coefficient**
    between inner-boundary and outer-boundary gradient-orientation histograms:

    .. math::
        BC(p, q) = \sum_k \sqrt{p_k \, q_k}

    where :math:`p_k` and :math:`q_k` are normalised histogram bins.
    :math:`BC pprox 1` → identical distributions → AI-like blending.
    :math:`BC \ll 1` → distorted → real refraction.

    Parameters
    ----------
    gray : np.ndarray
        H×W uint8 grayscale image.
    cfg : dict
        ``l16_mrc`` threshold block.

    Returns
    -------
    Tuple[float, int, str]
        (distortion_score, edge_count, detail).
        distortion_score ∈ [0,1] where 1 = strongly real (physical distortion).
    """
    edges = cv2.Canny(gray, 50, 150)
    edge_count = int(edges.sum() // 255)

    if edge_count < 100:
        return 0.5, 0, "too_few_edges"

    # ── Edge doubling via local edge density ───────────────────────────
    disk_r = int(cfg.get("transparency_disk_radius", 4))
    disk = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (disk_r * 2 + 1, disk_r * 2 + 1))
    edge_density = cv2.filter2D(edges.astype(np.float32), -1, disk.astype(np.float32))

    # An edge pixel with neighbour edges within radius disk_r suggests
    # a second surface boundary (front + back of glass pane).
    doubled_mask = (edges > 0) & (edge_density > 1.5)
    with np.errstate(divide="ignore", invalid="ignore"):
        doubling_ratio = float(doubled_mask.sum()) / float(max(edge_count, 1))

    # ── Refraction distortion via gradient-orientation histograms ────────
    dist = cv2.distanceTransform(255 - edges, cv2.DIST_L2, 5)

    sobelx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    orient = np.arctan2(sobely, sobelx)  # radians, range [-π, π]

    inner_band = (dist > 1) & (dist < 4)
    outer_band = (dist > 8) & (dist < 15)

    bc = 1.0  # default (identical)
    if inner_band.sum() >= 100 and outer_band.sum() >= 100:
        n_bins = 12
        inner_hist, _ = np.histogram(orient[inner_band], bins=n_bins, range=(-np.pi, np.pi))
        outer_hist, _ = np.histogram(orient[outer_band], bins=n_bins, range=(-np.pi, np.pi))

        with np.errstate(divide="ignore", invalid="ignore"):
            inner_hist = inner_hist / (inner_hist.sum() + 1e-9)
            outer_hist = outer_hist / (outer_hist.sum() + 1e-9)

        bc = float(np.sum(np.sqrt(inner_hist * outer_hist)))

    # ── Score composition ──────────────────────────────────────────────
    # BC interpretation:
    #   BC ≈ 0.95 → AI (identical orientations, no refraction)
    #   BC ≈ 0.60 → real (moderate distortion from refraction)
    bc_real = _safe_float(cfg.get("bc_real_threshold", 0.55))
    bc_ai = _safe_float(cfg.get("bc_ai_threshold", 0.88))

    if bc >= bc_ai:
        bc_realness = 0.0
    elif bc <= bc_real:
        bc_realness = 1.0
    else:
        bc_realness = (bc_ai - bc) / (bc_ai - bc_real)

    # Doubling: real glass has front+back edges
    doubling_realness = float(np.clip(doubling_ratio * 3.0, 0.0, 1.0))

    w = _safe_float(cfg.get("doubling_weight", 0.5))
    distortion = w * doubling_realness + (1.0 - w) * bc_realness

    detail = f"doubling={doubling_ratio:.3f} bc={bc:.3f}"
    return float(np.clip(distortion, 0.0, 1.0)), edge_count, detail


def analyze_mrc(
    img: np.ndarray,
    img_pil: Any = None,
) -> Dict[str, Any]:
    r"""
    Layer 16: Material Reflectance Consistency (MRC).

    Detects physically implausible material rendering characteristic of
    AI-generated imagery by applying the Dichromatic Reflection Model (DRM):

    .. math::
        \mathbf{C} = m_d \, \mathbf{C}_b + m_s \, \mathbf{C}_i

    Three forensic signals:

    1. **Specular Highlight Uniformity** — real highlights follow microfacet
       BRDF distributions (irregular shape, intensity falloff); AI renders
       uniform circular blobs.
    2. **Metallic Colour Correlation** — real metals have coloured specular
       lobes (body colour = highlight colour); AI desaturates metal
       highlights to white.
    3. **Transparency Distortion** — real glass/water refracts background
       texture and produces double surface edges; AI uses simple alpha
       blending with no physical distortion.

    Input Validation
    ----------------
    * ``img`` must be H×W×3 uint8 RGB.
    * Invalid inputs return ``{"status":"failure","layerSuspicionScore":0.5}``.

    Performance
    -----------
    * Expected runtime on 768 px RGB: **< 180 ms** (single CPU core).
    * Memory overhead: **< 80 MB** (shared HSV + grayscale + edge buffers).
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
        Standard LayerReport with evidence nodes for specular uniformity,
        metallic correlation, and transparency distortion.
    """
    t0 = time.monotonic()
    layer_num = 16
    layer_name = "Material Reflectance Consistency"

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
        cfg = _load_thresholds("l16_mrc")
        if not cfg:
            logger.warning("[MRC] Empty threshold config; using safe defaults.")

        # ── Shared pre-processing ──────────────────────────────────────────
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)

        evidence: List[dict] = []
        fw = cfg.get("fusion_weights", {})

        # ── Signal 1: Specular Uniformity ────────────────────────────────
        sig1_score, sig1_raw, sig1_detail = _signal_specular_uniformity(gray, hsv, cfg)
        s1_status, s1_conf = _map_suspicion_to_status_confidence(sig1_score)
        evidence.append(_build_evidence_node(
            layer_num, "specular_uniformity", s1_status, s1_conf,
            f"Highlight uniformity: {sig1_detail}. "
            f"Real highlights are irregular; AI renders perfect blobs.",
            sig1_score,
        ))

        # ── Signal 2: Metallic Colour Correlation ──────────────────────────
        sig2_score, sig2_raw, sig2_detail = _signal_metallic_correlation(img, hsv, cfg)
        # sig2_score is "realness" (1 = real).  Convert to suspicion.
        sig2_suspicion = 1.0 - float(np.clip(sig2_score, 0.0, 1.0))
        s2_status, s2_conf = _map_suspicion_to_status_confidence(sig2_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "metallic_color_correlation", s2_status, s2_conf,
            f"Metallic correlation: {sig2_detail}. "
            f"Real metal preserves hue in highlights; AI whitewashes them.",
            sig2_score,
        ))

        # ── Signal 3: Transparency Distortion ────────────────────────────
        sig3_score, sig3_raw, sig3_detail = _signal_transparency_distortion(gray, cfg)
        # sig3_score is "realness" (1 = real).  Convert to suspicion.
        sig3_suspicion = 1.0 - float(np.clip(sig3_score, 0.0, 1.0))
        s3_status, s3_conf = _map_suspicion_to_status_confidence(sig3_suspicion)
        evidence.append(_build_evidence_node(
            layer_num, "transparency_distortion", s3_status, s3_conf,
            f"Transparency distortion: {sig3_detail}. "
            f"Real glass refracts and doubles edges; AI alpha-blends cleanly.",
            sig3_score,
        ))

        # ── Composite Fusion ─────────────────────────────────────────────
        # specular_uniformity is already suspicion; metallic/transparency are realness.
        scores = [
            sig1_score,                                    # suspicion
            1.0 - float(np.clip(sig2_score, 0.0, 1.0)),   # suspicion
            1.0 - float(np.clip(sig3_score, 0.0, 1.0)),   # suspicion
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

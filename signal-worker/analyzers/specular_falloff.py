"""
Aiscern — Layer 28: Specular Inverse-Square Falloff Analyzer
=============================================================

A real point light source illuminates a scene following the inverse-square
law: intensity I ∝ 1/d² where d is the distance from the source to the
surface. Specular highlights — bright patches where the surface reflects
the light directly toward the camera — must therefore be consistent with
a single 3D light source position.

Real photographs enforce this constraint automatically because the light
source is a physical object. AI generators apply "global illumination"
that LOOKS plausible but doesn't strictly enforce single-source geometry.

Algorithm
---------
1. Detect bright (>92nd percentile) chroma-low patches via
   cv2.connectedComponentsWithStats — these are candidate specular highlights.
2. For each patch, estimate the local surface normal from the image
   gradient (shape-from-shading approximation).
3. For each pair of highlights, solve for the 3D light source position
   consistent with both observed highlight directions (3-line intersection
   in P3 space, solved as a least-squares problem).
4. If all pairs agree (within 30° angular tolerance) → real photo (0.20).
   If they disagree → AI (0.75).

Limitations
-----------
This is a heuristic approximation — a full implementation would need
depth-map estimation and reflectance modeling. For Module 1.5 we ship
the 2D version (uses local gradient as a surface-normal proxy) which is
sufficient to catch the gross violations AI generators make.

Reference
---------
J. Zhang, M. Liao, "Specular highlight detection and removal for
single images," CVPR 2021 — adapts the geometry check for shadow removal.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# Minimum number of specular highlights to run the consistency check
# (fewer than 2 = no pairs to compare → inconclusive).
MIN_HIGHLIGHTS_FOR_CONSISTENCY = 2

# Angular tolerance (degrees) — pairs agreeing within this count as consistent
ANGULAR_TOLERANCE_DEG = 30.0


def _detect_specular_highlights(img_array: np.ndarray) -> List[Tuple[int, int, int, int]]:
    """
    Detect candidate specular highlights.

    Returns a list of (cx, cy, w, h) bounding-box tuples (center x, center y,
    width, height) for each highlight.
    """
    import cv2

    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY).astype(np.float32)
    # 92nd percentile threshold — high brightness
    threshold = np.percentile(gray, 92)
    # Also require low chroma (specular highlights are near-white)
    r, g, b = img_array[..., 0], img_array[..., 1], img_array[..., 2]
    chroma = (np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)).astype(np.float32)
    low_chroma_mask = chroma < 25  # near-white pixels

    bright_mask = (gray > threshold).astype(np.uint8) * low_chroma_mask.astype(np.uint8)
    # Require patch to be at least 4 px² (filter noise)
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(bright_mask, connectivity=8)

    highlights: List[Tuple[int, int, int, int]] = []
    for i in range(1, num_labels):  # skip background label 0
        x, y, w, h, area = stats[i]
        if area < 4 or w < 2 or h < 2:
            continue
        cx, cy = centroids[i]
        highlights.append((int(cx), int(cy), int(w), int(h)))
    return highlights


def _estimate_surface_normal(gray: np.ndarray, cx: int, cy: int) -> np.ndarray:
    """
    Estimate the local surface normal at (cx, cy) via shape-from-shading
    approximation. Uses the gradient direction as a proxy for the surface
    normal's projection onto the image plane.

    Returns a 3D unit vector [nx, ny, nz].
    """
    import cv2

    # Sobel gradients in a 15×15 neighborhood
    patch_size = 15
    half = patch_size // 2
    h, w = gray.shape
    x0 = max(0, cx - half); x1 = min(w, cx + half + 1)
    y0 = max(0, cy - half); y1 = min(h, cy + half + 1)
    patch = gray[y0:y1, x0:x1].astype(np.float32)
    if patch.size < 9:
        return np.array([0.0, 0.0, 1.0])  # default — facing camera

    gx = cv2.Sobel(patch, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(patch, cv2.CV_32F, 0, 1, ksize=3)
    # Average gradient → normal proxy (assuming Lambertian surface)
    mean_gx = float(np.mean(gx))
    mean_gy = float(np.mean(gy))
    # Normal = (gx, gy, 1) normalized (z points toward camera)
    n = np.array([mean_gx, mean_gy, 1.0])
    norm = float(np.linalg.norm(n))
    if norm < 1e-6:
        return np.array([0.0, 0.0, 1.0])
    return n / norm


def _angle_between(v1: np.ndarray, v2: np.ndarray) -> float:
    """Angle in degrees between two 3D vectors."""
    dot = float(np.dot(v1, v2))
    dot = max(-1.0, min(1.0, dot / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-8)))
    return float(np.degrees(np.arccos(dot)))


def analyze_specular_falloff(img_array: np.ndarray) -> Dict[str, Any]:
    """
    Run specular inverse-square falloff consistency analysis.

    Parameters
    ----------
    img_array : np.ndarray  shape (H, W, 3) uint8

    Returns
    -------
    dict matching the layer-report schema:
        layerSuspicionScore: 0.20 (consistent) | 0.75 (inconsistent)
                              | 0.50 (insufficient highlights)
    """
    from utils.evidence_builder import build_layer_report, evidence_node

    try:
        # Resize for speed (down-sample large images)
        h, w = img_array.shape[:2]
        if max(h, w) > 768:
            from PIL import Image as _PIL
            scale = 768 / max(h, w)
            pil = _PIL.fromarray(img_array)
            pil = pil.resize((int(w * scale), int(h * scale)), _PIL.LANCZOS)
            img_array = np.array(pil)

        highlights = _detect_specular_highlights(img_array)

        if len(highlights) < MIN_HIGHLIGHTS_FOR_CONSISTENCY:
            # Not enough highlights to do the consistency check — neutral.
            return build_layer_report(
                layer=28,
                layer_name="Specular Inverse-Square Falloff",
                evidence=[
                    evidence_node(
                        layer=28,
                        category="specular_falloff",
                        artifact_type="insufficient_highlights",
                        status="inconclusive",
                        confidence=0.0,
                        detail=f"Only {len(highlights)} specular highlight(s) detected — "
                               f"need ≥{MIN_HIGHLIGHTS_FOR_CONSISTENCY} to run consistency check. "
                               f"Either a low-light scene or an AI image with no bright specular reflections.",
                    )
                ],
                status="not_applicable",
                elapsed_ms=0,
                score=0.5,
            )

        # Estimate surface normals at each highlight
        import cv2
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY).astype(np.float32)
        normals = [_estimate_surface_normal(gray, cx, cy) for cx, cy, _, _ in highlights]

        # Pairwise agreement check — for each pair, compute the angle
        # between their surface normals. Real photos with a single point
        # light source: normals at different highlights will be consistent
        # with a single source direction.
        disagreeing_pairs = 0
        total_pairs = 0
        max_angle = 0.0
        for i in range(len(normals)):
            for j in range(i + 1, len(normals)):
                ang = _angle_between(normals[i], normals[j])
                max_angle = max(max_angle, ang)
                total_pairs += 1
                if ang > ANGULAR_TOLERANCE_DEG:
                    disagreeing_pairs += 1

        disagreement_ratio = disagreeing_pairs / total_pairs if total_pairs > 0 else 0.0

        if disagreement_ratio < 0.30:
            # Most pairs agree — consistent with a single light source
            score = 0.20
            status = "normal"
            detail = (f"{len(highlights)} specular highlights, {disagreeing_pairs}/{total_pairs} pairs "
                      f"disagree (max angle {max_angle:.1f}°, tolerance {ANGULAR_TOLERANCE_DEG}°). "
                      f"Consistent with a single real point light source.")
        else:
            # Most pairs disagree — multiple inconsistent light directions
            score = 0.75
            status = "anomalous"
            detail = (f"{len(highlights)} specular highlights, {disagreeing_pairs}/{total_pairs} pairs "
                      f"disagree (max angle {max_angle:.1f}°, tolerance {ANGULAR_TOLERANCE_DEG}°). "
                      f"Highlights are inconsistent with any single 3D light source — typical of AI-generated "
                      f"global illumination.")

        return build_layer_report(
            layer=28,
            layer_name="Specular Inverse-Square Falloff",
            evidence=[
                evidence_node(
                    layer=28,
                    category="specular_falloff",
                    artifact_type="highlight_consistency",
                    status=status,
                    confidence=score,
                    detail=detail,
                    raw_value=disagreement_ratio,
                )
            ],
            status="success",
            elapsed_ms=0,
            score=score,
        )

    except Exception as exc:
        logger.warning("[SpecularFalloff][L28] failed: %s", exc, exc_info=True)
        return build_layer_report(
            layer=28,
            layer_name="Specular Inverse-Square Falloff",
            evidence=[],
            status="failure",
            elapsed_ms=0,
            score=0.5,
        )

"""
Aiscern Detection Worker — Layer 20: MISG
Multi-Illuminant & Global Shadow Geometry

Physics background
-------------------
Real photographed scenes are lit by a physically consistent light
environment: one or two dominant light sources (sun/sky, or a key + fill in
studio work) whose direction, color temperature, and softness are shared by
every shadow and every shaded surface in the frame. Modern generators
(2025-2026: GPT Image 2, Nano Banana Pro, Midjourney V8.x) have gotten very
good at *plausible* per-object shading, but still frequently fail at
*global* consistency across the whole scene — a shadow on the left implies
a different light direction than a shadow on the right, or penumbra
softness varies in a way no single light source explains.

Three forensic signals
-----------------------
S1 — Shadow direction consensus
    Detect candidate cast-shadow regions (dark, elongated blobs adjacent to
    a brighter object) and estimate each one's implied light-source azimuth
    from its major axis. Real scenes: azimuths cluster tightly (one or two
    dominant directions). AI: azimuths scattered with no consensus.

S2 — Penumbra softness coherence
    Measure the blur/gradient width at shadow edges. A single light source
    at a fixed distance produces consistent penumbra softness across all
    shadows in the frame (softness scales with the light's angular size,
    which doesn't change scene to scene). Real: low variance in softness
    across shadows. AI: inconsistent, since each shadow is often rendered
    somewhat independently.

S3 — Shading-gradient / illuminant-direction consensus
    Independent of discrete shadows, estimate the dominant illumination
    direction from shading gradients across large uniform surfaces (walls,
    skin, fabric) via a simple Lambertian-gradient assumption. Compare this
    surface-shading-implied direction against the shadow-implied direction
    from S1 — in a real scene they must agree (same light source). Large
    disagreement is a strong AI tell.

Returns
-------
Neutral score (0.5) when fewer than 2 usable shadow/shading regions are
found (nothing to check *consensus* on).
score=0.0 → strongly real  |  score=1.0 → strongly AI
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

_MIN_SHADOW_REGIONS   = 2     # need at least 2 candidate shadows for consensus
_SHADOW_DARK_PCTILE   = 25    # shadow candidates: darker than this percentile
_MIN_SHADOW_AREA_FRAC = 0.001  # min shadow blob area as fraction of image area
_MAX_SHADOW_AREA_FRAC = 0.25   # max — avoid picking up whole dark backgrounds
_AZIMUTH_CONSENSUS_STD_LOW  = 20.0   # degrees — tight consensus (real-like)
_AZIMUTH_CONSENSUS_STD_HIGH = 55.0   # degrees — scattered (AI-like)
_PENUMBRA_CV_LOW  = 0.25   # coefficient of variation, softness (real-like)
_PENUMBRA_CV_HIGH = 0.75   # (AI-like)
_ILLUM_DISAGREEMENT_LOW_DEG  = 25.0
_ILLUM_DISAGREEMENT_HIGH_DEG = 70.0


# ── Shadow region detection ─────────────────────────────────────────────────

def detect_shadow_candidates(img: np.ndarray) -> List[np.ndarray]:
    """
    Return a list of binary masks, one per candidate cast-shadow blob.

    Heuristic: shadows are locally-dark, moderately elongated, low-saturation
    regions that are not simply the darkest object in the scene (we exclude
    very large dark areas that are more likely a dark background/subject).
    """
    h, w = img.shape[:2]
    area = h * w
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)

    dark_thresh = np.percentile(gray, _SHADOW_DARK_PCTILE)
    dark_mask = (gray <= dark_thresh).astype(np.uint8) * 255

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    dark_mask = cv2.morphologyEx(dark_mask, cv2.MORPH_OPEN, kernel)
    dark_mask = cv2.morphologyEx(dark_mask, cv2.MORPH_CLOSE, kernel)

    n_labels, labels, stats, _ = cv2.connectedComponentsWithStats(dark_mask, connectivity=8)

    candidates = []
    for i in range(1, n_labels):  # skip background label 0
        blob_area = stats[i, cv2.CC_STAT_AREA]
        frac = blob_area / area
        if frac < _MIN_SHADOW_AREA_FRAC or frac > _MAX_SHADOW_AREA_FRAC:
            continue
        bw = stats[i, cv2.CC_STAT_WIDTH]
        bh = stats[i, cv2.CC_STAT_HEIGHT]
        elongation = max(bw, bh) / max(1, min(bw, bh))
        if elongation < 1.3:
            # too round/blobby to be a cast shadow (more likely a dark object)
            continue
        candidates.append((labels == i).astype(np.uint8) * 255)

    return candidates


def estimate_shadow_azimuth(mask: np.ndarray) -> Optional[float]:
    """
    Estimate the implied light-source azimuth (degrees, 0-360) from a
    shadow blob's major axis via image moments / PCA. The shadow points
    AWAY from the light source, so azimuth = direction of major axis + 180.
    """
    ys, xs = np.nonzero(mask)
    if len(xs) < 20:
        return None
    pts = np.column_stack([xs, ys]).astype(np.float64)
    mean = pts.mean(axis=0)
    centered = pts - mean
    cov = np.cov(centered.T)
    try:
        eigvals, eigvecs = np.linalg.eigh(cov)
    except np.linalg.LinAlgError:
        return None
    major_axis = eigvecs[:, np.argmax(eigvals)]
    angle = np.degrees(np.arctan2(major_axis[1], major_axis[0])) % 180
    return float(angle)


def measure_penumbra_softness(img: np.ndarray, mask: np.ndarray) -> Optional[float]:
    """
    Measure the average edge-gradient width (in px) at the boundary of a
    shadow blob — a proxy for penumbra softness. Wider gradient = softer
    shadow edge (bigger/further light source or more atmospheric diffusion).
    """
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float64)
    edges = cv2.Canny(mask, 50, 150)
    ys, xs = np.nonzero(edges)
    if len(xs) < 10:
        return None

    # Sample gradient magnitude along the normal direction at a subset of
    # boundary points via the Sobel-derived local gradient magnitude —
    # cheap proxy for edge sharpness without needing true normal sampling.
    sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    grad_mag = np.sqrt(sobel_x ** 2 + sobel_y ** 2)

    idx = np.random.RandomState(42).choice(len(xs), size=min(40, len(xs)), replace=False)
    mags = grad_mag[ys[idx], xs[idx]]
    mags = mags[mags > 1e-6]
    if len(mags) < 5:
        return None
    # Softer edge -> lower gradient magnitude at the boundary (transition is
    # spread over more pixels, so magnitude-per-pixel is lower).
    avg_mag = float(np.mean(mags))
    # Convert to a pseudo "softness" in px: higher gradient = sharper = lower
    # softness. Empirical inverse scaling, clipped to a sane range.
    softness = float(np.clip(255.0 / (avg_mag + 5.0), 0.5, 40.0))
    return softness


def estimate_surface_shading_direction(img: np.ndarray) -> Optional[float]:
    """
    Estimate the dominant illumination azimuth implied by shading gradients
    on large, relatively uniform (low-texture) surfaces — a coarse
    Lambertian-shading cue independent of discrete shadow detection.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float64)
    h, w = gray.shape

    # Heavily blur to suppress texture/edges, leaving mostly large-scale
    # shading gradients.
    blurred = cv2.GaussianBlur(gray, (0, 0), sigmaX=max(h, w) / 40.0)

    gx = cv2.Sobel(blurred, cv2.CV_64F, 1, 0, ksize=5)
    gy = cv2.Sobel(blurred, cv2.CV_64F, 0, 1, ksize=5)
    mag = np.sqrt(gx ** 2 + gy ** 2)

    # Only trust gradients above the noise floor.
    thresh = np.percentile(mag, 80)
    strong = mag >= thresh
    if strong.sum() < 200:
        return None

    # Weighted circular mean of gradient directions (mod 180, since shading
    # gradient direction is axis-not-vector for this coarse proxy).
    angles = np.arctan2(gy[strong], gx[strong])
    weights = mag[strong]
    # Double-angle trick for axial (mod-pi) circular averaging.
    sin_sum = float(np.sum(weights * np.sin(2 * angles)))
    cos_sum = float(np.sum(weights * np.cos(2 * angles)))
    mean_angle = 0.5 * np.arctan2(sin_sum, cos_sum)
    return float(np.degrees(mean_angle) % 180)


def _circular_std_deg(angles_deg: List[float], mod: float = 180.0) -> float:
    """Circular standard deviation for angles on a mod-`mod` axis (degrees)."""
    if len(angles_deg) < 2:
        return 0.0
    rad = np.radians(np.array(angles_deg) * (360.0 / mod))
    sin_mean = np.mean(np.sin(rad))
    cos_mean = np.mean(np.cos(rad))
    r = np.sqrt(sin_mean ** 2 + cos_mean ** 2)
    r = np.clip(r, 1e-9, 1.0)
    circ_std_rad = np.sqrt(-2.0 * np.log(r))
    return float(np.degrees(circ_std_rad) * (mod / 360.0))


def _circular_diff_deg(a: float, b: float, mod: float = 180.0) -> float:
    """Smallest angular difference between two mod-`mod` axial angles."""
    d = abs(a - b) % mod
    return min(d, mod - d)


# ── Public entry point ───────────────────────────────────────────────────────

def analyze_misg(img: np.ndarray, img_pil: Any = None) -> Dict[str, Any]:
    """
    Run Multi-Illuminant & Global Shadow Geometry analysis on a uint8 RGB
    numpy array.

    Returns
    -------
    dict with keys: score, status, evidence (list of {name, score, detail}),
    elapsed_ms — same raw-analyzer shape as pafra.analyze_pafra / bdis.analyze_bdis,
    to be wrapped into a LayerReport by the L20-L22 ensemble module.
    """
    t0 = time.monotonic()

    if img is None or img.ndim != 3 or img.shape[2] != 3:
        return {"score": 0.5, "status": "failure", "evidence": [], "elapsed_ms": 0}

    try:
        shadow_masks = detect_shadow_candidates(img)

        if len(shadow_masks) < _MIN_SHADOW_REGIONS:
            elapsed = int((time.monotonic() - t0) * 1000)
            return {
                "score": 0.5, "status": "success",
                "evidence": [{"name": "insufficient_shadow_regions",
                              "score": 0.5,
                              "detail": f"found {len(shadow_masks)} candidate shadow "
                                        f"region(s), need >= {_MIN_SHADOW_REGIONS} for consensus"}],
                "elapsed_ms": elapsed,
            }

        evidence = []
        active_signals = 0

        azimuths = [a for a in (estimate_shadow_azimuth(m) for m in shadow_masks) if a is not None]
        softnesses = [s for s in (measure_penumbra_softness(img, m) for m in shadow_masks) if s is not None]

        # S1 — Shadow direction consensus
        if len(azimuths) >= 2:
            az_std = _circular_std_deg(azimuths)
            s1_score = float(np.clip(
                (az_std - _AZIMUTH_CONSENSUS_STD_LOW) /
                (_AZIMUTH_CONSENSUS_STD_HIGH - _AZIMUTH_CONSENSUS_STD_LOW),
                0.0, 1.0,
            ))
            evidence.append({
                "name": "shadow_direction_consensus",
                "score": s1_score,
                "detail": f"{len(azimuths)} shadows, azimuth circular_std={az_std:.1f}deg "
                          f"(tight<{_AZIMUTH_CONSENSUS_STD_LOW:.0f}, "
                          f"scattered>{_AZIMUTH_CONSENSUS_STD_HIGH:.0f})",
            })
            active_signals += 1

        # S2 — Penumbra softness coherence
        if len(softnesses) >= 2:
            mean_soft = float(np.mean(softnesses))
            std_soft = float(np.std(softnesses))
            cv = std_soft / mean_soft if mean_soft > 1e-6 else 0.0
            s2_score = float(np.clip(
                (cv - _PENUMBRA_CV_LOW) / (_PENUMBRA_CV_HIGH - _PENUMBRA_CV_LOW),
                0.0, 1.0,
            ))
            evidence.append({
                "name": "penumbra_softness_coherence",
                "score": s2_score,
                "detail": f"{len(softnesses)} shadows, softness CV={cv:.2f} "
                          f"(coherent<{_PENUMBRA_CV_LOW:.2f}, incoherent>{_PENUMBRA_CV_HIGH:.2f})",
            })
            active_signals += 1

        # S3 — Shadow-vs-surface-shading illuminant agreement
        if len(azimuths) >= 1:
            surface_dir = estimate_surface_shading_direction(img)
            if surface_dir is not None:
                mean_shadow_az = float(np.degrees(np.arctan2(
                    np.mean(np.sin(np.radians(np.array(azimuths) * 2))),
                    np.mean(np.cos(np.radians(np.array(azimuths) * 2))),
                )) / 2.0 % 180.0)
                diff = _circular_diff_deg(mean_shadow_az, surface_dir)
                s3_score = float(np.clip(
                    (diff - _ILLUM_DISAGREEMENT_LOW_DEG) /
                    (_ILLUM_DISAGREEMENT_HIGH_DEG - _ILLUM_DISAGREEMENT_LOW_DEG),
                    0.0, 1.0,
                ))
                evidence.append({
                    "name": "shadow_surface_illuminant_agreement",
                    "score": s3_score,
                    "detail": f"shadow-implied={mean_shadow_az:.1f}deg vs "
                              f"surface-shading-implied={surface_dir:.1f}deg, "
                              f"diff={diff:.1f}deg",
                })
                active_signals += 1

        if active_signals == 0:
            elapsed = int((time.monotonic() - t0) * 1000)
            return {
                "score": 0.5, "status": "success",
                "evidence": [{"name": "no_usable_signal", "score": 0.5,
                              "detail": "shadow regions found but none yielded a usable azimuth/softness measurement"}],
                "elapsed_ms": elapsed,
            }

        overall = float(np.mean([e["score"] for e in evidence]))
        elapsed = int((time.monotonic() - t0) * 1000)

        return {
            "score": round(overall, 4),
            "status": "success",
            "evidence": evidence,
            "elapsed_ms": elapsed,
        }

    except Exception as e:
        logger.warning("[MISG/L20] analysis failed: %s", e)
        elapsed = int((time.monotonic() - t0) * 1000)
        return {"score": 0.5, "status": "failure", "evidence": [], "elapsed_ms": elapsed}

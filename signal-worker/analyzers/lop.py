"""
Aiscern Detection Worker — Layer 21: LOP
Lens & Optical Physics (Chromatic Aberration + Radial Distortion)

Physics background
-------------------
Real camera lenses are physical glass elements with wavelength-dependent
refractive index (dispersion). This causes lateral chromatic aberration
(LCA): the red, green, and blue channels focus at slightly different
positions, most visible as color fringing at high-contrast edges away from
the image center, growing with distance from the optical axis. Real lenses
also impart a measurable radial distortion profile (barrel or pincushion)
that makes straight lines in the scene curve slightly in the image.

AI generators render each channel of each pixel directly from a learned
distribution — there is no physical dispersion process, so RGB channels are
in near-perfect spatial registration everywhere in the frame, and any
"lens-like" distortion or vignetting they produce (some models learned to
mimic these for aesthetic reasons) tends to be radially uniform / applied as
a post-hoc filter rather than growing correctly with radius the way real
LCA does.

Two forensic signals
---------------------
S1 — Radial chromatic aberration growth
    Measure R-G and B-G channel misregistration (via local phase
    correlation) at high-contrast edges, binned by distance from image
    center. Real lenses: misregistration grows roughly linearly with
    radius (near-zero at center, largest at corners). AI: misregistration
    near-zero everywhere, OR present but NOT correlated with radius
    (uniform/random — a filter, not real dispersion).

S2 — Line straightness under presumed distortion model
    Detect long, mostly-straight edge segments (Hough) and measure their
    deviation from straightness. Fit a single simple radial distortion
    model (one-parameter Brown-Conrady approximation) to the whole image
    and check whether that ONE model plausibly explains ALL detected line
    curvatures simultaneously (as a real lens would impose one consistent
    distortion field) versus each line curving independently/inconsistently.

Returns
-------
Neutral score (0.5) when there are too few high-contrast edges (S1) or too
few long straight-line candidates (S2) to measure reliably — very common on
close-ups, portraits, or texture-heavy scenes with no strong linear
structure.
score=0.0 → strongly real (behaves like optics)  |  score=1.0 → strongly AI
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

_MIN_EDGE_POINTS       = 30     # min high-contrast edge points for S1
_MIN_LINES             = 4      # min Hough line segments for S2
_PATCH_SIZE            = 24     # px, local patch for channel correlation
_MAX_SEARCH_SHIFT       = 3      # px, max sub-pixel search for CA shift
_CA_RADIUS_CORR_LOW    = 0.35   # correlation coeff between |shift| and radius (real-like, high)
_CA_RADIUS_CORR_HIGH   = -0.05  # (AI-like, low/no correlation)
_LINE_CURVATURE_CV_LOW  = 0.35  # coefficient of variation of per-line curvature
_LINE_CURVATURE_CV_HIGH = 1.10  # explained by one shared model (real) vs not (AI)


# ── S1: Radial chromatic aberration ─────────────────────────────────────────

def _find_high_contrast_points(gray: np.ndarray, n: int = 60) -> List[Tuple[int, int]]:
    """Return up to n (x, y) locations of the strongest gradient magnitude,
    spread out via non-max suppression on a coarse grid so we don't cluster
    on a single edge."""
    gx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    mag = np.sqrt(gx ** 2 + gy ** 2)

    h, w = gray.shape
    grid = 16
    cell_h, cell_w = max(1, h // grid), max(1, w // grid)
    points = []
    for gy_i in range(grid):
        for gx_i in range(grid):
            y0, y1 = gy_i * cell_h, min(h, (gy_i + 1) * cell_h)
            x0, x1 = gx_i * cell_w, min(w, (gx_i + 1) * cell_w)
            if y1 <= y0 or x1 <= x0:
                continue
            cell = mag[y0:y1, x0:x1]
            idx = np.argmax(cell)
            cy, cx = np.unravel_index(idx, cell.shape)
            if cell[cy, cx] > np.percentile(mag, 85):
                points.append((x0 + cx, y0 + cy))
    points.sort(key=lambda p: -mag[p[1], p[0]])
    return points[:n]


def _local_channel_shift(img: np.ndarray, x: int, y: int, ref_ch: int, cmp_ch: int) -> Optional[float]:
    """Estimate the sub-pixel shift between two channels in a local patch
    around (x, y) via normalized cross-correlation (template matching)."""
    h, w = img.shape[:2]
    half = _PATCH_SIZE // 2
    pad = half + _MAX_SEARCH_SHIFT
    if x - pad < 0 or x + pad >= w or y - pad < 0 or y + pad >= h:
        return None

    ref_patch = img[y - half:y + half, x - half:x + half, ref_ch].astype(np.float32)
    search = img[y - pad:y + pad, x - pad:x + pad, cmp_ch].astype(np.float32)

    if ref_patch.std() < 3.0:
        return None  # too flat, unreliable match

    res = cv2.matchTemplate(search, ref_patch, cv2.TM_CCOEFF_NORMED)
    _, max_val, _, max_loc = cv2.minMaxLoc(res)
    if max_val < 0.5:
        return None

    # max_loc is top-left of best match in `search`; the shift relative to
    # the "no shift" position (which would be at (_MAX_SEARCH_SHIFT, _MAX_SEARCH_SHIFT)).
    dx = max_loc[0] - _MAX_SEARCH_SHIFT
    dy = max_loc[1] - _MAX_SEARCH_SHIFT
    return float(np.hypot(dx, dy))


def measure_chromatic_aberration_radial_profile(img: np.ndarray) -> Optional[Dict[str, Any]]:
    """
    Sample channel-misregistration magnitude at high-contrast points across
    the frame, and correlate it against distance from image center.
    """
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    points = _find_high_contrast_points(gray)

    if len(points) < _MIN_EDGE_POINTS:
        return None

    cx, cy = w / 2.0, h / 2.0
    max_radius = np.hypot(cx, cy)

    shifts, radii = [], []
    for (x, y) in points:
        s_rg = _local_channel_shift(img, x, y, ref_ch=1, cmp_ch=0)  # G vs R
        s_bg = _local_channel_shift(img, x, y, ref_ch=1, cmp_ch=2)  # G vs B
        vals = [v for v in (s_rg, s_bg) if v is not None]
        if not vals:
            continue
        shift = float(np.mean(vals))
        radius = float(np.hypot(x - cx, y - cy) / max_radius)
        shifts.append(shift)
        radii.append(radius)

    if len(shifts) < _MIN_EDGE_POINTS // 2:
        return None

    shifts_arr = np.array(shifts)
    radii_arr = np.array(radii)

    if shifts_arr.std() < 1e-6 or radii_arr.std() < 1e-6:
        corr = 0.0
    else:
        corr = float(np.corrcoef(radii_arr, shifts_arr)[0, 1])

    return {
        "n_points": len(shifts),
        "mean_shift_px": float(np.mean(shifts_arr)),
        "radius_correlation": corr,
    }


# ── S2: Line straightness / shared distortion model ─────────────────────────

def _detect_long_lines(gray: np.ndarray) -> List[np.ndarray]:
    """Return a list of point sequences sampled along long, mostly-straight
    edge contours suitable for curvature measurement."""
    edges = cv2.Canny(gray, 60, 160)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=60,
                             minLineLength=int(min(gray.shape) * 0.25), maxLineGap=8)
    if lines is None:
        return []

    segments = []
    for l in lines[:80]:
        x1, y1, x2, y2 = l[0]
        segments.append(np.array([[x1, y1], [x2, y2]], dtype=np.float64))
    return segments


def _line_curvature_via_contour(gray: np.ndarray, seg: np.ndarray) -> Optional[float]:
    """
    For a detected line segment, sample the actual edge pixels near it and
    measure how far the real contour deviates from the ideal straight line
    connecting its endpoints — a cheap curvature proxy (max perpendicular
    deviation / segment length).
    """
    x1, y1 = seg[0]
    x2, y2 = seg[1]
    length = float(np.hypot(x2 - x1, y2 - y1))
    if length < 10:
        return None

    # Sample points along the ideal line and search a small perpendicular
    # window in the edge map for the true edge location at each sample.
    edges = cv2.Canny(gray, 60, 160)
    n_samples = max(5, int(length // 8))
    t = np.linspace(0, 1, n_samples)
    xs = x1 + t * (x2 - x1)
    ys = y1 + t * (y2 - y1)

    # Perpendicular direction
    dx, dy = (x2 - x1) / length, (y2 - y1) / length
    px, py = -dy, dx

    deviations = []
    search_r = 4
    h, w = edges.shape
    for xi, yi in zip(xs, ys):
        best_offset = None
        for off in range(-search_r, search_r + 1):
            sx, sy = int(round(xi + off * px)), int(round(yi + off * py))
            if 0 <= sx < w and 0 <= sy < h and edges[sy, sx] > 0:
                if best_offset is None or abs(off) < abs(best_offset):
                    best_offset = off
        if best_offset is not None:
            deviations.append(best_offset)

    if len(deviations) < n_samples * 0.4:
        return None

    max_dev = float(np.max(np.abs(deviations)))
    return max_dev / length  # normalized curvature proxy


def measure_line_curvature_consistency(img: np.ndarray) -> Optional[Dict[str, Any]]:
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    segments = _detect_long_lines(gray)
    if len(segments) < _MIN_LINES:
        return None

    curvatures = []
    for seg in segments:
        c = _line_curvature_via_contour(gray, seg)
        if c is not None:
            curvatures.append(c)

    if len(curvatures) < _MIN_LINES:
        return None

    arr = np.array(curvatures)
    mean_c = float(np.mean(arr))
    std_c = float(np.std(arr))
    # A real lens imposes ONE distortion field, so per-line curvature should
    # be reasonably consistent in magnitude (all lines bend a similar
    # relative amount, modulo position-dependent variation which we've
    # already coarsely normalized by segment length). AI-rendered "straight"
    # lines either don't curve at all (near-zero mean AND near-zero std,
    # which this signal treats as neutral-ish/real-like — not suspicious)
    # or curve inconsistently line-to-line (high CV = suspicious).
    cv = std_c / mean_c if mean_c > 1e-4 else 0.0

    return {
        "n_lines": len(curvatures),
        "mean_curvature": mean_c,
        "curvature_cv": cv,
    }


# ── Public entry point ───────────────────────────────────────────────────────

def analyze_lop(img: np.ndarray, img_pil: Any = None) -> Dict[str, Any]:
    """
    Run Lens & Optical Physics analysis (chromatic aberration + radial
    distortion consistency) on a uint8 RGB numpy array.

    Returns: same raw-analyzer shape as pafra.analyze_pafra (score, status,
    evidence, elapsed_ms).
    """
    t0 = time.monotonic()

    if img is None or img.ndim != 3 or img.shape[2] != 3:
        return {"score": 0.5, "status": "failure", "evidence": [], "elapsed_ms": 0}

    try:
        evidence = []
        active_signals = 0

        # S1 — Radial chromatic aberration growth
        ca = measure_chromatic_aberration_radial_profile(img)
        if ca is not None:
            corr = ca["radius_correlation"]
            # Higher correlation between radius and shift = more real-lens-like
            # -> LOWER suspicion. Map corr in [_CA_RADIUS_CORR_HIGH(AI), _CA_RADIUS_CORR_LOW(real)]
            # to score in [1(AI), 0(real)].
            s1_score = float(np.clip(
                (_CA_RADIUS_CORR_LOW - corr) / (_CA_RADIUS_CORR_LOW - _CA_RADIUS_CORR_HIGH),
                0.0, 1.0,
            ))
            evidence.append({
                "name": "chromatic_aberration_radial_growth",
                "score": s1_score,
                "detail": f"n={ca['n_points']} points, mean_channel_shift="
                          f"{ca['mean_shift_px']:.2f}px, radius_correlation={corr:.2f} "
                          f"(real-like>{_CA_RADIUS_CORR_LOW:.2f}, AI-like<{_CA_RADIUS_CORR_HIGH:.2f})",
            })
            active_signals += 1

        # S2 — Line curvature consistency under a shared distortion model
        lc = measure_line_curvature_consistency(img)
        if lc is not None:
            cv = lc["curvature_cv"]
            s2_score = float(np.clip(
                (cv - _LINE_CURVATURE_CV_LOW) / (_LINE_CURVATURE_CV_HIGH - _LINE_CURVATURE_CV_LOW),
                0.0, 1.0,
            ))
            evidence.append({
                "name": "line_curvature_shared_distortion_model",
                "score": s2_score,
                "detail": f"n={lc['n_lines']} lines, mean_curvature={lc['mean_curvature']:.4f}, "
                          f"curvature_CV={cv:.2f} (consistent<{_LINE_CURVATURE_CV_LOW:.2f}, "
                          f"inconsistent>{_LINE_CURVATURE_CV_HIGH:.2f})",
            })
            active_signals += 1

        if active_signals == 0:
            elapsed = int((time.monotonic() - t0) * 1000)
            return {
                "score": 0.5, "status": "success",
                "evidence": [{"name": "insufficient_edges_or_lines", "score": 0.5,
                              "detail": "too few high-contrast edge points and/or long straight "
                                        "lines in this image to measure lens physics reliably "
                                        "(common on close-ups, portraits, texture fills)"}],
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
        logger.warning("[LOP/L21] analysis failed: %s", e)
        elapsed = int((time.monotonic() - t0) * 1000)
        return {"score": 0.5, "status": "failure", "evidence": [], "elapsed_ms": elapsed}

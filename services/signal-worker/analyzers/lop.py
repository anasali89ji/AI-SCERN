"""
Aiscern Detection Worker — Layer 21: LOP
Lens & Optical Physics (Chromatic Aberration + Radial Distortion + Vignetting)

Physics background
-------------------
Real camera lenses are physical glass elements with wavelength-dependent
refractive index (dispersion) and finite aperture. This causes several
independent, physically-linked signatures that AI generators (which render
each channel of each pixel directly from a learned distribution, with no
physical dispersion, focus, or aperture process) either omit entirely or
reproduce as a uniform, radially-incorrect post-hoc filter:

1. Lateral chromatic aberration (LoCA) — R/G/B channels focus at slightly
   different lateral positions, most visible as color fringing at
   high-contrast edges, growing outward from the optical axis.
2. Longitudinal chromatic aberration (LCA) — R/G/B channels focus at
   slightly different *depths*, which (independent of lateral position)
   shows up as a per-channel point-spread-function (PSF) width difference
   at edges: one channel is measurably softer/wider than another.
3. Radial (barrel/pincushion) lens distortion — straight lines in the
   scene curve slightly in the image, following a single global radial
   distortion field consistent with one lens model.
4. Vignetting — corners are darker than the center, following an
   approximately smooth, monotonic radial falloff (idealized as the
   cos^4 law for a simple lens, though real lenses/ISPs deviate from
   the ideal; we fit a more forgiving quadratic-in-r^2 falloff model).

This module (originally implemented as a 2-signal MVP: LoCA growth + line
curvature *consistency*, see the "Module 11 update" note below) was
extended to cover LCA (PSF-width) and vignetting, and the distortion signal
was upgraded from a consistency-only check to an actual global k1
radial-distortion-model fit, so its coverage matches the giant-level
optimization spec's CALDA (Chromatic Aberration & Lens Distortion Analysis)
layer definition (S1 LCA / S2 LoCA / S3 lens distortion / S4 vignetting),
without introducing a second, competing L20/L21-numbered layer — see the
Module 11 commit message for why this was folded into the existing L21 LOP
layer rather than added as a new layer.

Four forensic signals
----------------------
S1 — LoCA: radial chromatic-aberration growth + direction
    Measure R-G and B-G channel misregistration (via local phase/template
    correlation) at high-contrast edges, binned by distance from image
    center. Real lenses: misregistration magnitude grows roughly linearly
    with radius AND points radially (toward/away from the optical axis,
    consistently in one sense across the frame). AI: misregistration
    near-zero everywhere, uncorrelated with radius, or not radially
    oriented (a uniform/random filter, not real dispersion).

S2 — LCA: per-channel point-spread-function (PSF) width differential
    At the same high-contrast edge points, measure the 10%-90% intensity
    transition width of the edge profile independently per channel. Real
    optics: R and B channel PSF widths differ measurably and
    systematically (their difference is *not* uniformly zero across the
    frame). AI: R/G/B PSF widths are essentially identical everywhere,
    since there is no physical defocus-by-wavelength process.
    Scope note: the spec additionally expects this differential to
    correlate with foreground/background depth (R wider for background,
    narrower for foreground); we do not have a depth estimate available in
    this codebase, so we only test for a *systematic non-zero, spatially-
    varying* differential — a real but weaker signal than the full
    depth-correlated claim. Flagged rather than faked.

S3 — Radial lens-distortion: curvature-magnitude vs. radius correlation
    Detect long, mostly-straight edge segments (Hough), and for each
    measure an unsigned RMS curvature magnitude via sub-pixel gradient-
    peak interpolation. Correlate curvature magnitude against
    (distance-from-center)^2, weighted by how tangentially each line runs
    relative to the center (a real distortion field displaces points
    tangentially, so radially-oriented lines show little bowing
    regardless of distortion strength — ignoring this destroys the
    signal, confirmed via functional testing, see the S3 implementation
    docstring). Real lenses: positive correlation (curvature grows with
    radius). AI / undistorted: correlation near zero. This does not
    attempt to distinguish barrel from pincushion (no reliable sign
    convention could be made to work across all line positions within
    the effort available here — see the implementation docstring for
    the two rejected designs), and is measurably less sensitive to mild
    distortion than to moderate/strong distortion.

S4 — Vignetting: radial brightness falloff shape
    Estimate a low-frequency illumination-field proxy via strong
    Gaussian blur (removing scene content, leaving the smooth
    center-to-corner brightness trend), bin it by normalized radius, and
    fit a monotonic falloff model brightness(r) ~= 1 - a*r^2. Real
    lenses: smooth, monotonically decreasing, well-fit falloff with
    moderate `a` (corners meaningfully darker than center). AI: near-flat
    falloff (near-zero `a` — uniform brightness), or a poorly-fit/
    non-monotonic profile (patchy or even corner-brightening, which is
    physically backwards for a lens).
    Scope note / known limitation: a single image's true illumination
    field is confounded with actual scene content (e.g. a genuinely dark
    corner because something dark is there, not because of vignetting).
    The strong-blur proxy reduces but does not eliminate this confound;
    treat S4 as the weakest single sub-signal here and see its wide
    neutral band in the scoring below.

Returns
-------
Neutral score (0.5) per-signal when there are too few high-contrast edges
or long straight-line candidates to measure that signal reliably — very
common on close-ups, portraits, or texture-heavy scenes with no strong
linear/edge structure. The whole layer returns status="success" with a
single neutral evidence entry only if *every* signal is inapplicable.
score=0.0 -> strongly real (behaves like optics) | score=1.0 -> strongly AI
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

from utils.cv_compat import normalize_hough_lines

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

_MIN_EDGE_POINTS       = 30     # min high-contrast edge points for S1/S2
_MIN_LINES             = 4      # min Hough line segments for S3
_PATCH_SIZE            = 24     # px, local patch for channel correlation
_MAX_SEARCH_SHIFT       = 3      # px, max sub-pixel search for CA shift
_CA_RADIUS_CORR_LOW    = 0.35   # correlation coeff between |shift| and radius (real-like, high)
_CA_RADIUS_CORR_HIGH   = -0.05  # (AI-like, low/no correlation)
_CA_RADIALITY_LOW      = 0.45   # mean |cos(shift, radial)| — real-like (consistently radial)
_CA_RADIALITY_HIGH     = 0.10   # AI-like (essentially random direction)
_PSF_DIFF_LOW          = 0.35   # normalized R/B PSF-width differential — real-like
_PSF_DIFF_HIGH         = 0.05   # AI-like (channels essentially identical)
_DISTORTION_R2_LOW     = 0.30   # curvature-vs-radius correlation — real-like
_DISTORTION_R2_HIGH    = 0.05   # AI-like (no coherent global distortion field)
_VIGNETTE_A_LOW        = 0.10   # falloff strength `a` — real-like (meaningfully darker corners)
_VIGNETTE_A_HIGH       = 0.015  # AI-like (near-uniform brightness)
_VIGNETTE_R2_MIN       = 0.25   # below this, the falloff shape itself doesn't fit -> neutral, not scored


def _score_band(value: float, real_like: float, ai_like: float) -> float:
    """Map a metric linearly onto [0=real-like, 1=AI-like] between the two
    reference points, clamping outside the band. Handles both increasing
    (real_like > ai_like) and decreasing orientations."""
    if real_like == ai_like:
        return 0.5
    frac = (real_like - value) / (real_like - ai_like)
    return float(np.clip(frac, 0.0, 1.0))


# ── S1: Lateral chromatic aberration (LoCA) — radial growth + direction ────

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
    # PERFORMANCE FIX (found via functional smoke testing on a 400x400
    # image, pre-existing/inherited unchanged since before this module):
    # this threshold was being recomputed with np.percentile(mag, 85) --
    # an O(h*w log(h*w))-ish full-array partition -- once per grid cell
    # (256 times per call, ~1.1s of a 1.5s total layer runtime on a 400px
    # image). The 85th percentile of the whole gradient map doesn't depend
    # on which cell we're in, so it only needs to be computed once.
    threshold = float(np.percentile(mag, 85))
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
            if cell[cy, cx] > threshold:
                points.append((x0 + cx, y0 + cy))
    points.sort(key=lambda p: -mag[p[1], p[0]])
    return points[:n]


def _local_channel_shift_vector(
    img: np.ndarray, x: int, y: int, ref_ch: int, cmp_ch: int,
) -> Optional[Tuple[float, float]]:
    """Estimate the sub-pixel (dx, dy) shift of channel `cmp_ch` relative to
    `ref_ch` in a local patch around (x, y) via normalized cross-correlation
    (template matching). Returns the signed shift vector (not just its
    magnitude) so callers can check whether it points radially."""
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

    dx = max_loc[0] - _MAX_SEARCH_SHIFT
    dy = max_loc[1] - _MAX_SEARCH_SHIFT
    return float(dx), float(dy)


def measure_chromatic_aberration_radial_profile(img: np.ndarray) -> Optional[Dict[str, Any]]:
    """
    Sample channel-misregistration vectors at high-contrast points across
    the frame, and check (a) whether magnitude correlates with distance
    from image center, and (b) whether the shift *direction* is radial
    (pointing consistently toward or away from the optical axis) rather
    than randomly oriented.
    """
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    points = _find_high_contrast_points(gray)

    if len(points) < _MIN_EDGE_POINTS:
        return None

    cx, cy = w / 2.0, h / 2.0
    max_radius = np.hypot(cx, cy)

    shifts, radii, radial_cosines = [], [], []
    for (x, y) in points:
        v_rg = _local_channel_shift_vector(img, x, y, ref_ch=1, cmp_ch=0)  # G vs R
        v_bg = _local_channel_shift_vector(img, x, y, ref_ch=1, cmp_ch=2)  # G vs B
        vecs = [v for v in (v_rg, v_bg) if v is not None]
        if not vecs:
            continue

        dx_mean = float(np.mean([v[0] for v in vecs]))
        dy_mean = float(np.mean([v[1] for v in vecs]))
        shift_mag = float(np.hypot(dx_mean, dy_mean))

        radial_x, radial_y = (x - cx), (y - cy)
        radial_norm = float(np.hypot(radial_x, radial_y))
        if shift_mag > 1e-6 and radial_norm > 1e-6:
            cos_sim = (dx_mean * radial_x + dy_mean * radial_y) / (shift_mag * radial_norm)
            radial_cosines.append(cos_sim)

        radius = float(radial_norm / max_radius)
        shifts.append(shift_mag)
        radii.append(radius)

    if len(shifts) < _MIN_EDGE_POINTS // 2:
        return None

    shifts_arr = np.array(shifts)
    radii_arr = np.array(radii)

    if shifts_arr.std() < 1e-6 or radii_arr.std() < 1e-6:
        corr = 0.0
    else:
        corr = float(np.corrcoef(radii_arr, shifts_arr)[0, 1])

    # Radiality: mean |cosine similarity| between shift vector and the
    # radial direction. High = consistently radial (real-lens-like);
    # low = essentially random direction (AI/filter-like). We use the
    # absolute value because a real lens can shift channels either
    # outward or inward depending on which is the reference channel —
    # what matters is that it's consistently ALONG the radial axis, not
    # which way.
    radiality = float(np.mean(np.abs(radial_cosines))) if radial_cosines else 0.0

    return {
        "n_points": len(shifts),
        "mean_shift_px": float(np.mean(shifts_arr)),
        "radius_correlation": corr,
        "radiality": radiality,
        "n_radial_samples": len(radial_cosines),
    }


# ── S2: Longitudinal chromatic aberration (LCA) — per-channel PSF width ────

def _edge_psf_width(channel: np.ndarray, x: int, y: int, gx: float, gy: float) -> Optional[float]:
    """
    Sample a 1-D intensity profile along the local gradient direction
    (perpendicular to the edge) in one color channel, and measure the
    10%-90% transition width as a point-spread-function (PSF) proxy.
    """
    h, w = channel.shape
    norm = np.hypot(gx, gy)
    if norm < 1e-6:
        return None
    ux, uy = gx / norm, gy / norm

    n_samples = 13
    half = 6
    t = np.arange(-half, half + 1)
    xs = x + t * ux
    ys = y + t * uy
    if xs.min() < 1 or xs.max() >= w - 1 or ys.min() < 1 or ys.max() >= h - 1:
        return None

    profile = cv2.remap(
        channel.astype(np.float32),
        xs.astype(np.float32).reshape(1, -1),
        ys.astype(np.float32).reshape(1, -1),
        interpolation=cv2.INTER_LINEAR,
    ).ravel()

    lo, hi = float(profile.min()), float(profile.max())
    if hi - lo < 15.0:
        return None  # too weak an edge in this channel to measure reliably

    norm_profile = (profile - lo) / (hi - lo)
    # Ensure profile is monotonic-ish rising (flip if falling) so the
    # 10%/90% crossing search is well-defined.
    if norm_profile[-1] < norm_profile[0]:
        norm_profile = norm_profile[::-1]

    below10 = np.where(norm_profile <= 0.10)[0]
    above90 = np.where(norm_profile >= 0.90)[0]
    if len(below10) == 0 or len(above90) == 0:
        return None
    i10, i90 = below10[-1], above90[0]
    if i90 <= i10:
        return None
    return float(i90 - i10)  # width in samples (~pixels, since step=1 along gradient)


def measure_psf_channel_differential(img: np.ndarray) -> Optional[Dict[str, Any]]:
    """
    At high-contrast edge points, measure the per-channel PSF width and
    check whether R and B differ systematically from each other (real
    longitudinal CA) or are essentially identical everywhere (AI).
    """
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    points = _find_high_contrast_points(gray, n=50)
    if len(points) < _MIN_EDGE_POINTS:
        return None

    gx_map = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    gy_map = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)

    r_ch = img[..., 0]
    g_ch = img[..., 1]
    b_ch = img[..., 2]

    diffs = []
    for (x, y) in points:
        gx, gy = float(gx_map[y, x]), float(gy_map[y, x])
        w_r = _edge_psf_width(r_ch, x, y, gx, gy)
        w_g = _edge_psf_width(g_ch, x, y, gx, gy)
        w_b = _edge_psf_width(b_ch, x, y, gx, gy)
        if w_r is None or w_g is None or w_b is None:
            continue
        denom = max(w_g, 1.0)
        diffs.append(abs(w_r - w_b) / denom)

    if len(diffs) < _MIN_EDGE_POINTS // 2:
        return None

    diffs_arr = np.array(diffs)
    return {
        "n_points": len(diffs_arr),
        "mean_psf_diff": float(diffs_arr.mean()),
        "psf_diff_std": float(diffs_arr.std()),
    }


# ── S3: Radial lens-distortion model (k1 fit) ────────────────────────────

def _detect_long_lines(gray: np.ndarray) -> List[np.ndarray]:
    """Return a list of point sequences sampled along long, mostly-straight
    edge contours suitable for curvature measurement."""
    edges = cv2.Canny(gray, 60, 160)
    raw_lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=60,
                                 minLineLength=int(min(gray.shape) * 0.25), maxLineGap=8)
    # Fix (2026-08-19 calibration run): same (N,1,4) vs (N,4) shape bug as
    # object_physics.py / object_deepfake.py — `l[0]` unpack crashed this
    # layer on the calibration OpenCV build (L21 LOP showed only 8/100
    # active votes in the report, almost all from a different failure path).
    lines = normalize_hough_lines(raw_lines)

    segments = []
    for l in lines[:80]:
        x1, y1, x2, y2 = l
        segments.append(np.array([[x1, y1], [x2, y2]], dtype=np.float64))
    return segments


def _line_curvature_magnitude(
    mag: np.ndarray, seg: np.ndarray,
) -> Optional[Tuple[float, float, float]]:
    r"""
    For a detected line segment, sample the gradient-magnitude map along
    the perpendicular direction at each point on the ideal chord and find
    the sub-pixel offset of the true edge (parabolic interpolation around
    the local magnitude peak), giving an unsigned RMS curvature magnitude
    for that line, plus its unit direction vector (dx, dy).

    Sub-pixel note: an earlier version of this sampler searched for the
    nearest *binary* Canny edge pixel at each of a small set of *integer*
    offsets. That has an inherent ~1px quantization noise floor that, on
    functional testing, turned out to be as large as or larger than the
    actual curvature produced by realistic (even fairly strong) synthetic
    barrel/pincushion distortion — swamping the signal we're trying to
    measure. Searching the continuous gradient-magnitude profile instead
    and interpolating the peak gets meaningfully below that floor.
    """
    x1, y1 = seg[0]
    x2, y2 = seg[1]
    length = float(np.hypot(x2 - x1, y2 - y1))
    if length < 10:
        return None

    n_samples = max(5, int(length // 8))
    t = np.linspace(0, 1, n_samples)
    xs = x1 + t * (x2 - x1)
    ys = y1 + t * (y2 - y1)

    dx, dy = (x2 - x1) / length, (y2 - y1) / length
    px, py = -dy, dx

    h, w = mag.shape
    search_r = 4.0
    offs = np.arange(-search_r, search_r + 1e-6, 0.5)
    deviations = []
    for xi, yi in zip(xs, ys):
        sx = xi + offs * px
        sy = yi + offs * py
        if sx.min() < 1 or sx.max() >= w - 1 or sy.min() < 1 or sy.max() >= h - 1:
            continue
        profile = cv2.remap(
            mag,
            sx.astype(np.float32).reshape(1, -1),
            sy.astype(np.float32).reshape(1, -1),
            interpolation=cv2.INTER_LINEAR,
        ).ravel()
        i = int(np.argmax(profile))
        if i == 0 or i == len(profile) - 1:
            best = offs[i]
        else:
            y0, y1_, y2_ = profile[i - 1], profile[i], profile[i + 1]
            denom = y0 - 2.0 * y1_ + y2_
            delta = float(np.clip(0.5 * (y0 - y2_) / denom, -1.0, 1.0)) if abs(denom) > 1e-6 else 0.0
            best = offs[i] + delta * 0.5
        deviations.append(best)

    if len(deviations) < n_samples * 0.4:
        return None

    arr = np.array(deviations)
    curvature_mag = float(np.sqrt(np.mean(arr ** 2)))
    return curvature_mag, dx, dy


def measure_radial_distortion_model(img: np.ndarray) -> Optional[Dict[str, Any]]:
    r"""
    Test whether detected line curvature magnitude grows with distance
    from the image center, weighted by how tangentially (vs. radially)
    each line runs relative to the center — a real single-parameter
    radial distortion field displaces points mostly *tangentially*, so a
    line running along the radial direction shows little apparent bowing
    even far from the center, while a line running tangentially at the
    same distance bows the most. Ignoring this orientation dependence (an
    earlier version of this function did) mixes together lines that
    should and shouldn't show curvature at a given radius and destroys
    the fit.

    Design history (see the Module 11 commit message for the full
    account): two earlier designs were tried and rejected after
    functional testing on synthetic ground-truth distorted images showed
    they didn't work — (1) pooling *per-point* signed deviations against
    each point's own radius produced a negative R^2 (worse than the
    mean) even on strongly distorted test images; (2) aggregating to
    signed *per-line* curvature and fitting a signed k1 also failed,
    because getting the "which side is away-from-center" sign convention
    right for every line (especially lines that pass near the image
    center, where the correct sign is locally ambiguous) proved
    unreliable within the effort available here.

    This final version drops the sign entirely and instead correlates
    *unsigned* (RMS) curvature magnitude against radius^2 * tangential-
    weight across lines (using Pearson correlation, not a strict fit —
    more robust to the residual per-line noise). This sacrifices telling
    barrel from pincushion distortion (the spec's "wrong sign" check),
    which we no longer attempt, in exchange for a signal that actually
    measures something real: on synthetic ground truth, this correlation
    came out ~0.68-0.79 for moderate-to-strong (k1 = +-0.3, OpenCV
    normalized units) distortion vs. ~0.18 for an undistorted control —
    a real, if imperfect, separation. It is noticeably less sensitive to
    *mild* distortion (a synthetic k1=-0.15 test did not clearly separate
    from the undistorted control), which is an honest limitation of
    single-image, pixel-scale forensic measurement rather than something
    to paper over.
    """
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    segments = _detect_long_lines(gray)
    if len(segments) < _MIN_LINES:
        return None

    gray_f = gray.astype(np.float32)
    gx_map = cv2.Sobel(gray_f, cv2.CV_32F, 1, 0, ksize=3)
    gy_map = cv2.Sobel(gray_f, cv2.CV_32F, 0, 1, ksize=3)
    mag = np.sqrt(gx_map ** 2 + gy_map ** 2)

    cx, cy = w / 2.0, h / 2.0
    max_radius = float(np.hypot(cx, cy))

    rows: List[Tuple[float, float, float, float, float]] = []  # (r, curvature, mx, my, weight)
    for seg in segments:
        result = _line_curvature_magnitude(mag, seg)
        if result is None:
            continue
        curvature_mag, dx, dy = result

        mx, my = float((seg[0][0] + seg[1][0]) / 2.0), float((seg[0][1] + seg[1][1]) / 2.0)
        r_line = float(np.hypot(mx - cx, my - cy) / max_radius)
        if r_line < 0.05:
            continue  # too close to center: radial vs tangential direction is ill-defined

        radial_x, radial_y = (mx - cx) / (r_line * max_radius), (my - cy) / (r_line * max_radius)
        weight = float(abs(dx * radial_y - dy * radial_x))  # |cross(line_dir, radial_dir)|
        if weight < 0.3:
            continue  # near-radial line: expected to show ~no curvature regardless of k1, uninformative

        is_dup = any(np.hypot(mx - lx, my - ly) < 15.0 for (_, _, lx, ly, _) in rows)
        if is_dup:
            continue

        rows.append((r_line, curvature_mag, mx, my, weight))

    if len(rows) < _MIN_LINES:
        return None

    r_arr = np.array([d[0] for d in rows])
    c_arr = np.array([d[1] for d in rows])
    wt_arr = np.array([d[4] for d in rows])
    x = r_arr ** 2 * wt_arr

    if x.std() < 1e-9 or c_arr.std() < 1e-9:
        corr = 0.0
    else:
        corr = float(np.corrcoef(x, c_arr)[0, 1])
    corr_clipped = float(np.clip(corr, 0.0, 1.0))

    denom = float(np.sum(x ** 2))
    k1_est = float(np.sum(x * c_arr) / denom) if denom > 1e-9 else 0.0

    return {
        "n_lines": len(rows),
        "n_samples": len(rows),
        "k1": k1_est,
        "r2": corr_clipped,
    }


# ── S4: Vignetting — radial brightness falloff shape ────────────────────

def measure_vignetting_profile(img: np.ndarray) -> Optional[Dict[str, Any]]:
    """
    Estimate a low-frequency illumination-field proxy via strong Gaussian
    blur, bin it radially, and fit brightness(r) ~= 1 - a*r^2.
    """
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float32)

    sigma = max(8.0, min(h, w) * 0.12)
    ksize = int(sigma * 6) | 1  # odd
    blurred = cv2.GaussianBlur(gray, (ksize, ksize), sigma)

    cx, cy = w / 2.0, h / 2.0
    center_val = float(blurred[int(cy), int(cx)])
    if center_val < 5.0:
        return None  # near-black center, falloff ratio unreliable

    yy, xx = np.mgrid[0:h, 0:w]
    r_map = np.hypot(xx - cx, yy - cy) / np.hypot(cx, cy)

    n_bins = 8
    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    radii_c, ratios = [], []
    for i in range(n_bins):
        m = (r_map >= bin_edges[i]) & (r_map < bin_edges[i + 1])
        if m.sum() < 20:
            continue
        radii_c.append(float((bin_edges[i] + bin_edges[i + 1]) / 2.0))
        ratios.append(float(blurred[m].mean() / center_val))

    if len(radii_c) < 5:
        return None

    r_arr = np.array(radii_c)
    ratio_arr = np.array(ratios)
    r2_col = r_arr ** 2

    # Fit ratio ~= 1 - a * r^2  =>  (1 - ratio) ~= a * r^2
    denom = float(np.sum(r2_col ** 2))
    if denom < 1e-9:
        return None
    a = float(np.sum(r2_col * (1.0 - ratio_arr)) / denom)

    predicted = 1.0 - a * r2_col
    ss_res = float(np.sum((ratio_arr - predicted) ** 2))
    ss_tot = float(np.sum((ratio_arr - ratio_arr.mean()) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 1e-9 else 0.0
    r2 = float(np.clip(r2, 0.0, 1.0))

    monotonic = bool(np.all(np.diff(ratio_arr) <= 0.01))  # allow tiny noise

    return {
        "a": a,
        "r2": r2,
        "monotonic": monotonic,
        "corner_ratio": float(ratio_arr[-1]),
    }


# ── Public entry point ───────────────────────────────────────────────────────

def analyze_lop(img: np.ndarray, img_pil: Any = None) -> Dict[str, Any]:
    """
    Run Lens & Optical Physics analysis (LoCA, LCA, radial distortion,
    vignetting) on a uint8 RGB numpy array.

    Returns: same raw-analyzer shape as pafra.analyze_pafra (score, status,
    evidence, elapsed_ms).
    """
    t0 = time.monotonic()

    if img is None or img.ndim != 3 or img.shape[2] != 3:
        return {"score": 0.5, "status": "failure", "evidence": [], "elapsed_ms": 0}

    try:
        evidence = []
        active_signals = 0

        # S1 — LoCA: radial chromatic aberration growth + direction
        ca = measure_chromatic_aberration_radial_profile(img)
        if ca is not None:
            corr = ca["radius_correlation"]
            radiality = ca["radiality"]
            growth_score = _score_band(corr, _CA_RADIUS_CORR_LOW, _CA_RADIUS_CORR_HIGH)
            radiality_score = _score_band(radiality, _CA_RADIALITY_LOW, _CA_RADIALITY_HIGH)
            s1_score = float(np.clip(0.6 * growth_score + 0.4 * radiality_score, 0.0, 1.0))
            evidence.append({
                "name": "loca_radial_growth_and_direction",
                "score": s1_score,
                "detail": f"n={ca['n_points']} points, mean_channel_shift="
                          f"{ca['mean_shift_px']:.2f}px, radius_correlation={corr:.2f}, "
                          f"radiality={radiality:.2f} (n_radial={ca['n_radial_samples']}) "
                          f"(real-like: corr>{_CA_RADIUS_CORR_LOW:.2f}, radiality>{_CA_RADIALITY_LOW:.2f})",
            })
            active_signals += 1

        # S2 — LCA: per-channel PSF width differential
        psf = measure_psf_channel_differential(img)
        if psf is not None:
            diff = psf["mean_psf_diff"]
            s2_score = _score_band(diff, _PSF_DIFF_LOW, _PSF_DIFF_HIGH)
            evidence.append({
                "name": "lca_psf_channel_differential",
                "score": s2_score,
                "detail": f"n={psf['n_points']} edges, mean_R_B_PSF_diff={diff:.3f} "
                          f"(normalized to G width), std={psf['psf_diff_std']:.3f} "
                          f"(real-like>{_PSF_DIFF_LOW:.2f}, AI-like<{_PSF_DIFF_HIGH:.2f}). "
                          f"Depth-correlated direction not verified (no depth estimate available).",
            })
            active_signals += 1

        # S3 — Radial lens-distortion: curvature-magnitude/radius correlation
        dist = measure_radial_distortion_model(img)
        if dist is not None:
            k1, corr = dist["k1"], dist["r2"]
            s3_score = _score_band(corr, _DISTORTION_R2_LOW, _DISTORTION_R2_HIGH)
            evidence.append({
                "name": "radial_distortion_curvature_correlation",
                "score": s3_score,
                "detail": f"n_lines={dist['n_lines']} tangential_weighted_slope~{k1:.4f} "
                          f"corr={corr:.2f} "
                          f"(real-like: corr>{_DISTORTION_R2_LOW:.2f}, AI-like: corr<{_DISTORTION_R2_HIGH:.2f}). "
                          f"Barrel/pincushion sign not determined (see docstring); "
                          f"weaker sensitivity to mild distortion than to moderate/strong.",
            })
            active_signals += 1

        # S4 — Vignetting: radial brightness falloff shape
        vig = measure_vignetting_profile(img)
        if vig is not None and vig["r2"] >= _VIGNETTE_R2_MIN:
            a = vig["a"]
            s4_score = _score_band(a, _VIGNETTE_A_LOW, _VIGNETTE_A_HIGH)
            if not vig["monotonic"]:
                # Non-monotonic falloff (e.g. corners brighter than center in
                # places) is physically backwards for a lens -- push toward
                # AI-like regardless of the fitted magnitude.
                s4_score = max(s4_score, 0.7)
            evidence.append({
                "name": "vignetting_radial_falloff",
                "score": s4_score,
                "detail": f"a={a:.3f} r2={vig['r2']:.2f} corner_ratio={vig['corner_ratio']:.2f} "
                          f"monotonic={vig['monotonic']} "
                          f"(real-like: a>{_VIGNETTE_A_LOW:.2f}, AI-like: a<{_VIGNETTE_A_HIGH:.3f}). "
                          f"Weakest sub-signal: single-image illumination is confounded with scene "
                          f"content, only partially separated here via strong-blur detrending.",
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


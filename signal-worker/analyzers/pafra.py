"""
Aiscern Detection Worker — Layer 11: PAFRA
Polarization & Atmospheric Fresnel Reflection Analysis

v2 (Section 1.2 of the giant-level image engine optimization directive):
Adaptive Scene Classification + physics-fit S1/S2/S3 + new S4.

Physics background
------------------
AI image generators predict RGB pixel values directly. They have no internal
model for electromagnetic wave polarization. Real cameras capture polarized
light through lenses, and atmospheric Rayleigh scattering creates measurable
polarization gradients in sky regions that AI simply cannot replicate.

Four forensic signals
----------------------
S1 — Sky polarization gradient FIELD (not just a top/bottom correlation)
    Real sky: Rayleigh scattering produces a spatially coherent-but-not-
    uniform saturation gradient field across the sky region. AI: either
    flat (no gradient) or incoherent/random local gradients.

S2 — Atmospheric haze coherence, fit to the Koschmieder scattering model
    Real photos: luminance/saturation follows L(d) = L_inf*(1-e^{-beta d})
    + L_0*e^{-beta d} as a function of (proxy) depth toward the horizon.
    AI: this curve either doesn't fit (arbitrary variation) or fits with
    beta ~ 0 (no haze falloff at all).

S3 — Fresnel reflection plausibility, fit to the Schlick approximation
    Water/glass surfaces follow R(theta) = R0 + (1-R0)(1-cos theta)^5.
    AI reflections are artistically placed without this constraint, and
    real glass often shows a second, fainter back-surface reflection
    that AI reflections don't reproduce.

S4 — Indoor light source falloff consistency (new)
    Real indoor light sources (windows, lamps, fixtures) produce a
    physically continuous radial brightness falloff. AI-lit indoor
    scenes are frequently lit "globally" with no single source whose
    falloff actually holds up under radial measurement.

Adaptive scene routing
-----------------------
classify_scene_type() decides which signals are even meaningful for this
image before any of them run:
  outdoor_sky    -> S1, S2, and S3 if a reflective surface is also present
  outdoor_no_sky -> S3 only (Fresnel on water/glass), if present
  indoor         -> S3 (windows/mirrors) if present, plus S4
  macro          -> not_applicable (texture statistics alone can't tell a
                     genuine macro shot from a close AI crop; feeding S1-S4
                     data from either would just add noise)
  document       -> not_applicable (delegates to L22, which is what
                     actually knows what to do with a photographed document)

Honesty note on scope (read before assuming full spec compliance)
-------------------------------------------------------------------
The directive's L11 section asks for several things this pass does NOT
attempt, because building them here would be pretend-precision rather
than real detection:
  - Sun-position Rayleigh scattering simulation from EXIF GPS+timestamp:
    skipped. Most uploads have GPS/orientation EXIF stripped by whatever
    platform they were shared through before ever reaching Aiscern, so
    this would silently no-op on the large majority of real traffic
    while adding a real dependency (ephemeris/solar-position math) for
    little practical gain.
  - Object-size-based depth estimation (cars/people) for the Koschmieder
    fit's depth axis: skipped — needs an object detector this pipeline
    doesn't otherwise run. Normalized row position within the sky region
    is used as a monotonic depth proxy instead (this is what v1 did
    implicitly via row-correlation already; v2 makes it an explicit,
    honestly-labeled approximation and actually fits the Koschmieder
    curve to it instead of just checking correlation sign).
  - CCT-illuminant-based expected-beta validation: skipped, same reason
    — no illuminant estimation module exists yet in this pipeline.
  - Full microfacet/shape-from-shading viewing-angle estimation for the
    Fresnel fit: approximated via radial position within the reflective
    patch (center ~ near-normal incidence, edge ~ grazing angle) — same
    "position as a monotonic angle proxy" pattern as the Koschmieder
    depth proxy above, now backing a real Schlick curve_fit instead of
    a single center/edge brightness ratio.
What IS new and real here: adaptive scene routing (rule-based — the
directive offers rule-based as an explicit alternative to a MobileNetV3
segmenter, and pulling in a new pretrained-model dependency for a single
routing decision isn't worth the added weight/latency), genuine nonlinear
curve fitting (scipy.optimize.curve_fit) for S2 and S3 replacing simple
correlation/ratio heuristics, 8-direction gradient-field coherence for
S1, a new S4 indoor light-falloff signal, and a scene-brightness-adaptive
threshold for S1 (sunny vs. overcast skies have genuinely different
gradient magnitudes).

Returns
-------
Neutral score (0.5) when no applicable scene element is detected.
status="not_applicable" for macro/document scenes (see LAYER_WEIGHTS
handling in engines/image_engine.py — excluded from fusion entirely,
same convention as L13/L14/L17/L22).
score=0.0 -> strongly real  |  score=1.0 -> strongly AI
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

# HSV thresholds for sky detection (blue hue region, low saturation tolerance)
_SKY_HUE_MIN    = 90   # H in [0,179] — cyan-to-blue
_SKY_HUE_MAX    = 135
_SKY_SAT_MIN    = 20   # some saturation required
_SKY_SAT_MAX    = 220
_SKY_VAL_MIN    = 80   # not too dark

# Minimum sky-region fraction of image height to consider the signal active
_SKY_MIN_FRAC   = 0.05  # 5% of image must be sky

# Reflective surface: bright region with low color variance (specular highlight)
_REFL_BRIGHT_THRESH = 200   # pixel brightness (gray)
_REFL_MAX_CHROMA    = 30    # max chroma in Lab A/B channels


# ── Sky / reflective-surface detection (unchanged from v1) ────────────────────

def detect_sky_region(img: np.ndarray) -> np.ndarray:
    """
    Return a binary mask (uint8, 0/255) of sky pixels.

    Strategy: look for blue-ish, moderately saturated pixels in the upper half
    of the image, avoiding edge regions that are likely not sky.
    """
    h, w = img.shape[:2]
    upper = img[:int(h * 0.60), :]

    hsv = cv2.cvtColor(upper, cv2.COLOR_RGB2HSV)
    mask_upper = cv2.inRange(
        hsv,
        np.array([_SKY_HUE_MIN, _SKY_SAT_MIN, _SKY_VAL_MIN]),
        np.array([_SKY_HUE_MAX, _SKY_SAT_MAX, 255]),
    )

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    mask_upper = cv2.morphologyEx(mask_upper, cv2.MORPH_OPEN,  kernel)
    mask_upper = cv2.morphologyEx(mask_upper, cv2.MORPH_CLOSE, kernel)

    full_mask = np.zeros((h, w), dtype=np.uint8)
    full_mask[:int(h * 0.60), :] = mask_upper
    return full_mask


def detect_reflective_surfaces(img: np.ndarray) -> np.ndarray:
    """
    Return a binary mask of specular/reflective surface pixels.

    Fresnel reflections are bright and near-achromatic. We look for bright
    patches with low colorfulness in the CIE L*a*b* space.
    """
    gray  = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    lab   = cv2.cvtColor(img, cv2.COLOR_RGB2LAB).astype(np.float32)

    bright_mask = (gray.astype(np.float32) > _REFL_BRIGHT_THRESH).astype(np.uint8) * 255

    a_centered = np.abs(lab[:, :, 1] - 128.0)
    b_centered = np.abs(lab[:, :, 2] - 128.0)
    chroma     = np.hypot(a_centered, b_centered)
    low_chroma = (chroma < _REFL_MAX_CHROMA).astype(np.uint8) * 255

    mask = cv2.bitwise_and(bright_mask, low_chroma)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    return mask


# ── Section 1.2 item 1: Adaptive Scene Classification ─────────────────────────

def classify_scene_type(img: np.ndarray) -> Tuple[str, Dict[str, Any]]:
    """
    Rule-based scene classifier (the directive offers "lightweight
    MobileNetV3 or rule-based" — a new pretrained-model dependency isn't
    worth it for a single routing decision feeding four heuristic
    signals, none of which need pixel-perfect segmentation to be useful).

    Returns one of "outdoor_sky", "outdoor_no_sky", "indoor", "macro",
    "document", plus a details dict for the evidence trail.
    """
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    details: Dict[str, Any] = {}

    # Document/ID — defer to the L22 classifier so both layers agree on
    # what "this is a document" means, rather than maintaining two
    # separate, potentially-disagreeing heuristics.
    try:
        from analyzers.document_forensics import classify_image_type
        doc_cls = classify_image_type(img)
        details["document_confidence"] = doc_cls.get("classification_confidence", 0.0)
        if doc_cls.get("is_document"):
            return "document", details
    except Exception:
        pass  # never let L22's absence/failure break L11 routing

    sky_mask = detect_sky_region(img)
    sky_frac = float(sky_mask.sum() / 255) / float(h * w)
    details["sky_frac"] = round(sky_frac, 4)
    if sky_frac >= _SKY_MIN_FRAC:
        return "outdoor_sky", details

    # Macro: near-uniform, extreme close-up texture detail across almost
    # the whole frame. This can't fully distinguish a genuine macro shot
    # from a tight AI crop from texture statistics alone — which is
    # exactly why "macro" routes to not_applicable below rather than
    # being trusted as a real/fake signal itself.
    lap = cv2.Laplacian(gray, cv2.CV_64F)
    lap_var = float(lap.var())
    tiles = 6
    th, tw = max(h // tiles, 1), max(w // tiles, 1)
    tile_vars = []
    for ty in range(tiles):
        for tx in range(tiles):
            patch = lap[ty * th:(ty + 1) * th, tx * tw:(tx + 1) * tw]
            if patch.size:
                tile_vars.append(float(patch.var()))
    tile_vars_arr = np.array(tile_vars) if tile_vars else np.array([0.0])
    sharp_uniformity = 1.0 - min(1.0, float(tile_vars_arr.std() / (tile_vars_arr.mean() + 1e-6)))
    details["lap_var"] = round(lap_var, 1)
    details["sharp_uniformity"] = round(sharp_uniformity, 3)
    if lap_var > 800 and sharp_uniformity > 0.55:
        return "macro", details

    # Indoor vs outdoor_no_sky: rectilinear structure (wall/ceiling/door
    # edges) density via probabilistic Hough lines, biased toward
    # axis-aligned orientations typical of built interiors.
    edges = cv2.Canny(gray, 50, 150)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=80,
                             minLineLength=min(h, w) // 4, maxLineGap=20)
    axis_aligned = 0
    if lines is not None:
        for l in lines[:, 0, :]:
            x1, y1, x2, y2 = l
            ang = abs(np.degrees(np.arctan2(y2 - y1, x2 - x1)))
            if ang < 8 or ang > 172 or 82 < ang < 98:
                axis_aligned += 1
    details["axis_aligned_lines"] = axis_aligned
    if axis_aligned >= 6:
        return "indoor", details

    return "outdoor_no_sky", details


# ── S1 — Sky polarization gradient field ───────────────────────────────────────

def _signal_sky_polarization(img: np.ndarray, sky_mask: np.ndarray,
                              scene_brightness: float) -> Tuple[float, str]:
    """
    S1 — 8-direction local gradient VECTOR FIELD analysis, replacing v1's
    single global Y-position correlation.

    Real Rayleigh-scattered sky: saturation gradient vectors across the
    sky region share a dominant orientation without being perfectly
    uniform (the scattering geometry varies smoothly but non-trivially
    across the frame). AI sky: gradients are either near-zero everywhere
    (flat paint, no gradient at all) or point in incoherent/random local
    directions (no shared physical cause) — or, less obviously, are
    *too* perfectly uniform (a single flat linear gradient painted in,
    with none of Rayleigh scattering's genuine angular falloff).

    scene_brightness (0-1) makes the "flat gradient" floor adaptive:
    overcast real skies have genuinely weaker gradients than clear sunny
    skies, so a fixed magnitude cutoff would misfire on real photos.
    """
    ys, xs = np.where(sky_mask > 0)
    if len(ys) < 400:
        return 0.5, "insufficient_sky_pixels"

    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV).astype(np.float32)
    sat = hsv[:, :, 1]

    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    sat_roi = sat[y0:y1 + 1, x0:x1 + 1]
    mask_roi = sky_mask[y0:y1 + 1, x0:x1 + 1] > 0
    if sat_roi.shape[0] < 8 or sat_roi.shape[1] < 8:
        return 0.5, "sky_roi_too_small"

    gy, gx = np.gradient(sat_roi)
    mag = np.sqrt(gy ** 2 + gx ** 2)
    ang = np.degrees(np.arctan2(gy, gx)) % 180  # a director field (0-180), not a vector field

    mag_m, ang_m = mag[mask_roi], ang[mask_roi]
    if mag_m.size < 100:
        return 0.5, "insufficient_gradient_samples"

    mag_floor = 0.15 + 0.25 * float(np.clip(scene_brightness, 0.0, 1.0))  # 0.15 (overcast) .. 0.40 (bright sun)
    strong = mag_m > np.percentile(mag_m, 70)
    mean_mag = float(mag_m[strong].mean()) if strong.any() else float(mag_m.mean())

    if mean_mag < mag_floor:
        return 0.68, f"flat_gradient_ai: mean_mag={mean_mag:.3f} floor={mag_floor:.3f}"

    # Circular coherence of the strong-gradient orientations. Doubled-angle
    # trick for a 0-180 director field (standard circular statistics).
    rad2 = np.radians(ang_m[strong] * 2)
    R = float(np.hypot(np.cos(rad2).mean(), np.sin(rad2).mean()))  # 0=incoherent .. 1=perfectly aligned

    if 0.25 <= R <= 0.85:
        score = max(0.0, 0.35 - (R - 0.25) * 0.15)
        detail = f"coherent_field_real: R={R:.3f} mag={mean_mag:.3f}"
    elif R > 0.85:
        score = 0.60
        detail = f"too_uniform_linear_ai: R={R:.3f} mag={mean_mag:.3f}"
    else:
        score = 0.65
        detail = f"incoherent_field_ai: R={R:.3f} mag={mean_mag:.3f}"

    return float(np.clip(score, 0.0, 1.0)), detail


# ── S2 — Koschmieder atmospheric scattering fit ────────────────────────────────

def _koschmieder(d: np.ndarray, L_inf: float, L_0: float, beta: float) -> np.ndarray:
    return L_inf * (1 - np.exp(-beta * d)) + L_0 * np.exp(-beta * d)


def _signal_aerial_perspective(img: np.ndarray, sky_mask: np.ndarray) -> Tuple[float, str]:
    """
    S2 — Fit the actual Koschmieder scattering equation to the row-mean
    saturation curve, replacing v1's linear-correlation-sign heuristic.

    d (depth) is approximated by normalized row position within the sky
    region — see module docstring's honesty note on why true object-size
    depth estimation isn't attempted here. Real haze produces a curve
    genuinely better explained by the Koschmieder exponential (good R^2)
    with a physically plausible, non-zero scattering coefficient beta;
    AI skies usually aren't (either no falloff -> beta~0, or a fit that
    doesn't meaningfully beat a flat baseline).
    """
    sky_rows = np.where(sky_mask.any(axis=1))[0]
    if len(sky_rows) < 20:
        return 0.5, "insufficient_sky_rows"

    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV).astype(np.float32)
    row_sat, row_d = [], []
    for r in sky_rows:
        cols = np.where(sky_mask[r] > 0)[0]
        if len(cols) < 5:
            continue
        row_sat.append(float(hsv[r, cols, 1].mean()))
        row_d.append(float(r))
    if len(row_sat) < 12:
        return 0.5, "insufficient_sky_rows_with_pixels"

    row_sat = np.array(row_sat, dtype=np.float64)
    d = np.array(row_d, dtype=np.float64)
    d = (d - d.min()) / (d.max() - d.min() + 1e-9)

    if row_sat.std() < 0.5:
        return 0.65, f"flat_saturation_ai: std={row_sat.std():.2f}"

    try:
        from scipy.optimize import curve_fit
        L0_guess, Linf_guess = float(row_sat[0]), float(row_sat[-1])
        popt, _ = curve_fit(
            _koschmieder, d, row_sat,
            p0=[Linf_guess, L0_guess, 2.0],
            bounds=([0, 0, 1e-3], [255, 255, 50]),
            maxfev=2000,
        )
        L_inf, L_0, beta = popt
        pred = _koschmieder(d, *popt)
        ss_res = float(np.sum((row_sat - pred) ** 2))
        ss_tot = float(np.sum((row_sat - row_sat.mean()) ** 2)) + 1e-9
        r2 = 1.0 - ss_res / ss_tot
    except Exception as exc:
        return 0.5, f"fit_failed:{exc}"

    if r2 > 0.55 and 0.15 < beta < 25:
        score = max(0.0, 0.32 - (r2 - 0.55) * 0.3)
        detail = f"koschmieder_fit_real: r2={r2:.2f} beta={beta:.2f}"
    elif r2 < 0.15 or beta <= 0.15:
        score = 0.63
        detail = f"no_haze_falloff_ai: r2={r2:.2f} beta={beta:.2f}"
    else:
        score = 0.50
        detail = f"ambiguous_fit: r2={r2:.2f} beta={beta:.2f}"

    return float(np.clip(score, 0.0, 1.0)), detail


# ── S3 — Schlick Fresnel fit + multi-bounce reflection check ──────────────────

def _schlick(cos_theta: np.ndarray, R0: float) -> np.ndarray:
    return R0 + (1 - R0) * (1 - cos_theta) ** 5


def _signal_fresnel_consistency(img: np.ndarray, refl_mask: np.ndarray) -> Tuple[float, str]:
    """
    S3 — Schlick-approximation curve fit across multiple radial bins per
    reflective patch, replacing v1's 2-bin (center vs. edge) ratio. Also
    checks for a genuine multi-bounce (front+back surface) secondary
    reflection, which real glass shows and AI reflections typically don't.

    Viewing angle theta is approximated from normalized radial position
    within each patch (0=center~near-normal incidence, 1=edge~grazing) —
    see module docstring's honesty note; this is the same "position as a
    monotonic angle/depth proxy" pattern used in S2 above, now fit to the
    real Schlick curve instead of a single ratio.
    """
    if refl_mask.sum() < 200:
        return 0.5, "no_reflective_surface"

    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float64)
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(refl_mask)
    if num_labels <= 1:
        return 0.5, "no_reflective_components"

    fit_scores = []
    bounce_hits = 0

    for i in range(1, min(num_labels, 6)):
        area = stats[i, cv2.CC_STAT_AREA]
        if area < 150:
            continue
        comp_mask = labels == i
        ys, xs = np.where(comp_mask)
        cy, cx = centroids[i][1], centroids[i][0]
        r = np.hypot(ys - cy, xs - cx)
        r_max = r.max() + 1e-9
        r_norm = r / r_max
        vals = gray[ys, xs]

        bins = np.linspace(0, 1, 6)
        bin_means, bin_theta = [], []
        for b0, b1 in zip(bins[:-1], bins[1:]):
            sel = (r_norm >= b0) & (r_norm < b1)
            if sel.sum() < 8:
                continue
            bin_means.append(float(vals[sel].mean()))
            bin_theta.append(float((b0 + b1) / 2))
        if len(bin_means) < 4:
            continue

        bin_means_arr = np.array(bin_means)
        cos_theta = 1.0 - np.array(bin_theta)  # center~cos=1 (normal) .. edge~cos->0 (grazing)
        span = bin_means_arr.max() - bin_means_arr.min() + 1e-9
        norm_means = (bin_means_arr - bin_means_arr.min()) / span

        try:
            from scipy.optimize import curve_fit
            popt, _ = curve_fit(_schlick, cos_theta, norm_means, p0=[0.1],
                                 bounds=([0.0], [1.0]), maxfev=1000)
            pred = _schlick(cos_theta, *popt)
            ss_res = float(np.sum((norm_means - pred) ** 2))
            ss_tot = float(np.sum((norm_means - norm_means.mean()) ** 2)) + 1e-9
            r2 = 1.0 - ss_res / ss_tot
            r2 = max(r2, -5.0)  # a near-zero-variance patch (flat/uniform bright
            # region) can blow ss_tot down toward the 1e-9 floor, sending R^2 to
            # numerically absurd negative magnitudes that are still correctly
            # "bad fit" but unreadable in evidence output — clamp for display,
            # the mean_r2 < 0.1 classification below doesn't care about the
            # exact magnitude either way.
        except Exception:
            r2 = -1.0
        fit_scores.append(r2)

        # Multi-bounce: a fainter secondary bright region just outside this
        # patch's bounding box (back-surface reflection sits near but
        # offset from the primary front-surface one in real glass).
        x, y, cw, ch, _ = stats[i]
        pad = max(cw, ch) // 2
        y0, y1 = max(0, y - pad), min(gray.shape[0], y + ch + pad)
        x0, x1 = max(0, x - pad), min(gray.shape[1], x + cw + pad)
        ring = gray[y0:y1, x0:x1]
        local_mask = comp_mask[y0:y1, x0:x1]
        if ring.size and local_mask.any() and local_mask.sum() < local_mask.size:
            primary_mean = float(vals.mean())
            outside = ring[~local_mask]
            if outside.size > 50:
                secondary_bright = outside[outside > primary_mean * 0.3]
                if secondary_bright.size > 0.02 * outside.size and secondary_bright.mean() < primary_mean * 0.85:
                    bounce_hits += 1

    if not fit_scores:
        return 0.5, "no_valid_patches"

    mean_r2 = float(np.mean(fit_scores))
    has_bounce = bounce_hits > 0

    if mean_r2 > 0.5:
        score = max(0.0, 0.35 - (mean_r2 - 0.5) * 0.3)
        if has_bounce:
            score = max(0.0, score - 0.08)
        detail = f"schlick_fit_real: r2={mean_r2:.2f} bounce={has_bounce}"
    elif mean_r2 < 0.1:
        score = 0.62
        detail = f"no_fresnel_curve_ai: r2={mean_r2:.2f} bounce={has_bounce}"
    else:
        score = 0.50
        detail = f"ambiguous_fresnel: r2={mean_r2:.2f} bounce={has_bounce}"

    return float(np.clip(score, 0.0, 1.0)), detail


# ── S4 (new) — Indoor light source falloff consistency ─────────────────────────

def _signal_indoor_light_consistency(img: np.ndarray) -> Tuple[float, str]:
    """
    New S4 — indoor light source radial falloff consistency. Real light
    sources (windows, lamps, ceiling fixtures) produce a smooth, roughly
    monotonic brightness falloff radiating outward. AI-generated indoor
    scenes are often lit "globally" without a consistent falloff tied to
    any single visible source.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float64)
    h, w = gray.shape
    bright_thresh = float(np.percentile(gray, 97))
    if bright_thresh < 180:
        return 0.5, "no_bright_source_candidate"

    bright_mask = (gray >= bright_thresh).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    bright_mask = cv2.morphologyEx(bright_mask, cv2.MORPH_CLOSE, kernel)
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(bright_mask)
    if num_labels <= 1:
        return 0.5, "no_bright_source_region"

    profiles_ok, profiles_checked = 0, 0
    for i in range(1, min(num_labels, 4)):
        area = stats[i, cv2.CC_STAT_AREA]
        if area < 80 or area > 0.15 * h * w:
            continue  # too small to trust, or too large to be a "source" (likely a blown-out window wall)
        cy, cx = centroids[i][1], centroids[i][0]
        max_r = min(h, w) * 0.35
        radii = np.linspace(4, max_r, 8)
        yy, xx = np.ogrid[:h, :w]
        d = np.hypot(yy - cy, xx - cx)

        ring_means = []
        for r0, r1 in zip(radii[:-1], radii[1:]):
            ring = (d >= r0) & (d < r1)
            if ring.sum() < 30:
                continue
            ring_means.append(float(gray[ring].mean()))
        if len(ring_means) < 5:
            continue
        profiles_checked += 1

        diffs = np.diff(ring_means)
        monotonic_frac = float((diffs <= 2.0).mean())  # allow +2 gray-level noise tolerance
        if monotonic_frac >= 0.7 and ring_means[0] > ring_means[-1] + 5:
            profiles_ok += 1

    if profiles_checked == 0:
        return 0.5, "no_measurable_falloff_profile"

    ok_frac = profiles_ok / profiles_checked
    if ok_frac >= 0.6:
        score = max(0.0, 0.35 - (ok_frac - 0.6) * 0.4)
        detail = f"light_falloff_real: ok_frac={ok_frac:.2f} n={profiles_checked}"
    elif ok_frac <= 0.2:
        score = 0.64
        detail = f"no_physical_falloff_ai: ok_frac={ok_frac:.2f} n={profiles_checked}"
    else:
        score = 0.50
        detail = f"ambiguous_falloff: ok_frac={ok_frac:.2f} n={profiles_checked}"

    return float(np.clip(score, 0.0, 1.0)), detail


# ── Public API ────────────────────────────────────────────────────────────────

def analyze_pafra(img: np.ndarray, img_pil: Any) -> Dict[str, Any]:
    """
    Run PAFRA analysis on a uint8 RGB numpy array.

    Parameters
    ----------
    img     : np.ndarray — H×W×3 uint8 RGB image
    img_pil : PIL.Image | None — unused, kept for API consistency

    Returns
    -------
    dict with keys:
        score      : float [0=real, 1=AI]
        status     : "success" | "not_applicable" | "failure"
        evidence   : list of {"name", "score", "detail"} dicts
        elapsed_ms : int
        scene_type : str (present whenever scene classification ran)
    """
    t0 = time.monotonic()

    if img is None or img.ndim != 3 or img.shape[2] != 3:
        return {"score": 0.5, "status": "failure", "evidence": [], "elapsed_ms": 0}

    try:
        scene_type, scene_details = classify_scene_type(img)

        if scene_type in ("macro", "document"):
            # Section 1.2 item 1: macro/document scenes don't get diluted
            # by physics signals that assume open-scene geometry. Document
            # photos are handled by L22 instead.
            elapsed = int((time.monotonic() - t0) * 1000)
            return {
                "score": 0.5, "status": "not_applicable",
                "evidence": [{"name": "scene_not_applicable", "score": 0.5,
                              "detail": f"scene_type={scene_type} {scene_details}"}],
                "elapsed_ms": elapsed, "scene_type": scene_type,
            }

        evidence = []
        active_signals = 0
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        scene_brightness = float(gray.mean()) / 255.0

        sky_mask = detect_sky_region(img) if scene_type == "outdoor_sky" else np.zeros(img.shape[:2], dtype=np.uint8)
        refl_mask = detect_reflective_surfaces(img)
        has_refl = float(refl_mask.sum() / 255) > 200

        if scene_type == "outdoor_sky":
            s1_score, s1_detail = _signal_sky_polarization(img, sky_mask, scene_brightness)
            evidence.append({"name": "sky_polarization_gradient_field", "score": s1_score, "detail": s1_detail})
            if s1_score != 0.5:
                active_signals += 1

            s2_score, s2_detail = _signal_aerial_perspective(img, sky_mask)
            evidence.append({"name": "koschmieder_aerial_perspective", "score": s2_score, "detail": s2_detail})
            if s2_score != 0.5:
                active_signals += 1

        if has_refl:
            s3_score, s3_detail = _signal_fresnel_consistency(img, refl_mask)
            evidence.append({"name": "schlick_fresnel_plausibility", "score": s3_score, "detail": s3_detail})
            if s3_score != 0.5:
                active_signals += 1

        if scene_type == "indoor":
            s4_score, s4_detail = _signal_indoor_light_consistency(img)
            evidence.append({"name": "indoor_light_falloff_consistency", "score": s4_score, "detail": s4_detail})
            if s4_score != 0.5:
                active_signals += 1

        if not evidence:
            elapsed = int((time.monotonic() - t0) * 1000)
            return {
                "score": 0.5, "status": "success",
                "evidence": [{"name": "no_applicable_scene_element", "score": 0.5,
                              "detail": f"scene_type={scene_type} no signals fired"}],
                "elapsed_ms": elapsed, "scene_type": scene_type,
            }

        # Active signals (non-neutral) are weighted 2x vs neutral ones
        weighted_sum = sum(e["score"] * (2.0 if e["score"] != 0.5 else 1.0) for e in evidence)
        total_w = sum(2.0 if e["score"] != 0.5 else 1.0 for e in evidence)
        composite = weighted_sum / total_w

        elapsed = int((time.monotonic() - t0) * 1000)
        return {
            "score":          round(float(np.clip(composite, 0.0, 1.0)), 4),
            "status":         "success",
            "evidence":       evidence,
            "elapsed_ms":     elapsed,
            "active_signals": active_signals,
            "scene_type":     scene_type,
        }

    except Exception as exc:
        logger.warning("[PAFRA] analysis failed: %s", exc)
        elapsed = int((time.monotonic() - t0) * 1000)
        return {"score": 0.5, "status": "failure", "evidence": [], "elapsed_ms": elapsed}

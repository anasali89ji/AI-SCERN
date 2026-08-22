"""
Aiscern Detection Worker — Layer 13: SSWDP
Sub-Surface Wavelength Diffusion Profile

v2 (Section 1.2 of the giant-level image engine optimization directive):
material database expansion + auto-detection, multi-model/multi-wavelength
S1 decay fitting, and structure-tensor-based S2 anisotropy.

Physics background
------------------
Biological materials (skin, wax, marble) are translucent — light penetrates
below the surface, scatters internally, and re-emerges. This process, called
Subsurface Scattering (SSS), is highly wavelength-dependent:

  Red light   (≈700 nm) penetrates deeply     — 3–5 mm in skin
  Green light (≈550 nm) penetrates moderately — 1–2 mm in skin
  Blue light  (≈450 nm) scatters near-surface — 0.2–0.4 mm in skin

Consequence: at the edge of a translucent region, the R channel decays more
slowly (spatially) than the B channel. The ratio R_decay / B_decay is
physically constrained per material — for real human skin it's ~8-12x.

AI generators mimic the visual appearance of SSS but compute it
approximately (e.g. Stable Diffusion's VAE has no SSS model). The resulting
wavelength-dependent decay ratio is wrong — typically 1-3x instead of the
material's real ratio.

Material database (Section 1.2 item 1)
----------------------------------------
v1 only ever loaded and applied the "human_skin" profile from
data/sss_profiles.json, even though the file already contained wax,
marble, milk, and juice profiles that were simply never used.
detect_material_type() now auto-routes to whichever of 7 materials
(human_skin, wax, marble, milk, juice, jade, soap) actually dominates the
image, using HSV colour-hint ranges now stored per-profile in the JSON.
Two more materials were added to the database (human_teeth, plant_leaf)
alongside a new fruit_flesh entry, but are deliberately NOT auto-routed
to — see detect_material_type()'s docstring for why a colour-only match
isn't reliable enough for those two without a real region proposal (a
mouth/face crop, a cut-fruit classifier) this pipeline doesn't have.

Two signals
-----------
S1 — SSS decay profile, now multi-model (exponential / half-Gaussian /
    power-law, AIC-selected) and multi-wavelength (fits R, G, AND B —
    not just R/B — and checks the full tau_R > tau_G > tau_B physical
    ordering as corroborating evidence, not just the R/B endpoint ratio).
    For each detected material-edge pixel, we sample a perpendicular
    profile inward and fit the best-supported decay model per channel.

S2 — Cross-region colour variance anisotropy, now via structure-tensor
    eigenvalue ratios per channel rather than a flat std ratio. Real
    material: the R channel's local gradient field is more isotropic
    (scattering blurs directionality); the B channel stays anisotropic
    (dominated by sharp, undiffused surface reflection). AI: R and B
    tensors look similar — no physically-driven difference in blur
    behaviour between channels.

Honesty note on scope (read before assuming full spec compliance)
-------------------------------------------------------------------
Not attempted, same "don't fake precision" reasoning as the other
Section 1.2 modules:
  - Monte Carlo SSS photon-transport simulation compared via Earth
    Mover's Distance: skipped. This means literally implementing a real
    subsurface light-transport simulator (photon scattering, absorption,
    material-specific phase functions) — that's a research project in
    its own right, not something a code patch can responsibly bolt on.
  - "NIR estimation from R-channel excess": skipped, and flagged as not
    physically real as worded — a standard RGB sensor's R channel does
    not carry recoverable near-infrared information; there's no "excess"
    to extract. Multi-wavelength analysis is still genuinely implemented
    (see S1 above), just correctly limited to the three channels that
    actually exist in the data.
  - Reliable human_teeth / fruit_flesh auto-detection: skipped, see
    detect_material_type()'s docstring — both stay in the database for
    explicit/future use.

Returns
-------
Neutral (0.5) when no recognized translucent material region is detected.
score=0.0 → strongly real  |  score=1.0 → strongly AI
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ── Load SSS profiles ─────────────────────────────────────────────────────────
_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

def _load_sss_profiles() -> dict:
    path = os.path.join(_DATA_DIR, "sss_profiles.json")
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return {}

_SSS_PROFILES = _load_sss_profiles()
_SKIN_PROFILE = _SSS_PROFILES.get("human_skin", {
    "penetration_depth_mm": {"red": 4.2, "green": 1.8, "blue": 0.35},
    "ratio_min": 8.0,
})

# Materials deliberately excluded from auto-detection (see
# detect_material_type() docstring) — kept in the database, not routed to.
_AUTO_DETECT_EXCLUDED = {"human_skin", "human_teeth", "fruit_flesh"}  # skin handled separately, first

# ── Skin detection ────────────────────────────────────────────────────────────

_SKIN_LOWER1 = np.array([0,   48,  80],  dtype=np.uint8)  # HSV lower bound
_SKIN_UPPER1 = np.array([20, 255, 255],  dtype=np.uint8)
_SKIN_LOWER2 = np.array([170, 48,  80],  dtype=np.uint8)  # Wrap-around hue
_SKIN_UPPER2 = np.array([180, 255, 255], dtype=np.uint8)


def detect_skin_regions(img: np.ndarray) -> np.ndarray:
    """
    Return a binary mask (uint8 0/255) of skin-coloured pixels.

    Uses HSV double-range for warm skin tones, plus a YCrCb confirmation.
    Unchanged from v1 — kept as its own function (rather than folded into
    detect_material_type) for backward compatibility with existing callers.
    """
    if img.ndim != 3 or img.shape[2] != 3:
        return np.zeros(img.shape[:2], dtype=np.uint8)

    hsv  = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)
    mask1 = cv2.inRange(hsv, _SKIN_LOWER1, _SKIN_UPPER1)
    mask2 = cv2.inRange(hsv, _SKIN_LOWER2, _SKIN_UPPER2)
    hsv_mask = cv2.bitwise_or(mask1, mask2)

    # YCrCb confirmation — standard skin-tone range
    ycrcb = cv2.cvtColor(img, cv2.COLOR_RGB2YCrCb)
    ycrcb_mask = cv2.inRange(
        ycrcb,
        np.array([0, 135, 85], dtype=np.uint8),
        np.array([255, 180, 135], dtype=np.uint8),
    )

    mask = cv2.bitwise_and(hsv_mask, ycrcb_mask)
    # Clean up
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,  kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    return mask


# ── Section 1.2 item 1: material auto-detection ────────────────────────────────

def detect_material_type(img: np.ndarray) -> Tuple[str, np.ndarray, float]:
    """
    Auto-detect which known translucent material (if any) dominates the
    image, and return its region mask — so S1/S2 apply the RIGHT profile
    instead of v1's "always assume human skin" behaviour.

    Skin is checked first via the existing, well-tested detect_skin_regions
    (unchanged, and still its own public function for callers/tests that
    want skin specifically). Other materials are matched via the HSV
    colour-hint ranges now stored per-profile in data/sss_profiles.json,
    with a soft texture-consistency check (a "smooth" material scored down,
    not excluded, if the candidate region turns out highly textured) —
    the material with the highest confidence clearing a minimum area
    fraction wins.

    human_teeth and fruit_flesh are in the database but deliberately
    EXCLUDED here: both need a real region proposal (a mouth/face crop
    for teeth; a "this is a cut piece of fruit" classifier for flesh) to
    avoid false-positiving on any pale smooth object in frame. A raw
    colour-only match isn't reliable enough to route to them automatically
    — they stay available for a future region-proposal step, or for a
    caller that already knows the material and wants the profile directly.

    Returns (material_name, mask, area_fraction). ("none", empty_mask, 0.0)
    when nothing clears the detection bar.
    """
    h, w = img.shape[:2]
    total_px = float(h * w)

    skin_mask = detect_skin_regions(img)
    skin_frac = float(skin_mask.sum() / 255) / total_px
    if skin_frac >= 0.02:
        return "human_skin", skin_mask, skin_frac

    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    lap_var_global = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)

    best_name = "none"
    best_mask = np.zeros((h, w), dtype=np.uint8)
    best_conf = 0.0

    for name, prof in _SSS_PROFILES.items():
        if name in _AUTO_DETECT_EXCLUDED:
            continue
        hint = prof.get("color_hint")
        if not hint:
            continue

        h_range = hint.get("h_range", [0, 179])
        s_range = hint.get("s_range", [0, 255])
        v_range = hint.get("v_range", [0, 255])
        mask = cv2.inRange(
            hsv,
            np.array([h_range[0], s_range[0], v_range[0]], dtype=np.uint8),
            np.array([h_range[1], s_range[1], v_range[1]], dtype=np.uint8),
        )
        h_range2 = hint.get("h_range2")
        if h_range2:
            mask2 = cv2.inRange(
                hsv,
                np.array([h_range2[0], s_range[0], v_range[0]], dtype=np.uint8),
                np.array([h_range2[1], s_range[1], v_range[1]], dtype=np.uint8),
            )
            mask = cv2.bitwise_or(mask, mask2)

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,  kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        frac = float(mask.sum() / 255) / total_px
        if frac < 0.02:
            continue

        expect_smooth = hint.get("smoothness", "medium") == "low"
        texture_match = (lap_var_global < 400) if expect_smooth else True
        confidence = frac * (1.0 if texture_match else 0.7)

        if confidence > best_conf:
            best_name, best_mask, best_conf = name, mask, confidence

    if best_conf > 0.0:
        return best_name, best_mask, float(best_mask.sum() / 255) / total_px
    return "none", np.zeros((h, w), dtype=np.uint8), 0.0


def extract_perpendicular_profile(
    img: np.ndarray,
    edge_x: int,
    edge_y: int,
    skin_mask: np.ndarray,
    length: int = 30,
) -> Optional[np.ndarray]:
    """
    Extract a colour profile perpendicular to the material boundary at
    (edge_x, edge_y). Unchanged from v1 (parameter still named skin_mask
    for backward compatibility with existing callers/tests — it works
    identically for any binary region mask, skin or otherwise).

    Samples `length` pixels inward. Returns array of shape (N, 3) with
    RGB values, or None if insufficient valid pixels.
    """
    h, w = img.shape[:2]

    sob_x = cv2.Sobel(skin_mask.astype(np.float32), cv2.CV_32F, 1, 0, ksize=3)
    sob_y = cv2.Sobel(skin_mask.astype(np.float32), cv2.CV_32F, 0, 1, ksize=3)

    gx = float(sob_x[edge_y, edge_x])
    gy = float(sob_y[edge_y, edge_x])
    norm = float(np.hypot(gx, gy))
    if norm < 1.0:
        return None

    dx, dy = -gx / norm, -gy / norm

    profile = []
    for k in range(length):
        px = int(edge_x + round(dx * k))
        py = int(edge_y + round(dy * k))
        if 0 <= px < w and 0 <= py < h:
            profile.append(img[py, px, :].tolist())

    if len(profile) < length // 2:
        return None

    return np.array(profile, dtype=np.float32)


# ── Section 1.2 item 2: multi-model decay fitting ──────────────────────────────

def _model_exp(x: np.ndarray, A: float, tau: float, C: float) -> np.ndarray:
    return A * np.exp(-x / max(tau, 1e-6)) + C


def _model_gauss(x: np.ndarray, A: float, sigma: float, C: float) -> np.ndarray:
    """Half-Gaussian decay from the edge (x=0)."""
    return A * np.exp(-(x ** 2) / (2 * max(sigma, 1e-6) ** 2)) + C


def _model_power(x: np.ndarray, A: float, p: float, C: float) -> np.ndarray:
    return A * np.power(x + 1.0, -np.clip(p, 0.01, 10)) + C


def _fit_best_model(values: np.ndarray) -> Tuple[float, str]:
    """
    Multi-model fitting (Section 1.2 item 2): fit exponential, half-
    Gaussian, and power-law decay models to the profile; select the best
    via AIC (n*ln(RSS/n) + 2k). Returns an "effective tau" — the
    x-distance at which the fitted curve falls to 1/e of its value at
    x=0 — so all three model families produce a directly comparable
    decay-length, and the R/B ratio logic downstream doesn't need to
    know which model won.

    Returns (effective_tau, winning_model_name). tau=0.0 on failure/no
    decay.
    """
    n = len(values)
    if n < 6:
        return 0.0, "insufficient_samples"

    x = np.arange(n, dtype=np.float64)
    y = np.clip(values, 1.0, None).astype(np.float64)
    y0 = float(y[0])

    try:
        from scipy.optimize import curve_fit
    except ImportError:
        # Fall back to the v1 log-linear exponential fit if scipy.optimize
        # is somehow unavailable — never hard-fail the whole layer over it.
        return _fit_exponential_decay_loglinear(y), "exponential_loglinear_fallback"

    candidates = []
    for model_fn, name, p0, bounds in (
        (_model_exp,   "exponential", [y0, 5.0, float(y[-1])], ([0, 0.1, 0], [500, 200, 300])),
        (_model_gauss, "gaussian",    [y0, 8.0, float(y[-1])], ([0, 0.1, 0], [500, 200, 300])),
        (_model_power, "power_law",   [y0, 1.0, float(y[-1])], ([0, 0.01, 0], [500, 10, 300])),
    ):
        try:
            popt, _ = curve_fit(model_fn, x, y, p0=p0, bounds=bounds, maxfev=2000)
            pred = model_fn(x, *popt)
            rss = float(np.sum((y - pred) ** 2))
            candidates.append((name, rss, 3, popt))
        except Exception:
            continue

    if not candidates:
        return 0.0, "fit_failed"

    def aic(rss: float, k: int, n_: int) -> float:
        rss = max(rss, 1e-9)
        return n_ * np.log(rss / n_) + 2 * k

    best_name, _rss, _k, best_popt = min(candidates, key=lambda c: aic(c[1], c[2], n))

    if best_name == "exponential":
        eff_tau = float(best_popt[1])
    elif best_name == "gaussian":
        eff_tau = float(best_popt[1]) * float(np.sqrt(2))  # half-Gaussian reaches 1/e at x=sigma*sqrt(2)
    else:  # power_law: (x+1)^-p = 1/e  ->  x = e^(1/p) - 1
        eff_tau = float(np.exp(1.0 / max(best_popt[1], 0.01)) - 1.0)

    if eff_tau <= 0.5 or not np.isfinite(eff_tau):
        return 0.0, f"{best_name}_no_decay"

    return eff_tau, best_name


def _fit_exponential_decay_loglinear(values: np.ndarray) -> float:
    """v1's original log-linear exponential fit — kept as a no-scipy fallback."""
    n = len(values)
    if n < 4:
        return 0.0
    x = np.arange(n, dtype=np.float32)
    vals = np.clip(values, 1.0, None).astype(np.float32)
    log_vals = np.log(vals)
    try:
        coeffs = np.polyfit(x, log_vals, 1)
        slope = float(coeffs[0])
        if slope >= 0.0:
            return 0.0
        return float(-1.0 / slope)
    except Exception:
        return 0.0


# ── Signal computation ────────────────────────────────────────────────────────

def _signal_sss_decay(img: np.ndarray, material_mask: np.ndarray, profile: dict) -> Tuple[float, str]:
    """
    S1 — Multi-model (exponential/half-Gaussian/power-law, AIC-selected),
    multi-wavelength (R+G+B, not just R/B) SSS decay profile fit,
    replacing v1's single fixed exponential R/B-only fit.

    Real material: tau_R / tau_B ratio near-or-above the matched
    material's ratio_min, AND (when G is measurable) a monotonic
    tau_R > tau_G > tau_B ordering — the full physical signature, not
    just one endpoint ratio that could look plausible by chance.
    AI material: ratio far below ratio_min, ordering typically violated.
    """
    if material_mask.sum() < 100 * 255:
        return 0.5, "insufficient_material_area"

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    eroded = cv2.erode(material_mask, kernel)
    edge_mask = cv2.subtract(material_mask, eroded)

    edge_ys, edge_xs = np.where(edge_mask > 0)
    if len(edge_xs) < 20:
        return 0.5, "no_edge_pixels"

    n_sample = min(30, len(edge_xs))
    idx = np.random.choice(len(edge_xs), n_sample, replace=False)

    r_taus, g_taus, b_taus, models_used = [], [], [], []

    for i in idx:
        ex, ey = int(edge_xs[i]), int(edge_ys[i])
        px_profile = extract_perpendicular_profile(img, ex, ey, material_mask, length=25)
        if px_profile is None or px_profile.shape[0] < 8:
            continue

        r_prof, g_prof, b_prof = px_profile[:, 0], px_profile[:, 1], px_profile[:, 2]
        if r_prof.std() < 2.0 or b_prof.std() < 2.0:
            continue

        tau_r, model_r = _fit_best_model(r_prof)
        tau_g, _model_g = _fit_best_model(g_prof)
        tau_b, _model_b = _fit_best_model(b_prof)

        if tau_r > 0.5 and tau_b > 0.5:
            r_taus.append(tau_r)
            b_taus.append(tau_b)
            if tau_g > 0.5:
                g_taus.append(tau_g)
            models_used.append(model_r)

    if len(r_taus) < 3:
        return 0.5, f"insufficient_profiles: n={len(r_taus)}"

    median_r = float(np.median(r_taus))
    median_b = float(np.median(b_taus))
    median_g = float(np.median(g_taus)) if len(g_taus) >= 3 else None

    if median_b < 0.5:
        return 0.5, "blue_decay_too_short"

    rb_ratio = median_r / (median_b + 1e-9)
    ratio_min = float(profile.get("ratio_min", 8.0))

    monotonic_bonus = 0.0
    monotonic_note = "g_unavailable"
    if median_g is not None:
        if median_r > median_g > median_b:
            monotonic_bonus = -0.05
            monotonic_note = f"monotonic_rgb: tau_G={median_g:.1f}"
        else:
            monotonic_bonus = 0.04
            monotonic_note = f"non_monotonic_rgb: tau_G={median_g:.1f}"

    dominant_model = max(set(models_used), key=models_used.count) if models_used else "n/a"

    if rb_ratio >= ratio_min * 0.70:
        score = max(0.0, 0.35 - (rb_ratio - ratio_min * 0.70) / (ratio_min * 2) * 0.2 + monotonic_bonus)
        detail = f"sss_real: R/B_tau={rb_ratio:.2f} (min={ratio_min:.1f}) model={dominant_model} {monotonic_note}"
    elif rb_ratio < 2.0:
        score = min(1.0, 0.70 + (2.0 - rb_ratio) * 0.08 + monotonic_bonus)
        detail = f"sss_ai: R/B_tau={rb_ratio:.2f} (min={ratio_min:.1f}) model={dominant_model} {monotonic_note}"
    else:
        score = 0.50 + monotonic_bonus
        detail = f"sss_ambiguous: R/B_tau={rb_ratio:.2f} model={dominant_model} {monotonic_note}"

    return float(np.clip(score, 0.0, 1.0)), detail


def _local_structure_tensor_anisotropy(channel: np.ndarray, ys: np.ndarray, xs: np.ndarray) -> float:
    """
    Median eigenvalue-ratio anisotropy (largest/smallest eigenvalue of the
    2x2 structure tensor [[Ix^2, IxIy],[IxIy, Iy^2]], Gaussian-smoothed)
    at the given pixel locations. 1.0 = perfectly isotropic local gradient
    field; higher = more strongly directional.
    """
    gx = cv2.Sobel(channel, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(channel, cv2.CV_32F, 0, 1, ksize=3)
    ixx = cv2.GaussianBlur(gx * gx, (5, 5), 0)
    iyy = cv2.GaussianBlur(gy * gy, (5, 5), 0)
    ixy = cv2.GaussianBlur(gx * gy, (5, 5), 0)

    a, d, b_ = ixx[ys, xs], iyy[ys, xs], ixy[ys, xs]
    trace = a + d
    det = a * d - b_ * b_
    disc = np.clip(trace ** 2 - 4 * det, 0, None)
    sq = np.sqrt(disc)
    lam1 = (trace + sq) / 2.0
    lam2 = (trace - sq) / 2.0
    lam_max = np.maximum(lam1, lam2)
    lam_min = np.maximum(np.minimum(lam1, lam2), 1e-6)
    ratios = lam_max / lam_min
    valid = np.isfinite(ratios) & (lam_max > 1.0)
    if valid.sum() < 20:
        return 1.0
    return float(np.median(ratios[valid]))


def _signal_rgb_variance_anisotropy(img: np.ndarray, material_mask: np.ndarray) -> Tuple[float, str]:
    """
    S2 — Directional variance TENSOR anisotropy (structure-tensor
    eigenvalue ratio) per channel at the material boundary, replacing
    v1's flat R_std/B_std ratio. Real material: the R channel's gradient
    field is more isotropic (SSS blurs directionality); the B channel
    stays anisotropic (dominated by sharp, undiffused surface
    reflection). AI: R and B tensors look similar — no physically-driven
    difference in blur behaviour between channels.
    """
    if material_mask.sum() < 50 * 255:
        return 0.5, "insufficient_material_area"

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    dilated = cv2.dilate(material_mask, kernel)
    boundary_mask = cv2.subtract(dilated, material_mask)

    by, bx = np.where(boundary_mask > 0)
    if len(by) < 100:
        return 0.5, "insufficient_boundary_pixels"

    if len(by) > 3000:
        sel = np.random.choice(len(by), 3000, replace=False)
        by, bx = by[sel], bx[sel]

    r_std = float(img[by, bx, 0].astype(np.float32).std())
    b_std = float(img[by, bx, 2].astype(np.float32).std())
    if b_std < 1.0:
        return 0.5, "flat_blue_boundary"

    r_ch = img[:, :, 0].astype(np.float32)
    b_ch = img[:, :, 2].astype(np.float32)
    r_aniso = _local_structure_tensor_anisotropy(r_ch, by, bx)
    b_aniso = _local_structure_tensor_anisotropy(b_ch, by, bx)

    tensor_gap = b_aniso - r_aniso
    rb_std_ratio = r_std / (b_std + 1e-9)  # kept as a secondary corroborating signal from v1

    if tensor_gap > 1.5 and rb_std_ratio > 1.3:
        score = max(0.0, 0.36 - min(tensor_gap - 1.5, 6.0) * 0.03)
        detail = f"tensor_aniso_real: B_aniso-R_aniso={tensor_gap:.2f} R_std/B_std={rb_std_ratio:.2f}"
    elif tensor_gap < 0.3 and rb_std_ratio < 1.15:
        score = min(1.0, 0.62 + max(0.0, 0.3 - tensor_gap) * 0.5)
        detail = f"tensor_isotropic_ai: B_aniso-R_aniso={tensor_gap:.2f} R_std/B_std={rb_std_ratio:.2f}"
    else:
        score = 0.50
        detail = f"tensor_ambiguous: B_aniso-R_aniso={tensor_gap:.2f} R_std/B_std={rb_std_ratio:.2f}"

    return float(np.clip(score, 0.0, 1.0)), detail


# ── Public API ────────────────────────────────────────────────────────────────

def analyze_sswdp(img: np.ndarray, img_pil: Any) -> Dict[str, Any]:
    """
    Run SSWDP analysis on a uint8 RGB numpy array.

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
        material_detected : str (present on "success")
    """
    t0 = time.monotonic()

    if img is None or img.ndim != 3 or img.shape[2] != 3:
        return {"score": 0.5, "status": "failure",
                "evidence": [], "elapsed_ms": 0}

    try:
        material_name, material_mask, material_frac = detect_material_type(img)
        material_px = float(material_mask.sum() / 255)

        if material_name == "none" or material_px < 1000 or material_frac < 0.02:
            elapsed = int((time.monotonic() - t0) * 1000)
            # Fix #4 (v4.5.0, preserved in v2): status="not_applicable" lets
            # _fuse_scores() skip this layer entirely rather than diluting
            # other layers' scores with a neutral 0.5 on every image that
            # has no recognized translucent material at all.
            return {
                "score": 0.5, "status": "not_applicable",
                "evidence": [{"name": "no_translucent_material_detected",
                              "score": 0.5,
                              "detail": f"material_px={int(material_px)} frac={material_frac:.3f}"}],
                "elapsed_ms": elapsed,
            }

        profile = _SSS_PROFILES.get(material_name, _SKIN_PROFILE)

        # S1 — SSS decay profile
        s1_score, s1_detail = _signal_sss_decay(img, material_mask, profile)
        # S2 — RGB variance anisotropy
        s2_score, s2_detail = _signal_rgb_variance_anisotropy(img, material_mask)

        evidence = [
            {"name": "sss_wavelength_decay", "score": s1_score,
             "detail": f"material={material_name} {s1_detail}"},
            {"name": "rgb_variance_aniso",   "score": s2_score,
             "detail": f"material={material_name} {s2_detail}"},
        ]

        # S1 (decay profile) is more informative → higher weight
        if s1_score == 0.5 and s2_score == 0.5:
            composite = 0.5
        else:
            w1, w2 = 1.6, 1.0
            composite = (s1_score * w1 + s2_score * w2) / (w1 + w2)

        elapsed = int((time.monotonic() - t0) * 1000)
        return {
            "score":              round(float(np.clip(composite, 0.0, 1.0)), 4),
            "status":             "success",
            "evidence":           evidence,
            "elapsed_ms":         elapsed,
            "material_detected":  material_name,
        }

    except Exception as exc:
        logger.warning("[SSWDP] analysis failed: %s", exc)
        elapsed = int((time.monotonic() - t0) * 1000)
        return {"score": 0.5, "status": "failure",
                "evidence": [], "elapsed_ms": elapsed}

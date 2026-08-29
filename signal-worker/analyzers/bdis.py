"""
Aiscern Detection Worker — Layer 12: BDIS
Bayer Demosaicing Inconsistency Signature

v2 (Section 1.2 of the giant-level image engine optimization directive):
adaptive CFA phase detection, multi-region/multi-scale S1, a genuine 2D
correlation-lag search for S2, a radial FFT profile for S3 (with JPEG
block-grid separation), and a phase-lock + phase-gradient S4.

Physics background
------------------
All consumer digital cameras use a Bayer Color Filter Array: a grid where
each pixel captures only one colour (Red, Green, or Blue). In the standard
RGGB Bayer pattern, green is sampled at twice the spatial frequency of red
and blue. Software (demosaicing) reconstructs full RGB by interpolating from
neighbouring pixels.

This interpolation leaves specific forensic traces:
  • Green channel 2px periodicity  (green sampled at every other pixel)
  • Cross-channel spatial correlation at a 1px lag (interpolated R and B
    derive from neighbouring G values, at a lag SET BY the sensor's CFA
    corner — see the CFA phase note below)
  • Specific chroma sub-band energy signature in the Fourier domain
  • Channel phase coherence at Nyquist/2 frequency

AI generators produce RGB pixel triples directly — no Bayer CFA, no
demosaicing, no artifacts. The absence of these patterns is a reliable tell.

A note on "CFA pattern" (read before assuming this matches the directive
literally — the directive's Section 1.2 item 1 frames this in a way that
doesn't quite hold up physically, and getting it right matters more than
matching the wording)
-------------------------------------------------------------------------
The four canonical Bayer layouts — RGGB, BGGR, GRBG, GBRG — all share the
SAME green-channel sampling geometry: green sits on a checkerboard in
every one of them. They differ only in which corner of each 2x2 tile R
and B occupy. That means there is no version of S1 (green periodicity)
that comes out different for the "right" vs "wrong" pattern — testing S1
against all 4 named patterns and taking the best score, as a literal
reading of the directive suggests, would just re-score the same number
four times. What genuinely DOES vary by CFA layout — and is what v1's S2
got wrong by hardcoding a single lag=(+1,0)-in-x assumption — is which
spatial offset R and B were interpolated *from* G at. v2's CFA phase
detection (_best_lag_correlation) fixes this properly: it searches all 4
unit-offset lags and finds which one the image actually supports, rather
than assuming one.

Four forensic signals
---------------------
S1 — Green channel 2-pixel periodicity, now multi-region (5 windows:
     centre + 4 quadrants) and multi-scale (32/64/128px crops, bounded by
     image size), requiring CONSISTENCY across both rather than trusting
     a single fixed 64x64 centre crop.
S2 — Cross-channel R/B-vs-G correlation, now searching all 4 candidate
     unit-offset lags per channel (the real CFA phase detection — see
     above) instead of assuming lag=(+1,0).
S3 — Chroma sub-band peak, now a genuine radial FFT power profile
     instead of 4 fixed quadrant-corner samples, with an explicit,
     separate JPEG 8x8-block-grid check on luma so a compression
     artifact at a very different radius is never confused with the
     Bayer chroma band.
S4 — Channel phase coherence, now combining the original inter-channel
     phase-lock (circular mean resultant length) with a new intra-channel
     phase-GRADIENT smoothness check (row-to-row phase drift, which real
     demosaicing/lens geometry produces and has no reason to appear by
     chance in AI output).

Honesty note on scope (read before assuming full spec compliance)
-------------------------------------------------------------------
Not attempted, same "don't fake precision" reasoning as the L11 (PAFRA)
and L22 (Document Forensics) modules:
  - Demosaicing-ALGORITHM fingerprinting against a database of 50+ known
    interpolation kernels (bilinear/AHD/AMaZE/etc): skipped. No such
    reference database exists in this codebase or anywhere accessible to
    it; building one would mean empirically profiling dozens of real
    camera/RAW-converter combinations, which is a data-collection project
    in its own right, not something a code patch can responsibly invent.
  - True chroma-subsampling-ratio detection (verifying an actual 4:2:0
    sample grid vs. 4:4:4 by testing downsample/upsample reconstruction
    error): skipped as its own separate signal. In practice it would
    overlap heavily with the JPEG 8x8-grid check S3 already does (both
    detect the same JPEG-encoding footprint), and — importantly — both
    real AND AI-generated images are commonly re-encoded as JPEG with
    standard chroma subsampling by the platforms they pass through, so
    this signal is weakly discriminative at best either way. Not worth
    a duplicate detector for that little added value.

Returns
-------
score=0.0 → strongly real  |  score=1.0 → strongly AI
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ── Minimum image size to run BDIS reliably ───────────────────────────────────
_MIN_DIM = 64

# Candidate unit-offset lags to search for CFA phase detection (S2).
# (0,0) is deliberately excluded — it's the "no CFA structure" case,
# handled by comparing against it separately, not as a lag candidate.
_CANDIDATE_LAGS: List[Tuple[int, int]] = [(1, 0), (-1, 0), (0, 1), (0, -1)]


# ── Shared helpers ──────────────────────────────────────────────────────────

def _pearson(a: np.ndarray, b: np.ndarray) -> float:
    a, b = a.flatten(), b.flatten()
    if a.std() < 1.0 or b.std() < 1.0:
        return 0.0
    return float(np.corrcoef(a, b)[0, 1])


def _best_lag_correlation(target: np.ndarray, ref: np.ndarray) -> Tuple[Tuple[int, int], float, float]:
    """
    CFA phase detection core: test |correlation| of `target` against `ref`
    shifted by each of the 4 candidate unit-offset lags, and return the
    best one. This is what actually distinguishes RGGB from BGGR from
    GRBG from GBRG (see module docstring) — replaces v1's hardcoded
    "always test lag=(+1,0)" assumption.

    Returns (best_lag, best_corr, confidence) where confidence is the
    best lag's correlation minus the mean of the other 3 — a clear
    winner means real, consistent CFA structure; all 4 lags scoring
    similarly means no detectable CFA phase at all (AI-typical).
    """
    h, w = target.shape
    corrs: Dict[Tuple[int, int], float] = {}
    for dx, dy in _CANDIDATE_LAGS:
        t = target[max(0, -dy):h - max(0, dy), max(0, -dx):w - max(0, dx)]
        rsh = ref[max(0, dy):h - max(0, -dy), max(0, dx):w - max(0, -dx)]
        if t.size < 200 or t.shape != rsh.shape:
            corrs[(dx, dy)] = 0.0
            continue
        corrs[(dx, dy)] = abs(_pearson(t, rsh))

    best_lag = max(corrs, key=corrs.get)
    best_corr = corrs[best_lag]
    others = [v for k, v in corrs.items() if k != best_lag]
    confidence = best_corr - (sum(others) / len(others) if others else 0.0)
    return best_lag, best_corr, confidence


def _radial_profile(mag: np.ndarray, n_bins: int = 40) -> np.ndarray:
    """Mean FFT magnitude binned by radial distance from the DC centre."""
    h, w = mag.shape
    cy, cx = h // 2, w // 2
    yy, xx = np.ogrid[:h, :w]
    r = np.hypot(yy - cy, xx - cx)
    r_max = max(min(cy, cx), 1)
    bins = np.linspace(0, r_max, n_bins + 1)
    profile = np.zeros(n_bins)
    for i in range(n_bins):
        sel = (r >= bins[i]) & (r < bins[i + 1])
        if sel.any():
            profile[i] = mag[sel].mean()
    return profile


# ── S1 — Multi-region, multi-scale green channel periodicity ──────────────────

def _sample_regions(h: int, w: int, win: int) -> List[Tuple[int, int, int, int]]:
    """5 windows of size `win`: centre + 4 quadrant centres."""
    half = win // 2
    centers = [
        (h // 2, w // 2),          # centre
        (h // 4, w // 4),          # top-left quadrant
        (h // 4, 3 * w // 4),      # top-right quadrant
        (3 * h // 4, w // 4),      # bottom-left quadrant
        (3 * h // 4, 3 * w // 4),  # bottom-right quadrant
    ]
    boxes = []
    for cy, cx in centers:
        y0, y1 = max(0, cy - half), min(h, cy + half)
        x0, x1 = max(0, cx - half), min(w, cx + half)
        if (y1 - y0) >= max(_MIN_DIM // 2, 16) and (x1 - x0) >= max(_MIN_DIM // 2, 16):
            boxes.append((y0, y1, x0, x1))
    return boxes


def _green_periodicity_ratio(crop: np.ndarray) -> float:
    """Raw 2px-periodicity peak/neighbour power ratio for one crop."""
    fft_rows = np.abs(np.fft.rfft(crop.astype(np.float32), axis=1))
    dc = fft_rows[:, 0:1] + 1e-9
    fft_rows_norm = fft_rows / dc
    w_fft = fft_rows.shape[1]
    ny2_bin = w_fft // 2
    target_power = float(fft_rows_norm[:, ny2_bin].mean())
    neighbour_power = float(
        (fft_rows_norm[:, max(0, ny2_bin - 2): ny2_bin].mean()
         + fft_rows_norm[:, ny2_bin + 1: min(w_fft, ny2_bin + 3)].mean()) / 2.0
    )
    if neighbour_power < 1e-6:
        return 1.0
    return target_power / (neighbour_power + 1e-9)


def check_green_periodicity(g: np.ndarray) -> Tuple[float, str]:
    """
    S1 — Multi-region (5 windows), multi-scale (32/64/128px) 2-pixel
    periodicity in the green channel, replacing v1's single fixed 64x64
    centre crop. Real cameras show a consistently strong 2px peak
    everywhere and at every analysis scale; AI shows either no peak at
    all, or an inconsistent one that only appears in some crops/scales
    (e.g. by compression-artifact coincidence).

    Returns: (score [0=real, 1=AI], detail string)
    """
    if g.ndim != 2:
        return 0.5, "invalid_channel_shape"

    h, w = g.shape
    if w < _MIN_DIM or h < _MIN_DIM:
        return 0.5, "too_small"

    max_win = min(h, w)
    windows = [ws for ws in (32, 64, 128) if ws <= max_win]
    if not windows:
        windows = [max_win]

    all_ratios = []
    for win in windows:
        for (y0, y1, x0, x1) in _sample_regions(h, w, win):
            crop = g[y0:y1, x0:x1]
            if crop.shape[0] < 16 or crop.shape[1] < 16:
                continue
            all_ratios.append(_green_periodicity_ratio(crop))

    if len(all_ratios) < 3:
        return 0.5, "insufficient_regions"

    arr = np.array(all_ratios)
    mean_ratio = float(arr.mean())
    consistency = 1.0 - min(1.0, float(arr.std() / (mean_ratio + 1e-9)))  # 1=perfectly consistent

    if mean_ratio > 1.5 and consistency > 0.5:
        score = max(0.0, 0.35 - (mean_ratio - 1.5) * 0.1 - (consistency - 0.5) * 0.1)
        detail = f"consistent_bayer_peak: mean_ratio={mean_ratio:.2f} consistency={consistency:.2f} n={len(all_ratios)}"
    elif mean_ratio < 1.15 or consistency < 0.25:
        score = min(1.0, 0.58 + max(0.0, 1.15 - mean_ratio) * 0.3 + max(0.0, 0.25 - consistency) * 0.4)
        detail = f"no_or_inconsistent_peak: mean_ratio={mean_ratio:.2f} consistency={consistency:.2f} n={len(all_ratios)}"
    else:
        score = 0.50
        detail = f"ambiguous: mean_ratio={mean_ratio:.2f} consistency={consistency:.2f} n={len(all_ratios)}"

    return float(np.clip(score, 0.0, 1.0)), detail


# ── S2 — Adaptive CFA phase detection via 2D correlation-lag search ──────────

def check_bayer_correlation(r: np.ndarray, g: np.ndarray, b: np.ndarray) -> Tuple[float, str]:
    """
    S2 — Real CFA phase detection: searches all 4 candidate unit-offset
    lags for R-vs-G and B-vs-G correlation and takes the best-fitting
    one per channel, replacing v1's hardcoded lag=(+1,0)-in-x-only test
    (see module docstring for why this, not a 4-named-pattern S1 rescan,
    is the physically correct fix).

    Real camera: one lag clearly beats the other three AND beats lag
    (0,0) (no shift) — evidence of genuine directional interpolation.
    AI image: no lag stands out, or the unshifted (0,0) correlation is
    already as good as any shifted one (no interpolation lag at all).

    Returns: (score [0=real, 1=AI], detail string)
    """
    if r.ndim != 2 or g.ndim != 2:
        return 0.5, "invalid_channel_shape"

    h, w = r.shape
    if w < _MIN_DIM or h < _MIN_DIM:
        return 0.5, "too_small"

    cy, cx = h // 2, w // 2
    sz = min(128, min(h, w) // 2)
    r_crop = r[cy - sz:cy + sz, cx - sz:cx + sz]
    g_crop = g[cy - sz:cy + sz, cx - sz:cx + sz]
    b_crop = b[cy - sz:cy + sz, cx - sz:cx + sz]

    r_lag, r_corr, r_conf = _best_lag_correlation(r_crop, g_crop)
    b_lag, b_corr, b_conf = _best_lag_correlation(b_crop, g_crop)
    lag0_r = abs(_pearson(r_crop, g_crop))
    lag0_b = abs(_pearson(b_crop, g_crop))

    mean_corr = (r_corr + b_corr) / 2.0
    mean_conf = (r_conf + b_conf) / 2.0
    # If the unshifted correlation is already as good as the best shifted
    # one, there's no genuine interpolation lag to detect — same "AI"
    # verdict as a low-confidence lag search.
    zero_beats_shift = (lag0_r >= r_corr - 0.02) and (lag0_b >= b_corr - 0.02)

    if mean_corr > 0.70 and mean_conf > 0.06 and not zero_beats_shift:
        score = max(0.0, 0.28 - mean_conf * 0.4)
        detail = f"cfa_phase_detected: r_lag={r_lag} b_lag={b_lag} corr={mean_corr:.2f} conf={mean_conf:.2f}"
    elif mean_corr < 0.40 or mean_conf < 0.015 or zero_beats_shift:
        score = min(1.0, 0.64 + max(0.0, 0.40 - mean_corr) * 0.5)
        detail = f"no_cfa_phase_ai: corr={mean_corr:.2f} conf={mean_conf:.2f} zero_beats_shift={zero_beats_shift}"
    else:
        score = 0.50
        detail = f"ambiguous: corr={mean_corr:.2f} conf={mean_conf:.2f}"

    return float(np.clip(score, 0.0, 1.0)), detail


# ── S3 — Radial FFT chroma profile + JPEG block-grid separation ───────────────

def _chroma_fft_peak(img: np.ndarray) -> Tuple[float, str]:
    """
    S3 — Radial FFT power profile on the chroma channels (Cr/Cb),
    replacing v1's fixed-4-quadrant-corner peak sampling with a proper
    radially-binned profile. Also separately checks the luma channel's
    8x8 JPEG block grid so compression blocking is never confused with
    the Bayer chroma sub-band signal — they sit at very different radii
    (2px Bayer period sits near the Nyquist edge of the profile; 8px
    JPEG block period sits much closer to DC), so this only needs a
    radius-band check, not a separate detector.

    Returns: (score [0=real, 1=AI], detail string)
    """
    h, w = img.shape[:2]
    if h < _MIN_DIM * 2 or w < _MIN_DIM * 2:
        return 0.5, "too_small"

    ycrcb = cv2.cvtColor(img, cv2.COLOR_RGB2YCrCb).astype(np.float32)
    y_ch, cr, cb = ycrcb[:, :, 0], ycrcb[:, :, 1], ycrcb[:, :, 2]

    def radial_peak_ratio(ch: np.ndarray) -> float:
        mag = np.fft.fftshift(np.abs(np.fft.fft2(ch - ch.mean())))
        profile = _radial_profile(mag, n_bins=40)
        # Nyquist/2 (2px period) sits at half the max radius — matches
        # v1's w//4 == (w//2)//2 geometry, now expressed as a profile-bin
        # fraction instead of a fixed pixel quadrant.
        nyq2_bin = int(0.5 * (len(profile) - 1))
        band = profile[max(0, nyq2_bin - 2): nyq2_bin + 3]
        background = profile[max(0, nyq2_bin - 8): max(1, nyq2_bin - 3)]
        bg_mean = float(background.mean()) if background.size else float(profile.mean())
        if bg_mean < 1e-9:
            return 1.0
        return float(band.mean() / bg_mean)

    cr_ratio = radial_peak_ratio(cr)
    cb_ratio = radial_peak_ratio(cb)
    mean_ratio = (cr_ratio + cb_ratio) / 2.0

    # JPEG 8x8 block grid on luma sits at ~1/8 of the way to Nyquist (vs
    # ~1/2 for the 2px Bayer period above) — a much smaller radius, so it
    # can never land in the same band as the Bayer check.
    y_mag = np.fft.fftshift(np.abs(np.fft.fft2(y_ch - y_ch.mean())))
    y_profile = _radial_profile(y_mag, n_bins=40)
    jpeg_bin = int(0.125 * (len(y_profile) - 1))
    jpeg_band = y_profile[max(0, jpeg_bin - 1): jpeg_bin + 2]
    jpeg_bg = y_profile[max(0, jpeg_bin - 5): max(1, jpeg_bin - 2)]
    jpeg_ratio = float(jpeg_band.mean() / (jpeg_bg.mean() + 1e-9)) if jpeg_bg.size else 1.0
    has_jpeg_grid = jpeg_ratio > 1.3

    if mean_ratio > 1.4:
        score = max(0.0, 0.38 - (mean_ratio - 1.4) * 0.2)
        detail = f"radial_bayer_peak_real: ratio={mean_ratio:.2f} jpeg_grid={has_jpeg_grid}"
    elif mean_ratio < 1.1:
        score = min(1.0, 0.60 + (1.1 - mean_ratio) * 0.4)
        detail = f"no_radial_peak_ai: ratio={mean_ratio:.2f} jpeg_grid={has_jpeg_grid}"
    else:
        score = 0.50
        detail = f"ambiguous_radial: ratio={mean_ratio:.2f} jpeg_grid={has_jpeg_grid}"

    return float(np.clip(score, 0.0, 1.0)), detail


# ── S4 — Inter-channel phase lock + intra-channel phase-gradient smoothness ───

def _channel_phase_coherence(r: np.ndarray, g: np.ndarray, b: np.ndarray) -> Tuple[float, str]:
    """
    S4 — Combines v1's inter-channel phase-lock check (circular mean
    resultant length of the R-G / B-G phase difference at the Bayer
    frequency) with a new intra-channel phase-GRADIENT smoothness check:
    real demosaicing (plus genuine lens/sensor geometry) makes the phase
    drift smoothly row-to-row; there's no reason for that same smooth
    drift to emerge by chance in AI output with no real CFA process
    behind it.

    Returns: (score [0=real, 1=AI], detail string)
    """
    h, w = g.shape
    if w < _MIN_DIM or h < _MIN_DIM:
        return 0.5, "too_small"

    cy, cx = h // 2, w // 2
    sz = min(64, min(h, w) // 3)

    def row_phase_at_nyq2(ch: np.ndarray) -> np.ndarray:
        fft_c = np.fft.rfft(ch.astype(np.float32), axis=1)
        nyq2 = fft_c.shape[1] // 2
        return np.angle(fft_c[:, nyq2])

    r_c = r[cy - sz:cy + sz, cx - sz:cx + sz]
    g_c = g[cy - sz:cy + sz, cx - sz:cx + sz]
    b_c = b[cy - sz:cy + sz, cx - sz:cx + sz]

    r_phase = row_phase_at_nyq2(r_c)
    g_phase = row_phase_at_nyq2(g_c)
    b_phase = row_phase_at_nyq2(b_c)

    rg_diff = np.angle(np.exp(1j * (r_phase - g_phase)))
    bg_diff = np.angle(np.exp(1j * (b_phase - g_phase)))
    rg_mrl = float(np.abs(np.mean(np.exp(1j * rg_diff))))
    bg_mrl = float(np.abs(np.mean(np.exp(1j * bg_diff))))
    coherence = (rg_mrl + bg_mrl) / 2.0

    def row_to_row_smoothness(phase: np.ndarray) -> float:
        if len(phase) < 4:
            return 0.5
        diffs = np.angle(np.exp(1j * np.diff(phase)))
        return float(np.abs(np.mean(np.exp(1j * diffs))))

    gradient_smoothness = (row_to_row_smoothness(r_phase) + row_to_row_smoothness(b_phase)) / 2.0

    # Coherence (inter-channel lock) and gradient smoothness (intra-channel
    # spatial continuity) are complementary; both should hold for a
    # genuinely real demosaicing signature.
    combined = 0.65 * coherence + 0.35 * gradient_smoothness

    if combined > 0.45:
        score = max(0.0, 0.32 - (combined - 0.45) * 0.4)
        detail = f"phase_locked_real: coherence={coherence:.2f} grad_smooth={gradient_smoothness:.2f}"
    elif combined < 0.18:
        score = min(1.0, 0.62 + (0.18 - combined) * 1.5)
        detail = f"random_phase_ai: coherence={coherence:.2f} grad_smooth={gradient_smoothness:.2f}"
    else:
        score = 0.50
        detail = f"ambiguous_phase: coherence={coherence:.2f} grad_smooth={gradient_smoothness:.2f}"

    return float(np.clip(score, 0.0, 1.0)), detail


# ── Public API ────────────────────────────────────────────────────────────────

def analyze_bdis(img: np.ndarray, img_pil: Any) -> Dict[str, Any]:
    """
    Run BDIS analysis on a uint8 RGB numpy array.

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

    if img.shape[0] < _MIN_DIM or img.shape[1] < _MIN_DIM:
        elapsed = int((time.monotonic() - t0) * 1000)
        return {"score": 0.5, "status": "success",
                "evidence": [{"name": "image_too_small", "score": 0.5,
                              "detail": f"size={img.shape}"}],
                "elapsed_ms": elapsed}

    try:
        r = img[:, :, 0].astype(np.float32)
        g = img[:, :, 1].astype(np.float32)
        b = img[:, :, 2].astype(np.float32)

        s1, s1_detail = check_green_periodicity(g)
        s2, s2_detail = check_bayer_correlation(r, g, b)
        s3, s3_detail = _chroma_fft_peak(img)
        s4, s4_detail = _channel_phase_coherence(r, g, b)

        evidence = [
            {"name": "green_channel_periodicity_multiscale", "score": s1, "detail": s1_detail},
            {"name": "bayer_cfa_phase_correlation",           "score": s2, "detail": s2_detail},
            {"name": "chroma_radial_fft_peak",                "score": s3, "detail": s3_detail},
            {"name": "channel_phase_lock_and_gradient",       "score": s4, "detail": s4_detail},
        ]

        # Weighted composite — S1 and S2 are most reliable
        weights = [1.3, 1.2, 1.0, 0.9]
        total_w = sum(weights)
        composite = sum(s * w for s, w in zip([s1, s2, s3, s4], weights)) / total_w

        elapsed = int((time.monotonic() - t0) * 1000)
        return {
            "score":       round(float(np.clip(composite, 0.0, 1.0)), 4),
            "status":      "success",
            "evidence":    evidence,
            "elapsed_ms":  elapsed,
        }

    except Exception as exc:
        logger.warning("[BDIS] analysis failed: %s", exc)
        elapsed = int((time.monotonic() - t0) * 1000)
        return {"score": 0.5, "status": "failure",
                "evidence": [], "elapsed_ms": elapsed}

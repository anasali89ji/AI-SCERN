"""
Aiscern Detection Worker — Layer 12: BDIS
Bayer Demosaicing Inconsistency Signature

Physics background
------------------
All consumer digital cameras use a Bayer Color Filter Array: a grid where
each pixel captures only one colour (Red, Green, or Blue). In the standard
RGGB Bayer pattern, green is sampled at twice the spatial frequency of red
and blue. Software (demosaicing) reconstructs full RGB by interpolating from
neighbouring pixels.

This interpolation leaves specific forensic traces:
  • Green channel 2px periodicity  (green sampled at every other pixel)
  • Cross-channel spatial correlation at lag-1 (interpolated R and B derive
    from neighbouring G values)
  • Specific chroma sub-band energy signature in the Fourier domain
  • Channel phase coherence at Nyquist/2 frequency

AI generators produce RGB pixel triples directly — no Bayer CFA, no
demosaicing, no artifacts. The absence of these patterns is a reliable tell.

Four forensic signals
---------------------
S1 — Green channel 2-pixel periodicity (FFT)
S2 — Cross-channel R/B neighbour correlation with G
S3 — Chroma sub-band peak at π/2 in FFT
S4 — Channel phase coherence at demosaicing frequency

Returns
-------
score=0.0 → strongly real  |  score=1.0 → strongly AI
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ── Minimum image size to run BDIS reliably ───────────────────────────────────
_MIN_DIM = 64


# ── Signal helpers ────────────────────────────────────────────────────────────

def check_green_periodicity(g: np.ndarray) -> float:
    """
    S1 — Detect 2-pixel periodicity in the green channel via FFT.

    In a demosaiced RGGB image, the green channel carries a residual 2-pixel
    periodic pattern from the alternating G positions in the CFA. In the
    1D power spectrum of each row, this appears as a peak at the Nyquist/2
    frequency (f = w/2 ≡ period = 2 pixels).

    Returns: score [0=real signal present, 1=no signal / AI]
    """
    if g.ndim != 2:
        return 0.5

    h, w = g.shape
    if w < _MIN_DIM or h < _MIN_DIM:
        return 0.5

    # Use a central crop to avoid border effects
    cy, cx = h // 2, w // 2
    crop = g[cy - _MIN_DIM//2: cy + _MIN_DIM//2,
              cx - _MIN_DIM//2: cx + _MIN_DIM//2].astype(np.float32)

    # Row-wise FFT
    fft_rows = np.abs(np.fft.rfft(crop, axis=1))   # shape: (rows, w//2 + 1)
    # Normalise each row by DC component
    dc = fft_rows[:, 0:1] + 1e-9
    fft_rows_norm = fft_rows / dc

    # Nyquist/2 bin = w_fft//2 where w_fft is the rfft output width
    w_fft = fft_rows.shape[1]
    ny2_bin = w_fft // 2  # index of the π/2 frequency (2-pixel period)

    # Take mean power at nyquist/2 bin and compare with neighbours
    target_power = float(fft_rows_norm[:, ny2_bin].mean())
    neighbour_power = float(
        (fft_rows_norm[:, max(0, ny2_bin-2): ny2_bin].mean()
         + fft_rows_norm[:, ny2_bin+1: min(w_fft, ny2_bin+3)].mean()) / 2.0
    )

    if neighbour_power < 1e-6:
        return 0.5

    # Real demosaiced: target_power significantly higher than neighbours
    ratio = target_power / (neighbour_power + 1e-9)

    if ratio > 1.5:
        # Clear Bayer peak → real camera
        score = max(0.0, 0.40 - (ratio - 1.5) * 0.15)
    elif ratio > 1.15:
        score = 0.40 + (1.5 - ratio) / (1.5 - 1.15) * 0.15
    else:
        # No Bayer peak → likely AI
        score = min(1.0, 0.58 + (1.15 - ratio) * 0.4)

    return float(np.clip(score, 0.0, 1.0))


def check_bayer_correlation(r: np.ndarray, g: np.ndarray, b: np.ndarray) -> float:
    """
    S2 — Cross-channel neighbour correlation (R/B vs shifted G).

    In a demosaiced image, each interpolated R pixel value is a weighted
    average of its neighbouring G pixels. This creates a detectable cross-
    correlation between R (or B) and spatially-shifted G at lag = 1 pixel.

    Real camera: corr(R[x,y], G[x+1,y]) > corr(R[x,y], G[x,y])  ← lag effect
    AI image: no systematic lag — G[x+1] correlation equals G[x] correlation.

    Returns: score [0=real, 1=AI]
    """
    if r.ndim != 2 or g.ndim != 2:
        return 0.5

    h, w = r.shape
    if w < _MIN_DIM or h < _MIN_DIM:
        return 0.5

    # Use a sub-region for speed
    cy, cx = h // 2, w // 2
    sz = min(128, min(h, w) // 2)
    r_crop = r[cy-sz:cy+sz, cx-sz:cx+sz]
    g_crop = g[cy-sz:cy+sz, cx-sz:cx+sz]
    b_crop = b[cy-sz:cy+sz, cx-sz:cx+sz]

    def pearson(a: np.ndarray, b: np.ndarray) -> float:
        a, b = a.flatten(), b.flatten()
        if a.std() < 1.0 or b.std() < 1.0:
            return 0.0
        return float(np.corrcoef(a, b)[0, 1])

    # Correlation at lag 0 vs lag 1 for R/G and B/G
    r_g0  = pearson(r_crop[:, :-1].flatten(), g_crop[:, :-1].flatten())
    r_g1  = pearson(r_crop[:, :-1].flatten(), g_crop[:, 1:].flatten())
    b_g0  = pearson(b_crop[:, :-1].flatten(), g_crop[:, :-1].flatten())
    b_g1  = pearson(b_crop[:, :-1].flatten(), g_crop[:, 1:].flatten())

    # Real: lag-1 corr should differ from lag-0 (asymmetric due to CFA)
    r_lag_diff = abs(r_g1 - r_g0)
    b_lag_diff = abs(b_g1 - b_g0)
    mean_lag_diff = (r_lag_diff + b_lag_diff) / 2.0

    # Also look at absolute cross-correlation magnitude
    # Real demosaiced: R and B are more correlated with G (due to interpolation)
    mean_corr = (abs(r_g0) + abs(r_g1) + abs(b_g0) + abs(b_g1)) / 4.0

    # Composite
    if mean_lag_diff > 0.06 and mean_corr > 0.70:
        score = max(0.0, 0.30 - mean_lag_diff * 0.5)
        detail_val = mean_lag_diff
    elif mean_corr < 0.40 or mean_lag_diff < 0.01:
        score = min(1.0, 0.62 + (0.40 - min(mean_corr, 0.40)) * 0.5)
        detail_val = mean_corr
    else:
        score = 0.50
        detail_val = mean_lag_diff

    return float(np.clip(score, 0.0, 1.0))


def _chroma_fft_peak(img: np.ndarray) -> float:
    """
    S3 — Chroma sub-band energy at demosaicing frequency in FFT.

    Demosaicing leaves a characteristic energy peak in the Cb/Cr (chroma)
    channels at spatial frequency f = 0.5 cycles/pixel (period = 2px).
    AI images lack this structured chroma sub-band artifact.

    Returns: score [0=real, 1=AI]
    """
    if img.shape[0] < _MIN_DIM * 2 or img.shape[1] < _MIN_DIM * 2:
        return 0.5

    # Convert to YCrCb — Cb and Cr are chroma channels
    ycrcb = cv2.cvtColor(img, cv2.COLOR_RGB2YCrCb).astype(np.float32)
    cr = ycrcb[:, :, 1]
    cb = ycrcb[:, :, 2]

    def peak_ratio_at_nyq2(ch: np.ndarray) -> float:
        h, w = ch.shape
        # 2D FFT magnitude
        f = np.fft.fftshift(np.abs(np.fft.fft2(ch - ch.mean())))
        cy, cx = h // 2, w // 2
        # Nyquist/2 positions in both axes
        # For a width-w image, period-2 peaks appear at w/4 from centre in FFT
        qx, qy = w // 4, h // 4
        # Measure peak at (cy±qy, cx±qx) relative to smooth baseline
        peak_region = np.array([
            f[cy - qy - 2: cy - qy + 2, cx - qx - 2: cx - qx + 2].mean(),
            f[cy + qy - 2: cy + qy + 2, cx + qx - 2: cx + qx + 2].mean(),
            f[cy - qy - 2: cy - qy + 2, cx + qx - 2: cx + qx + 2].mean(),
            f[cy + qy - 2: cy + qy + 2, cx - qx - 2: cx - qx + 2].mean(),
        ])
        # Smooth background: average over whole quadrant
        background = f[cy - qy//2: cy + qy//2, cx - qx//2: cx + qx//2].mean()
        if background < 1e-9:
            return 0.5
        return float(peak_region.mean() / background)

    cr_ratio = peak_ratio_at_nyq2(cr)
    cb_ratio = peak_ratio_at_nyq2(cb)
    mean_ratio = (cr_ratio + cb_ratio) / 2.0

    if mean_ratio > 1.4:
        return max(0.0, 0.38 - (mean_ratio - 1.4) * 0.2)
    elif mean_ratio < 1.1:
        return min(1.0, 0.60 + (1.1 - mean_ratio) * 0.4)
    else:
        return 0.50


def _channel_phase_coherence(r: np.ndarray, g: np.ndarray, b: np.ndarray) -> float:
    """
    S4 — Inter-channel phase coherence at Bayer frequency.

    Demosaicing algorithms create a specific phase relationship between
    channels at the 2-pixel period frequency. Real photos: channels are
    nearly in-phase or 180° out-of-phase depending on demosaicing kernel.
    AI: random inter-channel phase at this frequency.

    Returns: score [0=real, 1=AI]
    """
    h, w = g.shape
    if w < _MIN_DIM or h < _MIN_DIM:
        return 0.5

    cy, cx = h // 2, w // 2
    sz = min(64, min(h, w) // 3)

    def row_phase_at_nyq2(ch: np.ndarray) -> np.ndarray:
        """Mean phase at the Nyquist/2 bin across rows."""
        fft_c = np.fft.rfft(ch.astype(np.float32), axis=1)
        nyq2  = fft_c.shape[1] // 2
        return np.angle(fft_c[:, nyq2])  # phase angles, shape (rows,)

    r_c = r[cy-sz:cy+sz, cx-sz:cx+sz]
    g_c = g[cy-sz:cy+sz, cx-sz:cx+sz]
    b_c = b[cy-sz:cy+sz, cx-sz:cx+sz]

    r_phase = row_phase_at_nyq2(r_c)
    g_phase = row_phase_at_nyq2(g_c)
    b_phase = row_phase_at_nyq2(b_c)

    # Phase differences
    rg_diff = np.angle(np.exp(1j * (r_phase - g_phase)))  # wrap to [-π, π]
    bg_diff = np.angle(np.exp(1j * (b_phase - g_phase)))

    # Real: phase diffs should be consistent (low circular std)
    rg_circ_std = float(np.abs(np.mean(np.exp(1j * rg_diff))))  # mean resultant length
    bg_circ_std = float(np.abs(np.mean(np.exp(1j * bg_diff))))
    coherence   = (rg_circ_std + bg_circ_std) / 2.0

    # Real: high coherence (low circular spread) → MRL near 1.0
    # AI: random phase → MRL near 0.0
    if coherence > 0.50:
        score = max(0.0, 0.35 - (coherence - 0.50) * 0.4)
    elif coherence < 0.20:
        score = min(1.0, 0.62 + (0.20 - coherence) * 1.5)
    else:
        score = 0.50

    return float(np.clip(score, 0.0, 1.0))


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

        # S1 — Green channel periodicity
        s1 = check_green_periodicity(g)
        # S2 — Cross-channel Bayer correlation
        s2 = check_bayer_correlation(r, g, b)
        # S3 — Chroma sub-band FFT peak
        s3 = _chroma_fft_peak(img)
        # S4 — Inter-channel phase coherence
        s4 = _channel_phase_coherence(r, g, b)

        evidence = [
            {"name": "green_channel_periodicity",   "score": s1,
             "detail": f"bayer_2px_peak_ratio={'present' if s1 < 0.5 else 'absent'}"},
            {"name": "bayer_cross_channel_corr",    "score": s2,
             "detail": f"lag_asymmetry={'detected' if s2 < 0.5 else 'absent'}"},
            {"name": "chroma_fft_bayer_peak",       "score": s3,
             "detail": f"chroma_subband={'present' if s3 < 0.5 else 'absent'}"},
            {"name": "channel_phase_coherence",     "score": s4,
             "detail": f"coherence={'high' if s4 < 0.5 else 'low'}"},
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

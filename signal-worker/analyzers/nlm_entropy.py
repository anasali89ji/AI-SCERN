"""
Aiscern Detection Worker — Layer 8: NLM Noise Entropy Tensor
CPU-only.

Three forensic signals extracted from the noise residual (original − Gaussian-
smoothed) across all three colour channels:

  1. Noise-residual entropy variance — AI-generated images have unrealistically
     uniform noise; real camera images show channel-specific noise patterns.
     Low variance across the entropy map → high AI suspicion.

  2. Laplacian kurtosis of residual — Camera noise is approximately Gaussian
     (kurtosis ≈ 3). AI-generated noise residuals tend toward leptokurtic
     (high kurtosis) or flat distributions depending on the generator.
     Deviation from 3.0 → higher suspicion.

  3. Inter-channel residual correlation — In real photos the three colour
     channels have *independent* noise (each has sensor-specific shot noise).
     AI-generated images produce correlated channel noise (cross-channel
     artifacts from learned upscaling), so high correlation → higher suspicion.

Outputs a dict compatible with build_layer_report.
"""

from __future__ import annotations

import logging
from typing import Any, Dict

import numpy as np

logger = logging.getLogger(__name__)


# ── Gaussian blur (box approximation — 3 passes) ─────────────────────────────

def _gaussian_blur(channel: np.ndarray, radius: int = 2) -> np.ndarray:
    """Fast approximation of Gaussian blur using repeated box filter."""
    c = channel.astype(np.float32)
    for _ in range(3):
        # Horizontal pass
        kernel = np.ones(2 * radius + 1, dtype=np.float32) / (2 * radius + 1)
        c = np.apply_along_axis(lambda row: np.convolve(row, kernel, mode="same"), 1, c)
        # Vertical pass
        c = np.apply_along_axis(lambda col: np.convolve(col, kernel, mode="same"), 0, c)
    return c


def _noise_residual(channel: np.ndarray) -> np.ndarray:
    """Return the noise residual: original − Gaussian-smoothed."""
    return channel.astype(np.float32) - _gaussian_blur(channel, radius=1)


# ── Signal 1: entropy variance of residual map ───────────────────────────────

def _residual_entropy_variance(residuals: list[np.ndarray], block: int = 16) -> float:
    """
    For each channel's residual compute a coarse entropy-per-block map,
    then return the mean variance across channels.
    Low variance → uniform noise → high AI suspicion.
    """
    variances = []
    for res in residuals:
        h, w = res.shape
        rows, cols = h // block, w // block
        if rows < 2 or cols < 2:
            continue
        emap = np.zeros((rows, cols), dtype=np.float32)
        for r in range(rows):
            for c in range(cols):
                tile = res[r * block:(r + 1) * block, c * block:(c + 1) * block]
                hist, _ = np.histogram(tile.ravel(), bins=16)
                p = hist / (hist.sum() + 1e-9)
                with np.errstate(divide="ignore", invalid="ignore"):
                    ent = -np.where(p > 0, p * np.log2(p + 1e-12), 0).sum()
                emap[r, c] = float(ent)
        with np.errstate(invalid="ignore"):
            variances.append(float(np.nanvar(emap)))
    return float(np.mean(variances)) if variances else 0.0


# ── Signal 2: Laplacian kurtosis ─────────────────────────────────────────────

def _laplacian_kurtosis(residuals: list[np.ndarray]) -> float:
    """
    Convolve each residual with a Laplacian kernel, compute kurtosis of the
    result, return mean across channels.
    Deviation from 3.0 (Gaussian baseline) is the signal.
    """
    lap_kernel = np.array([[0, -1, 0],
                            [-1, 4, -1],
                            [0, -1, 0]], dtype=np.float32)
    kurtoses = []
    for res in residuals:
        # Manual 2-D convolution via stride tricks (small kernel — fast)
        from numpy.lib.stride_tricks import sliding_window_view
        padded = np.pad(res, 1, mode="reflect")
        windows = sliding_window_view(padded, (3, 3))
        lap = (windows * lap_kernel).sum(axis=(-2, -1))
        flat = lap.ravel()
        std = flat.std()
        if std < 1e-6:
            kurtoses.append(3.0)
            continue
        z = (flat - flat.mean()) / std
        kurt = float((z ** 4).mean())
        kurtoses.append(kurt)
    return float(np.mean(kurtoses)) if kurtoses else 3.0


# ── Signal 3: inter-channel residual correlation ─────────────────────────────

def _inter_channel_corr(residuals: list[np.ndarray]) -> float:
    """
    Pearson correlation between (R, G), (G, B), (R, B) residuals, averaged.
    High correlation → AI artifact → high suspicion.
    """
    if len(residuals) < 3:
        return 0.0
    pairs = [(0, 1), (1, 2), (0, 2)]
    corrs = []
    for i, j in pairs:
        a = residuals[i].ravel()
        b = residuals[j].ravel()
        if a.std() < 1e-6 or b.std() < 1e-6:
            corrs.append(0.0)
            continue
        corr = float(np.corrcoef(a, b)[0, 1])
        corrs.append(abs(corr))
    return float(np.mean(corrs))


# ── public API ────────────────────────────────────────────────────────────────

def analyze_nlm_entropy(img_array: np.ndarray, img_pil: Any) -> Dict[str, Any]:
    """
    Run the NLM Noise Entropy Tensor detector.

    Parameters
    ----------
    img_array : np.ndarray  shape (H, W, 3) uint8
    img_pil   : PIL.Image   (unused, kept for consistent engine signature)

    Returns
    -------
    dict compatible with the layer-report schema.
    """
    from utils.evidence_builder import build_layer_report

    try:
        # ── Resize to max 512px for speed ────────────────────────────────────
        _h, _w = img_array.shape[:2]
        if max(_h, _w) > 512:
            from PIL import Image as _PIL
            _s = 512 / max(_h, _w)
            _nh, _nw = max(8, int(_h * _s)), max(8, int(_w * _s))
            _pil_tmp = _PIL.fromarray(img_array).resize((_nw, _nh), _PIL.LANCZOS)
            img_array = np.array(_pil_tmp, dtype=np.uint8)
        _MAX_NLM = True
        # Compute noise residuals for all 3 channels
        residuals = [_noise_residual(img_array[:, :, ch]) for ch in range(3)]

        # Signal 1 — entropy variance (low → high suspicion)
        ent_var = _residual_entropy_variance(residuals, block=16)
        sig_entropy = float(np.clip(1.0 - ent_var / 0.5, 0, 1))

        # Signal 2 — Laplacian kurtosis deviation from 3.0
        lap_kurt = _laplacian_kurtosis(residuals)
        kurt_dev = abs(lap_kurt - 3.0)
        # High deviation in either direction → suspicion; normalise to [0,1]
        sig_kurtosis = float(np.clip(kurt_dev / 10.0, 0, 1))

        # Signal 3 — inter-channel correlation (high → suspicion)
        icc = _inter_channel_corr(residuals)
        sig_icc = float(np.clip(icc, 0, 1))

        score = 0.40 * sig_entropy + 0.30 * sig_kurtosis + 0.30 * sig_icc

        evidence = [
            f"noise_entropy_variance={ent_var:.4f} (suspicion={sig_entropy:.2f})",
            f"laplacian_kurtosis={lap_kurt:.4f} dev={kurt_dev:.4f} (suspicion={sig_kurtosis:.2f})",
            f"inter_channel_corr={icc:.4f} (suspicion={sig_icc:.2f})",
        ]

        return build_layer_report(8, "NLM Noise Entropy Tensor", evidence, "success", 0, score=round(score, 4))

    except Exception as exc:
        logger.warning("[NLM][L8] failed: %s", exc, exc_info=True)
        from utils.evidence_builder import build_layer_report
        return build_layer_report(8, "NLM Noise Entropy Tensor", [], "failure", 0, score=0.5)

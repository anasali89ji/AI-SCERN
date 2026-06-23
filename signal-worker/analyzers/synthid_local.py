"""
Aiscern Signal Worker — SynthID & Generator Watermark Detector

Covers two distinct detection tracks:

  Track A — Google SynthID (Gemini / Imagen / ImageFX):
    Google's SynthID embeds a pseudo-random watermark pattern in the
    spectral/latent domain. We approximate detection via mid-frequency
    energy concentration in an annular band, per published open research.
    True positive-key decoding requires Google's private key; this is a
    heuristic proxy.

  Track B — ChatGPT / DALL-E 3 / gpt-image-1 fingerprinting:
    These images have NO Google SynthID, but carry characteristic
    statistical signatures from the DALL-E 3 decoder:
    - Systematic spectral aliasing at 64-px periods (latent patch grid)
    - Characteristic inter-channel colour correlation patterns
    - Specific high-frequency energy ratio distinctive to their VAE

  Track C — Midjourney v5/v6 patterns:
    - High-pass residual energy distribution (over-sharpened)
    - 'Airbrushed' noise profile in skin/gradient regions

The returned `confidence` is a combined probability that this image
was produced by ANY of the covered generators. The `generator_hint`
field indicates which family was most strongly detected.
"""

import logging
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


# ── Track A: SynthID (Gemini/Imagen) ─────────────────────────────────────────

def _synthid_frequency_probe(gray256: np.ndarray) -> float:
    """
    Check mid-frequency annulus for SynthID characteristic energy elevation.
    gray256: float32 [256, 256] normalised to [0, 1].
    Returns heuristic confidence in [0, 1].
    """
    fft_s = np.fft.fftshift(np.fft.fft2(gray256))
    mag   = np.abs(fft_s)
    h, w  = mag.shape
    cy, cx = h // 2, w // 2
    Y, X  = np.indices((h, w))
    r     = np.sqrt((Y - cy) ** 2 + (X - cx) ** 2)

    # SynthID target zone: mid-frequency (10–50 radial units on 256 grid)
    low_mask  = r < 10
    mid_mask  = (r >= 10) & (r < 50)
    high_mask = r >= 50

    e_low  = float(mag[low_mask].mean())  + 1e-9
    e_mid  = float(mag[mid_mask].mean())
    e_high = float(mag[high_mask].mean()) + 1e-9

    # SynthID-injected images have elevated mid relative to high
    mid_ratio   = e_mid / (e_low + e_high)
    # Also: SynthID shifts mid/high ratio slightly above natural distribution
    mid_hi_ratio = e_mid / e_high

    # Natural image: mid_ratio ~0.15-0.25, mid_hi_ratio ~0.08-0.12
    # SynthID image: mid_ratio tends toward 0.30+, mid_hi_ratio toward 0.15+
    if mid_ratio > 0.30 and mid_hi_ratio > 0.14:
        confidence = float(np.clip(0.50 + (mid_ratio - 0.30) * 3.0, 0.50, 0.82))
    elif mid_ratio > 0.25:
        confidence = float(np.clip(0.35 + (mid_ratio - 0.25) * 1.5, 0.35, 0.55))
    else:
        confidence = float(np.clip(0.05 + mid_ratio * 0.5, 0.05, 0.30))

    return confidence


# ── Track B: DALL-E 3 / ChatGPT Image ────────────────────────────────────────

def _dalle3_latent_grid_probe(gray256: np.ndarray) -> float:
    """
    DALL-E 3 / gpt-image-1 decode images in 64×64 latent patches.
    This creates periodic energy at multiples of 64px (=256/4=every 4th bin
    in a 256-point DFT). We look for energy elevation at those harmonics.
    """
    fft = np.abs(np.fft.fft2(gray256))
    # Row projection (column-collapsed)
    row_proj = fft.sum(axis=1)
    # DALL-E 3 harmonic bins on 256-grid: 4, 8, 12, 16 (period=64px → bin=4)
    harmonic_bins = [4, 8, 12, 16]
    # Surrounding context bins to compare against
    context_bins  = list(range(2, 22))
    ctx_set = set(context_bins) - set(harmonic_bins)

    harmonic_energy = float(np.mean([row_proj[b] for b in harmonic_bins]))
    context_energy  = float(np.mean([row_proj[b] for b in ctx_set]))

    if context_energy < 1e-9:
        return 0.30

    ratio = harmonic_energy / context_energy
    # Real images: ratio ≈ 1.0–1.5 (harmonics not elevated)
    # DALL-E 3: ratio ≈ 1.8–3.5 (latent grid bleeds into pixel space)
    if ratio > 2.5:
        return float(np.clip(0.55 + (ratio - 2.5) / 5.0, 0.55, 0.85))
    elif ratio > 1.8:
        return float(np.clip(0.35 + (ratio - 1.8) / 3.5, 0.35, 0.55))
    else:
        return float(np.clip(0.10 + ratio / 10.0, 0.10, 0.35))


def _dalle3_inter_channel_corr(img_array: np.ndarray) -> float:
    """
    DALL-E 3 VAE produces characteristic cross-channel correlations.
    Real photos: R, G, B have independent noise → low correlation in HF residual.
    DALL-E 3: channels are correlated through the decoder → elevated HF correlation.
    """
    def _hf_residual(ch):
        # Box blur as LP filter, subtract
        from numpy.lib.stride_tricks import sliding_window_view
        k = 5
        padded = np.pad(ch, k // 2, mode="reflect")
        wins = sliding_window_view(padded, (k, k))
        blurred = wins.mean(axis=(-2, -1))
        return ch.astype(np.float32) - blurred

    r_res = _hf_residual(img_array[:, :, 0]).ravel()
    g_res = _hf_residual(img_array[:, :, 1]).ravel()
    b_res = _hf_residual(img_array[:, :, 2]).ravel()

    # Compute pairwise Pearson correlations on a sample
    n = min(50000, len(r_res))
    idx = np.random.default_rng(42).choice(len(r_res), n, replace=False)
    r_, g_, b_ = r_res[idx], g_res[idx], b_res[idx]

    def _corr(a, b):
        sa, sb = a.std(), b.std()
        if sa < 1e-6 or sb < 1e-6:
            return 0.0
        return float(np.mean((a - a.mean()) * (b - b.mean())) / (sa * sb))

    rg = abs(_corr(r_, g_))
    rb = abs(_corr(r_, b_))
    gb = abs(_corr(g_, b_))
    mean_corr = (rg + rb + gb) / 3.0

    # Real photos: mean_corr ~0.02-0.10
    # DALL-E 3 / GPT-Image: mean_corr ~0.20-0.55 (decoder correlates channels)
    if mean_corr > 0.35:
        return float(np.clip(0.60 + (mean_corr - 0.35) * 2.0, 0.60, 0.88))
    elif mean_corr > 0.18:
        return float(np.clip(0.35 + (mean_corr - 0.18) * 1.5, 0.35, 0.60))
    else:
        return float(np.clip(0.05 + mean_corr * 1.5, 0.05, 0.35))


# ── Track C: Midjourney high-pass overreach ───────────────────────────────────

def _midjourney_hf_overreach(gray256: np.ndarray) -> float:
    """
    Midjourney v5/v6 applies aggressive sharpening that creates characteristic
    high-pass residual energy in the 60–120 radial band of the 256-pt DFT.
    """
    fft_s = np.fft.fftshift(np.fft.fft2(gray256))
    mag   = np.abs(fft_s)
    h, w  = mag.shape
    cy, cx = h // 2, w // 2
    Y, X  = np.indices((h, w))
    r     = np.sqrt((Y - cy) ** 2 + (X - cx) ** 2)

    mj_mask  = (r >= 60) & (r < 120)
    low_mask = r < 20

    e_mj  = float(mag[mj_mask].mean())  + 1e-9
    e_low = float(mag[low_mask].mean()) + 1e-9

    ratio = e_mj / e_low
    # Real image: ratio ~0.04–0.10
    # Midjourney: ratio ~0.15–0.35 (heavy upscaling sharpening artefact)
    if ratio > 0.20:
        return float(np.clip(0.45 + (ratio - 0.20) * 2.0, 0.45, 0.80))
    elif ratio > 0.12:
        return float(np.clip(0.25 + (ratio - 0.12) * 2.5, 0.25, 0.45))
    else:
        return float(np.clip(0.05 + ratio * 1.5, 0.05, 0.25))


# ── Public API ────────────────────────────────────────────────────────────────

def check_synthid(img_array: np.ndarray) -> dict:
    """
    Multi-track AI generator watermark and fingerprint detection.
    Returns:
      detected      : bool   — True if any generator pattern strongly detected
      confidence    : float  — combined AI-generator confidence [0, 1]
      generator_hint: str    — "gemini_synthid" | "dalle3_chatgpt" | "midjourney" | "unknown_ai" | "none"
      track_scores  : dict   — per-track raw scores for transparency
    """
    try:
        gray = img_array.mean(axis=2).astype(np.float32) / 255.0

        # Normalise to 256×256 for consistent FFT grid
        from PIL import Image as PILImage
        pil_g = PILImage.fromarray((gray * 255).astype(np.uint8))
        pil_g = pil_g.resize((256, 256), PILImage.LANCZOS)
        gray256 = np.array(pil_g, dtype=np.float32) / 255.0

        # Track A — SynthID / Gemini
        score_a = _synthid_frequency_probe(gray256)

        # Track B — DALL-E 3 / ChatGPT
        score_b1 = _dalle3_latent_grid_probe(gray256)
        score_b2 = _dalle3_inter_channel_corr(img_array)
        score_b  = max(score_b1, score_b2 * 0.9)  # take strongest B signal

        # Track C — Midjourney
        score_c = _midjourney_hf_overreach(gray256)

        track_scores = {
            "synthid_gemini": round(score_a, 4),
            "dalle3_chatgpt_grid": round(score_b1, 4),
            "dalle3_chatgpt_corr": round(score_b2, 4),
            "midjourney_hf": round(score_c, 4),
        }

        # Best-match generator
        track_best = {
            "gemini_synthid": score_a,
            "dalle3_chatgpt": score_b,
            "midjourney": score_c,
        }
        top_gen, top_score = max(track_best.items(), key=lambda kv: kv[1])

        # Combined confidence: soft-max of all tracks
        # Use "noisy OR": P(at_least_one) = 1 - prod(1 - pi)
        noisy_or = 1.0 - (1 - score_a) * (1 - score_b) * (1 - score_c)
        confidence = float(np.clip(noisy_or, 0, 1))

        detected = confidence > 0.55 or top_score > 0.65

        return {
            "detected":       bool(detected),
            "confidence":     round(confidence, 4),
            "generator_hint": top_gen if top_score > 0.40 else "unknown_ai" if detected else "none",
            "track_scores":   track_scores,
        }

    except Exception as e:
        logger.warning("[SynthID/Generator] detection failed: %s", e)
        return {"detected": False, "confidence": 0.0, "generator_hint": "none", "track_scores": {}}

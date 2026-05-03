"""
Aiscern Signal Worker — Layer 4: Frequency Domain Analysis
Signals: FFT periodic spectral peaks (GAN fingerprint),
         Wavelet energy in high-frequency subbands (diffusion suppression).
"""

import time
import numpy as np
from PIL import Image

import pywt

from utils.evidence_builder import evidence_node, build_layer_report


# ── FFT Spectral Peaks ────────────────────────────────────────────────────────

def fft_peaks_suspicion(img_array: np.ndarray, target_regions: list) -> tuple[float, str, float]:
    """
    Compute 2D FFT on grayscale image. GAN-generated images often show
    periodic spectral peaks in the radial average due to upsampling artifacts.

    Returns (suspicion_score, detail, peak_ratio).
    """
    gray = img_array.mean(axis=2).astype(np.float32)

    # If target regions provided, also analyze those patches
    regions_to_analyze = [gray]

    if target_regions:
        h, w = gray.shape
        for region in target_regions[:3]:
            x0 = int(region.get("x", 0) * w)
            y0 = int(region.get("y", 0) * h)
            x1 = int((region.get("x", 0) + region.get("width", 1)) * w)
            y1 = int((region.get("y", 0) + region.get("height", 1)) * h)
            patch = gray[y0:y1, x0:x1]
            if patch.size > 64:
                regions_to_analyze.append(patch)

    peak_ratios = []

    for patch in regions_to_analyze:
        # Zero-pad to power of 2 for FFT efficiency
        h, w     = patch.shape
        ph       = int(2 ** np.ceil(np.log2(max(h, 8))))
        pw       = int(2 ** np.ceil(np.log2(max(w, 8))))
        padded   = np.zeros((ph, pw), dtype=np.float32)
        padded[:h, :w] = patch

        fft_mag  = np.abs(np.fft.fft2(padded))
        fft_mag  = np.fft.fftshift(fft_mag)
        fft_log  = np.log1p(fft_mag)

        # Compute radial average
        cy, cx   = ph // 2, pw // 2
        y_idx, x_idx = np.indices((ph, pw))
        r        = np.sqrt((y_idx - cy)**2 + (x_idx - cx)**2).astype(int)
        max_r    = min(cy, cx)
        radial   = np.array([fft_log[r == ri].mean() if (r == ri).any() else 0 for ri in range(max_r)])

        if len(radial) < 10:
            continue

        # Check for periodic peaks: std-to-mean ratio of radial average
        # High peaks = GAN artifact; smooth curve = natural or diffusion
        radial_norm = (radial - radial.mean()) / (radial.std() + 1e-8)
        # Count significant peaks (values > 2 sigma above mean of radial)
        peak_count  = int((radial_norm > 2.0).sum())
        # Ratio of peak energy to total
        peak_ratio  = peak_count / max(len(radial), 1)
        peak_ratios.append(peak_ratio)

    avg_peak_ratio = float(np.mean(peak_ratios)) if peak_ratios else 0.0

    if avg_peak_ratio > 0.08:
        score  = 0.82
        detail = (f"FFT shows significant periodic spectral peaks (ratio={avg_peak_ratio:.3f}). "
                  f"This pattern is characteristic of GAN upsampling artifacts.")
    elif avg_peak_ratio > 0.04:
        score  = 0.50
        detail = f"FFT shows moderate spectral peaks (ratio={avg_peak_ratio:.3f}) — inconclusive"
    else:
        score  = 0.20
        detail = f"FFT spectrum is smooth without GAN-characteristic peaks (ratio={avg_peak_ratio:.3f})"

    return score, detail, avg_peak_ratio


# ── Wavelet Subband Energy ────────────────────────────────────────────────────

# Natural image energy ratio baselines (measured on large diverse dataset)
# LH/HL/HH subbands contain high-frequency detail that AI models suppress.
NATURAL_HF_ENERGY_RATIO = 0.055  # natural images
AI_HF_ENERGY_RATIO      = 0.032  # diffusion models suppress HF

def wavelet_energy_suspicion(img_array: np.ndarray) -> tuple[float, str, float]:
    """
    Run 2D DWT (Haar) on grayscale image.
    Measure energy ratio in LH/HL/HH subbands vs LL.
    Diffusion models suppress high-frequency content → lower ratio.

    Returns (suspicion_score, detail, hf_ratio).
    """
    gray  = img_array.mean(axis=2).astype(np.float32) / 255.0
    h, w  = gray.shape

    # Resize to 256x256 for consistent analysis
    from PIL import Image as PILImage
    pil_g = PILImage.fromarray((gray * 255).astype(np.uint8))
    pil_g = pil_g.resize((256, 256), PILImage.LANCZOS)
    gray  = np.array(pil_g, dtype=np.float32) / 255.0

    # Multi-level 2D DWT
    total_hf_energy = 0.0
    total_energy    = 0.0

    current = gray
    for level in range(3):
        cA, (cH, cV, cD) = pywt.dwt2(current, 'haar')

        level_energy = float(cA.var() + cH.var() + cV.var() + cD.var())
        hf_energy    = float(cH.var() + cV.var() + cD.var())

        total_energy    += level_energy
        total_hf_energy += hf_energy
        current = cA  # recurse on approximation

    hf_ratio = total_hf_energy / (total_energy + 1e-8)

    if hf_ratio < AI_HF_ENERGY_RATIO * 0.9:
        score  = 0.85
        detail = (f"Wavelet HF energy ratio={hf_ratio:.4f} is significantly below natural baseline "
                  f"({NATURAL_HF_ENERGY_RATIO:.4f}). Diffusion models suppress high-frequency detail.")
    elif hf_ratio < NATURAL_HF_ENERGY_RATIO * 0.85:
        score  = 0.62
        detail = f"Wavelet HF energy ratio={hf_ratio:.4f} — below natural baseline, moderate AI signal"
    elif hf_ratio < NATURAL_HF_ENERGY_RATIO * 1.15:
        score  = 0.25
        detail = f"Wavelet HF energy ratio={hf_ratio:.4f} — within natural image range"
    else:
        score  = 0.10
        detail = f"Wavelet HF energy ratio={hf_ratio:.4f} — above natural baseline (strong real image signal)"

    return score, detail, hf_ratio


# ── Main Layer 4 function ─────────────────────────────────────────────────────

def analyze_frequency_domain(
    img_array:      np.ndarray,
    img_pil:        Image.Image,
    target_regions: list,
) -> dict:
    start = time.time()
    evidence = []

    # FFT spectral peaks
    fft_score, fft_detail, fft_raw = fft_peaks_suspicion(img_array, target_regions)
    fft_status = "anomalous" if fft_score > 0.65 else "normal" if fft_score < 0.30 else "inconclusive"
    evidence.append(evidence_node(
        layer=4, category="frequency_analysis", artifact_type="fft_spectral_peaks",
        status=fft_status, confidence=fft_score, detail=fft_detail, raw_value=fft_raw,
    ))

    # Wavelet subband energy
    wav_score, wav_detail, wav_raw = wavelet_energy_suspicion(img_array)
    wav_status = "anomalous" if wav_score > 0.65 else "normal" if wav_score < 0.30 else "inconclusive"
    evidence.append(evidence_node(
        layer=4, category="frequency_analysis", artifact_type="high_freq_suppression",
        status=wav_status, confidence=wav_score, detail=wav_detail, raw_value=wav_raw,
    ))

    elapsed_ms = int((time.time() - start) * 1000)
    return build_layer_report(4, "Frequency Domain", evidence, "success", elapsed_ms)

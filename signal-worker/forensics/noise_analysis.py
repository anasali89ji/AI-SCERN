"""
Aiscern Image v3 — Layer 2: Noise Pattern & PRNU Analysis
PRNU residual, noise coherence maps, spatial correlation analysis.
"""
import cv2
import numpy as np
from scipy.ndimage import gaussian_filter
from scipy.stats import pearsonr
from typing import Dict, Any, Optional


def extract_noise_residual(img_array: np.ndarray, sigma: float = 3.0) -> np.ndarray:
    """Fix #6 (v4.5.0): accepts img_array instead of image_path."""
    if img_array.ndim == 3:
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY).astype(np.float32)
    else:
        gray = img_array.astype(np.float32)
    denoised = gaussian_filter(gray, sigma=sigma)
    residual = gray - denoised
    return residual


def noise_coherence_analysis(img_array: np.ndarray) -> Dict[str, Any]:
    residual = extract_noise_residual(img_array)
    h, w = residual.shape

    patch_size = 64
    patches = []
    for i in range(0, h - patch_size + 1, patch_size):
        for j in range(0, w - patch_size + 1, patch_size):
            patch = residual[i:i + patch_size, j:j + patch_size]
            patches.append(patch)

    patches = np.array(patches)
    local_vars = np.var(patches, axis=(1, 2))
    noise_uniformity = np.std(local_vars) / (np.mean(local_vars) + 1e-8)

    flat_residual = residual.flatten()
    # Module 1.3: replaced O(n²) np.correlate with scipy.signal.fftconvolve.
    # The old code computed `np.correlate(flat[:10000], flat[:10000], mode='full')`
    # which is O(n²) memory AND runtime — several seconds per image, blocking
    # the sub-second latency target. FFT convolution produces the same first
    # N lags in O(n log n) — milliseconds.
    from scipy.signal import fftconvolve

    N = min(10000, len(flat_residual))
    sample = flat_residual[:N].astype(np.float32)
    # autocorr[k] = sum_{i} sample[i] * sample[i-k]  (mode='full' gives 2N-1 lags)
    autocorr_full = fftconvolve(sample, sample[::-1], mode='full')
    center = len(autocorr_full) // 2
    # First 50 lags — we only ever read [1:10] below, but compute a few extra
    # in case future code wants to look at longer-range correlation.
    n_lags = 50
    autocorr = autocorr_full[center:center + n_lags]
    spatial_correlation = float(np.mean(autocorr[1:10]) / (autocorr[0] + 1e-8))

    return {
        "noise_uniformity_score": float(noise_uniformity),
        "spatial_correlation": float(spatial_correlation),
        "local_variance_mean": float(np.mean(local_vars)),
        "local_variance_std": float(np.std(local_vars)),
        "is_uniform_noise": bool(noise_uniformity < 0.3)
    }


def prnu_fingerprint_correlation(
    img_array: np.ndarray,
    reference_prnu: Optional[np.ndarray] = None
) -> Dict[str, Any]:
    residual = extract_noise_residual(img_array)
    if reference_prnu is not None:
        r1 = residual.flatten()[:len(reference_prnu.flatten())]
        r2 = reference_prnu.flatten()[:len(r1)]
        r1 = (r1 - np.mean(r1)) / (np.std(r1) + 1e-8)
        r2 = (r2 - np.mean(r2)) / (np.std(r2) + 1e-8)
        correlation, _ = pearsonr(r1, r2)
        return {
            "prnu_correlation": float(correlation),
            "camera_match": bool(correlation > 0.03)
        }
    return {
        "prnu_available": False,
        "prnu_correlation": None,
        "note": "PRNU requires reference fingerprint from known camera"
    }

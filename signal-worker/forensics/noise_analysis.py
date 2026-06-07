"""
Aiscern Image v3 — Layer 2: Noise Pattern & PRNU Analysis
PRNU residual, noise coherence maps, spatial correlation analysis.
"""
import cv2
import numpy as np
from scipy.ndimage import gaussian_filter
from scipy.stats import pearsonr
from typing import Dict, Any, Optional


def extract_noise_residual(image_path: str, sigma: float = 3.0) -> np.ndarray:
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    denoised = gaussian_filter(gray, sigma=sigma)
    residual = gray - denoised
    return residual


def noise_coherence_analysis(image_path: str) -> Dict[str, Any]:
    residual = extract_noise_residual(image_path)
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
    autocorr = np.correlate(flat_residual[:10000], flat_residual[:10000], mode="full")
    autocorr = autocorr[autocorr.size // 2:]
    spatial_correlation = np.mean(autocorr[1:10]) / (autocorr[0] + 1e-8)

    return {
        "noise_uniformity_score": float(noise_uniformity),
        "spatial_correlation": float(spatial_correlation),
        "local_variance_mean": float(np.mean(local_vars)),
        "local_variance_std": float(np.std(local_vars)),
        "is_uniform_noise": bool(noise_uniformity < 0.3)
    }


def prnu_fingerprint_correlation(
    image_path: str,
    reference_prnu: Optional[np.ndarray] = None
) -> Dict[str, Any]:
    residual = extract_noise_residual(image_path)
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

"""
Aiscern Image v3 — Layer 2: Frequency Domain Analysis
FFT, DCT coefficient analysis, GAN fingerprinting, diffusion noise patterns.
"""
import cv2
import numpy as np
from scipy.stats import kurtosis, skew
from typing import Dict, Any


def frequency_domain_analysis(image_path: str) -> Dict[str, Any]:
    img = cv2.imread(image_path)
    if img is None:
        return {"error": "cannot_read_image"}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    f = np.fft.fft2(gray)
    fshift = np.fft.fftshift(f)
    magnitude = np.abs(fshift)
    magnitude_log = np.log(magnitude + 1)

    center_h, center_w = h // 2, w // 2
    y, x = np.ogrid[:h, :w]
    center_dist = np.sqrt((x - center_w) ** 2 + (y - center_h) ** 2)
    max_radius = min(center_h, center_w)

    low_mask = center_dist <= max_radius * 0.1
    mid_mask = (center_dist > max_radius * 0.1) & (center_dist <= max_radius * 0.3)
    high_mask = center_dist > max_radius * 0.3

    low_energy = np.sum(magnitude[low_mask])
    mid_energy = np.sum(magnitude[mid_mask])
    high_energy = np.sum(magnitude[high_mask])
    total_energy = low_energy + mid_energy + high_energy

    dct_features = analyze_dct_coefficients(gray)
    grid_score = detect_grid_artifacts(magnitude_log)
    diffusion_noise_score = analyze_diffusion_noise_pattern(magnitude, high_mask)

    return {
        "low_freq_ratio": float(low_energy / total_energy) if total_energy > 0 else 0,
        "mid_freq_ratio": float(mid_energy / total_energy) if total_energy > 0 else 0,
        "high_freq_ratio": float(high_energy / total_energy) if total_energy > 0 else 0,
        "high_freq_suppression": float(high_energy / low_energy) if low_energy > 0 else 0,
        "dct_features": dct_features,
        "grid_artifact_score": float(grid_score),
        "diffusion_noise_score": float(diffusion_noise_score),
        "magnitude_kurtosis": float(kurtosis(magnitude_log.flatten())),
        "magnitude_skewness": float(skew(magnitude_log.flatten()))
    }


def analyze_dct_coefficients(gray: np.ndarray, block_size: int = 8) -> Dict[str, Any]:
    h, w = gray.shape
    dct_blocks = []

    for i in range(0, h - block_size + 1, block_size):
        for j in range(0, w - block_size + 1, block_size):
            block = gray[i:i + block_size, j:j + block_size].astype(np.float32)
            dct = cv2.dct(block)
            dct_blocks.append(dct)

    dct_blocks = np.array(dct_blocks)
    ac_coeffs = dct_blocks[:, 1:, 1:].flatten()

    return {
        "ac_mean": float(np.mean(ac_coeffs)),
        "ac_std": float(np.std(ac_coeffs)),
        "ac_kurtosis": float(kurtosis(ac_coeffs)),
        "ac_skewness": float(skew(ac_coeffs)),
        "block_count": len(dct_blocks)
    }


def detect_grid_artifacts(magnitude_log: np.ndarray) -> float:
    h_proj = np.sum(magnitude_log, axis=1)
    v_proj = np.sum(magnitude_log, axis=0)

    h_corr = np.correlate(h_proj - np.mean(h_proj), h_proj - np.mean(h_proj), mode="full")
    v_corr = np.correlate(v_proj - np.mean(v_proj), v_proj - np.mean(v_proj), mode="full")

    h_corr = h_corr / np.max(h_corr)
    v_corr = v_corr / np.max(v_corr)

    center = len(h_corr) // 2
    h_peaks = np.max(h_corr[center + 10:center + 100]) if len(h_corr) > center + 100 else 0
    v_peaks = np.max(v_corr[center + 10:center + 100]) if len(v_corr) > center + 100 else 0

    return float((h_peaks + v_peaks) / 2)


def analyze_diffusion_noise_pattern(magnitude: np.ndarray, high_freq_mask: np.ndarray) -> float:
    high_freq = magnitude[high_freq_mask]
    if len(high_freq) == 0:
        return 0.5
    noise_kurtosis = kurtosis(high_freq)
    score = min(max((noise_kurtosis - 3.0) / 5.0, 0.0), 1.0)
    return float(score)

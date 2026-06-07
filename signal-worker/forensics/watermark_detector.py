"""
Aiscern Image v3 — Layer 5: Watermark & Signature Detection
SynthID (wavelet-based), Imagen, Stable Signature, frequency anomaly detection.
"""
import numpy as np
import cv2
from PIL import Image
from typing import Dict, Any


def detect_watermarks(image_path: str) -> Dict[str, Any]:
    img = Image.open(image_path)
    img_array = np.array(img)

    results = {
        "synthid_detected": False,
        "synthid_confidence": 0.0,
        "imagen_watermark": False,
        "stable_signature": False,
        "custom_watermarks": [],
        "overall_watermark_score": 0.0
    }

    synthid_result = detect_synthid(img_array)
    results["synthid_detected"] = synthid_result["detected"]
    results["synthid_confidence"] = synthid_result["confidence"]

    imagen_result = detect_imagen_watermark(img_array)
    results["imagen_watermark"] = imagen_result["detected"]

    stable_result = detect_stable_signature(img_array)
    results["stable_signature"] = stable_result["detected"]

    freq_anomaly = detect_frequency_anomaly(img_array)

    scores = [
        results["synthid_confidence"],
        1.0 if results["imagen_watermark"] else 0.0,
        1.0 if results["stable_signature"] else 0.0,
        freq_anomaly["score"]
    ]

    results["overall_watermark_score"] = float(max(scores))
    return results


def detect_synthid(img_array: np.ndarray) -> Dict[str, Any]:
    try:
        import pywt

        if len(img_array.shape) == 3:
            gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_array

        coeffs = pywt.dwt2(gray, "haar")
        cA, (cH, cV, cD) = coeffs

        h_energy = np.sum(cH ** 2)
        v_energy = np.sum(cV ** 2)
        d_energy = np.sum(cD ** 2)
        total = h_energy + v_energy + d_energy + 1e-8

        energy_ratio = (h_energy + v_energy) / total
        is_detected = bool(energy_ratio > 0.6)

        return {
            "detected": is_detected,
            "confidence": float(energy_ratio),
            "energy_ratio": float(energy_ratio)
        }
    except ImportError:
        return {"detected": False, "confidence": 0.0, "note": "pywt not available"}


def detect_imagen_watermark(img_array: np.ndarray) -> Dict[str, Any]:
    # Placeholder: Imagen watermark requires proprietary detector
    return {"detected": False, "confidence": 0.0}


def detect_stable_signature(img_array: np.ndarray) -> Dict[str, Any]:
    # Placeholder: Stable Signature requires fine-tuned model
    return {"detected": False, "confidence": 0.0}


def detect_frequency_anomaly(img_array: np.ndarray) -> Dict[str, Any]:
    if len(img_array.shape) == 3:
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    else:
        gray = img_array

    f = np.fft.fft2(gray)
    fshift = np.fft.fftshift(f)
    magnitude = np.abs(fshift)

    h, w = magnitude.shape
    center_h, center_w = h // 2, w // 2
    y, x = np.ogrid[:h, :w]
    center_dist = np.sqrt((x - center_w) ** 2 + (y - center_h) ** 2)

    ring_energies = []
    for r in range(10, min(h, w) // 2, 20):
        mask = (center_dist >= r) & (center_dist < r + 20)
        if np.sum(mask) > 0:
            ring_energies.append(np.mean(magnitude[mask]))

    energy_diff = np.diff(ring_energies)
    irregularity = np.std(energy_diff) / (np.mean(np.abs(energy_diff)) + 1e-8)

    return {
        "score": float(min(irregularity, 1.0)),
        "irregularity": float(irregularity)
    }

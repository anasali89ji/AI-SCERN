"""
Aiscern — Layer 26: PRNU Camera Fingerprint Analyzer
====================================================

Photo Response Non-Uniformity (PRNU) is a per-pixel multiplicative gain
pattern unique to each camera sensor, caused by CMOS manufacturing
variations in pixel area and amplifier gain. The pattern is:

  - Stable for the sensor's lifetime (does not change with temperature,
    exposure, or scene content)
  - Survives JPEG compression (and most social-media re-encoding)
  - Spatially high-frequency (mostly above the natural image content band)
  - Statistically independent of the scene

This makes it the gold-standard camera-attribution signal
(Lukas-Fridrich-Goljan, IEEE TIFS 2006 — "Determining Digital Image
Origin Using Sensor Imperfections").

Algorithm
---------
1. Extract the noise residual r = I - Denoise(I) using a wavelet-based
   Mihçak filter (Mihçak et al. 2003). This is better than Gaussian
   blur for PRNU because it preserves edges while suppressing scene
   content in flat regions.
2. Wiener-filter the residual in the frequency domain to suppress any
   remaining scene content.
3. Cross-correlate against each camera PRNU in
   `data/prnu_fingerprints/<model>.npy`. Use the PCE (Peak-to-Correlation-
   Energy) ratio as the match statistic — PCE > 60 is a strong match
   (Lukas et al. 2006, §IV.B).

Scoring
-------
- Strong PRNU match (PCE > 60) found in the fingerprint database →
  this image definitely came from that camera → strongly real (score 0.05).
- No match AND image has clear EXIF camera info (Make + Model populated) →
  suspicious — fabricators usually strip or fabricate EXIF (score 0.75).
- No EXIF and no match → neutral (score 0.5).

Data files
----------
For the initial commit, only `data/prnu_fingerprints/README.md` exists,
explaining the format. A full fingerprint DB is out of scope for this
batch — ship the analyzer + the integration scaffolding; production
fingerprints can be added later by dropping .npy files into the directory.

Reference
---------
J. Lukas, J. Fridrich, M. Goljan, "Determining Digital Image Origin Using
Sensor Imperfections," IEEE TIFS 2006.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List

import numpy as np

logger = logging.getLogger(__name__)

# Path to the PRNU fingerprint database (relative to signal-worker root).
# Each .npy file is a 2D float32 array, same shape as the test image's
# noise residual, named <camera_model>.npy — e.g. iphone_14_pro.npy.
PRNU_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "prnu_fingerprints")

# PCE threshold for "strong match" — Lukas et al. 2006 §IV.B recommends 60.
PCE_STRONG_MATCH_THRESHOLD = 60.0


def _wavelet_denoise(img: np.ndarray) -> np.ndarray:
    """
    Wavelet-based Mihçak denoiser (Mihçak et al. 2003). Better than
    Gaussian blur for PRNU extraction because it preserves edges while
    suppressing scene content in flat regions (where PRNU lives).

    Uses PyWavelets with hard thresholding on the detail coefficients.
    """
    import pywt

    # Single-level 2D wavelet decomposition
    coeffs = pywt.wavedec2(img.astype(np.float32), wavelet="db4", level=3)
    threshold = np.median(np.abs(coeffs[-1][0])) / 0.6745 * np.sqrt(2 * np.log(img.size))

    # Hard-threshold detail coefficients, keep approximation
    denoised = [coeffs[0]]
    for detail_level in coeffs[1:]:
        cH, cV, cD = detail_level
        cH = pywt.threshold(cH, threshold, mode="hard")
        cV = pywt.threshold(cV, threshold, mode="hard")
        cD = pywt.threshold(cD, threshold, mode="hard")
        denoised.append((cH, cV, cD))

    return pywt.waverec2(denoised, wavelet="db4")


def _wiener_filter(residual: np.ndarray) -> np.ndarray:
    """
    Wiener filter in the frequency domain to suppress any remaining
    scene content (which lives in the low-frequency band of the residual).

    Uses a simple spectral-domain Wiener with noise floor estimated from
    the residual's high-frequency energy.
    """
    # FFT shift so DC is centered
    F = np.fft.fftshift(np.fft.fft2(residual))
    mag = np.abs(F)
    # Noise floor estimate: median magnitude of the outer 25% of frequencies
    # (highest spatial frequencies — pure sensor noise).
    h, w = mag.shape
    edge_mask = np.zeros_like(mag, dtype=bool)
    edge_mask[:h // 8, :] = True
    edge_mask[-h // 8:, :] = True
    edge_mask[:, :w // 8] = True
    edge_mask[:, -w // 8:] = True
    noise_floor = float(np.median(mag[edge_mask])) + 1e-8

    # Wiener gain: H = |F|² / (|F|² + noise_floor²)
    gain = mag ** 2 / (mag ** 2 + noise_floor ** 2)
    filtered = F * gain
    return np.real(np.fft.ifft2(np.fft.ifftshift(filtered)))


def _extract_prnu(img_array: np.ndarray) -> np.ndarray:
    """
    Extract the PRNU noise residual from an RGB image.
    Returns a 2D float32 array (grayscale-equivalent residual).
    """
    # Convert to grayscale via luminance
    gray = np.mean(img_array, axis=2).astype(np.float32)

    # Resize to a canonical 256×256 (PRNU pattern is scale-invariant but
    # correlation requires both signals to be the same shape).
    from PIL import Image as _PIL
    pil_g = _PIL.fromarray(np.clip(gray, 0, 255).astype(np.uint8))
    pil_g = pil_g.resize((256, 256), _PIL.LANCZOS)
    g = np.array(pil_g, dtype=np.float32)

    # Step 1: wavelet denoise → residual
    denoised = _wavelet_denoise(g)
    # Trim in case waverec2 produced a slightly larger array
    denoised = denoised[: g.shape[0], : g.shape[1]]
    residual = g - denoised

    # Step 2: Wiener filter to suppress scene content
    filtered = _wiener_filter(residual)
    return filtered.astype(np.float32)


def _pce(correlation: np.ndarray) -> float:
    """
    Compute the Peak-to-Correlation-Energy ratio.

    PCE = peak_corr² / mean(corr² everywhere except the peak's 11×11 neighborhood)

    High PCE → the correlation has a sharp, isolated peak → strong match.
    Low PCE → correlation is diffuse → no match.
    """
    abs_corr = np.abs(correlation)
    peak_idx = np.unravel_index(np.argmax(abs_corr), abs_corr.shape)
    peak_val = float(abs_corr[peak_idx])

    # Mask out an 11×11 neighborhood around the peak before computing energy
    mask = np.ones_like(abs_corr, dtype=bool)
    ph, pw = peak_idx
    for dh in range(-5, 6):
        for dw in range(-5, 6):
            if 0 <= ph + dh < mask.shape[0] and 0 <= pw + dw < mask.shape[1]:
                mask[ph + dh, pw + dw] = False

    energy = float(np.mean(abs_corr[mask] ** 2)) + 1e-12
    return (peak_val ** 2) / energy


def _load_fingerprint_db() -> Dict[str, np.ndarray]:
    """Load all .npy files from data/prnu_fingerprints/. Returns {} if dir missing."""
    fingerprints: Dict[str, np.ndarray] = {}
    if not os.path.isdir(PRNU_DB_PATH):
        return fingerprints
    for fname in os.listdir(PRNU_DB_PATH):
        if fname.endswith(".npy"):
            try:
                arr = np.load(os.path.join(PRNU_DB_PATH, fname))
                model = fname[:-4]  # strip .npy
                fingerprints[model] = arr.astype(np.float32)
            except Exception as e:
                logger.warning("[PRNU][L26] failed to load %s: %s", fname, e)
    return fingerprints


def analyze_prnu(
    img_array: np.ndarray,
    exif_metadata: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """
    Run PRNU camera-fingerprint analysis.

    Parameters
    ----------
    img_array : np.ndarray  shape (H, W, 3) uint8
        The image to analyze.
    exif_metadata : dict, optional
        EXIF data from metadata_analyzer — used for the "no match AND has
        EXIF" suspicious signal. None or empty dict means no EXIF available.

    Returns
    -------
    dict matching the layer-report schema with key fields:
        layerSuspicionScore: float in [0,1] (0 = real camera, 1 = AI / fabricated)
        evidence: list of evidence-node dicts
        status: "success" | "not_applicable" (when no fingerprint DB exists)
    """
    from utils.evidence_builder import build_layer_report, evidence_node

    try:
        residual = _extract_prnu(img_array)
    except Exception as exc:
        logger.warning("[PRNU][L26] residual extraction failed: %s", exc, exc_info=True)
        return build_layer_report(
            layer=26,
            layer_name="PRNU Camera Fingerprint",
            evidence=[],
            status="failure",
            elapsed_ms=0,
            score=0.5,
        )

    fingerprints = _load_fingerprint_db()

    if not fingerprints:
        # No fingerprint DB yet — ship as not_applicable so _fuse_scores skips it
        # rather than diluting the average with a neutral 0.5.
        return build_layer_report(
            layer=26,
            layer_name="PRNU Camera Fingerprint",
            evidence=[
                evidence_node(
                    layer=26,
                    category="prnu_camera_fingerprint",
                    artifact_type="database_unavailable",
                    status="not_present",
                    confidence=0.0,
                    detail=f"PRNU fingerprint DB not yet populated at {PRNU_DB_PATH}. "
                           "Add .npy files (one per camera model) to enable this layer.",
                )
            ],
            status="not_applicable",
            elapsed_ms=0,
            score=0.5,
        )

    # Try matching against each camera model's fingerprint
    best_pce = 0.0
    best_model = None
    pce_scores: List[Dict[str, Any]] = []
    for model, fp in fingerprints.items():
        # Residual and fingerprint must be the same shape for correlation.
        # Resize fingerprint to match residual if needed (linear interpolation).
        if fp.shape != residual.shape:
            from PIL import Image as _PIL
            pil_fp = _PIL.fromarray(np.clip(fp, 0, 255).astype(np.uint8))
            pil_fp = pil_fp.resize((residual.shape[1], residual.shape[0]), _PIL.LANCZOS)
            fp = np.array(pil_fp, dtype=np.float32)

        # Cross-correlation via FFT
        corr = np.fft.ifft2(np.fft.fft2(residual) * np.fft.fft2(fp).conj()).real
        pce = _pce(corr)
        pce_scores.append({"model": model, "pce": pce})

        if pce > best_pce:
            best_pce = pce
            best_model = model

    # Decision logic per the spec:
    # - Strong PRNU match → strongly real (0.05)
    # - No match AND has EXIF camera info → suspicious (0.75)
    # - No EXIF and no match → neutral (0.5)
    has_camera_exif = bool(exif_metadata and (exif_metadata.get("make") or exif_metadata.get("model")))

    if best_pce > PCE_STRONG_MATCH_THRESHOLD:
        # Strong match → real camera, very low suspicion
        score = 0.05
        status = "anomalous_real"
        detail = f"Strong PRNU match with {best_model} (PCE={best_pce:.1f}, threshold={PCE_STRONG_MATCH_THRESHOLD}). " \
                 f"This image was almost certainly captured by this specific camera sensor."
    elif has_camera_exif:
        # EXIF claims a camera but no PRNU match — suspicious (fabricated EXIF,
        # or AI-generated image with EXIF pasted in)
        score = 0.75
        status = "anomalous"
        make_str = exif_metadata.get('make', '?') if exif_metadata else '?'
        model_str = exif_metadata.get('model', '?') if exif_metadata else '?'
        detail = (
            f"No PRNU match despite EXIF claiming camera "
            f"({make_str}/{model_str}). "
            f"Best PCE was {best_pce:.1f} (threshold={PCE_STRONG_MATCH_THRESHOLD}). "
            f"Either the EXIF is fabricated or this is an AI-generated image with EXIF pasted in."
        )
    else:
        # No EXIF and no match — neutral (could be AI, could be a camera
        # not in our DB)
        score = 0.5
        status = "inconclusive"
        detail = f"No PRNU match (best PCE={best_pce:.1f}, threshold={PCE_STRONG_MATCH_THRESHOLD}). " \
                 f"No EXIF camera info available to corroborate. Cannot distinguish AI-generated " \
                 f"from a real photo taken by a camera not in our fingerprint DB."

    evidence = [
        evidence_node(
            layer=26,
            category="prnu_camera_fingerprint",
            artifact_type="pce_match",
            status=status,
            confidence=score,
            detail=detail,
            raw_value=best_pce,
        )
    ]
    # Also surface the per-model PCE breakdown as additional evidence
    for entry in pce_scores[:3]:  # top 3
        evidence.append(
            evidence_node(
                layer=26,
                category="prnu_camera_fingerprint",
                artifact_type="per_model_pce",
                status="inconclusive",
                confidence=0.0,
                detail=f"PCE vs {entry['model']}: {entry['pce']:.2f}",
                raw_value=entry["pce"],
            )
        )

    return build_layer_report(
        layer=26,
        layer_name="PRNU Camera Fingerprint",
        evidence=evidence,
        status="success",
        elapsed_ms=0,
        score=score,
    )

"""
Aiscern — Layer 29: DCT Grid Sub-Pixel Offset Analyzer
=======================================================

A JPEG encoded at quality Q has its 8×8 DCT blocks locked to the pixel
grid at offset (0, 0). If the image is later cropped by (3 px, 5 px) and
re-encoded, the original content's block boundaries are now at (3, 5)
mod 8 in the new image. Detecting this offset reveals cropping that
happened between two JPEG compressions — a strong splice/inpainting signal.

AI-generated images that were never JPEG-compressed show no peak at any
offset — they have no DCT block structure to detect.

Algorithm
---------
1. Compute per-pixel local variance map (3×3 std filter).
2. For each offset (dx, dy) in {0..7} × {0..7}:
   - Cross-correlate the variance map with a synthetic comb:
     comb[i, j] = 1 if (i - dy) % 8 == 0 and (j - dx) % 8 == 0 else 0
3. Find the offset with the maximum correlation.
4. Decision:
   - (0, 0) with corr > 0.6 → real JPEG (single compression, score 0.20).
   - Offset ≠ (0, 0) → cropped-and-recompressed (score 0.65).
   - No offset > 0.4 → never JPEG-compressed, possibly AI (score 0.55).

Reference
---------
T. Pevny, J. Fridrich, "Detection of double-compression in JPEG images
for applications in steganography," IEEE TIFS 2008.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# Correlation threshold above which we say "yes, JPEG block structure detected"
JPEG_BLOCK_CORR_THRESHOLD = 0.6

# Below this threshold — no JPEG structure detected at all
NO_JPEG_CORR_THRESHOLD = 0.4


def _local_variance_map(img_array: np.ndarray) -> np.ndarray:
    """
    Compute per-pixel local variance using a 3×3 std filter.
    Block-aligned JPEG content produces periodic spikes in the variance map.
    """
    import cv2

    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY).astype(np.float32)
    # Use a 3×3 box filter to compute local mean and mean-of-squares
    ksize = (3, 3)
    mean = cv2.blur(gray, ksize)
    mean_sq = cv2.blur(gray ** 2, ksize)
    variance = mean_sq - mean ** 2
    # Variance is sometimes slightly negative due to floating-point error
    return np.maximum(variance, 0.0)


def _build_comb(shape: Tuple[int, int], offset: Tuple[int, int]) -> np.ndarray:
    """Build a synthetic comb pattern aligned to (dx, dy) mod 8."""
    h, w = shape
    dy, dx = offset
    y_idx = np.arange(h)
    x_idx = np.arange(w)
    y_marker = ((y_idx - dy) % 8 == 0).astype(np.float32)
    x_marker = ((x_idx - dx) % 8 == 0).astype(np.float32)
    return np.outer(y_marker, x_marker)


def _find_grid_offset(variance_map: np.ndarray) -> Tuple[Tuple[int, int], float]:
    """
    Find the (dy, dx) offset with maximum correlation between the variance map
    and the synthetic comb pattern. Returns ((dy, dx), max_correlation).
    """
    h, w = variance_map.shape
    best_offset = (0, 0)
    best_corr = 0.0

    # Normalize the variance map for correlation
    v_mean = float(np.mean(variance_map))
    v_std = float(np.std(variance_map)) + 1e-8
    v_centered = variance_map - v_mean

    for dy in range(8):
        for dx in range(8):
            comb = _build_comb((h, w), (dy, dx))
            c_mean = float(np.mean(comb))
            c_std = float(np.std(comb)) + 1e-8
            c_centered = comb - c_mean

            # Pearson correlation
            num = float(np.sum(v_centered * c_centered))
            denom = v_std * c_std * h * w
            corr = num / denom if denom > 0 else 0.0

            if corr > best_corr:
                best_corr = corr
                best_offset = (dy, dx)

    return best_offset, best_corr


def analyze_dct_grid_offset(img_array: np.ndarray) -> Dict[str, Any]:
    """
    Run DCT grid sub-pixel offset analysis.

    Parameters
    ----------
    img_array : np.ndarray  shape (H, W, 3) uint8

    Returns
    -------
    dict matching the layer-report schema:
        layerSuspicionScore: 0.20 (real JPEG at (0,0))
                              | 0.65 (cropped-and-recompressed)
                              | 0.55 (no JPEG structure)
    """
    from utils.evidence_builder import build_layer_report, evidence_node

    try:
        # Crop to a multiple of 8 to avoid edge effects in the comb correlation.
        # Also resize for speed (DCT grid signal is block-level, scale-invariant).
        h, w = img_array.shape[:2]
        if max(h, w) > 512:
            from PIL import Image as _PIL
            scale = 512 / max(h, w)
            pil = _PIL.fromarray(img_array)
            pil = pil.resize((int(w * scale), int(h * scale)), _PIL.LANCZOS)
            img_array = np.array(pil)

        h, w = img_array.shape[:2]
        # Crop to multiples of 8
        h8 = (h // 8) * 8
        w8 = (w // 8) * 8
        img_array = img_array[:h8, :w8]

        variance_map = _local_variance_map(img_array)
        offset, corr = _find_grid_offset(variance_map)

        if corr > JPEG_BLOCK_CORR_THRESHOLD and offset == (0, 0):
            # Single JPEG compression, block aligned at (0,0)
            score = 0.20
            status = "normal"
            detail = (f"Strong DCT block correlation ({corr:.3f}) at offset (0,0). "
                      f"Image is a single-generation JPEG — block structure intact.")
        elif corr > JPEG_BLOCK_CORR_THRESHOLD and offset != (0, 0):
            # Offset block structure → cropped-and-recompressed
            score = 0.65
            status = "anomalous"
            detail = (f"DCT block correlation {corr:.3f} peaks at offset (dy={offset[0]}, dx={offset[1]}). "
                      f"Original JPEG was cropped by {offset} before re-encoding — strong splice / "
                      f"inpainting signal.")
        elif corr > NO_JPEG_CORR_THRESHOLD:
            # Weak signal — between thresholds, ambiguous
            score = 0.50
            status = "inconclusive"
            detail = (f"Weak DCT block correlation ({corr:.3f}) at offset {offset}. "
                      f"Image may have been JPEG-compressed but heavily post-processed, "
                      f"or it may be a raw photo. Cannot determine confidently.")
        else:
            # No JPEG structure at all — either never compressed (raw/PNG)
            # or AI-generated (diffusion outputs aren't JPEG-encoded)
            score = 0.55
            status = "anomalous"
            detail = (f"No DCT block structure detected (max correlation {corr:.3f} at offset {offset}). "
                      f"Image has never been JPEG-compressed — either a raw/PNG photo or "
                      f"AI-generated content (diffusion model outputs are not JPEG-encoded).")

        return build_layer_report(
            layer=29,
            layer_name="DCT Grid Sub-Pixel Offset",
            evidence=[
                evidence_node(
                    layer=29,
                    category="dct_grid_offset",
                    artifact_type="block_offset",
                    status=status,
                    confidence=score,
                    detail=detail,
                    raw_value=corr,
                )
            ],
            status="success",
            elapsed_ms=0,
            score=score,
        )

    except Exception as exc:
        logger.warning("[DCTGridOffset][L29] failed: %s", exc, exc_info=True)
        return build_layer_report(
            layer=29,
            layer_name="DCT Grid Sub-Pixel Offset",
            evidence=[],
            status="failure",
            elapsed_ms=0,
            score=0.5,
        )

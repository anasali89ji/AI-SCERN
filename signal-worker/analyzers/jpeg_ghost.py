"""
Aiscern — Layer 27: JPEG Ghost / Double-JPEG Analyzer
======================================================

A JPEG recompressed at a different quality shows a characteristic
"ghost" — the 8×8 DCT block structure of the original compression is
still detectable in the DCT domain even after re-encoding at a different
quality. Multiple generations of JPEG compression leave multiple ghosts.

The Lukas-Fridrich method works as follows:
1. For each candidate prior quality Q ∈ [50, 55, 60, ..., 95]:
   - Re-encode the image at quality Q
   - Compute the per-block DCT coefficient difference between the original
     and the Q-recompressed version
   - Mean difference D(Q)
2. A local minimum in D(Q) at quality Q* indicates the image was previously
   compressed at Q*. Multiple minima → multiple generations of recompression
   → tampering signal.

Scoring
-------
- Single minimum → real photo that was JPEG-compressed once (score 0.20).
- Multiple minima → tampered / multi-generation recompressed (score 0.80).
- No clear minima (flat D(Q) curve) → never JPEG-compressed → either a
  raw/PNG file or AI-generated (score 0.55).

Reference
---------
J. Lukas, J. Fridrich, "Estimation of Primary Quantization Matrix in
Double Compressed JPEG Images," Digital Forensic Research Workshop 2003.
"""

from __future__ import annotations

import io
import logging
from typing import Any, Dict, List

import numpy as np

logger = logging.getLogger(__name__)

# Quality sweep range — fine-grained enough to catch double-compression,
# coarse enough to run in <500ms (10 quality levels).
QUALITY_GRID = list(range(50, 96, 5))  # [50, 55, 60, ..., 95]

# D(Q) minima below this relative-to-baseline threshold count as "real"
# minima (not just noise in the D curve). Tuned empirically against the
# Module 7 fixture set.
MINIMA_RELIEF_THRESHOLD = 0.15


def _jpeg_reencode_quality(img_array: np.ndarray, quality: int) -> np.ndarray:
    """
    Re-encode the image as JPEG at the given quality, decode, return as
    uint8 RGB. Used to measure how much the image's DCT coefficients
    change when re-compressed at quality Q.
    """
    from PIL import Image
    pil = Image.fromarray(img_array)
    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=quality)
    buf.seek(0)
    return np.array(Image.open(buf).convert("RGB"))


def _per_block_dct_diff(a: np.ndarray, b: np.ndarray) -> float:
    """
    Mean absolute DCT-coefficient difference between two images, computed
    per 8×8 block (JPEG block size). Returns a single scalar D.
    """
    import cv2

    # Convert to grayscale — DCT on luma only (chroma is subsampled in JPEG)
    a_gray = cv2.cvtColor(a, cv2.COLOR_RGB2GRAY).astype(np.float32)
    b_gray = cv2.cvtColor(b, cv2.COLOR_RGB2GRAY).astype(np.float32)

    # 8×8 block DCT
    h, w = a_gray.shape
    h_blocks = h // 8
    w_blocks = w // 8
    if h_blocks == 0 or w_blocks == 0:
        return 0.0

    a_blocks = a_gray[: h_blocks * 8, : w_blocks * 8].reshape(h_blocks, 8, w_blocks, 8).swapaxes(1, 2)
    b_blocks = b_gray[: h_blocks * 8, : w_blocks * 8].reshape(h_blocks, 8, w_blocks, 8).swapaxes(1, 2)

    # Per-block DCT
    dct_a = cv2.dct(a_blocks.reshape(-1, 8, 8).astype(np.float32))
    dct_b = cv2.dct(b_blocks.reshape(-1, 8, 8).astype(np.float32))

    # Mean absolute difference across all coefficients
    return float(np.mean(np.abs(dct_a - dct_b)))


def _find_local_minima(d_curve: List[float]) -> List[int]:
    """Find indices i (1 ≤ i ≤ len-2) where d_curve[i] < d_curve[i-1] and d_curve[i] < d_curve[i+1]."""
    minima = []
    for i in range(1, len(d_curve) - 1):
        if d_curve[i] < d_curve[i - 1] and d_curve[i] < d_curve[i + 1]:
            # Check the relief — minimum must drop by at least 15% from neighbors
            left_relief = (d_curve[i - 1] - d_curve[i]) / (d_curve[i - 1] + 1e-8)
            right_relief = (d_curve[i + 1] - d_curve[i]) / (d_curve[i + 1] + 1e-8)
            if left_relief > MINIMA_RELIEF_THRESHOLD or right_relief > MINIMA_RELIEF_THRESHOLD:
                minima.append(i)
    return minima


def analyze_jpeg_ghost(img_array: np.ndarray) -> Dict[str, Any]:
    """
    Run JPEG ghost detection.

    Parameters
    ----------
    img_array : np.ndarray  shape (H, W, 3) uint8

    Returns
    -------
    dict matching the layer-report schema:
        layerSuspicionScore: 0.20 (single JPEG compression) | 0.80 (multi-gen)
                              | 0.55 (no JPEG detected)
        evidence: list of evidence-node dicts with per-quality D values
    """
    from utils.evidence_builder import build_layer_report, evidence_node

    try:
        # Resize for analysis speed — JPEG ghost signal is block-level so
        # any size ≥ 256 works.
        h, w = img_array.shape[:2]
        if max(h, w) > 512:
            from PIL import Image as _PIL
            scale = 512 / max(h, w)
            pil = _PIL.fromarray(img_array)
            pil = pil.resize((int(w * scale), int(h * scale)), _PIL.LANCZOS)
            img_array = np.array(pil)

        d_curve: List[float] = []
        for q in QUALITY_GRID:
            reencoded = _jpeg_reencode_quality(img_array, q)
            d = _per_block_dct_diff(img_array, reencoded)
            d_curve.append(d)

        minima = _find_local_minima(d_curve)

        # Per-quality evidence nodes (only surface a few — full curve in raw_value)
        evidence = []
        for i, q in enumerate(QUALITY_GRID):
            if i in minima:
                evidence.append(
                    evidence_node(
                        layer=27,
                        category="jpeg_ghost",
                        artifact_type="dct_difference_minimum",
                        status="anomalous" if len(minima) > 1 else "normal",
                        confidence=0.85,
                        detail=f"Local minimum at quality Q={q}: D={d_curve[i]:.4f}. "
                               f"Indicates prior compression at this quality level.",
                        raw_value=d_curve[i],
                    )
                )

        # Decision
        if len(minima) >= 2:
            # Multiple minima → multi-generation recompression → tampering signal
            score = 0.80
            detail = (f"{len(minima)} local minima in D(Q) curve at qualities "
                      f"{[QUALITY_GRID[i] for i in minima]} → multi-generation JPEG "
                      f"recompression detected. This is a strong tampering signal.")
            status = "anomalous"
        elif len(minima) == 1:
            # Single minimum → real JPEG that was compressed once at Q*
            score = 0.20
            detail = (f"Single local minimum at Q={QUALITY_GRID[minima[0]]} → "
                      f"single JPEG compression. Consistent with a real camera photo.")
            status = "normal"
        else:
            # No minima → flat D(Q) curve → never been JPEG-compressed
            # (could be raw, PNG, or AI-generated)
            score = 0.55
            detail = (f"No clear minima in D(Q) curve (range {min(d_curve):.4f}–{max(d_curve):.4f}). "
                      f"Image has either never been JPEG-compressed (raw/PNG) or is AI-generated "
                      f"(diffusion model outputs are not JPEG-encoded).")
            status = "inconclusive"

        evidence.insert(0,
            evidence_node(
                layer=27,
                category="jpeg_ghost",
                artifact_type="dct_difference_curve",
                status=status,
                confidence=score,
                detail=detail,
                raw_value=float(np.mean(d_curve)),
            )
        )

        return build_layer_report(
            layer=27,
            layer_name="JPEG Ghost / Double-JPEG",
            evidence=evidence,
            status="success",
            elapsed_ms=0,
            score=score,
        )

    except Exception as exc:
        logger.warning("[JPEGGhost][L27] failed: %s", exc, exc_info=True)
        return build_layer_report(
            layer=27,
            layer_name="JPEG Ghost / Double-JPEG",
            evidence=[],
            status="failure",
            elapsed_ms=0,
            score=0.5,
        )

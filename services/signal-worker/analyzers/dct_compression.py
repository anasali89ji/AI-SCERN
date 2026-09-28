"""
Aiscern Signal Worker — Layer 2: DCT / JPEG Compression Artifact Analysis
Signals: DCT AC-coefficient distribution shape (Laplacian peakedness via
         kurtosis), 8x8 blocking-grid periodicity (BAM-style), and an
         embedded quantization-table check when the source was a real JPEG.

BUG-2: this layer was entirely absent — the layer numbering jumped
1 -> 3 -> 4 -> 5 with no analysis of compression-domain (DCT) artifacts,
which are among the strongest classical signals for distinguishing camera
JPEGs from AI/diffusion output. Natural-image DCT AC coefficients reliably
follow a sharply-peaked Laplacian/generalized-Gaussian distribution — this
assumption is the literal statistical basis JPEG's own entropy coding
relies on — so a flatter, more Gaussian-like coefficient distribution is a
meaningful forensic deviation, not a hand-wavy heuristic.
"""

import time
import numpy as np
import cv2
from PIL import Image

from utils.evidence_builder import evidence_node, build_layer_report

BLOCK = 8
MAX_SAMPLED_BLOCKS = 2000


def _to_gray_float(img_array: np.ndarray) -> np.ndarray:
    return img_array.mean(axis=2).astype(np.float32)


def _sample_block_coords(h: int, w: int, max_blocks: int = MAX_SAMPLED_BLOCKS, seed: int = 42):
    """
    Randomly sample up to max_blocks (top-left) coordinates from the
    non-overlapping 8x8 grid, without materializing every block — keeps
    this fast and memory-light even on large (e.g. 4000x3000) URL-sourced
    images that, unlike the upload path, are never pre-resized.
    """
    n_rows = h // BLOCK
    n_cols = w // BLOCK
    total = n_rows * n_cols
    if total == 0:
        return []
    rng = np.random.RandomState(seed)
    idxs = np.arange(total) if total <= max_blocks else rng.choice(total, max_blocks, replace=False)
    return [(int(i // n_cols) * BLOCK, int(i % n_cols) * BLOCK) for i in idxs]


# ── DCT AC-coefficient peakedness ───────────────────────────────────────────

def dct_ac_kurtosis_suspicion(img_array: np.ndarray) -> tuple:
    """
    Compute a 2D DCT on a sample of 8x8 blocks, pool the 63 AC coefficients
    (all but the DC term) across blocks, and measure the excess kurtosis of
    their distribution.

    Natural camera images: AC coefficients are sharply peaked around 0 with
    heavy tails — excess kurtosis typically well above 3 (often 5-15+).
    AI/diffusion output and heavily-smoothed/denoised images tend toward a
    flatter, more Gaussian-like AC coefficient distribution — lower kurtosis.

    Returns (suspicion_score, detail, excess_kurtosis).
    """
    gray = _to_gray_float(img_array)
    h, w = gray.shape
    if h < BLOCK * 4 or w < BLOCK * 4:
        return 0.5, "Image too small for reliable DCT block analysis", 0.0

    coords = _sample_block_coords(h, w)
    if len(coords) < 20:
        return 0.5, "Insufficient blocks for reliable DCT analysis", 0.0

    ac_coeffs = []
    for y, x in coords:
        block = gray[y:y + BLOCK, x:x + BLOCK] - 128.0  # center like JPEG does
        d = cv2.dct(block)
        ac_coeffs.extend(d.flatten()[1:])  # drop the DC term (index 0)

    ac = np.asarray(ac_coeffs)
    if ac.size < 100:
        return 0.5, "Insufficient AC coefficients sampled", 0.0

    std = float(ac.std())
    if std < 1e-6:
        return 0.6, "AC coefficients are nearly all zero (flat/blank region) — inconclusive", 0.0

    normalized = ac / std
    kurt = float(np.mean(normalized ** 4) - 3.0)  # excess kurtosis (Fisher), normal dist = 0

    if kurt > 4.0:
        score = 0.15
        detail = (f"DCT AC coefficients show strong Laplacian peakedness "
                   f"(excess kurtosis={kurt:.2f}) — consistent with camera JPEG statistics")
    elif kurt < 1.0:
        score = 0.75
        detail = (f"DCT AC coefficients are unusually flat/Gaussian-like "
                   f"(excess kurtosis={kurt:.2f}) — atypical for natural-image compression statistics")
    else:
        score = 0.45
        detail = f"DCT AC coefficient peakedness is moderate (excess kurtosis={kurt:.2f})"

    return score, detail, kurt


# ── 8x8 blocking-grid artifact (BAM-style) ──────────────────────────────────

def blockiness_suspicion(img_array: np.ndarray) -> tuple:
    """
    8x8 blocking-grid artifact measure. JPEG compression (the format almost
    every camera photo shared online has passed through at least once)
    introduces a small but measurable periodic discontinuity at 8-pixel
    block boundaries from independent per-block quantization. Raw output
    straight from a generator (e.g. an uncompressed/PNG diffusion sample)
    usually doesn't show this periodicity.

    NOTE: presence of blocking is only weak-to-moderate evidence of "real"
    (most images circulating online, AI-generated or not, end up
    JPEG-compressed eventually) — its *absence* is the more informative
    half of this signal, so the suspicion range here is intentionally
    capped rather than swinging to a confident "anomalous" verdict alone.

    Returns (suspicion_score, detail, boundary_to_interior_ratio).
    """
    gray = _to_gray_float(img_array)
    h, w = gray.shape
    if h < BLOCK * 8 or w < BLOCK * 8:
        return 0.5, "Image too small for blockiness analysis", 0.0

    col_diff = np.abs(np.diff(gray, axis=1))  # shape (h, w-1)
    row_diff = np.abs(np.diff(gray, axis=0))  # shape (h-1, w)

    boundary_cols = np.arange(BLOCK - 1, w - 1, BLOCK)
    boundary_rows = np.arange(BLOCK - 1, h - 1, BLOCK)
    if len(boundary_cols) == 0 or len(boundary_rows) == 0:
        return 0.5, "Insufficient blocks for blockiness analysis", 0.0

    boundary_energy = float(col_diff[:, boundary_cols].mean() + row_diff[boundary_rows, :].mean())

    col_mask = np.ones(col_diff.shape[1], dtype=bool)
    col_mask[boundary_cols] = False
    row_mask = np.ones(row_diff.shape[0], dtype=bool)
    row_mask[boundary_rows] = False
    interior_energy = float(col_diff[:, col_mask].mean() + row_diff[row_mask, :].mean())

    ratio = boundary_energy / (interior_energy + 1e-6)

    if ratio > 1.25:
        score = 0.30
        detail = f"8x8 block-grid discontinuity detected (boundary/interior ratio={ratio:.3f}) — consistent with JPEG compression history"
    elif ratio < 1.05:
        score = 0.55
        detail = f"No measurable 8x8 block-grid artifact (ratio={ratio:.3f}) — image may never have been JPEG-compressed"
    else:
        score = 0.40
        detail = f"Weak block-grid signal (ratio={ratio:.3f})"

    return score, detail, ratio


# ── Quantization table fingerprint ──────────────────────────────────────────

# IJG standard luminance quantization table (the libjpeg/Pillow default
# baseline shape, used by most generic software encoders).
_IJG_STANDARD_LUMA = np.array([
    16, 11, 10, 16, 24, 40, 51, 61,
    12, 12, 14, 19, 26, 58, 60, 55,
    14, 13, 16, 24, 40, 57, 69, 56,
    14, 17, 22, 29, 51, 87, 80, 62,
    18, 22, 37, 56, 68, 109, 103, 77,
    24, 35, 55, 64, 81, 104, 113, 92,
    49, 64, 78, 87, 103, 121, 120, 101,
    72, 92, 95, 98, 112, 100, 103, 99,
], dtype=np.float64)


def quantization_table_check(img_pil: Image.Image) -> tuple:
    """
    If the source file was an actual JPEG, PIL exposes the embedded
    quantization table(s) via img_pil.quantization. Quantization tables
    scale roughly proportionally with quality, so compare *shape*
    (correlation) against the generic IJG standard table rather than raw
    magnitudes. A close match suggests generic software re-encoding; a
    divergent table suggests a camera/proprietary encoder. This is a weak
    signal on its own (real cameras can also use standard tables) and is
    only ever combined with the other two checks above.

    Returns (suspicion_score, detail, correlation) or
    (0.5, ..., None) when no JPEG quantization table is available.
    """
    qtables = getattr(img_pil, "quantization", None)
    if not qtables or 0 not in qtables:
        return 0.5, "No embedded JPEG quantization table available", None

    table = np.asarray(qtables[0], dtype=np.float64)
    if table.size != 64:
        return 0.5, "Unexpected quantization table size", None

    corr = float(np.corrcoef(table, _IJG_STANDARD_LUMA)[0, 1])

    if corr > 0.97:
        score = 0.55
        detail = f"Quantization table closely matches the generic IJG standard table (corr={corr:.4f}) — consistent with generic software encoding, weak signal alone"
    else:
        score = 0.35
        detail = f"Quantization table diverges from the generic IJG standard table (corr={corr:.4f}) — consistent with a camera/proprietary encoder"

    return score, detail, corr


# ── Main Layer 2 function ───────────────────────────────────────────────────

def analyze_dct_compression(img_array: np.ndarray, img_pil: Image.Image) -> dict:
    start = time.time()
    evidence = []

    kurt_score, kurt_detail, kurt_raw = dct_ac_kurtosis_suspicion(img_array)
    kurt_status = "anomalous" if kurt_score > 0.65 else "normal" if kurt_score < 0.30 else "inconclusive"
    evidence.append(evidence_node(
        layer=2, category="compression_analysis", artifact_type="dct_ac_kurtosis",
        status=kurt_status, confidence=kurt_score, detail=kurt_detail, raw_value=kurt_raw,
    ))

    block_score, block_detail, block_raw = blockiness_suspicion(img_array)
    block_status = "anomalous" if block_score > 0.65 else "normal" if block_score < 0.30 else "inconclusive"
    evidence.append(evidence_node(
        layer=2, category="compression_analysis", artifact_type="blocking_grid",
        status=block_status, confidence=block_score, detail=block_detail, raw_value=block_raw,
    ))

    qt_score, qt_detail, qt_raw = quantization_table_check(img_pil)
    if qt_raw is None:
        qt_status = "not_present"
    else:
        qt_status = "anomalous" if qt_score > 0.65 else "normal" if qt_score < 0.30 else "inconclusive"
    evidence.append(evidence_node(
        layer=2, category="compression_analysis", artifact_type="quantization_table",
        status=qt_status, confidence=qt_score, detail=qt_detail, raw_value=qt_raw,
    ))

    elapsed_ms = int((time.time() - start) * 1000)
    return build_layer_report(2, "Compression Artifacts (DCT)", evidence, "success", elapsed_ms)

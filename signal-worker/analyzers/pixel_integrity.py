"""
Aiscern Signal Worker — Layer 1: Pixel Integrity
Signals: Error Level Analysis (ELA), Local Binary Patterns (LBP),
         Chromatic Aberration detection.
"""

import io
import time
import numpy as np
from PIL import Image
from typing import Optional

from utils.evidence_builder import evidence_node, build_layer_report


# ── Error Level Analysis ──────────────────────────────────────────────────────

def compute_ela(img_pil: Image.Image, quality: int = 90) -> np.ndarray:
    """
    Resave image at given JPEG quality and compute absolute difference.
    Returns per-pixel error map as float32 [H, W].
    """
    buf = io.BytesIO()
    img_pil.convert("RGB").save(buf, format="JPEG", quality=quality)
    buf.seek(0)
    recompressed = np.array(Image.open(buf).convert("RGB"), dtype=np.float32)
    original     = np.array(img_pil.convert("RGB"), dtype=np.float32)
    ela_map      = np.abs(original - recompressed).mean(axis=2)  # [H, W]
    return ela_map


def ela_suspicion(ela_map: np.ndarray, target_regions: list) -> tuple[float, str, float]:
    """
    Compute suspicion score from ELA map.
    AI images often show LOW and UNIFORM ELA (they were never naturally compressed).
    Returns (score, detail, raw_value).
    """
    h, w = ela_map.shape

    # Global stats
    global_std  = float(ela_map.std())
    global_mean = float(ela_map.mean())

    # Block variance: split into 16 tiles, compute std of each block's mean
    block_size = max(h // 4, 1), max(w // 4, 1)
    block_means = []
    for i in range(4):
        for j in range(4):
            block = ela_map[i*block_size[0]:(i+1)*block_size[0],
                            j*block_size[1]:(j+1)*block_size[1]]
            if block.size > 0:
                block_means.append(float(block.mean()))

    block_variance = float(np.std(block_means)) if block_means else 0.0

    # Scoring heuristics:
    # Low global_std = uniform ELA = suspicious
    # Low block_variance = tiles look alike = suspicious
    score = 0.0
    if global_std < 3.0:
        score += 0.40  # Very uniform ELA — strong AI indicator
    elif global_std < 6.0:
        score += 0.20

    if block_variance < 1.5:
        score += 0.35  # All tiles have similar ELA — AI indicator
    elif block_variance < 3.0:
        score += 0.15

    if global_mean < 2.0:
        score += 0.15  # Very low absolute error — nearly perfect, like AI output

    score = min(score, 1.0)
    raw   = round(global_std, 3)
    detail = (
        f"ELA: global_std={global_std:.2f}, block_variance={block_variance:.2f}. "
        f"{'Suspiciously uniform — likely AI' if score > 0.60 else 'Normal ELA variation' if score < 0.30 else 'Moderate ELA anomaly'}"
    )
    return score, detail, raw


# ── Local Binary Patterns ─────────────────────────────────────────────────────

def compute_lbp(gray: np.ndarray, radius: int = 1, n_points: int = 8) -> np.ndarray:
    """Compute LBP texture map (simplified, no scikit-image dep)."""
    h, w = gray.shape
    lbp   = np.zeros((h, w), dtype=np.uint8)
    angles = np.linspace(0, 2 * np.pi, n_points, endpoint=False)

    for idx, angle in enumerate(angles):
        dx = int(round(radius * np.cos(angle)))
        dy = int(round(radius * -np.sin(angle)))

        # Shift the image by (dy, dx) with clipping
        r0, r1 = max(0, dy),  min(h, h + dy)
        c0, c1 = max(0, dx),  min(w, w + dx)
        sr0, sr1 = max(0, -dy), min(h, h - dy)
        sc0, sc1 = max(0, -dx), min(w, w - dx)

        neighbor_patch = gray[sr0:sr1, sc0:sc1]
        center_patch   = gray[r0:r1,   c0:c1]

        min_h = min(neighbor_patch.shape[0], center_patch.shape[0])
        min_w = min(neighbor_patch.shape[1], center_patch.shape[1])

        bit = (neighbor_patch[:min_h, :min_w] >= center_patch[:min_h, :min_w]).astype(np.uint8)
        lbp[r0:r0+min_h, c0:c0+min_w] |= (bit << idx)

    return lbp


def lbp_suspicion(img_array: np.ndarray) -> tuple[float, str, float]:
    """
    LBP texture uniformity check.
    AI images tend to have more uniform (less diverse) texture patterns.
    """
    gray = img_array.mean(axis=2).astype(np.uint8)
    lbp  = compute_lbp(gray)

    # Compute histogram uniformity (chi-squared distance from flat distribution)
    hist, _ = np.histogram(lbp, bins=256, range=(0, 255))
    hist_norm = hist / (hist.sum() + 1e-8)
    uniform   = np.ones(256) / 256.0
    chi2      = float(np.sum((hist_norm - uniform) ** 2 / (uniform + 1e-8)))

    # Lower chi2 = more uniform distribution = more AI-like
    # Natural images have very non-uniform LBP histograms
    if chi2 < 0.05:
        score  = 0.75
        detail = f"LBP histogram is suspiciously uniform (chi2={chi2:.4f}) — AI texture pattern"
    elif chi2 < 0.15:
        score  = 0.45
        detail = f"LBP shows moderate uniformity (chi2={chi2:.4f})"
    else:
        score  = 0.15
        detail = f"LBP histogram shows natural texture diversity (chi2={chi2:.4f})"

    return score, detail, chi2


# ── Chromatic Aberration ──────────────────────────────────────────────────────

def chromatic_aberration_suspicion(img_array: np.ndarray) -> tuple[float, str, float]:
    """
    Real camera lenses produce RGB channel misalignment at edges (chromatic aberration).
    AI generators usually produce perfect per-pixel alignment.
    Check: measure edge-area cross-channel correlation.
    """
    r = img_array[:, :, 0].astype(np.float32)
    g = img_array[:, :, 1].astype(np.float32)
    b = img_array[:, :, 2].astype(np.float32)

    # Sobel edge detection on green channel (most sensitive)
    from scipy import ndimage
    edge_g = ndimage.sobel(g)
    edge_r = ndimage.sobel(r)
    edge_b = ndimage.sobel(b)

    # Threshold to find edge pixels
    edge_mask = np.abs(edge_g) > np.percentile(np.abs(edge_g), 85)

    if edge_mask.sum() < 100:
        return 0.50, "Insufficient edge pixels for chromatic aberration analysis", 0.0

    # Cross-channel alignment at edges: perfect alignment (high corr) = suspicious
    rg_diff = float(np.mean(np.abs(edge_r[edge_mask] - edge_g[edge_mask])))
    bg_diff = float(np.mean(np.abs(edge_b[edge_mask] - edge_g[edge_mask])))
    avg_diff = (rg_diff + bg_diff) / 2.0

    if avg_diff < 1.5:
        score  = 0.72
        detail = f"Near-perfect RGB channel alignment at edges (diff={avg_diff:.2f}) — real lenses produce chromatic aberration"
    elif avg_diff < 4.0:
        score  = 0.40
        detail = f"Minimal chromatic aberration detected (diff={avg_diff:.2f}) — borderline"
    else:
        score  = 0.15
        detail = f"Natural chromatic aberration present (diff={avg_diff:.2f}) — consistent with real lens optics"

    return score, detail, avg_diff


# ── Main Layer 1 function ─────────────────────────────────────────────────────

def analyze_pixel_integrity(
    img_array:      np.ndarray,
    img_pil:        Image.Image,
    target_regions: list,
) -> dict:
    start = time.time()
    evidence = []

    # ELA
    ela_map = compute_ela(img_pil)
    ela_score, ela_detail, ela_raw = ela_suspicion(ela_map, target_regions)
    ela_status = "anomalous" if ela_score > 0.65 else "normal" if ela_score < 0.30 else "inconclusive"
    evidence.append(evidence_node(
        layer=1, category="pixel_integrity", artifact_type="error_level_anomaly",
        status=ela_status, confidence=ela_score, detail=ela_detail, raw_value=ela_raw,
    ))

    # LBP
    lbp_score, lbp_detail, lbp_raw = lbp_suspicion(img_array)
    lbp_status = "anomalous" if lbp_score > 0.65 else "normal" if lbp_score < 0.30 else "inconclusive"
    evidence.append(evidence_node(
        layer=1, category="pixel_integrity", artifact_type="lbp_texture_uniformity",
        status=lbp_status, confidence=lbp_score, detail=lbp_detail, raw_value=lbp_raw,
    ))

    # Chromatic Aberration
    ca_score, ca_detail, ca_raw = chromatic_aberration_suspicion(img_array)
    ca_status = "anomalous" if ca_score > 0.65 else "normal" if ca_score < 0.30 else "inconclusive"
    evidence.append(evidence_node(
        layer=1, category="pixel_integrity", artifact_type="chromatic_aberration_absence",
        status=ca_status, confidence=ca_score, detail=ca_detail, raw_value=ca_raw,
    ))

    elapsed_ms = int((time.time() - start) * 1000)
    return build_layer_report(1, "Pixel Integrity", evidence, "success", elapsed_ms)

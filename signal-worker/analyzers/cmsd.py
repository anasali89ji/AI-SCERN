"""
Aiscern Detection Worker — Layer 23: CMSD
Copy-Move & Splice Detection

Architectural note (Module 12, carry forward from Module 11's L20/L21
precedent)
------------------------------------------------------------------------
The giant-level optimization spec's Section 1.3 layer list (L20-L25) does
not map cleanly onto this repo's actual layer numbering, for two
compounding reasons discovered during Module 12's audit:

  1. Spec L20 (CALDA) was already folded into this repo's existing L21
     (LOP) by Module 11 -- see analyzers/lop.py's module docstring.
  2. This repo's own L22 slot is *not* spec's L22 (AMSA -- AI
     Model-Specific Artifact Detection). It is Document/ID Security
     Forensics (analyzers/document_forensics.py, v4.9.0), added under
     Section 1.1 as a distinct "new capability" sub-module, unrelated to
     the L20-L25 list in Section 1.3.
  3. Spec L21 (PRNU Deep Analysis) was investigated for this module and
     rejected as the next target -- see "Why not PRNU" below.
  4. Spec L22 (AMSA) was investigated and found to already be covered:
     analyzers/ai_fingerprint.py (L9) and analyzers/generative_fingerprint.py
     (L10) already implement generator-family spectral/latent-geometry
     fingerprinting (frequency kurtosis divergence, palette quantization,
     6 calibrated generator-family profiles G1-G6). A third layer here
     would substantially duplicate L9/L10's scope rather than close a
     real gap.

Given that, this module implements spec L23 (Copy-Move & Splice
Detection, "CMSD"), assigned to this repo's next free layer number,
L23. Unlike L20-L22, there is no numbering collision here: no prior
module or pre-existing file claimed "L23" for anything else, and CMSD's
scope (single-image tamper/forgery detection) doesn't overlap L9/L10/L15-19
which are about whether the WHOLE image is AI-generated, not whether
PART of a real image was cloned or spliced in from elsewhere.

Why not PRNU (spec L21) instead
--------------------------------
A pre-existing "PRNU proxy" already exists at L3 (analyzers/noise_stats.py:
prnu_proxy_suspicion) and forensics/noise_analysis.py explicitly documents
the real reason a *deeper* PRNU layer can't be honestly built right now:
"PRNU requires reference fingerprint from known camera" -- true
photo-response non-uniformity forensics (Lukas/Fridrich-style sensor
fingerprint correlation, PCE/NCC matching) is fundamentally a
*cross-image* technique: it needs either (a) multiple images from the
same claimed camera to average out scene content and isolate the fixed
sensor pattern, or (b) a reference fingerprint database of known camera
models -- neither of which this pipeline has for a single uploaded
image. Going deeper than the existing L3 proxy without one of those
inputs would mean re-deriving the same brightness-correlated noise
heuristic L3 and L3's NLF signal already compute, just re-labeled --
exactly the kind of fabricated-depth this workflow's rules prohibit.
This is flagged here explicitly (rather than silently skipped) so the
owner can decide whether to invest in a reference-fingerprint dataset
later; until then, L3's existing PRNU proxy is the honest ceiling for
this signal.

Two forensic signals
---------------------
S1 -- Copy-move (clone) detection: ORB keypoint detection + brute-force
    Hamming matching, restricted to same-image self-matches with a
    minimum spatial separation (to reject trivial adjacent-patch
    matches from repetitive real texture). Matches are converted to
    displacement vectors and clustered; a strong cluster of many
    keypoint pairs sharing (near-)identical translation is exactly the
    signature of a moved-and-pasted region (every point in a cloned
    patch shares the same rigid transform to its source). The largest
    cluster is then verified with a RANSAC-estimated affine transform
    over its own matches, so an accidental repeated-texture coincidence
    (e.g. a brick wall, a picket fence) that only "clusters" loosely
    still gets rejected at the geometric-verification step. This
    replaces the existing L1 clone_detection_suspicion() 5-feature
    block-sort proxy (see analyzers/pixel_integrity.py), which is
    non-rotation/scale-invariant and was explicitly built as a fast
    quick-reject rather than a real detector; that L1 signal is left
    in place (it still contributes a fast, cheap, complementary vote)
    but this S1 is the actual deep implementation the spec asks for.

S2 -- Splice inconsistency: block-wise local noise-residual level
    (same high-pass-residual-std primitive L3/L8 already use) computed
    over a finer grid, then tested for outlier blocks via a
    median-absolute-deviation threshold against the image's dominant
    (majority) noise level. A spliced-in region from a different source
    image (different camera, different compression history, or a
    different point in an AI generation/edit pipeline) very often
    carries a measurably different noise floor than its surroundings,
    even when it's visually seamless. This is a real, distinct
    single-image-computable signal -- it does not require a reference
    fingerprint, only internal self-consistency, so it doesn't have the
    PRNU problem above. Scope note: this detects *noise-level*
    inconsistency specifically; it will not catch a splice from a
    source with matching noise characteristics (e.g. two crops from the
    same camera/session), which is an inherent limit of a
    noise-floor-only signal, not a bug.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from scipy import ndimage

logger = logging.getLogger(__name__)

# ── Tunables ─────────────────────────────────────────────────────────────────
_MIN_KEYPOINTS          = 40     # below this, image has too little texture for ORB matching
_MIN_SEPARATION_PX      = 24     # reject self-matches closer than this (trivial/adjacent)
_CLUSTER_BIN_PX         = 6      # displacement-vector histogram bin size for clustering
_MIN_CLUSTER_SIZE       = 8      # min matches sharing a displacement bin to call it a candidate clone
_RANSAC_REPROJ_THRESH   = 3.0    # px, affine RANSAC inlier threshold
_MIN_RANSAC_INLIERS     = 6      # min verified inliers to call S1 anomalous
_S1_INLIER_ANOMALOUS    = 14     # inlier count considered strongly anomalous
_S2_GRID                = 8      # 8x8 block grid for noise-floor mapping
_S2_MAD_K               = 3.5    # MAD multiplier for outlier-block threshold
_S2_OUTLIER_FRAC_LOW    = 0.02   # real-like: <=2% of blocks are noise-floor outliers
_S2_OUTLIER_FRAC_HIGH   = 0.10   # anomalous: >=10% of blocks are noise-floor outliers


def _to_gray_u8(img: np.ndarray) -> np.ndarray:
    if img.ndim == 3:
        gray = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_RGB2GRAY)
    else:
        gray = img.astype(np.uint8)
    return gray


def _score_band(value: float, real_like: float, ai_like: float) -> float:
    """Map a metric linearly onto [0=real-like, 1=AI-like] between the two
    reference points, clamping outside the band. Handles both increasing
    and decreasing orientations. Copied verbatim from analyzers/lop.py to
    keep the two modules' scoring semantics identical (an earlier
    from-scratch reimplementation here had the interpolation backwards —
    caught by this module's own smoke tests, see test_cmsd_smoke.py)."""
    if real_like == ai_like:
        return 0.5
    frac = (real_like - value) / (real_like - ai_like)
    return float(np.clip(frac, 0.0, 1.0))


# ── S1: Copy-move detection (ORB + displacement clustering + RANSAC) ──────────

def detect_copy_move(img: np.ndarray) -> Optional[Dict[str, Any]]:
    """
    Returns dict with keys: n_inliers, n_candidate_clusters, max_cluster_size,
    displacement (dx, dy) of the verified cluster, or None if too few
    keypoints to attempt matching at all (neutral, not scored).
    """
    gray = _to_gray_u8(img)
    h, w = gray.shape

    # Downscale very large images for speed; ORB/matching cost scales with
    # keypoint count, which scales with resolution.
    max_side = 1024
    scale = 1.0
    if max(h, w) > max_side:
        scale = max_side / max(h, w)
        gray = cv2.resize(gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    orb = cv2.ORB_create(nfeatures=2000, fastThreshold=12)
    kps, descs = orb.detectAndCompute(gray, None)

    if descs is None or len(kps) < _MIN_KEYPOINTS:
        return None

    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
    # Self-match: k=3 to get a couple of candidates past self-match at distance 0
    matches_knn = bf.knnMatch(descs, descs, k=4)

    pts = np.array([kp.pt for kp in kps], dtype=np.float32)
    displacements: List[Tuple[float, float]] = []
    pairs: List[Tuple[int, int]] = []

    for m_list in matches_knn:
        for m in m_list:
            if m.queryIdx == m.trainIdx:
                continue  # trivial self-match (distance 0)
            if m.distance > 40:  # Hamming distance threshold for ORB (256-bit desc)
                continue
            i, j = m.queryIdx, m.trainIdx
            if i >= j:
                continue  # dedupe symmetric pairs, keep i<j canonical
            p1, p2 = pts[i], pts[j]
            sep = float(np.linalg.norm(p1 - p2))
            if sep < _MIN_SEPARATION_PX:
                continue
            displacements.append((float(p2[0] - p1[0]), float(p2[1] - p1[1])))
            pairs.append((i, j))

    if len(displacements) < _MIN_CLUSTER_SIZE:
        return {
            "n_inliers": 0, "n_candidate_clusters": 0, "max_cluster_size": len(displacements),
            "displacement": None,
        }

    # ── Coarse translation-displacement clustering (reporting only) ──────────
    # NOTE (found via smoke testing on a rotated clone, see
    # test_cmsd_smoke.py -- a 25-degree-rotated pasted patch was matched
    # by ORB but produced n_candidate_clusters=0 and was missed entirely):
    # binning on raw (dx, dy) only groups matches that share one *pure
    # translation*. A rotated or scaled clone's keypoint pairs each have a
    # different displacement vector (every point moves by a different
    # amount under rotation about the patch center), so pre-filtering to
    # "the largest single-bin displacement cluster" before RANSAC silently
    # discards every non-translation clone before RANSAC ever sees it.
    # This stat is kept only as an informational count of same-translation
    # candidates; it is NOT used to gate what RANSAC verifies below.
    disp_arr = np.array(displacements)
    bins = np.round(disp_arr / _CLUSTER_BIN_PX).astype(int)
    _, inverse, counts = np.unique(bins, axis=0, return_inverse=True, return_counts=True)
    n_candidate_clusters = int(np.sum(counts >= _MIN_CLUSTER_SIZE))
    max_cluster_size = int(counts.max()) if len(counts) else 0

    # ── RANSAC-verify a single affine transform over the FULL match set ──────
    # estimateAffinePartial2D (translation + rotation + uniform scale) is
    # itself the clustering step: RANSAC finds the largest self-consistent
    # transform among all candidate pairs and reports which survive as
    # inliers, which is exactly what's needed to catch a rotated/scaled
    # clone, not just a pure-translation one.
    src = np.array([pts[i] for i, _ in pairs], dtype=np.float32)
    dst = np.array([pts[j] for _, j in pairs], dtype=np.float32)

    n_inliers = 0
    mean_disp = None
    if len(src) >= 3:
        try:
            M, inlier_mask = cv2.estimateAffinePartial2D(
                src, dst, method=cv2.RANSAC, ransacReprojThreshold=_RANSAC_REPROJ_THRESH,
            )
            if inlier_mask is not None and inlier_mask.sum() > 0:
                mask_flat = inlier_mask.ravel().astype(bool)
                n_inliers = int(mask_flat.sum())
                mean_disp = (disp_arr[mask_flat].mean(axis=0) / scale)
        except cv2.error as e:
            logger.debug("[CMSD/S1] RANSAC estimation failed: %s", e)
            n_inliers = 0

    return {
        "n_inliers": n_inliers,
        "n_candidate_clusters": n_candidate_clusters,
        "max_cluster_size": max_cluster_size,
        "displacement": (float(mean_disp[0]), float(mean_disp[1])) if mean_disp is not None else None,
    }


# ── S2: Splice inconsistency (block noise-floor outliers) ─────────────────────

def detect_splice_noise_inconsistency(img: np.ndarray) -> Optional[Dict[str, Any]]:
    gray = img.mean(axis=2).astype(np.float32) if img.ndim == 3 else img.astype(np.float32)
    h, w = gray.shape

    blurred = ndimage.gaussian_filter(gray, sigma=1.0)
    residual = gray - blurred

    # Flat-region masking: raw residual std over a whole block is dominated
    # by edge/texture content, not the underlying noise floor -- a block
    # straddling a hard edge or busy texture reads as "high noise" even with
    # a perfectly uniform sensor/generation noise floor underneath, which
    # produced false splice-outlier flags on non-spliced test images during
    # smoke testing (an untouched synthetic image scored 0.92 anomalous on
    # this signal before this fix). Standard blind noise-level estimation
    # avoids this by only sampling smooth (low-gradient) pixels; we do the
    # same here via a per-block gradient-magnitude percentile mask.
    gx = ndimage.sobel(gray, axis=1)
    gy = ndimage.sobel(gray, axis=0)
    grad_mag = np.hypot(gx, gy)

    tile_h, tile_w = max(h // _S2_GRID, 8), max(w // _S2_GRID, 8)
    if tile_h < 8 or tile_w < 8:
        return None

    block_stds = []
    positions = []
    for i in range(_S2_GRID):
        for j in range(_S2_GRID):
            block = residual[i * tile_h:(i + 1) * tile_h, j * tile_w:(j + 1) * tile_w]
            block_grad = grad_mag[i * tile_h:(i + 1) * tile_h, j * tile_w:(j + 1) * tile_w]
            if block.size < 32:
                continue
            # Keep only the flattest (lowest-gradient) 40% of pixels in this
            # block so edges/texture in the block don't inflate the estimate.
            thresh = np.percentile(block_grad, 40)
            flat_mask = block_grad <= thresh
            flat_vals = block[flat_mask]
            if flat_vals.size < 16:
                continue  # block is edge-dominated everywhere; skip rather than guess
            block_stds.append(float(flat_vals.std()))
            positions.append((i, j))

    if len(block_stds) < 16:
        return None

    stds = np.array(block_stds)
    median = float(np.median(stds))
    mad = float(np.median(np.abs(stds - median))) + 1e-8

    outlier_mask = np.abs(stds - median) > (_S2_MAD_K * mad)
    outlier_frac = float(outlier_mask.sum()) / len(stds)

    return {
        "outlier_frac": outlier_frac,
        "n_blocks": len(stds),
        "n_outliers": int(outlier_mask.sum()),
        "median_noise_std": median,
    }


# ── Main entry point ───────────────────────────────────────────────────────

def analyze_cmsd(img: np.ndarray, img_pil: Any = None) -> Dict[str, Any]:
    """
    Layer 23 — Copy-Move & Splice Detection. Returns the same
    {score, status, evidence, elapsed_ms} shape as analyzers/lop.py's
    analyze_lop(), consumed by the same kind of thin ensemble wrapper
    pattern used for L20/L21/L22.
    """
    t0 = time.monotonic()
    evidence: List[Dict[str, Any]] = []
    active_signals = 0

    try:
        # S1 — Copy-move
        cm = detect_copy_move(img)
        if cm is None:
            evidence.append({
                "name": "copy_move_insufficient_texture", "score": 0.5,
                "detail": "too few ORB keypoints (image too small, too smooth, or too "
                          "low-contrast) to attempt copy-move matching reliably",
            })
        else:
            n_inl = cm["n_inliers"]
            if n_inl >= _MIN_RANSAC_INLIERS:
                s1_score = float(np.clip(
                    (n_inl - _MIN_RANSAC_INLIERS) / max(_S1_INLIER_ANOMALOUS - _MIN_RANSAC_INLIERS, 1),
                    0.0, 1.0,
                )) * 0.5 + 0.5  # map to [0.5, 1.0]
                dx, dy = cm["displacement"] or (0.0, 0.0)
                evidence.append({
                    "name": "copy_move_ransac_verified", "score": round(s1_score, 4),
                    "detail": f"n_inliers={n_inl} (of {cm['max_cluster_size']} candidates in "
                              f"dominant displacement cluster), displacement=({dx:.1f},{dy:.1f})px "
                              f"— RANSAC-verified rigid transform shared by multiple keypoint pairs, "
                              f"consistent with a moved-and-pasted region.",
                })
                active_signals += 1
            else:
                # No verified clone; low/neutral score. Distinguish "some loose
                # clustering but not geometrically verified" (mildly informative,
                # e.g. repetitive real texture) from "nothing at all".
                s1_score = 0.15 if cm["n_candidate_clusters"] > 0 else 0.05
                evidence.append({
                    "name": "copy_move_no_verified_clone", "score": s1_score,
                    "detail": f"n_candidate_clusters={cm['n_candidate_clusters']}, "
                              f"largest cluster={cm['max_cluster_size']} matches but only "
                              f"{n_inl} survived RANSAC affine verification "
                              f"(need >={_MIN_RANSAC_INLIERS}) — no geometrically-consistent "
                              f"clone found.",
                })
                active_signals += 1

        # S2 — Splice noise-floor inconsistency
        sp = detect_splice_noise_inconsistency(img)
        if sp is None:
            evidence.append({
                "name": "splice_insufficient_resolution", "score": 0.5,
                "detail": "image too small to build a reliable 8x8 noise-floor block grid",
            })
        else:
            frac = sp["outlier_frac"]
            s2_score = _score_band(frac, _S2_OUTLIER_FRAC_LOW, _S2_OUTLIER_FRAC_HIGH)
            evidence.append({
                "name": "splice_noise_floor_outliers", "score": round(s2_score, 4),
                "detail": f"{sp['n_outliers']}/{sp['n_blocks']} blocks ({frac*100:.1f}%) have a "
                          f"noise-residual std deviating >{_S2_MAD_K}xMAD from the image's "
                          f"dominant noise floor (median_std={sp['median_noise_std']:.3f}) "
                          f"(real-like: <{_S2_OUTLIER_FRAC_LOW*100:.0f}%, "
                          f"anomalous: >{_S2_OUTLIER_FRAC_HIGH*100:.0f}%). Detects noise-level "
                          f"mismatch only — a splice from a source with matching noise "
                          f"characteristics would not be caught by this signal.",
            })
            active_signals += 1

        if active_signals == 0:
            elapsed = int((time.monotonic() - t0) * 1000)
            return {
                "score": 0.5, "status": "success",
                "evidence": evidence, "elapsed_ms": elapsed,
            }

        overall = float(np.mean([e["score"] for e in evidence]))
        elapsed = int((time.monotonic() - t0) * 1000)
        return {
            "score": round(overall, 4),
            "status": "success",
            "evidence": evidence,
            "elapsed_ms": elapsed,
        }

    except Exception as e:
        logger.warning("[CMSD/L23] analysis failed: %s", e)
        elapsed = int((time.monotonic() - t0) * 1000)
        return {"score": 0.5, "status": "failure", "evidence": [], "elapsed_ms": elapsed}

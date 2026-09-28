"""
Aiscern Detection Worker — Layer 24: TCA
Temporal Coherence Analysis (single-image-applicable subset)

Architectural note (Module 14, carry forward from Module 12/13's L20-L23
precedent)
------------------------------------------------------------------------
The giant-level optimization spec's L24 is titled "Temporal Coherence
Analysis (for video frames)" and defines three sub-signals:

  S1 — Interlacing Detection (single-image-computable)
  S2 — Motion Blur Consistency (single-image-computable)
  S3 — Frame Repeat Detection ("For video analysis" per the spec's own
       text — requires comparing MULTIPLE frames, which a single
       uploaded image fundamentally cannot provide)

Despite the "(for video frames)" title, the spec's own S1/S2 descriptions
explicitly scope them to single images: "Even for single images, analyze
if the image could be a frame from a video." S1 and S2 are genuinely
computable here; S3 is not, for the same structural reason PRNU cross-
image correlation wasn't (Module 12): it needs an input this pipeline
doesn't have for a single upload. S3 belongs to the video engine
(Section 4 of the giant-level spec), not here. This is flagged
explicitly rather than fabricating a single-frame proxy for a
fundamentally multi-frame signal.

Two forensic signals implemented
----------------------------------
S1 — Interlacing (comb-artifact) detection: real interlaced video
    (legacy broadcast capture, some camcorder/CCTV formats) weaves two
    temporally-offset fields into alternating scanlines. At motion
    edges this produces a characteristic period-2 "comb" pattern:
    vertical row-to-row difference energy alternates sharply between
    adjacent-row pairs. We measure the column-averaged absolute
    vertical gradient as a 1D signal indexed by row, then check what
    fraction of its (DC-removed) spectral energy concentrates at the
    Nyquist frequency (period=2) versus the rest of the spectrum. A
    real interlaced frame concentrates energy there; a progressive
    photo or an AI image (which was never fields-of-a-video to begin
    with) does not.
    Scoring note: this is a one-directional signal, same as several
    existing PAFRA/QESM sub-checks — interlacing PRESENT is real-like
    evidence (AI generators don't synthesize field-interleaving
    artifacts), but interlacing ABSENT is uninformative (the vast
    majority of real, non-video-sourced photos are progressive too),
    so absence is scored neutral (0.5), not pushed toward "AI-like".

S2 — Motion blur direction consistency: only evaluated when the image
    actually contains meaningful directional (anisotropic) blur in the
    first place (most sharp photos don't, and lack of blur is
    uninformative — scored neutral, same reasoning as S1's absence
    case). Where blur IS present, per-block local structure tensors
    (2x2 second-moment matrix from Sobel gradients) give each block's
    blur anisotropy (eigenvalue ratio) and dominant blur angle
    (eigenvector orientation). Real camera motion blur (handheld shake,
    panning) comes from ONE physical camera trajectory during the
    exposure, so blurred background regions across the frame should
    share a consistent blur angle. We measure the circular variance of
    blur angle across all sufficiently-anisotropic blocks: low
    variance (angles agree) is real-like; high variance (angles
    disagree with no shared physical cause) is AI-like — consistent
    with the existing L18 TSAD finding that synthesized blur/texture
    often lacks the single coherent physical process real optics and
    real motion enforce.
    Scope note: this only checks BACKGROUND-region angle consistency
    across the frame; it cannot separate independently-moving
    foreground subjects (which legitimately have a different blur
    angle/magnitude than a panned background) from a genuine
    inconsistency, since that requires object segmentation this module
    doesn't have. A photo with one blurred foreground subject against
    a sharp or differently-blurred background may register as
    "inconsistent" even though it's physically normal — flagged here
    rather than silently assumed away.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ── Tunables ─────────────────────────────────────────────────────────────────
_MIN_DIM_FOR_TCA        = 64     # below this, too small to compute either signal meaningfully

# S1 — Interlacing
_S1_MIN_GRAD_ENERGY     = 1.0    # min mean |vertical gradient| to attempt the check at all
_S1_COMB_RATIO_REAL     = 2.2    # real-like (interlaced): cross-field diff >=2.2x within-field diff
_S1_COMB_RATIO_NONE     = 1.15   # below this: no meaningful comb signature -> neutral, not AI-like

# S2 — Motion blur consistency
_S2_GRID                = 6      # 6x6 block grid
_S2_MIN_ANISOTROPY      = 0.35   # eigenvalue-ratio threshold for "this block has directional blur"
_S2_MIN_HIGH_GRAD_FRAC  = 0.15   # min fraction of block that must be high-gradient (rules out a single thin edge)
_S2_MIN_BLURRED_BLOCKS  = 6      # min qualifying blocks before we trust a consistency measurement
_S2_CIRCVAR_LOW         = 0.06   # real-like: low circular variance (angles agree) -- note LOW value here
_S2_CIRCVAR_HIGH        = 0.35   # AI-like: high circular variance (angles disagree)


def _to_gray_f32(img: np.ndarray) -> np.ndarray:
    if img.ndim == 3:
        return cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
    return img.astype(np.float32)


def _score_band(value: float, real_like: float, ai_like: float) -> float:
    """Map a metric linearly onto [0=real-like, 1=AI-like] between the two
    reference points, clamping outside the band. Copied verbatim from
    analyzers/lop.py (and analyzers/cmsd.py) to keep scoring semantics
    identical across modules -- see cmsd.py's docstring for why an
    earlier from-scratch reimplementation of this exact function had a
    real, smoke-test-caught bug."""
    if real_like == ai_like:
        return 0.5
    frac = (real_like - value) / (real_like - ai_like)
    return float(np.clip(frac, 0.0, 1.0))


# ── S1: Interlacing / comb-artifact detection ──────────────────────────────

def detect_interlacing(img: np.ndarray) -> Optional[Dict[str, Any]]:
    """
    Field-difference comb detection. Direct field-difference comparison,
    not the FFT/Nyquist-spectral-peak approach tried first: that version
    measured mean |row[i+1]-row[i]| averaged over columns and looked for
    row-index alternation in that 1D signal, but a horizontally-shifted-
    field synthetic fixture produces roughly EQUAL diff magnitude at
    every row transition (both even->odd and odd->even boundaries carry
    the same misalignment error), not literal alternation in that
    reduced 1D signal -- so it never separated interlaced from
    progressive fixtures at all (caught by smoke testing). This version
    compares CROSS-field row differences (even row vs its odd neighbor)
    against WITHIN-field row differences (row k vs row k+2, same
    parity) directly: real field interleaving makes cross-field
    differences much larger than within-field differences, since
    within a single field, adjacent-parity rows come from one
    consistent moment/scan and vary smoothly, while cross-field rows
    come from two different moments.
    """
    gray = _to_gray_f32(img)
    h, w = gray.shape
    if h < _MIN_DIM_FOR_TCA:
        return None
    if h < 8:
        return None

    even = gray[0:h - 1:2, :]
    odd = gray[1:h:2, :]
    n_pairs = min(len(even), len(odd))
    if n_pairs < 8:
        return None
    cross_diff = float(np.mean(np.abs(even[:n_pairs] - odd[:n_pairs])))

    even_rows = gray[0::2, :]
    odd_rows = gray[1::2, :]
    within_even = float(np.mean(np.abs(even_rows[:-1] - even_rows[1:]))) if len(even_rows) > 1 else 0.0
    within_odd = float(np.mean(np.abs(odd_rows[:-1] - odd_rows[1:]))) if len(odd_rows) > 1 else 0.0
    within_avg = (within_even + within_odd) / 2.0

    mean_energy = float(np.mean(np.abs(np.diff(gray, axis=0))))
    if mean_energy < _S1_MIN_GRAD_ENERGY:
        return {"applicable": False, "reason": "flat_image_insufficient_vertical_gradient"}

    comb_ratio = cross_diff / (within_avg + 1e-6)

    return {
        "applicable": True,
        "comb_ratio": comb_ratio,
        "cross_diff": cross_diff,
        "within_diff": within_avg,
    }


# ── S2: Motion blur direction consistency ──────────────────────────────────

def _block_structure_tensor(gray_block: np.ndarray) -> Optional[Dict[str, float]]:
    gx = cv2.Sobel(gray_block, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray_block, cv2.CV_32F, 0, 1, ksize=3)
    Gxx = float((gx * gx).mean())
    Gyy = float((gy * gy).mean())
    Gxy = float((gx * gy).mean())

    trace = Gxx + Gyy
    if trace < 1e-6:
        return None  # essentially flat block, no structure to measure

    # Gradient-density gate: a single straight edge crossing an otherwise
    # flat block (e.g. one object boundary) produces the SAME anisotropic
    # structure-tensor signature as genuine motion blur -- both concentrate
    # gradient energy into one dominant orientation. This isn't a
    # hypothetical concern: it fired on every solid-rectangle synthetic
    # fixture used to test S1 (10/8 blocks flagged as "blurred" on
    # perfectly sharp images), caught by smoke testing. The distinguishing
    # feature is spatial extent: true motion blur smears gradient energy
    # across the texture/edges throughout the block, while a single sharp
    # edge concentrates it into a thin (~1-2px-wide) line occupying a small
    # fraction of the block's area. Require the high-gradient region to
    # cover a non-trivial share of the block before trusting its angle as
    # a "blur direction" at all.
    grad_mag = np.hypot(gx, gy)
    high_grad_thresh = grad_mag.mean() + grad_mag.std()
    high_grad_frac = float(np.mean(grad_mag > high_grad_thresh)) if grad_mag.std() > 1e-6 else 0.0
    if high_grad_frac < _S2_MIN_HIGH_GRAD_FRAC:
        return None  # likely a single edge/boundary, not blur -- skip this block

    # Eigenvalues of [[Gxx, Gxy], [Gxy, Gyy]]
    disc = np.sqrt(max((Gxx - Gyy) ** 2 + 4 * Gxy ** 2, 0.0))
    lam1 = (trace + disc) / 2.0
    lam2 = (trace - disc) / 2.0
    anisotropy = (lam1 - lam2) / (trace + 1e-9)
    # Dominant orientation of the elongated gradient structure (blur runs
    # PERPENDICULAR to the dominant gradient direction, i.e. along the
    # low-variance eigenvector -- add 90 deg / pi/2 to convert).
    angle = 0.5 * np.arctan2(2 * Gxy, (Gxx - Gyy))
    blur_angle = angle + np.pi / 2.0

    return {"anisotropy": float(anisotropy), "angle": float(blur_angle)}


def detect_motion_blur_consistency(img: np.ndarray) -> Optional[Dict[str, Any]]:
    gray = _to_gray_f32(img)
    h, w = gray.shape
    if h < _MIN_DIM_FOR_TCA or w < _MIN_DIM_FOR_TCA:
        return None

    tile_h, tile_w = max(h // _S2_GRID, 8), max(w // _S2_GRID, 8)
    if tile_h < 8 or tile_w < 8:
        return None

    angles: List[float] = []
    for i in range(_S2_GRID):
        for j in range(_S2_GRID):
            block = gray[i * tile_h:(i + 1) * tile_h, j * tile_w:(j + 1) * tile_w]
            if block.size < 64:
                continue
            st = _block_structure_tensor(block)
            if st is None:
                continue
            if st["anisotropy"] >= _S2_MIN_ANISOTROPY:
                angles.append(st["angle"])

    if len(angles) < _S2_MIN_BLURRED_BLOCKS:
        return {"applicable": False, "n_blurred_blocks": len(angles),
                "reason": "too_few_directionally_blurred_blocks"}

    # Circular variance over angle*2 (blur direction is axial/undirected --
    # a block blurred "at 30 degrees" is indistinguishable from "210
    # degrees", so double the angle before averaging on the unit circle,
    # matching standard axial-data statistics, then the circular variance
    # is 1 - |mean resultant length|.
    theta2 = np.array(angles) * 2.0
    C = float(np.mean(np.cos(theta2)))
    S = float(np.mean(np.sin(theta2)))
    R = float(np.hypot(C, S))
    circ_var = 1.0 - R

    return {
        "applicable": True,
        "circ_var": circ_var,
        "n_blurred_blocks": len(angles),
    }


# ── Main entry point ───────────────────────────────────────────────────────

def analyze_tca(img: np.ndarray, img_pil: Any = None) -> Dict[str, Any]:
    """
    Layer 24 — Temporal Coherence Analysis (single-image-applicable
    subset: S1 interlacing, S2 motion-blur consistency). Same
    {score, status, evidence, elapsed_ms} shape as analyzers/cmsd.py's
    analyze_cmsd().
    """
    t0 = time.monotonic()
    evidence: List[Dict[str, Any]] = []
    active_signals = 0

    try:
        # S1 — Interlacing
        s1 = detect_interlacing(img)
        if s1 is None:
            evidence.append({
                "name": "interlacing_insufficient_resolution", "score": 0.5,
                "detail": "image too small to compute a reliable row-difference spectrum",
            })
        elif not s1.get("applicable", False):
            evidence.append({
                "name": "interlacing_not_applicable", "score": 0.5,
                "detail": s1.get("reason", "not applicable"),
            })
        else:
            frac = s1["comb_ratio"]
            if frac >= _S1_COMB_RATIO_REAL:
                s1_score = 0.05  # strong comb signature -> real-like (genuine field interleaving)
                status_note = "comb artifact detected"
            elif frac <= _S1_COMB_RATIO_NONE:
                s1_score = 0.5  # absence is uninformative, see docstring -- NOT pushed AI-like
                status_note = "no comb signature (uninformative -- most real photos aren't interlaced either)"
            else:
                # Partial signature: interpolate between neutral (0.5) and
                # strongly-real (0.05) only -- absence side is never
                # AI-like, consistent with the one-directional design.
                t = (frac - _S1_COMB_RATIO_NONE) / (_S1_COMB_RATIO_REAL - _S1_COMB_RATIO_NONE)
                s1_score = 0.5 - t * 0.45
                status_note = "partial comb signature"
            evidence.append({
                "name": "interlacing_comb_signature", "score": round(float(s1_score), 4),
                "detail": f"comb_ratio={frac:.3f} (cross-field / within-field row-difference; "
                          f"{status_note}); one-directional signal — presence is real-like "
                          f"evidence, absence is neutral, never scored AI-like.",
            })
            active_signals += 1

        # S2 — Motion blur consistency
        s2 = detect_motion_blur_consistency(img)
        if s2 is None:
            evidence.append({
                "name": "motion_blur_insufficient_resolution", "score": 0.5,
                "detail": "image too small to build a reliable block grid for structure-tensor analysis",
            })
        elif not s2.get("applicable", False):
            evidence.append({
                "name": "motion_blur_not_applicable", "score": 0.5,
                "detail": f"only {s2.get('n_blurred_blocks', 0)} block(s) show meaningful directional "
                          f"blur (need >={_S2_MIN_BLURRED_BLOCKS}) — image is sharp or blur is too "
                          f"localized to assess consistency; uninformative, not scored AI-like.",
            })
        else:
            cv = s2["circ_var"]
            s2_score = _score_band(cv, _S2_CIRCVAR_LOW, _S2_CIRCVAR_HIGH)
            evidence.append({
                "name": "motion_blur_direction_consistency", "score": round(s2_score, 4),
                "detail": f"circular_variance={cv:.3f} across {s2['n_blurred_blocks']} directionally-"
                          f"blurred blocks (real-like: <{_S2_CIRCVAR_LOW:.2f} consistent single-"
                          f"trajectory blur angle, AI-like: >{_S2_CIRCVAR_HIGH:.2f} incoherent angles). "
                          f"Cannot separate an independently-moving foreground subject from a genuine "
                          f"inconsistency (no object segmentation available) — see module docstring.",
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
        logger.warning("[TCA/L24] analysis failed: %s", e)
        elapsed = int((time.monotonic() - t0) * 1000)
        return {"score": 0.5, "status": "failure", "evidence": [], "elapsed_ms": elapsed}

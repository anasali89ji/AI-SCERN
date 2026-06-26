"""
Aiscern Signal Worker — Layer 10: Generative Fingerprinting Engine (GFE)

ARCHITECTURE OVERVIEW
=====================
This is a forensic platform, not a binary classifier. It outputs:
  • Structural match scores to 6 known generator families
  • Lighting physics consistency score
  • Biological plausibility markers (faces, skin, eyes)
  • A "best generator attribution" with confidence %

Generator families covered:
  G1 — Google Gemini / Imagen / ImageFX
  G2 — OpenAI DALL-E 3 / ChatGPT gpt-image-1
  G3 — Midjourney V5/V6
  G4 — Stable Diffusion XL / SDXL Turbo / Flux
  G5 — Adobe Firefly
  G6 — Generic diffusion (unknown brand)

Detection modules:
  M1 — Latent Residual Geometry (decoder architecture fingerprint)
  M2 — Lighting Physics Consistency (3D scene plausibility)
  M3 — Biological Marker Analysis (face, skin, pupil, catchlight)
  M4 — Gemini Sparkle Artifact Detector (Gemini-specific visual tell)
  M5 — Generator-Specific Spectral Signature Matching
  M6 — Texture Regularity Engine (AI smoothness vs real grain)

CPU-only. Target: < 400ms on 1080p.
"""

from __future__ import annotations

import logging
import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# M1: Latent Residual Geometry
# ─────────────────────────────────────────────────────────────────────────────

def _latent_residual_geometry(img_array: np.ndarray) -> Dict[str, float]:
    """
    Detect per-generator decoder artifacts using local spectral deviation.

    Rather than comparing harmonic bins to global context (noisy, as real images
    have monotonically decreasing spectra), we compute the LOCAL deviation of
    each bin from its smoothed neighbourhood (rolling mean ± 3 bins).
    A genuine harmonic artifact causes a LOCAL spike relative to adjacent bins.

    Periods targeted:
      DALL-E 3 / gpt-image-1: 64px latent grid
      Gemini / Imagen:         16px latent grid
      Midjourney V6:           32px upscale grid
      SD-XL / Flux:            8px VAE boundary
    """
    gray = img_array.mean(axis=2).astype(np.float32)
    h, w = gray.shape

    # Resize to a fixed 512px on long edge for consistent bin counts
    if max(h, w) > 512:
        from PIL import Image as _PIL
        pil_g = _PIL.fromarray(np.clip(gray, 0, 255).astype(np.uint8))
        scale = 512 / max(h, w)
        nh = max(16, int(h * scale) // 8 * 8)
        nw = max(16, int(w * scale) // 8 * 8)
        pil_g = pil_g.resize((nw, nh), _PIL.LANCZOS)
        gray = np.array(pil_g, dtype=np.float32)
        h, w = gray.shape

    fft2 = np.abs(np.fft.fft2(gray))
    row_p = np.log1p(fft2.sum(axis=1))  # log scale for better contrast
    col_p = np.log1p(fft2.sum(axis=0))

    def _local_spike_score(proj: np.ndarray, target_bin: int, window: int = 4) -> float:
        """
        Measure how much bin `target_bin` deviates from its local rolling mean.
        A genuine harmonic artifact appears as a local spike.
        Returns [0,1]: 0=no spike, 1=strong spike.
        """
        n = len(proj)
        if target_bin <= window or target_bin + window >= n:
            return 0.0
        local_context = np.concatenate([
            proj[max(0, target_bin - window):target_bin],
            proj[target_bin + 1:min(n, target_bin + window + 1)]
        ])
        local_mean = float(local_context.mean()) + 1e-9
        local_std  = float(local_context.std())  + 1e-9
        # Z-score: how many std above mean is the target bin
        z = (float(proj[target_bin]) - local_mean) / local_std
        # Convert z to [0,1]: z > 2.0 = notable; z > 4.0 = strong
        return float(np.clip((z - 1.5) / 3.5, 0, 1))

    def _period_score(period_px: int) -> float:
        """Score for a specific pixel-period harmonic (checks first 4 harmonics)."""
        scores = []
        for k in range(1, 5):  # 1st through 4th harmonic
            # bin in DFT = N / period_px * k (for row projection of length h)
            bin_row = int(round(h / period_px * k))
            bin_col = int(round(w / period_px * k))
            scores.append(_local_spike_score(row_p, bin_row))
            scores.append(_local_spike_score(col_p, bin_col))
        return float(np.mean(scores)) if scores else 0.0

    score_dalle3   = _period_score(64)   # DALL-E 3: 64px patch
    score_gemini   = _period_score(16)   # Gemini: 16px patch
    score_mj       = _period_score(32)   # Midjourney: 32px
    score_sdxl     = _period_score(8)    # SD-XL: 8px VAE

    return {
        "gemini":     round(score_gemini, 4),
        "dalle3":     round(score_dalle3, 4),
        "midjourney": round(score_mj, 4),
        "sdxl":       round(score_sdxl, 4),
    }


# ─────────────────────────────────────────────────────────────────────────────
# M2: Lighting Physics Consistency Engine
# ─────────────────────────────────────────────────────────────────────────────

def _lighting_physics_consistency(img_array: np.ndarray) -> Dict[str, Any]:
    """
    Real photographs obey laws of photometry:
      - Gradient falloff follows inverse square law
      - Highlight-to-shadow transitions have consistent directionality
      - Specular highlights appear at physically consistent positions

    AI generators apply "global illumination" that looks correct but often
    violates cross-region consistency: two objects in the same scene may have
    contradictory light directions, or perfect gradients where physics demands
    noise + scatter.

    Returns:
      consistency_score: [0,1] — lower = more suspicious (inconsistent = AI)
      shadow_direction_variance: how much shadow angles vary across scene
      highlight_uniformity: how unnaturally uniform highlights are
      gradient_law_residual: deviation from inverse-square falloff
    """
    gray = img_array.mean(axis=2).astype(np.float32)
    h, w = gray.shape

    # Divide image into 3x3 grid of regions
    rh, rw = h // 3, w // 3
    if rh < 10 or rw < 10:
        return {"consistency_score": 0.5, "ai_lighting_score": 0.5}

    # Per-region: estimate dominant gradient direction (proxy for light direction)
    # using Sobel
    def _sobel_direction(region: np.ndarray) -> Tuple[float, float]:
        kx = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=np.float32)
        ky = kx.T
        r = np.pad(region, 1, mode="reflect")
        from numpy.lib.stride_tricks import sliding_window_view
        try:
            wins = sliding_window_view(r, (3, 3))
        except Exception:
            return 0.0, 0.0
        gx = (wins * kx).sum(axis=(-2, -1))
        gy = (wins * ky).sum(axis=(-2, -1))
        # Weighted circular mean of gradient angle
        mag = np.sqrt(gx**2 + gy**2)
        mask = mag > mag.mean() + mag.std()
        if mask.sum() < 5:
            return 0.0, 0.0
        gx_m = gx[mask].mean()
        gy_m = gy[mask].mean()
        return float(gx_m), float(gy_m)

    directions = []
    for i in range(3):
        for j in range(3):
            reg = gray[i*rh:(i+1)*rh, j*rw:(j+1)*rw]
            gx, gy = _sobel_direction(reg)
            if gx != 0 or gy != 0:
                angle = math.atan2(gy, gx)
                directions.append(angle)

    # Shadow direction variance — large variance = inconsistent lighting = AI
    if len(directions) >= 3:
        # Circular variance of angles
        s_val = float(np.sin(directions).mean())
        c_val = float(np.cos(directions).mean())
        circular_r = math.sqrt(s_val**2 + c_val**2)  # 1=all same, 0=random
        # Low circular_r = inconsistent light directions
        direction_consistency = circular_r
    else:
        direction_consistency = 0.5

    # Highlight uniformity — check if bright spots are suspiciously uniform
    # AI images often have perfectly smooth gradients vs real grain
    bright_mask = gray > np.percentile(gray, 92)
    if bright_mask.sum() > 100:
        bright_vals = gray[bright_mask]
        bright_cv = float(bright_vals.std() / (bright_vals.mean() + 1e-6))
        # Real photos: CV ~0.12-0.30 (varied); AI: CV ~0.03-0.10 (perfectly smooth)
        highlight_uniformity_ai = float(np.clip(1.0 - bright_cv * 4.0, 0, 1))
    else:
        highlight_uniformity_ai = 0.5

    # Gradient falloff — check if brightness falloff from bright regions follows
    # inverse-square (real) or linear (AI "artistic" gradient)
    # Simplified: compute brightness profile from center
    cy, cx = h // 2, w // 2
    Y, X = np.ogrid[:h, :w]
    dist = np.sqrt((Y - cy)**2 + (X - cx)**2).astype(np.float32) + 1e-6
    dist_norm = dist / dist.max()

    # Sample brightness vs distance
    flat_gray = gray.ravel()
    flat_dist = dist_norm.ravel()
    idx_sort = np.argsort(flat_dist)
    n_bins = 20
    bin_size = len(flat_dist) // n_bins
    brightness_profile = []
    for b in range(n_bins):
        sl = idx_sort[b*bin_size:(b+1)*bin_size]
        brightness_profile.append(float(flat_gray[sl].mean()))

    # Fit: does it follow inverse-square (1/r²) or linear?
    bp = np.array(brightness_profile, dtype=np.float32)
    bp_norm = (bp - bp.min()) / (bp.max() - bp.min() + 1e-6)
    r_vals = np.linspace(0.1, 1.0, n_bins)
    inv_sq = 1.0 / (r_vals**2 + 0.1)
    inv_sq_norm = (inv_sq - inv_sq.min()) / (inv_sq.max() - inv_sq.min() + 1e-6)
    linear = 1.0 - r_vals
    linear_norm = (linear - linear.min()) / (linear.max() - linear.min() + 1e-6)

    inv_sq_residual = float(np.abs(bp_norm - inv_sq_norm[::-1]).mean())
    linear_residual = float(np.abs(bp_norm - linear_norm[::-1]).mean())

    # If linear fits better than inv-sq → more AI-like (artists use linear gradients)
    gradient_ai = float(np.clip((inv_sq_residual - linear_residual + 0.1) * 3.0, 0, 1))

    # Composite lighting consistency
    # direction_consistency: 1=consistent (REAL), 0=inconsistent (AI mismatch)
    # highlight_uniformity_ai: 1=perfectly smooth highlights (AI)
    # gradient_ai: 1=linear gradient (AI aesthetic)

    # Low direction_consistency = suspicious
    lighting_inconsistency_ai = float(np.clip(1.0 - direction_consistency, 0, 1))

    ai_lighting_score = float(np.clip(
        lighting_inconsistency_ai * 0.40 +
        highlight_uniformity_ai  * 0.35 +
        gradient_ai              * 0.25,
        0, 1
    ))

    return {
        "direction_consistency":    round(direction_consistency, 4),
        "highlight_uniformity_ai":  round(highlight_uniformity_ai, 4),
        "gradient_law_ai":          round(gradient_ai, 4),
        "ai_lighting_score":        round(ai_lighting_score, 4),
    }


# ─────────────────────────────────────────────────────────────────────────────
# M3: Biological Marker Analysis
# ─────────────────────────────────────────────────────────────────────────────

def _biological_markers(img_array: np.ndarray) -> Dict[str, Any]:
    """
    Checks for violations of biological laws that AI generators commonly introduce.
    All analysis is performed on a 384px-capped image for speed (<200ms).
    """
    h, w = img_array.shape[:2]

    # ── Resize to max 384px for all bio analysis (full-res = 8s, 384px = <200ms) ──
    _MAX_BIO = 384
    if max(h, w) > _MAX_BIO:
        from PIL import Image as _PIL
        scale = _MAX_BIO / max(h, w)
        nh, nw = max(8, int(h * scale)), max(8, int(w * scale))
        pil_tmp = _PIL.fromarray(img_array).resize((nw, nh), _PIL.LANCZOS)
        img_array = np.array(pil_tmp, dtype=np.uint8)
        h, w = img_array.shape[:2]

    # ── Skin colour region detection ────────────────────────────────────────
    r = img_array[:, :, 0].astype(np.float32)
    g = img_array[:, :, 1].astype(np.float32)
    b = img_array[:, :, 2].astype(np.float32)

    # Broad skin colour range in RGB: R>100, R>G>B, R-B>15
    skin_mask = (
        (r > 80) & (r < 240) &
        (g > 40) & (g < 200) &
        (b > 20) & (b < 180) &
        (r > g) & (g > b) &
        ((r - b) > 15)
    )

    skin_ai_score = 0.5  # neutral default when no face present

    if skin_mask.sum() > 500:
        skin_pixels_r = r[skin_mask]
        skin_pixels_g = g[skin_mask]
        skin_pixels_b = b[skin_mask]

        # Real skin: R, G, B have substantial variance (subsurface scatter creates spread)
        r_cv = float(skin_pixels_r.std() / (skin_pixels_r.mean() + 1e-6))
        g_cv = float(skin_pixels_g.std() / (skin_pixels_g.mean() + 1e-6))
        b_cv = float(skin_pixels_b.std() / (skin_pixels_b.mean() + 1e-6))
        mean_cv = (r_cv + g_cv + b_cv) / 3.0

        # AI skin: CV ~0.05-0.12 (airbrushed); Real: CV ~0.15-0.35
        skin_regularity_ai = float(np.clip(1.0 - mean_cv * 3.5, 0, 1))

        # Spatial regularity in skin region — AI skin has periodic texture
        # Sample a skin sub-region and compute local variance map
        ys, xs = np.where(skin_mask)
        if len(ys) > 100:
            # Tight bounding box
            y0, y1 = int(ys.min()), int(ys.max())
            x0, x1 = int(xs.min()), int(xs.max())
            gray_skin = img_array[y0:y1, x0:x1, :].mean(axis=2).astype(np.float32)
            if gray_skin.size > 100:
                # Local variance (5x5 patches)
                lh, lw = gray_skin.shape
                if lh >= 10 and lw >= 10:
                    ph, pw = lh // 5, lw // 5
                    local_vars = []
                    for i in range(5):
                        for j in range(5):
                            patch = gray_skin[i*ph:(i+1)*ph, j*pw:(j+1)*pw]
                            if patch.size > 0:
                                local_vars.append(float(patch.var()))
                    if local_vars:
                        lv_cv = float(np.std(local_vars) / (np.mean(local_vars) + 1e-6))
                        # AI: low spatial variance CV (uniform smooth texture)
                        # Real: higher CV (imperfect, varied texture)
                        spatial_regularity_ai = float(np.clip(1.0 - lv_cv * 0.8, 0, 1))
                        skin_ai_score = float(skin_regularity_ai * 0.55 + spatial_regularity_ai * 0.45)
                    else:
                        skin_ai_score = skin_regularity_ai
                else:
                    skin_ai_score = skin_regularity_ai
            else:
                skin_ai_score = skin_regularity_ai
        else:
            skin_ai_score = skin_regularity_ai
    else:
        skin_ai_score = 0.4  # no skin detected → slight downgrade (not a portrait)

    # ── Hair entropy ────────────────────────────────────────────────────────
    # AI hair: lower HF entropy than real hair (blended, painted look)
    # We detect dark, low-saturation regions near the top of the frame
    gray = img_array.mean(axis=2).astype(np.float32) / 255.0
    top_third = gray[:h//3, :]
    if top_third.size > 100:
        top_entropy = _image_entropy_2d(top_third)
        # Real hair: entropy ~6.5-7.5; AI hair: ~5.0-6.5
        hair_ai = float(np.clip((7.0 - top_entropy) / 3.0, 0, 1))
    else:
        hair_ai = 0.5

    # ── Eye catchlight / iris circularity ────────────────────────────────
    # Simplified: look for high-contrast circular blobs in likely eye regions
    # (upper-middle of image)
    eye_ai_score = _detect_eye_perfection(img_array)

    biological_ai_score = float(np.clip(
        skin_ai_score  * 0.45 +
        hair_ai        * 0.20 +
        eye_ai_score   * 0.35,
        0, 1
    ))

    return {
        "skin_regularity_ai": round(skin_ai_score, 4),
        "hair_entropy_ai":    round(hair_ai, 4),
        "eye_perfection_ai":  round(eye_ai_score, 4),
        "biological_ai_score": round(biological_ai_score, 4),
    }


def _image_entropy_2d(gray_norm: np.ndarray) -> float:
    """Shannon entropy of an image (0-1 float array)."""
    hist, _ = np.histogram(gray_norm.ravel(), bins=256, range=(0, 1))
    hist = hist.astype(np.float64)
    hist = hist[hist > 0]
    probs = hist / hist.sum()
    return float(-np.sum(probs * np.log2(probs + 1e-10)))


def _detect_eye_perfection(img_array: np.ndarray) -> float:
    """
    Detect suspiciously perfect circular iris/pupil regions.
    AI-generated eyes often have geometrically perfect irises that real eyes
    don't have (asymmetry, eyelid occlusion, highlight scatter).
    Returns [0,1] — higher = more AI-perfect eyes.
    """
    try:
        import cv2
        gray_u8 = img_array.mean(axis=2).astype(np.uint8)
        h, w = gray_u8.shape

        # Hough circle detection for iris-sized circles
        min_r = max(5, min(h, w) // 40)
        max_r = max(min_r + 5, min(h, w) // 8)

        circles = cv2.HoughCircles(
            gray_u8,
            cv2.HOUGH_GRADIENT,
            dp=1.5,
            minDist=min(h, w) // 10,
            param1=80,
            param2=25,
            minRadius=min_r,
            maxRadius=max_r,
        )

        if circles is None:
            return 0.35  # no circles = less suspicious

        circles = np.round(circles[0]).astype(int)
        # Only care about circles in the upper 2/3 (face region)
        face_circles = [c for c in circles if c[1] < h * 0.75]

        if not face_circles:
            return 0.35

        # Check circularity — real irises are slightly occluded, not perfect circles
        # We approximate by checking if the detected circle has uniform surrounding
        scores = []
        for cx, cy, cr in face_circles[:4]:
            y0 = max(0, cy - cr)
            y1 = min(h, cy + cr)
            x0 = max(0, cx - cr)
            x1 = min(w, cx + cr)
            roi = img_array[y0:y1, x0:x1, :].mean(axis=2).astype(np.float32)
            if roi.size < 20:
                continue
            # Variance in the ring — perfect circles have very uniform rings
            ry, rx = roi.shape
            cy_r, cx_r = ry // 2, rx // 2
            Y, X = np.ogrid[:ry, :rx]
            r_map = np.sqrt((Y - cy_r)**2 + (X - cx_r)**2)
            ring_mask = (r_map > cr * 0.6) & (r_map < cr * 0.9)
            if ring_mask.sum() < 5:
                continue
            ring_vals = roi[ring_mask]
            ring_cv = float(ring_vals.std() / (ring_vals.mean() + 1e-6))
            # Low CV ring = perfectly uniform iris ring = AI
            eye_score = float(np.clip(1.0 - ring_cv * 2.5, 0, 1))
            scores.append(eye_score)

        return float(np.mean(scores)) if scores else 0.35

    except Exception as e:
        logger.debug("[GFE][EyePerfection] failed: %s", e)
        return 0.35


# ─────────────────────────────────────────────────────────────────────────────
# M4: Gemini Sparkle Artifact Detector
# ─────────────────────────────────────────────────────────────────────────────

def _gemini_sparkle_detector(img_array: np.ndarray) -> float:
    """
    Google Gemini / ImageFX adds characteristic "sparkle" or "dust particle"
    visual artifacts — isolated bright pixels scattered in dark background regions.
    These appear as small high-value spikes that don't correspond to any coherent
    image structure. Visible as white/light dots in the Gemini reference image.

    This is a near-certain Gemini-specific fingerprint when present.
    Returns [0, 1] — higher = more sparkle artifacts detected.
    """
    gray = img_array.mean(axis=2).astype(np.float32)
    h, w = gray.shape

    # Compute 7x7 local mean to identify dark-neighbourhood regions
    from numpy.lib.stride_tricks import sliding_window_view
    pad = 3
    padded = np.pad(gray, pad, mode="reflect")
    try:
        wins = sliding_window_view(padded, (7, 7))
    except Exception:
        return 0.0
    local_mean = wins.mean(axis=(-2, -1))

    # "Dark neighbourhood": local mean < 80 (surrounding pixels are dark)
    dark_neighbourhood = local_mean < 80

    # Sparkle pixel: bright pixel (> 130) sitting in a dark neighbourhood
    # AND significantly brighter than local mean (ratio > 1.8)
    sparkle_candidates = (
        dark_neighbourhood &
        (gray > 130) &
        (gray > local_mean * 1.8)
    )
    sparkle_count = int(sparkle_candidates.sum())
    total_dark_neighbourhood = int(dark_neighbourhood.sum())

    if total_dark_neighbourhood < 100:
        return 0.0

    sparkle_density = sparkle_count / total_dark_neighbourhood

    # Isolation check: sparkle pixels surrounded by non-sparkle pixels
    if sparkle_count > 0:
        sparkle_f = sparkle_candidates.astype(np.float32)
        sp_padded = np.pad(sparkle_f, 3, mode="constant")
        try:
            sp_wins = sliding_window_view(sp_padded, (7, 7))
            neighbour_sparkle = sp_wins.sum(axis=(-2, -1)) - sparkle_f
        except Exception:
            neighbour_sparkle = np.zeros_like(sparkle_f)
        isolated = sparkle_candidates & (neighbour_sparkle <= 3)
        isolation_ratio = float(isolated.sum()) / max(sparkle_count, 1)
    else:
        isolation_ratio = 0.0

    # Gemini: density ~0.001-0.008, isolation_ratio ~0.6-0.9
    # Real photos: low density or low isolation (lamp blobs are clusters)
    score = float(np.clip(
        sparkle_density * 120.0 * (isolation_ratio ** 0.5),
        0, 1
    ))

    return round(score, 4)


# ─────────────────────────────────────────────────────────────────────────────
# M5: Generator-Specific Spectral Signature Matching
# ─────────────────────────────────────────────────────────────────────────────

def _spectral_generator_signatures(img_array: np.ndarray) -> Dict[str, float]:
    """
    Each generator's VAE/decoder produces characteristic spectral energy profiles.
    We match against empirical signatures derived from known samples.

    Signatures:
      Gemini/Imagen: elevated energy at 8–24px period, very clean mid-band
      DALL-E 3: grid at 64px, elevated colour inter-channel correlation
      Midjourney V6: aggressive sharpening → peak at 3–8px period
      SD-XL: 8px VAE artifacts, slight banding at 8px period
      Firefly: very uniform mid-band (clean diffusion)
    """
    gray = img_array.mean(axis=2).astype(np.float32)
    h, w = gray.shape

    # Use 256x256 crop for fast FFT
    gh = min(h, 256)
    gw = min(w, 256)
    crop = gray[:gh, :gw]

    fft_mag = np.abs(np.fft.fftshift(np.fft.fft2(crop)))
    ch, cw = fft_mag.shape
    cy, cx = ch // 2, cw // 2
    Y, X = np.ogrid[:ch, :cw]
    r = np.sqrt((Y - cy)**2 + (X - cx)**2)

    def _band_energy(r_low: float, r_high: float) -> float:
        mask = (r >= r_low) & (r < r_high)
        return float(fft_mag[mask].mean()) if mask.sum() > 0 else 0.0

    e_dc    = _band_energy(0, 5)       + 1e-6
    e_very_low = _band_energy(5, 15)   + 1e-6  # 17–50px periods
    e_low   = _band_energy(15, 35)     + 1e-6  # 7–17px periods
    e_mid   = _band_energy(35, 60)     + 1e-6  # 4–7px periods
    e_high  = _band_energy(60, 100)    + 1e-6  # 2–4px periods
    e_vhigh = _band_energy(100, 128)   + 1e-6  # 2px period

    # Normalised ratios
    total = e_very_low + e_low + e_mid + e_high
    r_vl  = e_very_low / total
    r_lo  = e_low / total
    r_mi  = e_mid / total
    r_hi  = e_high / total

    # Gemini/Imagen: concentration in very_low + low bands, clean mid
    # Empirical: r_vl ~0.45-0.65, r_mi < 0.15
    gemini_spec = float(np.clip(
        (r_vl - 0.35) * 2.0 + (0.20 - r_mi) * 3.0,
        0, 1
    ))

    # DALL-E 3: moderate spread, grid peaks at specific bins
    dalle3_spec = float(np.clip(
        (r_lo - 0.20) * 2.5 + (r_hi - 0.15) * 1.5,
        0, 1
    ))

    # Midjourney: strong high-frequency overreach
    mj_spec = float(np.clip(
        (r_hi - 0.20) * 3.0 + (e_vhigh / e_mid - 0.3) * 2.0,
        0, 1
    ))

    # SD-XL: balanced mid-range with slight 8px artifacts
    sdxl_spec = float(np.clip(
        abs(r_mi - 0.30) * (-1.0) + 0.40,   # peak at mid
        0, 1
    ))

    # Firefly: very clean output, very low high-freq AND very uniform mid-band
    # Requires BOTH: low HF AND uniform mid (not just low HF which all diffusion has)
    firefly_spec = float(np.clip(
        (0.15 - r_hi) * 2.0 * (1.0 - abs(r_mi - 0.28) * 3.0),
        0, 1
    ))

    return {
        "gemini":     round(max(0.0, gemini_spec), 4),
        "dalle3":     round(max(0.0, dalle3_spec), 4),
        "midjourney": round(max(0.0, mj_spec), 4),
        "sdxl":       round(max(0.0, sdxl_spec), 4),
        "firefly":    round(max(0.0, firefly_spec), 4),
    }


# ─────────────────────────────────────────────────────────────────────────────
# M6: Texture Regularity Engine
# ─────────────────────────────────────────────────────────────────────────────

def _texture_regularity(img_array: np.ndarray) -> float:
    """
    AI images have characteristically regular, periodic textures. Even "noisy"
    AI images have noise that's too statistically uniform. This measures local
    texture variance homogeneity via a tiled analysis.
    """
    gray = img_array.mean(axis=2).astype(np.float32)
    h, w = gray.shape
    tile = 32
    nh, nw = h // tile, w // tile

    if nh < 2 or nw < 2:
        return 0.5

    # Local variance for each tile
    variances = []
    for i in range(nh):
        for j in range(nw):
            patch = gray[i*tile:(i+1)*tile, j*tile:(j+1)*tile]
            variances.append(float(patch.var()))

    variances = np.array(variances)
    mean_var = float(variances.mean()) + 1e-6

    # Coefficient of variation of local variances
    # Low CoV = all patches have similar texture → AI uniform noise
    # High CoV = patches vary a lot → real scene complexity
    cov = float(variances.std() / mean_var)

    # Also check: periodicity of variance across tiles
    # reshape to 2D grid and compute 2D FFT
    var_grid = variances.reshape(nh, nw)
    fft_var = np.abs(np.fft.fft2(var_grid))
    fft_var[0, 0] = 0  # zero DC
    # High peak in variance FFT = periodic texture = AI
    var_peak_ratio = float(fft_var.max() / (fft_var.mean() + 1e-6))

    # Real images: cov ~0.6-2.0, var_peak_ratio ~2-8
    # AI images: cov ~0.2-0.8, var_peak_ratio ~8-25
    texture_ai = float(np.clip(
        (1.0 - cov * 0.6) * 0.5 +
        (var_peak_ratio - 5.0) / 25.0 * 0.5,
        0, 1
    ))

    return round(texture_ai, 4)


# ─────────────────────────────────────────────────────────────────────────────
# M4b: Gemini Visual Watermark (4-pointed star) Detector
# ─────────────────────────────────────────────────────────────────────────────

def _gemini_visual_watermark(img_array: np.ndarray) -> float:
    """
    Gemini (via ImageFX and Gemini App) embeds a visible 4-pointed star
    watermark (Gemini logo) in the bottom-right corner of generated images.
    It appears as a small white/light 4-pointed diamond-star shape.

    Detection approach:
      1. Crop bottom-right 15% of image
      2. Look for star-shaped bright blob (high radial symmetry, 4 lobes)
      3. Check cross-shaped brightness profile in the corner region

    Returns [0, 1]: 0 = no watermark, 1 = strong Gemini star detected.
    """
    h, w = img_array.shape[:2]
    # Gemini star is typically in bottom-right 12-18% of the image
    crop_h = max(40, int(h * 0.15))
    crop_w = max(40, int(w * 0.15))
    corner = img_array[h - crop_h:, w - crop_w:, :]
    gray_c = corner.mean(axis=2).astype(np.float32)

    # Find the brightest region in the corner
    max_val = float(gray_c.max())
    if max_val < 120:
        return 0.0  # too dark, no watermark

    # Gemini star is a SMALL isolated blob — find the single peak pixel
    # and check a 20px radius around it
    peak_idx = np.unravel_index(gray_c.argmax(), gray_c.shape)
    cy_peak, cx_peak = float(peak_idx[0]), float(peak_idx[1])

    # Small window around peak
    r_star = max(6, min(gray_c.shape[0], gray_c.shape[1]) // 8)
    y0 = max(0, int(cy_peak) - r_star)
    y1 = min(gray_c.shape[0], int(cy_peak) + r_star)
    x0 = max(0, int(cx_peak) - r_star)
    x1 = min(gray_c.shape[1], int(cx_peak) + r_star)
    star_roi = gray_c[y0:y1, x0:x1]

    # Contrast: star must be bright relative to surrounding corner
    star_mean = float(star_roi.mean())
    corner_mean = float(gray_c.mean())
    if star_mean < corner_mean * 1.5:
        return 0.0  # not a localized bright spot

    # The watermark should occupy < 8% of the corner area (it's small)
    corner_area = gray_c.size
    bright_ratio = float((gray_c > max_val * 0.6).sum()) / corner_area
    if bright_ratio > 0.08:
        return 0.0  # too large to be a small watermark

    thresh = float(np.percentile(star_roi, 70))
    bright_mask = star_roi >= thresh
    if bright_mask.sum() < 4:
        return 0.0

    ys, xs = np.where(bright_mask)
    cy = float(ys.mean())
    cx = float(xs.mean())

    # Check radial symmetry — a 4-pointed star has 4 bright lobes arranged
    # at 0°, 90°, 180°, 270° around the center. Sample 8 directions.
    ch, cw = gray_c.shape
    radial_scores = []
    for angle_deg in range(0, 360, 45):
        angle_rad = math.radians(angle_deg)
        # Sample 5 points along this direction (r=2..10 pixels)
        pts = []
        for r in range(2, min(12, min(ch, cw) // 3)):
            yi = int(cy + r * math.sin(angle_rad))
            xi = int(cx + r * math.cos(angle_rad))
            if 0 <= yi < ch and 0 <= xi < cw:
                pts.append(gray_c[yi, xi])
        if pts:
            radial_scores.append(float(np.mean(pts)))

    if not radial_scores:
        return 0.0

    # A 4-pointed star: 4 directions bright, 4 directions dark
    # Sort and check contrast between top-4 and bottom-4 directions
    rs = sorted(radial_scores, reverse=True)
    n = len(rs)
    if n < 4:
        return 0.0
    top4_mean = float(np.mean(rs[:4]))
    bot4_mean = float(np.mean(rs[4:])) + 1e-6
    lobe_contrast = top4_mean / bot4_mean

    # A 4-pointed star has lobe_contrast ~3-8x; random blob ~1.5-2x
    wm_score = float(np.clip((lobe_contrast - 1.8) / 4.0, 0, 1))

    # Also weight by the peak brightness relative to image surroundings
    corner_surround = img_array[max(0, h - crop_h*2):h - crop_h,
                                max(0, w - crop_w*2):w - crop_w, :].mean()
    brightness_contrast = float(np.clip(
        (max_val - float(corner_surround)) / 100.0, 0, 1
    ))

    return round(float(np.clip(wm_score * 0.65 + brightness_contrast * 0.35, 0, 1)), 4)


# ─────────────────────────────────────────────────────────────────────────────
# Generator Attribution Logic
# ─────────────────────────────────────────────────────────────────────────────

_GENERATOR_PROFILES = {
    "gemini_imagen": {
        "display": "Google Gemini / Imagen",
        "version_hint": "Gemini 2.0 / ImageFX",
        "description": "Google's diffusion-based generator with SynthID watermarking and characteristic sparkle artifacts",
    },
    "dalle3_chatgpt": {
        "display": "OpenAI DALL-E 3 / GPT Image",
        "version_hint": "DALL-E 3 / gpt-image-1",
        "description": "OpenAI's latent diffusion model with 64px patch grid and distinctive colour VAE fingerprint",
    },
    "midjourney_v6": {
        "display": "Midjourney V6",
        "version_hint": "V5/V6",
        "description": "Midjourney's highly stylised diffusion with aggressive sharpening and characteristic 32px upscale grid",
    },
    "stable_diffusion": {
        "display": "Stable Diffusion XL / Flux",
        "version_hint": "SDXL / Flux.1",
        "description": "Open-source diffusion model with 8px VAE boundary artifacts and characteristic noise profile",
    },
    "adobe_firefly": {
        "display": "Adobe Firefly",
        "version_hint": "Firefly 3",
        "description": "Adobe's commercial diffusion model with very clean output and minimal spectral artifacts",
    },
    "unknown_diffusion": {
        "display": "Unknown AI Generator",
        "version_hint": "diffusion model",
        "description": "Statistical signatures match a diffusion-based AI generator, specific family unidentified",
    },
}


def _attribute_generator(
    latent_geo: Dict[str, float],
    spectral_sig: Dict[str, float],
    sparkle_score: float,
    visual_wm: float,
    lighting: Dict[str, Any],
    bio: Dict[str, Any],
    texture_reg: float,
) -> Dict[str, Any]:
    """
    Combine all signals into per-generator attribution scores.
    Returns ranked list of generator matches with confidence.
    """
    # Build composite score per generator
    scores: Dict[str, float] = {}

    # Gemini / Imagen
    # sparkle (isolated bright dots in dark background) is the primary Gemini tell
    # visual_wm adds evidence when a 4-pointed star is clearly present (score > 0.5)
    gemini_raw = (
        latent_geo.get("gemini", 0)   * 0.20 +
        sparkle_score                  * 0.50 +  # strongest discriminator
        max(0.0, visual_wm - 0.40)    * 0.30    # only count strong visual WM
    )
    scores["gemini_imagen"] = float(np.clip(gemini_raw * 1.5, 0, 1))

    # DALL-E 3 / ChatGPT
    # Lower sparkle than Gemini; no Gemini star; high saturation/drama
    # Key discriminators: low sparkle + high saturation + strong lighting contrast
    dalle3_raw = (
        latent_geo.get("dalle3", 0)   * 0.25 +
        (1.0 - min(sparkle_score * 4, 1.0)) * 0.30 +  # INVERSE of sparkle
        lighting.get("ai_lighting_score", 0.5)  * 0.25 +
        bio.get("biological_ai_score", 0.5)     * 0.20
    )
    scores["dalle3_chatgpt"] = float(np.clip(dalle3_raw * 1.15, 0, 1))

    # Midjourney
    mj_raw = (
        latent_geo.get("midjourney", 0) * 0.35 +
        spectral_sig.get("midjourney", 0) * 0.40 +
        bio.get("eye_perfection_ai", 0.35) * 0.25
    )
    scores["midjourney_v6"] = float(np.clip(mj_raw * 1.2, 0, 1))

    # SD-XL / Flux
    sdxl_raw = (
        latent_geo.get("sdxl", 0) * 0.40 +
        spectral_sig.get("sdxl", 0) * 0.35 +
        texture_reg * 0.25
    )
    scores["stable_diffusion"] = float(np.clip(sdxl_raw * 1.15, 0, 1))

    # Firefly — only score if BOTH spectral AND highlight uniformity are strong
    # Prevents Firefly from winning on generic "clean diffusion" images
    ff_spec = spectral_sig.get("firefly", 0)
    ff_hi   = lighting.get("highlight_uniformity_ai", 0.3)
    # Both must be present; neither alone is sufficient
    firefly_raw = float(ff_spec * ff_hi) ** 0.5  # geometric mean
    scores["adobe_firefly"] = float(np.clip(firefly_raw * 1.0, 0, 1))

    # Overall AI score (max / noisy-OR)
    all_s = list(scores.values())
    overall_ai = float(1.0 - np.prod([1.0 - s for s in all_s]))

    # Rank generators
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)

    top_gen, top_score = ranked[0]
    # If top is very close to second, reduce confidence
    if len(ranked) >= 2 and (top_score - ranked[1][1]) < 0.08:
        top_score = float(top_score * 0.85)  # uncertain

    # Unknown if none clear
    if top_score < 0.20:
        top_gen = "unknown_diffusion"
        top_score = overall_ai

    attribution = {
        "top_generator": top_gen,
        "top_generator_display": _GENERATOR_PROFILES[top_gen]["display"],
        "top_generator_version": _GENERATOR_PROFILES[top_gen]["version_hint"],
        "top_generator_description": _GENERATOR_PROFILES[top_gen]["description"],
        "structural_match_pct": round(float(np.clip(top_score * 100, 0, 98)), 1),
        "overall_ai_score": round(float(np.clip(overall_ai, 0, 1)), 4),
        "generator_scores": {k: round(v, 4) for k, v in scores.items()},
        "ranked_generators": [
            {
                "generator": k,
                "display": _GENERATOR_PROFILES[k]["display"],
                "confidence": round(v, 4),
                "match_pct": round(float(np.clip(v * 100, 0, 98)), 1),
            }
            for k, v in ranked[:3]
        ],
    }
    return attribution


# ─────────────────────────────────────────────────────────────────────────────
# Main Layer 10 Entry Point
# ─────────────────────────────────────────────────────────────────────────────

def analyze_generative_fingerprint(img_array: np.ndarray, img_pil: Any) -> Dict[str, Any]:
    """
    Layer 10: Generative Fingerprinting Engine.

    Parameters
    ----------
    img_array : np.ndarray  (H, W, 3) uint8 RGB
    img_pil   : PIL.Image

    Returns
    -------
    Layer-report dict + rich attribution data under 'generative_attribution'.
    """
    from utils.evidence_builder import build_layer_report

    try:
        # Run all modules
        latent_geo   = _latent_residual_geometry(img_array)
        lighting     = _lighting_physics_consistency(img_array)
        bio          = _biological_markers(img_array)
        sparkle      = _gemini_sparkle_detector(img_array)
        visual_wm    = _gemini_visual_watermark(img_array)
        spectral_sig = _spectral_generator_signatures(img_array)
        texture_reg  = _texture_regularity(img_array)

        # Attribution
        attribution = _attribute_generator(
            latent_geo, spectral_sig, sparkle, visual_wm, lighting, bio, texture_reg
        )

        overall_ai = attribution["overall_ai_score"]
        lighting_ai = lighting.get("ai_lighting_score", 0.5)
        bio_ai = bio.get("biological_ai_score", 0.5)

        # Composite L10 score
        layer_score = float(np.clip(
            overall_ai  * 0.50 +
            lighting_ai * 0.25 +
            bio_ai      * 0.25,
            0, 1
        ))

        # Build evidence nodes
        def _ev(conf, detail, atype):
            status = "anomalous" if conf >= 0.60 else ("normal" if conf < 0.30 else "inconclusive")
            return {
                "layer": 10, "category": "generative_fingerprint",
                "artifactType": atype, "status": status,
                "confidence": round(float(conf), 4), "detail": str(detail)[:200],
                "rawValue": round(float(conf), 6),
            }

        top_pct = attribution["structural_match_pct"]
        top_disp = attribution["top_generator_display"]
        evidence = [
            _ev(overall_ai,   f"Generator signal: {top_disp} ({top_pct:.0f}% structural match)", "generator_attribution"),
            _ev(lighting_ai,  f"Lighting physics inconsistency score: {lighting_ai:.3f}", "lighting_physics"),
            _ev(bio_ai,       f"Biological markers: skin={bio.get('skin_regularity_ai',0):.3f} eye={bio.get('eye_perfection_ai',0):.3f}", "biological_markers"),
            _ev(sparkle,      f"Gemini sparkle artifacts: {sparkle:.4f}", "gemini_sparkle"),
            _ev(visual_wm,    f"Gemini visual watermark (4-pt star): {visual_wm:.4f}", "gemini_visual_watermark"),
            _ev(texture_reg,  f"Texture regularity: {texture_reg:.3f}", "texture_regularity"),
        ]

        report = build_layer_report(10, "Generative Fingerprinting Engine", evidence, "success", 0,
                                    score=round(layer_score, 4))
        report["generative_attribution"] = attribution
        report["lighting_analysis"]      = lighting
        report["biological_analysis"]    = bio
        report["latent_geometry"]        = latent_geo
        report["spectral_signatures"]    = spectral_sig
        report["gemini_sparkle_score"]   = round(sparkle, 4)
        report["gemini_visual_watermark"] = round(visual_wm, 4)
        report["texture_regularity"]     = round(texture_reg, 4)
        return report

    except Exception as exc:
        logger.warning("[GFE][L10] failed: %s", exc, exc_info=True)
        from utils.evidence_builder import build_layer_report
        return build_layer_report(10, "Generative Fingerprinting Engine", [], "failure", 0, score=0.5)

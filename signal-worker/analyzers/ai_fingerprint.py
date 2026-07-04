"""
Aiscern Signal Worker — Layer 9: Modern AI Fingerprint Detector

Targets the specific failure modes of the older layers against
hyperrealistic diffusion-model images (DALL-E 3, ChatGPT Image/gpt-image-1,
Midjourney V6, Stable Diffusion XL, Gemini Imagen).

Four forensic signals calibrated against modern generators:

  1. Saturation-Overreach Score  — AI generators over-saturate colour.
     Real camera images have bounded per-channel std; AI images push beyond
     the natural sensor ceiling. We check the "oversaturation ratio":
     fraction of pixels where ANY channel > 245 OR saturation (HSV) > 220.

  2. Frequency Kurtosis Divergence — diffusion models produce characteristic
     leptokurtic (heavy-tailed) distributions in specific spectral bands.
     We use the radial power spectrum kurtosis in the mid-frequency annulus
     (the band a GAN/diffusion decoder writes into most heavily).

  3. Colour Palette Quantisation Anomaly — AI images tend to have "round"
     colour distributions that cluster tightly around their dominant hues,
     whereas real photos have long-tailed, smeared palettes driven by
     sensor noise. Measured as: ratio of top-4 colours (by 8-bit R+G+B
     histogram) to total palette diversity.

  4. Edge-Perfection Score — AI edges are too clean. We compute the Laplacian
     standard deviation in a narrow edge-vicinity band and compare to the
     global mean. Real photos have fringing, blur, chromatic smear; AI edges
     are knife-sharp with abrupt transitions.

All CPU-only. Target <200 ms on 1080p.
"""

from __future__ import annotations

import logging
from typing import Any, Dict

import numpy as np

logger = logging.getLogger(__name__)


# ── Signal 1: Saturation overreach ───────────────────────────────────────────

def _saturation_overreach(img_array: np.ndarray) -> float:
    """
    Modern AI generators output images with unnaturally saturated regions.
    Real photos are limited by sensor + lens dynamic range.
    Returns score in [0, 1]; higher = more AI-like.
    """
    r = img_array[:, :, 0].astype(np.float32)
    g = img_array[:, :, 1].astype(np.float32)
    b = img_array[:, :, 2].astype(np.float32)
    total_px = r.size

    # Channel blast: pixels where any channel is near-maxed (>245)
    blast_mask = (r > 245) | (g > 245) | (b > 245)
    blast_ratio = float(blast_mask.sum()) / total_px

    # Convert to HSV-equivalent saturation (max-min)/max
    cmax = np.maximum(np.maximum(r, g), b)
    cmin = np.minimum(np.minimum(r, g), b)
    with np.errstate(divide="ignore", invalid="ignore"):
        sat = np.where(cmax > 0, (cmax - cmin) / cmax, 0.0)

    # Fraction of pixels with saturation > 0.85 (very vivid colours)
    high_sat_ratio = float((sat > 0.85).sum()) / total_px

    # Mean RGB std across channels (AI images have lower inter-channel spread)
    rgb_stds = np.array([r.std(), g.std(), b.std()])
    inter_channel_spread = float(rgb_stds.std())  # variation between channels

    # Score: high blast + high saturation → AI; compensated by inter-channel spread
    base = float(np.clip(blast_ratio * 3.0 + high_sat_ratio * 2.0, 0, 1))
    # Low inter-channel spread (monochromatic/over-processed) → more suspicious
    spread_penalty = float(np.clip(1.0 - inter_channel_spread / 30.0, 0, 0.3))
    return float(np.clip(base + spread_penalty, 0, 1))


# ── Signal 2: Frequency kurtosis divergence ───────────────────────────────────

def _freq_kurtosis_divergence(img_array: np.ndarray) -> float:
    """
    Diffusion models produce characteristic heavy-tailed spectral energy
    distributions in the mid-frequency annulus.
    Returns score in [0, 1]; higher = more AI-like.
    """
    gray = np.mean(img_array, axis=2).astype(np.float32)
    h, w = gray.shape

    # Downsample to 512×512 max for speed
    if max(h, w) > 512:
        scale = 512 / max(h, w)
        nh, nw = int(h * scale), int(w * scale)
        # Simple area downsampling via reshape+mean
        gh = (nh // 4) * 4
        gw = (nw // 4) * 4
        gray = gray[:gh, :gw]
        gray = gray.reshape(gh // 4, 4, gw // 4, 4).mean(axis=(1, 3))
        h, w = gray.shape

    fft_mag = np.abs(np.fft.fftshift(np.fft.fft2(gray)))
    cy, cx = h // 2, w // 2
    Y, X = np.ogrid[:h, :w]
    r = np.sqrt((Y - cy) ** 2 + (X - cx) ** 2)
    max_r = min(cy, cx)

    # Mid-frequency annulus: 15%–50% of max radius
    mid_mask = (r >= max_r * 0.15) & (r < max_r * 0.50)
    mid_energy = fft_mag[mid_mask]

    if mid_energy.size < 10:
        return 0.5

    # Kurtosis of mid-band energy
    mean_e = float(mid_energy.mean())
    std_e  = float(mid_energy.std())
    if std_e < 1e-6:
        return 0.5
    z4 = ((mid_energy - mean_e) / std_e) ** 4
    kurt = float(z4.mean())

    # Real photos: kurtosis ~3-8 in mid-band
    # Diffusion models: kurtosis typically > 10 (very spiky, concentrated energy)
    # GAN images: kurtosis can be extreme (>30)
    if kurt > 15.0:
        return float(np.clip(0.60 + (kurt - 15.0) / 50.0, 0.60, 0.95))
    elif kurt > 8.0:
        return float(np.clip(0.40 + (kurt - 8.0) / 35.0, 0.40, 0.60))
    else:
        return float(np.clip(0.15 + kurt / 50.0, 0.15, 0.40))


# ── Signal 3: Colour palette quantisation anomaly ─────────────────────────────

def _palette_quantisation_score(img_array: np.ndarray) -> float:
    """
    AI images cluster their colour usage more tightly than real photos.
    We measure the concentration of the top-N colour bins.
    Returns score in [0, 1]; higher = more AI-like (tight clustering).
    """
    # Use 6-bit per channel (64^3 = 262 144 bins) — compact enough to compute fast
    r6 = (img_array[:, :, 0] >> 2).astype(np.int32)
    g6 = (img_array[:, :, 1] >> 2).astype(np.int32)
    b6 = (img_array[:, :, 2] >> 2).astype(np.int32)
    keys = r6 * (64 * 64) + g6 * 64 + b6
    flat = keys.ravel()
    total = len(flat)

    # Count bin frequencies
    counts = np.bincount(flat, minlength=64 ** 3).astype(np.float64)
    nonzero = counts[counts > 0]
    if len(nonzero) == 0:
        return 0.5

    # Gini coefficient — measures concentration
    # 0 = perfectly uniform (every colour equally used) → natural photo
    # 1 = all pixels same colour → extremely concentrated
    sorted_c = np.sort(nonzero)
    n = len(sorted_c)
    index = np.arange(1, n + 1)
    gini = float((2 * (index * sorted_c).sum() / (n * sorted_c.sum())) - (n + 1) / n)

    # Real photos: Gini ~0.70-0.85 (varied but not extreme)
    # AI images: Gini ~0.85-0.97 (concentrated palette, "perfect" colour discipline)
    if gini > 0.92:
        return float(np.clip(0.70 + (gini - 0.92) * 7.0, 0.70, 0.95))
    elif gini > 0.80:
        return float(np.clip(0.35 + (gini - 0.80) * 2.5, 0.35, 0.70))
    else:
        return float(np.clip(0.10 + gini * 0.3, 0.10, 0.35))


# ── Signal 4: Edge perfection score ──────────────────────────────────────────

def _edge_perfection_score(img_array: np.ndarray) -> float:
    """
    AI edges are knife-sharp with perfectly localised transitions.
    Real photos show: chromatic fringing, blur from diffraction, motion,
    sensor interpolation artefacts. We measure edge "crispness contrast" —
    the ratio of peak gradient to surrounding gradient width.
    Returns score in [0, 1]; higher = more unnaturally perfect edges → AI.
    """
    gray = np.mean(img_array, axis=2).astype(np.float32)

    # Sobel gradients
    def _sobel(img):
        kx = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=np.float32)
        ky = kx.T
        from numpy.lib.stride_tricks import sliding_window_view
        ph = np.pad(img, 1, mode="reflect")
        wins = sliding_window_view(ph, (3, 3))
        gx = (wins * kx).sum(axis=(-2, -1))
        gy = (wins * ky).sum(axis=(-2, -1))
        return np.sqrt(gx ** 2 + gy ** 2)

    mag = _sobel(gray)

    # Edge pixels: top 10% of gradient magnitude
    thresh = float(np.percentile(mag, 90))
    edge_mask = mag >= thresh

    if edge_mask.sum() < 50:
        return 0.5

    edge_vals = mag[edge_mask]
    non_edge_vals = mag[~edge_mask]

    edge_mean = float(edge_vals.mean())
    non_edge_mean = float(non_edge_vals.mean()) + 1e-6

    # "Sharpness ratio": how much stronger are edge pixels vs non-edge
    # Real photos: ratio ~3-10x (gradual falloff)
    # AI images: ratio ~15-50x (abrupt transitions, "drawn" quality)
    ratio = edge_mean / non_edge_mean

    if ratio > 25.0:
        return float(np.clip(0.70 + (ratio - 25.0) / 50.0, 0.70, 0.95))
    elif ratio > 12.0:
        return float(np.clip(0.40 + (ratio - 12.0) / 65.0, 0.40, 0.70))
    else:
        return float(np.clip(0.10 + ratio / 80.0, 0.10, 0.40))


# ── Signal 5: PNG/WEBP without EXIF — generator fingerprint ──────────────────

def _lossless_no_exif_score(img_array: np.ndarray, img_pil: Any) -> float:
    """
    ChatGPT (gpt-image-1 / DALL-E 3) and Midjourney output PNG or WEBP.
    Real cameras almost never produce PNG or WEBP as the native capture format
    -- BUT any screenshot, WhatsApp/Telegram-forwarded image, or web-saved
    photo also loses EXIF and is commonly re-encoded as PNG. This signal is a
    weak prior, not forensic evidence of AI generation, and must never be
    strong enough on its own to drive the fused score into "AI" territory.

    Module 2 fix: magnitudes lowered (was 0.82/0.60) so this can only ever act
    as a modest nudge alongside genuine content-based signals, never as a
    standalone driver.
    """
    try:
        fmt = getattr(img_pil, "format", None) or ""
        if isinstance(fmt, str):
            fmt = fmt.upper()
        has_exif = bool(getattr(img_pil, "_getexif", lambda: None)() or
                        img_pil.info.get("exif"))
        h, w = img_array.shape[:2]
        large = (h * w) > (512 * 512)
        if fmt in ("PNG", "WEBP") and not has_exif and large:
            return 0.55  # weak prior nudge only — was 0.82
        if fmt in ("PNG", "WEBP") and not has_exif:
            return 0.42  # was 0.60
    except Exception:
        pass
    return 0.40  # neutral-to-low; real photos often lose EXIF via web processing


# ── Main Layer 9 function ─────────────────────────────────────────────────────

def analyze_ai_fingerprint(img_array: np.ndarray, img_pil: Any) -> Dict[str, Any]:
    """
    Layer 9: Modern AI Fingerprint Detector.

    Parameters
    ----------
    img_array : np.ndarray  shape (H, W, 3) uint8 RGB
    img_pil   : PIL.Image

    Returns
    -------
    dict compatible with the layer-report schema.
    """
    from utils.evidence_builder import build_layer_report

    try:
        sig_sat   = _saturation_overreach(img_array)
        sig_freq  = _freq_kurtosis_divergence(img_array)
        sig_pal   = _palette_quantisation_score(img_array)
        sig_edge  = _edge_perfection_score(img_array)
        sig_fmt   = _lossless_no_exif_score(img_array, img_pil)

        # Weighted fusion — format signal is now a MINOR prior, not a primary
        # driver (Module 2 fix: was 0.24, tied for the largest weight in this
        # layer; a PNG-without-EXIF real photo could satisfy most of L9's
        # score through this single non-content signal alone).
        weights = {"sat": 0.24, "freq": 0.26, "pal": 0.22, "edge": 0.20, "fmt": 0.08}
        score = (
            sig_sat  * weights["sat"]  +
            sig_freq * weights["freq"] +
            sig_pal  * weights["pal"]  +
            sig_edge * weights["edge"] +
            sig_fmt  * weights["fmt"]
        )

        # Boost: if ≥3 CONTENT-BASED signals agree strongly (≥0.65), apply
        # soft-max boost. Module 2 fix: sig_fmt (format prior) deliberately
        # excluded from this count -- it is not a content signal and should
        # never count towards "multiple independent signals agree".
        content_signals = [sig_sat, sig_freq, sig_pal, sig_edge]
        strong = sum(1 for s in content_signals if s >= 0.65)
        if strong >= 3:
            score = float(np.clip(score * 1.25, 0, 1))
        elif strong >= 2:
            score = float(np.clip(score * 1.10, 0, 1))

        def _ev(sig, name, atype):
            status = "anomalous" if sig >= 0.65 else "normal" if sig < 0.30 else "inconclusive"
            return {
                "layer": 9, "category": "ai_fingerprint", "artifactType": atype,
                "status": status, "confidence": round(sig, 4), "detail": name,
                "rawValue": round(sig, 6),
            }
        evidence = [
            _ev(sig_sat,  f"Saturation overreach={sig_sat:.3f}", "colour_overreach"),
            _ev(sig_freq, f"Freq kurtosis divergence={sig_freq:.3f}", "spectral_fingerprint"),
            _ev(sig_pal,  f"Palette quantisation={sig_pal:.3f}", "palette_clustering"),
            _ev(sig_edge, f"Edge perfection score={sig_edge:.3f}", "edge_perfection"),
            _ev(sig_fmt,  f"Format prior={sig_fmt:.3f} (PNG/WEBP+no-EXIF)", "format_prior"),
        ]

        return build_layer_report(9, "Modern AI Fingerprint", evidence, "success", 0,
                                   score=round(float(np.clip(score, 0, 1)), 4))

    except Exception as exc:
        logger.warning("[AIF][L9] failed: %s", exc, exc_info=True)
        from utils.evidence_builder import build_layer_report
        return build_layer_report(9, "Modern AI Fingerprint", [], "failure", 0, score=0.5)

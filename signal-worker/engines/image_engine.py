"""
Aiscern Detection Worker — Image Engine v4.2.0
Merges v2 signal analysis (Layers 1, 3, 4, SynthID) and v3 forensic cascade
(metadata, frequency, noise, texture, face, watermark, text artifacts)
into a single unified module.

GPU layers (L5, L5b) are optional — return 503-equivalent dict if GPU unavailable.
"""

import os
import time
import logging
import tempfile
from typing import Any, Dict, Optional
from version import VERSION

logger = logging.getLogger(__name__)

GPU_ENABLED = os.getenv("GPU_ENABLED", "false").lower() == "true"


# ── GPU availability check ────────────────────────────────────────────────────

def _gpu_available() -> bool:
    if not GPU_ENABLED:
        return False
    try:
        import torch
        return torch.cuda.is_available()
    except ImportError:
        return False


def _gpu_vram_gb() -> float:
    try:
        import torch
        if torch.cuda.is_available():
            return round(torch.cuda.get_device_properties(0).total_memory / 1e9, 1)
    except Exception:
        pass
    return 0.0


from utils.structured_log import slog


# ── v2 Layer runners ─────────────────────────────────────────────────────────

def _run_l1(img_array, img_pil, target_regions) -> Dict[str, Any]:
    from analyzers.pixel_integrity import analyze_pixel_integrity
    from utils.evidence_builder import build_layer_report
    try:
        return analyze_pixel_integrity(img_array, img_pil, target_regions)
    except Exception as e:
        logger.warning("[ImageEngine][L1] failed: %s", e)
        return build_layer_report(1, "Pixel Integrity", [], "failure", 0, score=0.5)


def _run_l2(img_array, img_pil) -> Dict[str, Any]:
    from analyzers.dct_compression import analyze_dct_compression
    from utils.evidence_builder import build_layer_report
    try:
        return analyze_dct_compression(img_array, img_pil)
    except Exception as e:
        logger.warning("[ImageEngine][L2] failed: %s", e)
        return build_layer_report(2, "Compression Artifacts (DCT)", [], "failure", 0, score=0.5)


def _run_l3(img_array, img_pil) -> Dict[str, Any]:
    from analyzers.noise_stats import analyze_noise_stats
    from utils.evidence_builder import build_layer_report
    try:
        return analyze_noise_stats(img_array, img_pil)
    except Exception as e:
        logger.warning("[ImageEngine][L3] failed: %s", e)
        return build_layer_report(3, "Noise & Statistical", [], "failure", 0, score=0.5)


def _run_l4(img_array, img_pil, target_regions) -> Dict[str, Any]:
    from analyzers.frequency_domain import analyze_frequency_domain
    from utils.evidence_builder import build_layer_report
    try:
        return analyze_frequency_domain(img_array, img_pil, target_regions)
    except Exception as e:
        logger.warning("[ImageEngine][L4] failed: %s", e)
        return build_layer_report(4, "Frequency Domain", [], "failure", 0, score=0.5)


def _run_synthid(img_array, lossless: bool = True) -> Dict[str, Any]:
    from analyzers.synthid_local import check_synthid
    try:
        return check_synthid(img_array, lossless=lossless)
    except Exception as e:
        logger.warning("[ImageEngine][SynthID] failed: %s", e)
        return {"detected": False, "confidence": 0.0, "generator_hint": "none", "track_scores": {}}


def _run_l5_inversion(image_url: str) -> Dict[str, Any]:
    if not _gpu_available() or _gpu_vram_gb() < 4.0:
        return {
            "available": False,
            "score": 0.5,
            "confidence": 0.0,
            "reason": "gpu_unavailable",
        }
    from analyzers.diffusion_inversion import diffusion_inversion_score
    try:
        return {**diffusion_inversion_score(image_url), "available": True}
    except Exception as e:
        logger.warning("[ImageEngine][L5] failed: %s", e)
        return {"available": True, "score": 0.5, "confidence": 0.0, "error": str(e)}


def _run_l5b_snapback(image_url: str) -> Dict[str, Any]:
    if not _gpu_available() or _gpu_vram_gb() < 4.0:
        return {
            "available": False,
            "snapBackScore": 0.5,
            "confidence": 0.0,
            "reason": "gpu_unavailable",
        }
    from analyzers.diffusion_snapback import diffusion_snapback_score
    try:
        return {**diffusion_snapback_score(image_url), "available": True}
    except Exception as e:
        logger.warning("[ImageEngine][L5b] failed: %s", e)
        return {"available": True, "snapBackScore": 0.5, "confidence": 0.0, "error": str(e)}


def _run_l6(img_array, img_pil) -> Dict[str, Any]:
    from analyzers.zed_detector import analyze_zed
    from utils.evidence_builder import build_layer_report
    try:
        return analyze_zed(img_array, img_pil)
    except Exception as e:
        logger.warning("[ImageEngine][L6] failed: %s", e)
        return build_layer_report(6, "Zero-Shot Entropy Detector", [], "failure", 0, score=0.5)


def _run_l7(img_array, img_pil) -> Dict[str, Any]:
    from analyzers.dire_detector import analyze_dire
    from utils.evidence_builder import build_layer_report
    try:
        return analyze_dire(img_array, img_pil)
    except Exception as e:
        logger.warning("[ImageEngine][L7] failed: %s", e)
        return build_layer_report(7, "DIRE Approximation", [], "failure", 0, score=0.5)


def _run_l8(img_array, img_pil) -> Dict[str, Any]:
    from analyzers.nlm_entropy import analyze_nlm_entropy
    from utils.evidence_builder import build_layer_report
    try:
        return analyze_nlm_entropy(img_array, img_pil)
    except Exception as e:
        logger.warning("[ImageEngine][L8] failed: %s", e)
        return build_layer_report(8, "NLM Noise Entropy Tensor", [], "failure", 0, score=0.5)

def _run_l9(img_array, img_pil) -> Dict[str, Any]:
    from analyzers.ai_fingerprint import analyze_ai_fingerprint
    from utils.evidence_builder import build_layer_report
    try:
        return analyze_ai_fingerprint(img_array, img_pil)
    except Exception as e:
        logger.warning("[ImageEngine][L9] failed: %s", e)
        return build_layer_report(9, "Modern AI Fingerprint", [], "failure", 0, score=0.5)


def _run_l10(img_array, img_pil) -> Dict[str, Any]:
    from analyzers.generative_fingerprint import analyze_generative_fingerprint
    from utils.evidence_builder import build_layer_report
    try:
        return analyze_generative_fingerprint(img_array, img_pil)
    except Exception as e:
        logger.warning("[ImageEngine][L10] failed: %s", e)
        return build_layer_report(10, "Generative Fingerprinting Engine", [], "failure", 0, score=0.5)


# ── v3 Forensic layer runners ─────────────────────────────────────────────────

def _run_v3_forensics(temp_path: str) -> Dict[str, Any]:
    """Run all v3 forensic modules CONCURRENTLY on a local file path.
    Was: serial execution ~4-8s total
    Now: parallel ThreadPoolExecutor ~1-2s (wall-clock bounded by slowest module)
    """
    from forensics.metadata_analyzer import analyze_metadata
    from forensics.frequency_analysis import frequency_domain_analysis
    from forensics.noise_analysis import noise_coherence_analysis
    from forensics.texture_color_analysis import texture_analysis, color_analysis, illumination_consistency
    from forensics.face_deepfake import face_specific_analysis
    from forensics.watermark_detector import detect_watermarks
    from forensics.text_artifact_detector import detect_text_artifacts
    from concurrent.futures import ThreadPoolExecutor, as_completed

    def safe(fn, *args, fallback=None):
        try:
            return fn(*args)
        except Exception as e:
            logger.warning("[ImageEngine][v3] %s failed: %s", fn.__name__, e)
            return fallback or {}

    # Submit all 9 tasks to a thread pool — they all read the same file
    # but do independent CPU work, so GIL is released during numpy/cv2 ops
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {
            "metadata":     pool.submit(safe, analyze_metadata,           temp_path, fallback={"score": 0.5}),
            "frequency":    pool.submit(safe, frequency_domain_analysis,  temp_path, fallback={"high_freq_suppression": 0.5}),
            "noise":        pool.submit(safe, noise_coherence_analysis,   temp_path, fallback={"noise_uniformity_score": 0.5}),
            "texture":      pool.submit(safe, texture_analysis,           temp_path, fallback={"texture_smoothness_score": 0.5}),
            "color":        pool.submit(safe, color_analysis,             temp_path, fallback={}),
            "illumination": pool.submit(safe, illumination_consistency,   temp_path, fallback={"illumination_variance": 500}),
            "face":         pool.submit(safe, face_specific_analysis,     temp_path, fallback={"faces_detected": False, "deepfake_score": 0.5}),
            "watermarks":   pool.submit(safe, detect_watermarks,          temp_path, fallback={"overall_watermark_score": 0.0}),
            "text_art":     pool.submit(safe, detect_text_artifacts,      temp_path, fallback={"artifact_score": 0.0}),
        }
        results = {k: f.result() for k, f in futures.items()}

    metadata     = results["metadata"]
    frequency    = results["frequency"]
    noise        = results["noise"]
    texture      = results["texture"]
    color        = results["color"]
    illumination = results["illumination"]
    face         = results["face"]
    watermarks   = results["watermarks"]
    text_art     = results["text_art"]

    import math as _math

    # ── Fixed signal computation (v4.3) ─────────────────────────────────────
    # Bug 1 — noise_uniformity_score is a CV (std/mean of tile noise variances).
    #          It is unbounded and routinely exceeds 1.0 for complex images.
    #          Old code: 1-min(x,1) → clamped to 0.0, giving zero suspicion.
    #          Fix: use tanh so unbounded values collapse smoothly toward 1.
    raw_nu = float(noise.get("noise_uniformity_score", 0.5))
    # Low CV → AI (uniform noise): 1 - tanh(low) ≈ high; High CV → 1 - tanh(high) ≈ low
    noise_uniformity_ai = float(1.0 - min(_math.tanh(raw_nu), 1.0))

    # Bug 2 — "high_freq_suppression" = HF/LF energy ratio (NOT a suppression score).
    #          High values meant MORE HF, not less. And it was multiplied by 2 then clamped.
    #          Fix: use diffusion_noise_score (kurtosis-based, correctly directional)
    #          and grid_artifact_score (DALL-E 64px block grid) instead.
    diffusion_noise = float(min(max(frequency.get("diffusion_noise_score", 0.0), 0), 1))
    grid_artifact   = float(min(max(frequency.get("grid_artifact_score", 0.0), 0), 1))
    frequency_ai    = float(min(max(diffusion_noise * 0.65 + grid_artifact * 0.35, 0), 1))

    # Bug 3 — texture_smoothness_score = homogeneity/contrast.
    #          For hyperrealistic AI images (high contrast/detail) this is near 0 → zero signal.
    #          Fix: use GLCM energy (higher = more patterned/regular = AI).
    glcm_energy_ai = float(min(texture.get("glcm_energy", 0.05) * 10.0, 1.0))

    # Bug 4 — illumination_uniform used variance/1000 but dramatic split-tone AI images
    #          have HUGE variance (e.g. 513), giving: 1-0.51=0.49 (nearly neutral).
    #          Fix: detect bimodal / split-lighting (AI aesthetic) via region range.
    region_means = illumination.get("region_means", [128.0] * 9)
    if region_means and len(region_means) >= 2:
        ill_range = float(max(region_means) - min(region_means))
        # Very high range (>180) = extreme split-tone = AI aesthetic indicator
        # Very low range (<30) = flat lighting = also AI-like (studio perfect)
        if ill_range > 180:
            illumination_ai = float(min(0.50 + (ill_range - 180) / 200.0, 0.85))
        elif ill_range < 30:
            illumination_ai = float(min(0.65 + (30 - ill_range) / 100.0, 0.80))
        else:
            illumination_ai = float(0.30 + ill_range / 600.0)  # natural range → lower suspicion
    else:
        illumination_ai = 0.50

    cv_signals = {
        "metadata":          metadata.get("score", 0.5),
        "frequency":         frequency_ai,
        "noise_uniformity":  noise_uniformity_ai,
        "texture_glcm":      glcm_energy_ai,
        "illumination_ai":   illumination_ai,
        "face_deepfake":     face.get("deepfake_score", 0.5) if face.get("faces_detected") else 0.5,
        "watermark":         watermarks.get("overall_watermark_score", 0.0),
        "text_artifact":     text_art.get("artifact_score", 0.0),
    }

    v3_weights = {
        "metadata": 0.15, "frequency": 0.22, "noise_uniformity": 0.18,
        "texture_glcm": 0.08, "illumination_ai": 0.10,
        "face_deepfake": 0.12, "watermark": 0.10, "text_artifact": 0.05,
    }

    composite = sum(cv_signals[k] * v3_weights[k] for k in v3_weights)

    return {
        "metadata":          metadata,
        "frequency_analysis": frequency,
        "noise_analysis":    noise,
        "texture_color":     {**texture, **color, **illumination},
        "face_deepfake":     face,
        "watermark_detection": watermarks,
        "text_artifacts":    text_art,
        "composite_cv_score": round(float(composite), 4),
        "cv_signals":        cv_signals,
    }


# ── Unified composite scoring ─────────────────────────────────────────────────

def _fuse_scores(v2_layers: list, v3_forensics: Dict[str, Any], synthid: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Unified score fusion v4.3 — rebuilt to fix systematic under-scoring of
    hyperrealistic AI images (DALL-E 3, ChatGPT Image, Midjourney V6, Gemini).

    Strategy:
    ──────────
    1. Layer scores are individually weighted by signal reliability:
       - L1 ELA has high reliability; LBP/CA are unreliable on complex images.
         Instead of averaging across ALL evidence nodes inside each layer,
         we take the MAX within multi-signal layers to surface the strongest hit.
       - L9 (AI Fingerprint) is the most targeted signal — gets full weight.
       - SynthID generator detection included at full weight (was 0.4× before).

    2. v3 forensics composite uses fixed signals (see _run_v3_forensics).
       Previously weighted at 60% of the final score; reduced to 40% because
       several signals were actively wrong (dragging scores toward "real").

    3. Override rules — these short-circuit soft fusion:
       - If ANY layer ≥ 0.92 → hard floor of 0.82 on final score.
       - If SynthID/generator detected (confidence > 0.65) → floor of 0.85.
       - If ≥ 3 layers ≥ 0.70 → floor of 0.75 (three-signal consensus).
       - If metadata score = 0.95+ (literal AI software tag in EXIF) → floor 0.97.

    4. Sigmoid stretch in the ambiguous zone [0.35, 0.65]:
       Signals that agree → pulled toward the consensus; borderline stays near 0.5.
       Avoids the "every image scores ~0.5" failure mode.
    """
    import math as _math
    import numpy as _np_fuse

    # ── Per-layer scoring (with MAX evidence selection for noisy layers) ─────
    layer_scores: list[tuple[float, float]] = []  # (score, weight)

    LAYER_WEIGHTS = {
        1:  1.1,   # L1 Pixel Integrity — reliable ELA signal
        2:  1.0,   # L2 DCT Compression
        3:  0.9,   # L3 Noise — less reliable on complex scenes
        4:  0.9,   # L4 Frequency Domain
        6:  1.0,   # L6 ZED — entropy
        7:  1.0,   # L7 DIRE approximation
        8:  0.9,   # L8 NLM noise tensor
        9:  1.3,   # L9 Modern AI Fingerprint
        10: 1.2,   # L10 Generative Fingerprinting Engine — attribution
    }

    for layer in v2_layers:
        if layer.get("status") == "failure":
            continue
        layer_num = layer.get("layer", 0)
        # Use layerSuspicionScore directly — it already aggregates all evidence
        # nodes inside the layer. Previous evidence-node boost was causing false
        # positives: e.g. clone_region_detection returns confidence=1.0 on JPEG
        # images (JPEG 8×8 block repetition looks like cloned regions), which
        # boosted L1 from 0.90 → 0.97 and triggered any_very_high override.
        base_score = float(layer.get("layerSuspicionScore", 0.5))
        w = LAYER_WEIGHTS.get(layer_num, 1.0)
        layer_scores.append((base_score, w))

    # SynthID / generator detection — now a full voting member
    synthid_conf = 0.0
    synthid_detected = False
    if synthid is not None:
        synthid_conf = float(synthid.get("confidence", 0.0))
        synthid_detected = bool(synthid.get("detected", False))
        if synthid_conf > 0.0:
            layer_scores.append((synthid_conf, 1.2))  # slightly upweighted

    total_w = sum(w for _, w in layer_scores)
    v2_composite = (sum(s * w for s, w in layer_scores) / total_w) if total_w > 0 else 0.5

    # ── v3 forensics ──────────────────────────────────────────────────────────
    v3_cv = float(v3_forensics.get("composite_cv_score", 0.5))

    # ── Raw fusion: 60% layers + 40% v3 ──────────────────────────────────────
    fused_raw = v2_composite * 0.60 + v3_cv * 0.40

    # ── Sigmoid stretch in ambiguous zone ─────────────────────────────────────
    # Maps [0, 1] through a steepened sigmoid centred at 0.5.
    # Values already near 0 or 1 are barely moved; 0.4-0.6 gets stretched.
    def _sigmoid_stretch(x: float, steepness: float = 4.0) -> float:
        # Logistic: f(x) = 1/(1+exp(-k*(x-0.5))); normalise so f(0)→0, f(1)→1
        mid = 1.0 / (1.0 + _math.exp(-steepness * (x - 0.5)))
        lo  = 1.0 / (1.0 + _math.exp(-steepness * (0.0 - 0.5)))
        hi  = 1.0 / (1.0 + _math.exp(-steepness * (1.0 - 0.5)))
        return (mid - lo) / (hi - lo + 1e-9)

    fused = _sigmoid_stretch(fused_raw)

    # ── L7 DIRE reality check (v4.5) ─────────────────────────────────────────
    # L7 (DIRE Approximation) measures how easily a Perona-Malik diffusion model
    # can reconstruct the image. Real photographs are well-explained by natural
    # diffusion processes → LOW L7 score. AI images have structure that's NOT
    # explained by diffusion → HIGH L7 score.
    #
    # Empirical ranges (from test battery):
    #   Real photographs : L7 = 0.04–0.36  (all clearly below 0.42)
    #   AI generators    : L7 = 0.47–0.62  (all clearly above 0.42)
    #
    # When L7 < 0.42, apply a QUADRATIC PENALTY to the fused score and cancel
    # any override floors — prevents false positives where many noisy signals
    # agree on "AI" but the fundamental diffusion reconstruction test says "real".
    l7_score = next(
        (float(l.get("layerSuspicionScore", 0.5))
         for l in v2_layers if l.get("layer") == 7),
        0.5,
    )
    _DIRE_REAL_THRESHOLD = 0.42
    dire_penalty = min(l7_score / _DIRE_REAL_THRESHOLD, 1.0)  # 1.0 = no penalty
    dire_check_fired = (dire_penalty < 1.0)

    if dire_check_fired:
        # Quadratic penalty: L7=0.04 → factor=0.009, L7=0.36 → factor=0.735
        # Reliably brings real-image fused scores below 0.55 classification boundary
        fused = float(fused * (dire_penalty ** 2))

    # ── Override rules (v4.5) ─────────────────────────────────────────────────
    # Thresholds tightened to eliminate two classes of false positives:
    #   1. Evidence-node boost in _fuse_scores can push a layer to 0.92+ even
    #      if the layerSuspicionScore is 0.85. Threshold raised to 0.96.
    #   2. SynthID Track C (Midjourney HF overreach) fires on natural textures
    #      (grass, hair). generator_detected gate raised from 0.45 → 0.55, and
    #      SynthID detected threshold raised to 0.70 (in synthid_local.py).
    all_scores = [s for s, _ in layer_scores]
    high_count = sum(1 for s in all_scores if s >= 0.70)
    # Without evidence-node boost, layer scores are clean layerSuspicionScores.
    # any_very_high fires only when a layer's own aggregate score is ≥ 0.92.
    any_very_high = any(s >= 0.92 for s in all_scores)
    metadata_score = float(v3_forensics.get("metadata", {}).get("score", 0.5))

    floor = 0.0
    override_reason = None
    if metadata_score >= 0.95:
        # Literal AI software tag in EXIF — certain
        floor = 0.97
        override_reason = "ai_software_tag_in_exif"
    elif synthid_detected and synthid_conf >= 0.65:
        # Generator fingerprint: require solid raw fusion to avoid HF-texture FPs
        # (Track C fires on natural grass/hair textures at threshold < 0.55)
        if fused_raw >= 0.58:
            floor = 0.87
            override_reason = f"generator_detected:{synthid.get('generator_hint','ai')}"
    elif any_very_high and fused_raw >= 0.60:
        # Single layer genuinely at 0.92+ with broad agreement
        floor = 0.82
        override_reason = "single_layer_very_high_confidence"
    elif high_count >= 4 and fused_raw >= 0.58:
        # Four-signal consensus: multiple independent high signals
        # Only apply if DIRE check didn't identify this as a real image
        if not dire_check_fired:
            floor = 0.75
            override_reason = "four_layer_consensus"

    fused = float(max(fused, floor))
    fused = float(min(max(fused, 0.0), 1.0))

    return {
        "v2_composite":    round(v2_composite, 4),
        "v3_composite":    round(v3_cv, 4),
        "fused_raw":       round(fused_raw, 4),
        "fused_score":     round(fused, 4),
        "override_floor":  round(floor, 4),
        "override_reason": override_reason,
        "high_signal_count": high_count,
    }


# ── Public entry points ───────────────────────────────────────────────────────

async def analyze_image_from_url(
    image_url: str,
    job_id: str = "",
    target_regions: Optional[list] = None,
    include_gpu_layers: bool = False,
) -> Dict[str, Any]:
    """
    Full image analysis from a URL.
    Used by /analyze-signals (v2 compat) and /analyze (auto-detect).
    Downloads image, runs v2 layers + v3 forensics + optional GPU layers.
    """
    from utils.image_loader import load_image_from_url

    start = time.time()
    target_regions = target_regions or []

    try:
        img_array, img_pil = await load_image_from_url(image_url)
    except Exception as e:
        return {
            "jobId": job_id,
            "status": "error",
            "error": str(e),
            "processingTimeMs": int((time.time() - start) * 1000),
        }

    # Save to temp file for v3 forensics (which expects a file path)
    suffix = ".jpg"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False, dir="/tmp") as tmp:
        img_pil.convert("RGB").save(tmp.name, format="JPEG")
        temp_path = tmp.name

    try:
        # v2 + P4 + L9 + L10 GFE (L1-L4, L6-L10)
        layers = [
            _run_l1(img_array, img_pil, target_regions),
            _run_l2(img_array, img_pil),
            _run_l3(img_array, img_pil),
            _run_l4(img_array, img_pil, target_regions),
            _run_l6(img_array, img_pil),
            _run_l7(img_array, img_pil),
            _run_l8(img_array, img_pil),
            _run_l9(img_array, img_pil),
            _run_l10(img_array, img_pil),
        ]
        synthid = _run_synthid(img_array,
                               lossless=(img_pil.format or "").upper() not in ("JPEG", "JPG"))

        # v3 forensics
        v3 = _run_v3_forensics(temp_path)

        # Optional GPU layers
        l5 = _run_l5_inversion(image_url) if include_gpu_layers else {"available": False, "reason": "not_requested"}
        l5b = _run_l5b_snapback(image_url) if include_gpu_layers else {"available": False, "reason": "not_requested"}

        fused = _fuse_scores(layers, v3, synthid)
        # GFE layer: enrich fused override_reason with best-guess generator attribution
        gfe_layer = next((l for l in layers if l.get("layer") == 10), {})
        gfe_attr  = gfe_layer.get("generative_attribution", {})
        if gfe_attr.get("structural_match_pct", 0) >= 35 and fused.get("override_reason"):
            gfe_gen = gfe_attr.get("top_generator", "")
            sid_gen = (synthid or {}).get("generator_hint", "")
            # Use GFE generator name when it's more specific than SynthID
            if gfe_gen and gfe_gen != "unknown_diffusion":
                fused["generator_display"]  = gfe_attr.get("top_generator_display", "")
                fused["generator_version"]  = gfe_attr.get("top_generator_version", "")
                fused["structural_match_pct"] = gfe_attr.get("structural_match_pct", 0)
                fused["override_reason"]    = f"generator_detected:{gfe_gen}"
        elapsed = int((time.time() - start) * 1000)

        return {
            "jobId": job_id,
            "status": "success",
            "processingTimeMs": elapsed,
            "layers": layers,
            "synthid": synthid,
            "forensics": v3,
            "diffusion_inversion": l5,
            "diffusion_snapback": l5b,
            "composite_score": fused,
            "generative_attribution": gfe_attr,
            "version": VERSION,
        }

    finally:
        try:
            os.remove(temp_path)
        except Exception:
            pass


def analyze_image_from_bytes(
    image_bytes: bytes,
    content_type: str,
    job_id: str = "",
) -> Dict[str, Any]:
    """
    Full image analysis from raw bytes (file upload path).
    Synchronous wrapper — used by /analyze/image endpoint.
    Internally parallelizes v2 layers + v3 forensics for max speed.
    
    Was: serial execution ~6-12s
    Now: parallel execution ~2-4s (all layers run concurrently)
    """
    import io
    import numpy as np
    from PIL import Image
    from concurrent.futures import ThreadPoolExecutor

    start = time.time()

    suffix = ".jpg" if "jpeg" in content_type else f".{content_type.split('/')[-1]}"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False, dir="/tmp") as tmp:
        tmp.write(image_bytes)
        temp_path = tmp.name

    try:
        # Keep a reference to the ORIGINAL decode before .convert("RGB") — PIL
        # drops the .quantization attribute (the embedded JPEG quant table)
        # on conversion, which would otherwise silently break the L2
        # quantization-table check on every upload (verified: a JPEG-loaded
        # Image has .quantization populated; after .convert("RGB") it's gone).
        pil_img_original = Image.open(io.BytesIO(image_bytes))
        pil_img   = pil_img_original.convert("RGB")
        # Resize to max 1024px for analysis — huge images slow everything down
        max_dim   = max(pil_img.width, pil_img.height)
        if max_dim > 1024:
            scale   = 1024 / max_dim
            new_w   = int(pil_img.width  * scale)
            new_h   = int(pil_img.height * scale)
            pil_img = pil_img.resize((new_w, new_h), Image.LANCZOS)
        img_array = np.array(pil_img, dtype=np.uint8)

        # Run v2+P4 layers + v3 forensics + synthid ALL in parallel (10 workers)
        slog.engine_start(job_id=job_id, engine="image")
        _t0 = time.monotonic()
        # L1-L4 (v2), L6-L8 (P4 CPU-only), SynthID, v3 forensics
        with ThreadPoolExecutor(max_workers=12) as pool:
            f_l1      = pool.submit(_run_l1,      img_array, pil_img, [])
            f_l2      = pool.submit(_run_l2,      img_array, pil_img_original)
            f_l3      = pool.submit(_run_l3,      img_array, pil_img)
            f_l4      = pool.submit(_run_l4,      img_array, pil_img, [])
            f_l6      = pool.submit(_run_l6,      img_array, pil_img)
            f_l7      = pool.submit(_run_l7,      img_array, pil_img)
            f_l8      = pool.submit(_run_l8,      img_array, pil_img)
            f_l9      = pool.submit(_run_l9,      img_array, pil_img_original)
            f_l10     = pool.submit(_run_l10,     img_array, pil_img_original)
            f_synthid = pool.submit(_run_synthid, img_array,
                                    "jpeg" not in content_type.lower())
            f_v3      = pool.submit(_run_v3_forensics, temp_path)

            layers  = [f_l1.result(), f_l2.result(), f_l3.result(), f_l4.result(),
                       f_l6.result(), f_l7.result(), f_l8.result(), f_l9.result(),
                       f_l10.result()]
            synthid = f_synthid.result()
            v3      = f_v3.result()
        # P5: emit per-layer structured log lines
        for _lr in layers:
            slog.layer_complete(
                job_id=job_id, engine="image",
                layer=_lr.get("layer", 0),
                latency_ms=_lr.get("elapsed_ms", 0),
                score=_lr.get("layerSuspicionScore"),
                status=_lr.get("status", "unknown"),
            )

        fused   = _fuse_scores(layers, v3, synthid)
        gfe_layer = next((l for l in layers if l.get("layer") == 10), {})
        gfe_attr  = gfe_layer.get("generative_attribution", {})
        if gfe_attr.get("structural_match_pct", 0) >= 35 and fused.get("override_reason"):
            gfe_gen = gfe_attr.get("top_generator", "")
            if gfe_gen and gfe_gen != "unknown_diffusion":
                fused["generator_display"]    = gfe_attr.get("top_generator_display", "")
                fused["generator_version"]    = gfe_attr.get("top_generator_version", "")
                fused["structural_match_pct"] = gfe_attr.get("structural_match_pct", 0)
                fused["override_reason"]      = f"generator_detected:{gfe_gen}"
        elapsed = int((time.time() - start) * 1000)
        logger.info("[ImageEngine] bytes analysis done in %dms", elapsed)

        return {
            "jobId":   job_id,
            "status":  "success",
            "processingTimeMs": elapsed,
            "layers":  layers,
            "synthid": synthid,
            "forensics": v3,
            # expose v3 fields at top level for /api/detect/image-v3 route
            "metadata":           v3.get("metadata",           {}),
            "frequency_analysis": v3.get("frequency_analysis", {}),
            "noise_analysis":     v3.get("noise_analysis",     {}),
            "texture_color":      v3.get("texture_color",      {}),
            "face_deepfake":      v3.get("face_deepfake",      {}),
            "watermark_detection":v3.get("watermark_detection",{}),
            "text_artifacts":     v3.get("text_artifacts",     {}),
            "composite_cv_score": v3.get("composite_cv_score", 0.5),
            "cv_signals":         v3.get("cv_signals",         {}),
            "diffusion_inversion": {"available": False, "reason": "bytes_upload_no_url"},
            "diffusion_snapback":  {"available": False, "reason": "bytes_upload_no_url"},
            "composite_score": fused,
            "version": VERSION,
            # GFE: expose generator attribution at top level
            "generative_attribution": next(
                (l.get("generative_attribution", {}) for l in layers if l.get("layer") == 10), {}
            ),
        }

    except Exception as e:
        logger.error("[ImageEngine] analyze_image_from_bytes failed: %s", e, exc_info=True)
        return {
            "jobId":   job_id,
            "status":  "error",
            "error":   str(e),
            "processingTimeMs": int((time.time() - start) * 1000),
        }

    finally:
        try:
            os.remove(temp_path)
        except Exception:
            pass

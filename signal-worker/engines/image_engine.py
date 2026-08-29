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
import hashlib
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
# ── In-process result cache (prevents re-analysis of same image) ──────────────
_RESULT_CACHE: dict = {}
_RESULT_CACHE_MAX = 50

def _cache_key(image_bytes: bytes) -> str:
    # Fix (2026-08-19): previously hashed only the first 64KB
    # (`image_bytes[:65536]`), so two different files sharing an identical
    # first 64KB — e.g. same header/thumbnail with different payloads past
    # that point — collided and one image's cached inference result could
    # be served for the other. Hash the full file content instead.
    return hashlib.sha256(image_bytes).hexdigest()

def _cache_get(key: str):
    return _RESULT_CACHE.get(key)

def _cache_set(key: str, result: dict):
    if len(_RESULT_CACHE) >= _RESULT_CACHE_MAX:
        oldest = next(iter(_RESULT_CACHE))
        del _RESULT_CACHE[oldest]
    _RESULT_CACHE[key] = result




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


# ── Document/ID Forensics runner (L22, v4.9.0, PROVISIONAL) ────────────────────

def _run_document_layer(img_array, img_pil) -> Dict[str, Any]:
    """
    Layer 22 — Document/ID Security Forensics [provisional]. Section 1.1 of
    the giant-level image engine optimization directive. Classify-then-route:
    analyzers/document_forensics.py's classify_image_type() cheaply decides
    whether this upload is a document/ID/passport/receipt; only then does
    the five-signal security-feature submodule (hologram/OVI, microprint,
    guilloche, UV-paper-texture proxy, font consistency) run. Reports
    status="not_applicable" for ordinary photos, so this costs ~nothing on
    the large majority of uploads. PROVISIONAL — uncalibrated against a
    labeled real-ID-vs-fake-ID dataset, same caveat as L20/L21; see the
    module docstring for why, and LAYER_WEIGHTS[22] below for how that's
    reflected in fusion.
    """
    from analyzers.document_forensics import analyze_document_forensics
    from utils.evidence_builder import build_layer_report
    try:
        return analyze_document_forensics(img_array, img_pil)
    except Exception as e:
        logger.warning("[ImageEngine][L22] failed: %s", e)
        return build_layer_report(
            22, "Document/ID Security Forensics [provisional]", [], "failure", 0, score=0.5
        )


# ── Physical Consistency Layer runners (L11-L14) ──────────────────────────────

def _run_physical_layers(img_array, img_pil) -> Dict[str, Any]:
    """
    Run the Physical Consistency ensemble (PAFRA + BDIS + SSWDP + QESM).
    Returns the full run_physical_analysis dict.
    Fails silently — on error returns neutral composite_score=0.5 and empty
    layer_reports so the rest of the pipeline is unaffected.
    """
    from analyzers.physical_consistency import run_physical_analysis
    from utils.evidence_builder import build_layer_report
    try:
        return run_physical_analysis(img_array, img_pil)
    except Exception as e:
        logger.warning("[ImageEngine][Physical] failed: %s", e)
        neutral_layers = [
            build_layer_report(11, "PAFRA – Polarization & Fresnel Analysis",    [], "failure", 0, score=0.5),
            build_layer_report(12, "BDIS – Bayer Demosaicing Inconsistency",      [], "failure", 0, score=0.5),
            build_layer_report(13, "SSWDP – Subsurface Scattering Profile",       [], "failure", 0, score=0.5),
            build_layer_report(14, "QESM – Quantum Efficiency Spectral Match",    [], "failure", 0, score=0.5),
        ]
        return {
            "pafra": {"score": 0.5, "status": "failure", "evidence": []},
            "bdis":  {"score": 0.5, "status": "failure", "evidence": []},
            "sswdp": {"score": 0.5, "status": "failure", "evidence": []},
            "qesm":  {"score": 0.5, "status": "failure", "evidence": []},
            "composite_score": 0.5,
            "active_signals":  0,
            "layer_reports":   neutral_layers,
            "elapsed_ms":      0,
        }


# ── Object Physics Layer runners (L15-L19, v4.7.0) ─────────────────────────────

def _run_object_physics_layers(img_array, img_pil) -> Dict[str, Any]:
    """
    Run the Object Physics ensemble (OBP + MRC + GPC + TSAD + OSIP).
    Returns the full run_object_physics_analysis dict.
    Fails silently — on error returns neutral composite_score=0.5 and empty
    layer_reports so the rest of the pipeline is unaffected, matching the
    L11-L14 failure-handling pattern in _run_physical_layers above.
    """
    from analyzers.object_physics_ensemble import run_object_physics_analysis
    from utils.evidence_builder import build_layer_report
    try:
        return run_object_physics_analysis(img_array, img_pil)
    except Exception as e:
        logger.warning("[ImageEngine][ObjectPhysics] failed: %s", e)
        neutral_layers = [
            build_layer_report(15, "OBP – Object Boundary Physics",             [], "failure", 0, score=0.5),
            build_layer_report(16, "MRC – Material Reflectance Consistency",    [], "failure", 0, score=0.5),
            build_layer_report(17, "GPC – 3D Geometry & Perspective Consistency", [], "failure", 0, score=0.5),
            build_layer_report(18, "TSAD – Texture Synthesis Artifact Detection", [], "failure", 0, score=0.5),
            build_layer_report(19, "OSIP – Object-Scene Interaction Physics",   [], "failure", 0, score=0.5),
        ]
        return {
            "obp":  {"score": 0.5, "status": "failure", "evidence": []},
            "mrc":  {"score": 0.5, "status": "failure", "evidence": []},
            "gpc":  {"score": 0.5, "status": "failure", "evidence": []},
            "tsad": {"score": 0.5, "status": "failure", "evidence": []},
            "osip": {"score": 0.5, "status": "failure", "evidence": []},
            "composite_score": 0.5,
            "active_signals":  0,
            "layer_reports":   neutral_layers,
            "elapsed_ms":      0,
        }


# ── Extended Physics layer runner (L20-L21, v4.8.0, PROVISIONAL) ───────────────

def _run_extended_physics_layers(img_array, img_pil) -> Dict[str, Any]:
    """
    Run the Extended Physics ensemble (MISG + LOP). PROVISIONAL — see
    analyzers/extended_physics_ensemble.py module docstring: these two
    layers' thresholds are not yet calibrated against a labeled dataset,
    so they're wired in at low weight (LAYER_WEIGHTS[20], [21]) rather
    than excluded entirely — this lets their raw evidence flow through for
    human review and future calibration-dataset construction without
    letting an uncalibrated signal meaningfully move the fused verdict.
    Fails silently on error, same pattern as _run_object_physics_layers.
    """
    from analyzers.extended_physics_ensemble import run_extended_physics_analysis
    from utils.evidence_builder import build_layer_report
    try:
        return run_extended_physics_analysis(img_array, img_pil)
    except Exception as e:
        logger.warning("[ImageEngine][ExtendedPhysics] failed: %s", e)
        neutral_layers = [
            build_layer_report(20, "MISG – Multi-Illuminant & Global Shadow Geometry [provisional]", [], "failure", 0, score=0.5),
            build_layer_report(21, "LOP – Lens & Optical Physics [provisional]",                       [], "failure", 0, score=0.5),
        ]
        return {
            "misg": {"score": 0.5, "status": "failure", "evidence": []},
            "lop":  {"score": 0.5, "status": "failure", "evidence": []},
            "composite_score": 0.5,
            "active_signals":  0,
            "layer_reports":   neutral_layers,
            "elapsed_ms":      0,
        }


# ── v3 Forensic layer runners ─────────────────────────────────────────────────

def _run_v3_forensics(img_array: "np.ndarray", temp_path: str) -> Dict[str, Any]:
    """Run all v3 forensic modules CONCURRENTLY.
    Fix #6 (v4.5.0): most modules now operate on the already-decoded
    img_array instead of independently re-reading the same file from disk
    (was 9x redundant disk I/O per request). Only metadata analysis still
    needs the file path (EXIF must be read from the original file bytes).
    Was: serial execution ~4-8s total
    Now: parallel ThreadPoolExecutor ~1-2s (wall-clock bounded by slowest module)
    """
    from forensics.metadata_analyzer import analyze_metadata
    from forensics.frequency_analysis import frequency_domain_analysis
    from forensics.noise_analysis import noise_coherence_analysis
    from forensics.texture_color_analysis import texture_analysis, color_analysis, illumination_consistency
    from forensics.object_deepfake import object_specific_analysis
    from forensics.watermark_detector import detect_watermarks
    from forensics.text_artifact_detector import detect_text_artifacts
    from concurrent.futures import ThreadPoolExecutor, as_completed

    def safe(fn, *args, fallback=None):
        try:
            return fn(*args)
        except Exception as e:
            logger.warning("[ImageEngine][v3] %s failed: %s", fn.__name__, e)
            return fallback or {}

    # Submit all 9 tasks to a thread pool — only metadata still reads from
    # disk; everything else operates on the shared in-memory img_array.
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {
            "metadata":     pool.submit(safe, analyze_metadata,           temp_path, fallback={"score": 0.5}),
            "frequency":    pool.submit(safe, frequency_domain_analysis,  img_array, fallback={"high_freq_suppression": 0.5}),
            "noise":        pool.submit(safe, noise_coherence_analysis,   img_array, fallback={"noise_uniformity_score": 0.5}),
            "texture":      pool.submit(safe, texture_analysis,           img_array, fallback={"texture_smoothness_score": 0.5}),
            "color":        pool.submit(safe, color_analysis,             img_array, fallback={}),
            "illumination": pool.submit(safe, illumination_consistency,   img_array, fallback={"illumination_variance": 500}),
            "face":         pool.submit(safe, object_specific_analysis,   img_array, fallback={"faces_detected": False, "deepfake_score": 0.5}),
            "watermarks":   pool.submit(safe, detect_watermarks,          img_array, fallback={"overall_watermark_score": 0.0}),
            "text_art":     pool.submit(safe, detect_text_artifacts,      img_array, fallback={"artifact_score": 0.0}),
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

def _maybe_attach_generator_attribution(fused: Dict[str, Any], gfe_attr: Dict[str, Any]) -> None:
    """
    Module 1 fix: only attach a specific vendor name (e.g. "Google Gemini /
    Imagen") to the fused result when we have STRONG, genuinely content-driven
    evidence for it -- never merely because *some* override fired (which can be
    driven by format-prior signals like PNG+no-EXIF, unrelated to GFE's own
    generator match).

    Previous behaviour: any override_reason + GFE structural_match_pct >= 35%
    (i.e. the top single-generator heuristic score was as low as 0.35, only
    slightly above GFE's own "unknown" floor) was enough to slap a specific
    product name + version onto the result. That is not solid evidence.

    New gate, ALL of the following must hold:
      1. An override already fired (fused_raw crossed the AI threshold).
      2. GFE's top single-generator match is >= 0.65 (was 0.35).
      3. GFE's overall_ai_score (noisy-OR across ALL generator profiles,
         a broader corroborating signal) is also >= 0.55 -- guards against
         one profile spiking on noise while the others disagree.

    When these aren't met but an override still fired, we keep a generic,
    non-attributed AI-suspected reason instead of inventing a vendor name.
    """
    structural_pct = gfe_attr.get("structural_match_pct", 0) or 0
    overall_ai = gfe_attr.get("overall_ai_score", 0) or 0
    gfe_gen = gfe_attr.get("top_generator", "")

    if not fused.get("override_reason"):
        return

    strong_specific_match = (structural_pct >= 65) and (overall_ai >= 0.55)

    if strong_specific_match and gfe_gen and gfe_gen != "unknown_diffusion":
        fused["generator_display"]    = gfe_attr.get("top_generator_display", "")
        fused["generator_version"]    = gfe_attr.get("top_generator_version", "")
        fused["structural_match_pct"] = structural_pct
        fused["override_reason"]      = f"generator_detected:{gfe_gen}"
    elif fused.get("override_reason", "").startswith("generator_detected:"):
        # A generator_detected override fired (from SynthID track scores, see
        # _fuse_scores) but GFE attribution doesn't independently corroborate
        # a specific vendor with strong confidence -- downgrade to a generic,
        # non-attributed message rather than presenting a named product.
        fused["generator_display"] = "AI generation suspected"
        fused["generator_version"] = "signature inconclusive"
        fused["override_reason"]   = "ai_generation_suspected_low_specificity"


def _fuse_scores(
    v2_layers: list,
    v3_forensics: Dict[str, Any],
    synthid: Optional[Dict[str, Any]] = None,
    brain: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
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

    1b. (Unification, v4.6) `brain` — the Vercel-side Brain's 18-signal
       heuristic score (image-detection-brain.ts), passed in from the caller
       as an optional pre-computed float. When present, it becomes a THIRD
       top-level pillar alongside v2_composite and v3_cv (see fused_raw
       below) instead of being blended separately in JS via a 5-branch
       availability-weighted ensemble. This is the single source of truth
       for Brain+Engine fusion — hf-analyze.ts no longer runs its own
       Brain-vs-CV arithmetic once this worker has folded Brain in here.
       Brain's own pixel-decode/calibration is untouched — this only changes
       WHERE its score gets combined with everything else, not HOW it's
       computed.

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
    layer_by_num: dict[int, float] = {}  # layer_num -> layerSuspicionScore, for corroboration checks

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
        11: 1.0,   # L11 PAFRA — Polarization (scene-dependent, neutral when N/A)
        12: 1.3,   # L12 BDIS — Bayer pattern (always active)
        13: 1.0,   # L13 SSWDP — SSS decay (portrait-dependent)
        14: 0.9,   # L14 QESM — Quantum efficiency (gray-region-dependent)
        # L15-L19 (v4.7.0): Object Physics Ensemble. Weights kept in sync
        # with analyzers/object_physics_ensemble.py's internal _WEIGHTS.
        15: 1.1,   # L15 OBP — Object Boundary Physics (always active)
        16: 1.0,   # L16 MRC — Material Reflectance Consistency (always active)
        17: 0.9,   # L17 GPC — Geometry & Perspective (scene-dependent, neutral when N/A)
        18: 1.2,   # L18 TSAD — Texture Synthesis Artifacts (always active, strongest vs. diffusion VAEs)
        19: 1.0,   # L19 OSIP — Object-Scene Interaction Physics (always active)
        # L20-L21 (v4.8.0): PROVISIONAL — uncalibrated, see
        # analyzers/extended_physics_ensemble.py module docstring. Weighted
        # low deliberately; raise only after a real calibration pass.
        20: 0.35,  # L20 MISG — Multi-Illuminant & Global Shadow Geometry
        21: 0.45,  # L21 LOP — Lens & Optical Physics (chromatic aberration)
        # L22 (v4.9.0): PROVISIONAL — uncalibrated, see
        # analyzers/document_forensics.py module docstring. Also
        # status="not_applicable" (skipped entirely, see loop below) for the
        # large majority of uploads that aren't documents/IDs in the first
        # place — this weight only matters for the minority that classify
        # as document-like.
        22: 0.40,  # L22 Document/ID Security Forensics (hologram/microprint/guilloche/UV/font)
    }

    for layer in v2_layers:
        # Fix #4/#9 (v4.5.0): skip layers that explicitly opted out via
        # status="not_applicable" (e.g. SSWDP on a product photo with no
        # skin/translucent material) — including their neutral score=0.5 in
        # the weighted average dilutes strong signals from layers that DO
        # have something to say about this image. "failure" was already
        # skipped; "not_applicable" is a distinct, deliberate signal from the
        # analyzer itself (not an error) and must be skipped too.
        # v4.7.0: L17 (GPC) uses status="neutral_scene_type" for the same
        # deliberate-opt-out reason L13/L14 use "not_applicable" (e.g. a
        # macro shot or texture fill with no reliable straight edges to
        # measure vanishing-point consistency from) — must be skipped for
        # the same reason "not_applicable" is: including its neutral 0.5
        # in the weighted average would dilute real signal from layers
        # that DO have something to say about this image.
        if layer.get("status") in ("failure", "not_applicable", "neutral_scene_type"):
            continue
        layer_num = layer.get("layer", 0)
        # Use layerSuspicionScore directly — it already aggregates all evidence
        # nodes inside the layer. Previous evidence-node boost was causing false
        # positives: e.g. clone_region_detection returns confidence=1.0 on JPEG
        # images (JPEG 8×8 block repetition looks like cloned regions), which
        # boosted L1 from 0.90 → 0.97 and triggered any_very_high override.
        base_score = float(layer.get("layerSuspicionScore", 0.5))
        w = LAYER_WEIGHTS.get(layer_num, 1.0)

        # Fix #9 (v4.5.0): dynamic weight adjustment. A layer that came back
        # with status="success" but landed exactly on the neutral midpoint
        # (e.g. a scene-dependent physical-consistency layer whose own
        # internal logic decided to return 0.5 without formally marking
        # itself not_applicable) still shouldn't get full voting weight —
        # it's not actively wrong, but it's also not informative. Reduce its
        # weight rather than skip it outright, since a true borderline 0.5
        # from a fully-applicable layer is still worth partial weight.
        if abs(base_score - 0.5) < 0.05:
            w *= 0.3

        layer_scores.append((base_score, w))
        layer_by_num[layer_num] = base_score

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

    # ── Brain unification (v4.6) ──────────────────────────────────────────────
    # `brain` is the Vercel-side 18-signal heuristic score, sent over from
    # hf-analyze.ts as part of the same request that carries the image bytes.
    # Validated defensively — a malformed/missing brain payload must never
    # break analysis, it just falls back to the pre-unification 2-pillar split.
    brain_score: Optional[float] = None
    if isinstance(brain, dict):
        _b = brain.get("score")
        if isinstance(_b, (int, float)) and 0.0 <= float(_b) <= 1.0:
            brain_score = float(_b)

    # ── Raw fusion ─────────────────────────────────────────────────────────
    # With brain: 45% v2 layers (L1-L14 physics) + 30% v3 forensics + 25% Brain
    #   — Brain is itself an 18-signal aggregate (comparable in stature to the
    #   whole v2/v3 pillars, not a single weak feature), hence its own
    #   top-level slice rather than folding it into layer_scores as one vote.
    # Without brain (unchanged v4.5 behavior): 60% v2 layers + 40% v3.
    if brain_score is not None:
        fused_raw = v2_composite * 0.45 + v3_cv * 0.30 + brain_score * 0.25
    else:
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
    # the override floors below EXCEPT the literal-EXIF-tag override — prevents
    # false positives where many noisy signals agree on "AI" but the
    # fundamental diffusion reconstruction test says "real". (v4.5.1: this
    # comment previously claimed ALL override floors were cancelled, but only
    # four_layer_consensus actually checked dire_check_fired — generator_detected
    # and single_layer_very_high_confidence silently ignored it and could still
    # force-floor a DIRE-confirmed-real image to 0.82-0.87. Now fixed to match
    # this comment's original intent, with the EXIF-tag override left as a
    # deliberate exception since a literal AI-tool tag is stronger ground truth
    # than any pixel-domain heuristic.)
    l7_score = next(
        (float(l.get("layerSuspicionScore", 0.5))
         for l in v2_layers if l.get("layer") == 7),
        0.5,
    )
    _DIRE_REAL_THRESHOLD = 0.42
    dire_penalty = min(l7_score / _DIRE_REAL_THRESHOLD, 1.0)  # 1.0 = no penalty
    dire_check_fired = (dire_penalty < 1.0)

    if dire_check_fired:
        # Fix #11 (v4.5.0): linear penalty instead of quadratic.
        # Quadratic was too aggressive for edge-case real photos near the
        # threshold: L7=0.36 → penalty=0.86 → quadratic factor=0.74 (fused
        # cut by 26% even though L7 was only mildly below the real-photo
        # ceiling). Linear: L7=0.04 → factor=0.095, L7=0.36 → factor=0.86 —
        # still strongly suppresses clear-real cases (low L7) while being
        # gentler near the boundary.
        fused = float(fused * dire_penalty)

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
    # Content-based layers only (pixel/frequency/noise/scene forensics) --
    # deliberately EXCLUDES L9 (partly format-prior driven) and L10/L12-L14
    # which can be scene- or sensor-dependent. Used below as independent
    # corroboration so format priors alone can never satisfy an override.
    CONTENT_LAYERS = (1, 2, 3, 4, 6, 7, 8)
    content_corroboration = any(
        layer_by_num.get(n, 0.0) >= 0.55 for n in CONTENT_LAYERS
    )

    if metadata_score >= 0.95:
        # Literal AI software tag in EXIF — certain
        floor = 0.97
        override_reason = "ai_software_tag_in_exif"
    elif synthid_detected and synthid_conf >= 0.75 and content_corroboration and not dire_check_fired:
        # Module 1 fix: previously gated on fused_raw >= 0.58, but fused_raw
        # blends in L9 which is partly driven by a pure format prior
        # (PNG + no EXIF), so a real screenshot/webphoto could satisfy this
        # gate with zero genuine generator signal. Now requires BOTH a high
        # SynthID track confidence (raised 0.65 -> 0.75) AND independent
        # corroboration from at least one purely content-based forensic layer.
        # Fix (v4.5.1): also gated on `not dire_check_fired` — SynthID Track C
        # is known to overreach on natural textures (grass/hair, see Fix #2
        # comment above); when DIRE's diffusion-reconstruction test says the
        # image is clearly real, this override must not be able to out-vote
        # it. Previously this branch force-floored to 0.87 regardless of
        # dire_check_fired, silently defeating the DIRE penalty applied to
        # `fused` a few lines above and reintroducing the exact false-positive
        # class Fix #11 was meant to eliminate.
        floor = 0.87
        override_reason = f"generator_detected:{synthid.get('generator_hint','ai')}"
    elif any_very_high and fused_raw >= 0.60 and not dire_check_fired:
        # Single layer genuinely at 0.92+ with broad agreement.
        # Fix (v4.5.1): gated on `not dire_check_fired` for the same reason as
        # generator_detected above — a single layer spiking to 0.92+ (e.g. an
        # evidence-node quirk) should not be able to override a clear DIRE
        # real-photo signal.
        floor = 0.82
        override_reason = "single_layer_very_high_confidence"
    elif high_count >= 4 and fused_raw >= 0.58:
        # Four-signal consensus: multiple independent high signals.
        # Note: content_corroboration is intentionally NOT required here.
        # It was added alongside the generator_detected fix below, but L9's
        # format-prior sub-signal was already independently weakened at the
        # source (ai_fingerprint.py _lossless_no_exif_score: 0.24 fusion
        # weight -> 0.08, magnitude 0.82 -> 0.55 ceiling) -- L9 crossing high
        # is now itself predominantly content-driven. Requiring a SECOND,
        # separate content layer (L1/2/3/4/6/7/8) to ALSO independently hit
        # 0.55 was overly strict double-gating that blocked legitimate
        # four-layer consensus built from L9/L10/L12/L13/L14 alone, and was
        # measurably hurting recall on genuine AI-generated images.
        # Only apply if DIRE check didn't identify this as a real image
        if not dire_check_fired:
            floor = 0.75
            override_reason = "four_layer_consensus"

    fused = float(max(fused, floor))
    fused = float(min(max(fused, 0.0), 1.0))

    return {
        "v2_composite":    round(v2_composite, 4),
        "v3_composite":    round(v3_cv, 4),
        "brain_composite": round(brain_score, 4) if brain_score is not None else None,
        "brain_included":  brain_score is not None,
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
    import numpy as np
    from PIL import Image
    from utils.image_loader import load_image_from_url
    from concurrent.futures import ThreadPoolExecutor

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
        # Resize to max 768px for consistent fast analysis (URL path had no cap)
        _max_url = 768
        if max(img_pil.width, img_pil.height) > _max_url:
            _scale = _max_url / max(img_pil.width, img_pil.height)
            _nw = int(img_pil.width * _scale)
            _nh = int(img_pil.height * _scale)
            img_pil = img_pil.resize((_nw, _nh), Image.LANCZOS)
            img_array = np.array(img_pil, dtype=np.uint8)

        # v4.7.0 fix: this path (used by /analyze-signals and the web
        # scanner) previously ran L1-L10 as a plain sequential list while
        # the upload path (analyze_image_from_bytes) ran the same layers in
        # a 12-worker ThreadPoolExecutor. That asymmetry made URL-based
        # scans several times slower for no reason, and made them more
        # likely to hit per-layer timeouts under load — since each timed-out
        # layer silently degrades to a neutral 0.5 (see the "not_applicable"/
        # "failure" skip logic in _fuse_scores), that raised the false
        # negative rate specifically on URL-scanned images (bulk site
        # crawling, the web scanner) relative to direct uploads. Now runs
        # concurrently, matching the bytes path.
        with ThreadPoolExecutor(max_workers=15) as pool:
            f_l1  = pool.submit(_run_l1, img_array, img_pil, target_regions)
            f_l2  = pool.submit(_run_l2, img_array, img_pil)
            f_l3  = pool.submit(_run_l3, img_array, img_pil)
            f_l4  = pool.submit(_run_l4, img_array, img_pil, target_regions)
            f_l6  = pool.submit(_run_l6, img_array, img_pil)
            f_l7  = pool.submit(_run_l7, img_array, img_pil)
            f_l8  = pool.submit(_run_l8, img_array, img_pil)
            f_l9  = pool.submit(_run_l9, img_array, img_pil)
            f_l10 = pool.submit(_run_l10, img_array, img_pil)
            f_doc = pool.submit(_run_document_layer, img_array, img_pil)
            f_phys = pool.submit(_run_physical_layers, img_array, img_pil)
            # v4.7.0: L15-L19 Object Physics Ensemble, same pool as L11-L14.
            f_objphys = pool.submit(_run_object_physics_layers, img_array, img_pil)
            # v4.8.0: L20-L21 Extended Physics (provisional weight, see runner docstring)
            f_extphys = pool.submit(_run_extended_physics_layers, img_array, img_pil)
            f_synthid = pool.submit(
                _run_synthid, img_array,
                (img_pil.format or "").upper() not in ("JPEG", "JPG"),
            )
            f_v3 = pool.submit(_run_v3_forensics, img_array, temp_path)

            layers = [f_l1.result(), f_l2.result(), f_l3.result(), f_l4.result(),
                      f_l6.result(), f_l7.result(), f_l8.result(), f_l9.result(),
                      f_l10.result(), f_doc.result()]
            physical = f_phys.result()
            layers.extend(physical.get("layer_reports", []))
            object_physics = f_objphys.result()
            layers.extend(object_physics.get("layer_reports", []))
            extended_physics = f_extphys.result()
            layers.extend(extended_physics.get("layer_reports", []))
            synthid = f_synthid.result()
            v3      = f_v3.result()

        # Optional GPU layers
        l5 = _run_l5_inversion(image_url) if include_gpu_layers else {"available": False, "reason": "not_requested"}
        l5b = _run_l5b_snapback(image_url) if include_gpu_layers else {"available": False, "reason": "not_requested"}

        fused = _fuse_scores(layers, v3, synthid)
        # GFE layer: enrich fused override_reason with best-guess generator attribution
        gfe_layer = next((l for l in layers if l.get("layer") == 10), {})
        gfe_attr  = gfe_layer.get("generative_attribution", {})
        _maybe_attach_generator_attribution(fused, gfe_attr)
        elapsed = int((time.time() - start) * 1000)

        return {
            "jobId": job_id,
            "status": "success",
            "processingTimeMs": elapsed,
            "layers": layers,
            "synthid": synthid,
            "forensics": v3,
            "physical_consistency": physical,
            "diffusion_inversion": l5,
            "diffusion_snapback": l5b,
            "composite_score": fused,
            "generative_attribution": gfe_attr,
            "version": VERSION,
            # L22 (v4.9.0): see analyze_image_from_bytes for why this is
            # surfaced at top level.
            "document_analysis": next(
                (l.get("document_classification", {}) for l in layers if l.get("layer") == 22), {}
            ),
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
    brain_result: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Full image analysis from raw bytes (file upload path).
    Synchronous wrapper — used by /analyze/image endpoint.
    Internally parallelizes v2 layers + v3 forensics for max speed.
    
    Was: serial execution ~6-12s
    Now: parallel execution ~2-4s (all layers run concurrently)

    brain_result (v4.6): optional pre-computed score from the Vercel-side
    Brain (image-detection-brain.ts), forwarded by main.py's /analyze/image
    handler when the caller sends it. See _fuse_scores() for how it's used —
    None here just means "unification not available for this request",
    never a hard failure.
    """
    import io
    import numpy as np
    from PIL import Image
    from concurrent.futures import ThreadPoolExecutor

    start = time.time()

    # Check in-process cache first
    _ck = _cache_key(image_bytes)
    _cached = _cache_get(_ck)
    if _cached is not None:
        logger.info("[ImageEngine] cache hit, returning cached result")
        return {**_cached, "jobId": job_id, "cache_hit": True}

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
        if max_dim > 768:
            scale   = 768 / max_dim
            new_w   = int(pil_img.width  * scale)
            new_h   = int(pil_img.height * scale)
            pil_img = pil_img.resize((new_w, new_h), Image.LANCZOS)
        img_array = np.array(pil_img, dtype=np.uint8)

        # Run v2+P4 layers + v3 forensics + synthid ALL in parallel.
        slog.engine_start(job_id=job_id, engine="image")
        _t0 = time.monotonic()
        # L1-L4 (v2), L6-L10 (P4/GFE), L11-L14 (physical), L15-L19 (object
        # physics, v4.7.0), L20-L21 (extended physics, v4.8.0, provisional),
        # SynthID, v3 forensics — 14 concurrent tasks.
        with ThreadPoolExecutor(max_workers=15) as pool:
            f_l1      = pool.submit(_run_l1,      img_array, pil_img, [])
            f_l2      = pool.submit(_run_l2,      img_array, pil_img_original)
            f_l3      = pool.submit(_run_l3,      img_array, pil_img)
            f_l4      = pool.submit(_run_l4,      img_array, pil_img, [])
            f_l6      = pool.submit(_run_l6,      img_array, pil_img)
            f_l7      = pool.submit(_run_l7,      img_array, pil_img)
            f_l8      = pool.submit(_run_l8,      img_array, pil_img)
            f_l9      = pool.submit(_run_l9,      img_array, pil_img_original)
            f_l10     = pool.submit(_run_l10,     img_array, pil_img_original)
            f_doc     = pool.submit(_run_document_layer, img_array, pil_img_original)
            f_phys    = pool.submit(_run_physical_layers, img_array, pil_img)
            # v4.7.0: L15-L19 Object Physics Ensemble, submitted alongside
            # L11-L14 so it doesn't add to wall-clock time (bounded by the
            # slowest task in the pool, same as every other layer here).
            f_objphys = pool.submit(_run_object_physics_layers, img_array, pil_img)
            # v4.8.0: L20-L21 Extended Physics (provisional weight, see runner docstring)
            f_extphys = pool.submit(_run_extended_physics_layers, img_array, pil_img)
            f_synthid = pool.submit(_run_synthid, img_array,
                                    "jpeg" not in content_type.lower())
            f_v3      = pool.submit(_run_v3_forensics, img_array, temp_path)

            layers  = [f_l1.result(), f_l2.result(), f_l3.result(), f_l4.result(),
                       f_l6.result(), f_l7.result(), f_l8.result(), f_l9.result(),
                       f_l10.result(), f_doc.result()]
            physical = f_phys.result()
            layers.extend(physical.get("layer_reports", []))
            object_physics = f_objphys.result()
            layers.extend(object_physics.get("layer_reports", []))
            extended_physics = f_extphys.result()
            layers.extend(extended_physics.get("layer_reports", []))
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

        fused   = _fuse_scores(layers, v3, synthid, brain=brain_result)
        gfe_layer = next((l for l in layers if l.get("layer") == 10), {})
        gfe_attr  = gfe_layer.get("generative_attribution", {})
        _maybe_attach_generator_attribution(fused, gfe_attr)
        elapsed = int((time.time() - start) * 1000)
        logger.info("[ImageEngine] bytes analysis done in %dms", elapsed)

        result = {
            "jobId":   job_id,
            "status":  "success",
            "processingTimeMs": elapsed,
            "layers":  layers,
            "synthid": synthid,
            "forensics": v3,
            "physical_consistency": physical,
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
            # L22 (v4.9.0): expose document/ID classification at top level so
            # the frontend can branch into a Document Verification view
            # without digging through the layers array. Empty dict when L22
            # didn't run (e.g. failed) rather than when it ran and found
            # "not a document" — that case still has a populated dict with
            # is_document=False, which the frontend can use to explain why
            # no document-specific evidence is shown.
            "document_analysis": next(
                (l.get("document_classification", {}) for l in layers if l.get("layer") == 22), {}
            ),
        }
        _cache_set(_ck, result)
        return result

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

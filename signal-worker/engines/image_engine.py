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


def _run_synthid(img_array) -> Dict[str, Any]:
    from analyzers.synthid_local import check_synthid
    try:
        return check_synthid(img_array)
    except Exception as e:
        logger.warning("[ImageEngine][SynthID] failed: %s", e)
        return {"detected": False, "confidence": 0.0, "error": str(e)}


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

    cv_signals = {
        "metadata":              metadata.get("score", 0.5),
        "frequency":             min(frequency.get("high_freq_suppression", 0.5) * 2, 1.0),
        "noise_uniformity":      1.0 - min(noise.get("noise_uniformity_score", 0.5), 1.0),
        "texture_smoothness":    texture.get("texture_smoothness_score", 0.5),
        "illumination_uniform":  1.0 - min(illumination.get("illumination_variance", 500) / 1000, 1.0),
        "face_deepfake":         face.get("deepfake_score", 0.5) if face.get("faces_detected") else 0.5,
        "watermark":             watermarks.get("overall_watermark_score", 0.0),
        "text_artifact":         text_art.get("artifact_score", 0.0),
    }

    v3_weights = {
        "metadata": 0.20, "frequency": 0.15, "noise_uniformity": 0.15,
        "texture_smoothness": 0.10, "illumination_uniform": 0.10,
        "face_deepfake": 0.15, "watermark": 0.10, "text_artifact": 0.05,
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
    """Weighted fusion of v2 layer scores, SynthID, and v3 composite CV score.

    NOTE: SynthID was previously computed (_run_synthid) and returned in the
    API response under a top-level "synthid" key, but was NEVER included in
    this fusion — its signal was silently discarded. This is specifically
    useful for catching Google/Imagen/Gemini-generated images (SynthID is
    Google's image watermarking scheme), so dropping it directly hurt
    detection of exactly that generator family. It's a weaker, heuristic-only
    proxy without the real verification key, so it's included at reduced
    weight (0.4x a full layer) rather than as an equal vote.
    """
    weighted = [
        (l.get("layerSuspicionScore", 0.5), 1.0)
        for l in v2_layers
        if l.get("status") != "failure"
    ]
    if synthid is not None and "confidence" in synthid:
        # confidence is already calibrated as "how AI/SynthID-like" — use directly.
        weighted.append((float(synthid.get("confidence", 0.5)), 0.4))

    total_w = sum(w for _, w in weighted)
    v2_composite = sum(s * w for s, w in weighted) / total_w if total_w > 0 else 0.5

    v3_cv = v3_forensics.get("composite_cv_score", 0.5)

    # v2 (now incl. SynthID) is 40%, v3 forensics is 60%
    fused = v2_composite * 0.40 + v3_cv * 0.60

    return {
        "v2_composite": round(v2_composite, 4),
        "v3_composite": round(v3_cv, 4),
        "fused_score": round(fused, 4),
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
        # v2 + P4 CPU layers (L1-L4, L6-L8)
        layers = [
            _run_l1(img_array, img_pil, target_regions),
            _run_l2(img_array, img_pil),
            _run_l3(img_array, img_pil),
            _run_l4(img_array, img_pil, target_regions),
            _run_l6(img_array, img_pil),
            _run_l7(img_array, img_pil),
            _run_l8(img_array, img_pil),
        ]
        synthid = _run_synthid(img_array)

        # v3 forensics
        v3 = _run_v3_forensics(temp_path)

        # Optional GPU layers
        l5 = _run_l5_inversion(image_url) if include_gpu_layers else {"available": False, "reason": "not_requested"}
        l5b = _run_l5b_snapback(image_url) if include_gpu_layers else {"available": False, "reason": "not_requested"}

        fused = _fuse_scores(layers, v3, synthid)
        elapsed = int((time.time() - start) * 1000)

        return {
            "jobId": job_id,
            "status": "success",
            "processingTimeMs": elapsed,
            # v2 compat fields
            "layers": layers,
            "synthid": synthid,
            # v3 forensics
            "forensics": v3,
            # GPU
            "diffusion_inversion": l5,
            "diffusion_snapback": l5b,
            # Unified scoring
            "composite_score": fused,
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
        with ThreadPoolExecutor(max_workers=10) as pool:
            f_l1      = pool.submit(_run_l1,      img_array, pil_img, [])
            f_l2      = pool.submit(_run_l2,      img_array, pil_img_original)
            f_l3      = pool.submit(_run_l3,      img_array, pil_img)
            f_l4      = pool.submit(_run_l4,      img_array, pil_img, [])
            f_l6      = pool.submit(_run_l6,      img_array, pil_img)
            f_l7      = pool.submit(_run_l7,      img_array, pil_img)
            f_l8      = pool.submit(_run_l8,      img_array, pil_img)
            f_synthid = pool.submit(_run_synthid, img_array)
            f_v3      = pool.submit(_run_v3_forensics, temp_path)

            layers  = [f_l1.result(), f_l2.result(), f_l3.result(), f_l4.result(),
                       f_l6.result(), f_l7.result(), f_l8.result()]
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

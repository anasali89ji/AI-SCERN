"""
Aiscern Detection Worker v4.2.0 — Unified Entry Point
DigitalOcean App Platform deployment.

Routes:
  GET  /health                  Health check + engine/GPU status
  POST /analyze                 Auto-detect content type and route
  POST /analyze/image           Full image analysis (v2 layers + v3 forensics)
  POST /analyze/text            Text AI-detection (perplexity, burstiness, stylometry)
  POST /analyze/audio            MODULE 3: CPU-only audio forensics (MFCC, jitter/shimmer,
                                  spectral stability, silence pattern, HNR)
  POST /analyze-signals         v2 compat: Layers 1, 3, 4, SynthID (JSON body with imageUrl)
  POST /diffusion-inversion     v2 Layer 5: DDIM inversion (GPU required)
  POST /diffusion-snapback      v2 Layer 5b: snap-back reconstruction (GPU required)
"""

import asyncio
import os
import signal
import logging
import time
import datetime
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from version import VERSION

# Structured logging — DO captures stdout/stderr
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("aiscern.worker")

# ── Helpers ───────────────────────────────────────────────────────────────────

def _gpu_status() -> Dict[str, Any]:
    try:
        import torch
        if torch.cuda.is_available():
            props = torch.cuda.get_device_properties(0)
            vram  = round(props.total_memory / 1e9, 1)
            return {
                "available": True,
                "name": props.name,
                "vram_gb": vram,
                "l5_ready": vram >= 4.0,
            }
    except Exception:
        pass
    return {"available": False, "name": None, "vram_gb": 0.0, "l5_ready": False}


# ── Lifespan ──────────────────────────────────────────────────────────────────

MODEL_IDLE_TTL_SECONDS  = int(os.getenv("MODEL_IDLE_TTL_SECONDS", 300))   # 5 min
MODEL_EVICTION_INTERVAL = int(os.getenv("MODEL_EVICTION_INTERVAL", 60))  # check every 1 min


async def _idle_model_eviction_loop():
    """
    BUG-5: GPU layer models (diffusion_inversion, diffusion_snapback) sit in
    VRAM indefinitely once loaded, with no way to free that memory between
    requests on a shared/VRAM-constrained GPU instance. Periodically evict
    anything that's gone unused past MODEL_IDLE_TTL_SECONDS.
    Cheap no-op when nothing is cached (the common case on CPU-only
    instances, since GPU_ENABLED=false means these models never load).
    """
    from utils.model_cache import evict_idle_models
    while True:
        try:
            await asyncio.sleep(MODEL_EVICTION_INTERVAL)
            evict_idle_models(ttl_seconds=MODEL_IDLE_TTL_SECONDS)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning("[ModelCache] Idle-eviction loop error: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Aiscern detection worker v%s starting", VERSION)
    logger.info("GPU_ENABLED=%s", os.getenv("GPU_ENABLED", "false"))

    # Graceful shutdown on SIGTERM (DO sends this before killing the container)
    def _shutdown(signum, frame):
        from utils.model_cache import clear_all_models
        logger.info("SIGTERM received — clearing model cache")
        clear_all_models()

    try:
        signal.signal(signal.SIGTERM, _shutdown)
    except ValueError:
        pass  # Not the main thread (e.g. pytest) — skip SIGTERM registration

    eviction_task = asyncio.create_task(_idle_model_eviction_loop())

    # MODULE 3 — audio engine warmup. librosa.pyin/hpss are numba-JIT'd;
    # their FIRST call in a fresh process pays a one-time ~15-20s
    # compilation cost (measured: 0.3s steady-state vs 21s cold on a 4s
    # clip). Run it once here, off the request path, so it doesn't eat a
    # real user's SIGNAL_WORKER_TIMEOUT_MS budget on the worker's first
    # audio request after a cold start / redeploy.
    def _warm_audio_engine():
        try:
            import numpy as np
            from engines.audio_engine import analyze_audio
            silence = (np.random.normal(0, 0.05, 16000 * 2)).astype(np.float32)
            import io, soundfile as sf
            buf = io.BytesIO()
            sf.write(buf, silence, 16000, format="WAV")
            analyze_audio(buf.getvalue(), "audio/wav", "startup_warmup")
            logger.info("[AudioEngine] warmup complete — numba kernels JIT-compiled")
        except Exception as e:
            # Never block startup on this — worst case, the first real
            # request pays the JIT cost instead (same as before this change).
            logger.warning("[AudioEngine] warmup failed (non-fatal): %s", e)

    asyncio.get_event_loop().run_in_executor(None, _warm_audio_engine)

    yield

    eviction_task.cancel()
    try:
        await eviction_task
    except asyncio.CancelledError:
        pass

    from utils.model_cache import clear_all_models
    from utils.image_loader import close_client
    clear_all_models()
    await close_client()
    logger.info("Worker shutdown complete")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Aiscern Detection Worker",
    description="Unified AI-content detection: image forensics + text analysis",
    version=VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
_raw_origins = os.getenv("ALLOWED_ORIGINS", "https://aiscern.com")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    allow_credentials=False,
)

# ── Metrics state (P3: Prometheus-style /metrics endpoint) ───────────────────
import threading as _threading
_metrics_lock = _threading.Lock()
_metrics: Dict[str, Any] = {
    "requests_total": 0,
    "requests_image": 0,
    "requests_text": 0,
    "requests_batch": 0,
    "errors_total": 0,
    "latency_sum_ms": 0.0,
    "latency_count": 0,
    "oom_evictions": 0,
}

def _inc(key: str, by: float = 1) -> None:
    with _metrics_lock:
        _metrics[key] = _metrics.get(key, 0) + by

# ── MIME allowlist (P3: reject invalid Content-Type before any processing) ────
ALLOWED_IMAGE_MIMES = {
    "image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp",
}

# ── Memory pressure threshold ─────────────────────────────────────────────────
OOM_RSS_THRESHOLD_MB = int(os.getenv("OOM_RSS_THRESHOLD_MB", 850))


# ── Pydantic models ───────────────────────────────────────────────────────────

class TargetRegion(BaseModel):
    x: float
    y: float
    width: float
    height: float
    reason: str = ""


class AnalyzeSignalsRequest(BaseModel):
    imageUrl: str
    jobId: str
    targetRegions: List[TargetRegion] = []
    includeDiffusion: bool = False


class AnalyzeTextRequest(BaseModel):
    text: str
    jobId: str = ""
    options: Optional[Dict[str, bool]] = None


class BatchImageRequest(BaseModel):
    urls: List[str]
    jobId: str = ""
    maxConcurrent: int = 5


class DiffusionRequest(BaseModel):
    imageUrl: str


# ── Memory-pressure middleware (P3: OOM prevention) ───────────────────────────

@app.middleware("http")
async def memory_pressure_middleware(request: Request, call_next):
    """
    Check RSS before each request. If over threshold (default 850MB),
    evict idle models before processing — a cheap operation when nothing
    is idle, but potentially saving 2-4GB on a loaded GPU instance.
    Logs a warning so you can tune OOM_RSS_THRESHOLD_MB if needed.
    """
    from utils.model_cache import get_memory_usage, evict_idle_models
    mem = get_memory_usage()
    if mem["rss_mb"] > OOM_RSS_THRESHOLD_MB:
        evicted = evict_idle_models(ttl_seconds=0)   # force-evict ALL idle models under pressure
        if evicted:
            logger.warning(
                "[OOM] RSS %.1fMB > threshold %dMB — force-evicted %d model(s): %s",
                mem["rss_mb"], OOM_RSS_THRESHOLD_MB, len(evicted), evicted,
            )
            _inc("oom_evictions", len(evicted))
    return await call_next(request)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> Dict[str, Any]:
    """
    Health check — must respond within 1-2s for DO load balancer.
    Lazy: does NOT import or load any ML models.
    """
    from utils.model_cache import cache_info

    gpu    = _gpu_status()
    cache  = cache_info()

    return {
        "status": "healthy",
        "service": "aiscern-detection-worker",
        "version": VERSION,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        "engines": {
            "image_v2": "available",
            "image_v3_forensics": "available",
            "text": "available",
            "audio": "not_implemented",
            "video": "not_implemented",
            "l5_diffusion_inversion": "available" if gpu["l5_ready"] else "unavailable_no_gpu",
            "l5b_diffusion_snapback": "available" if gpu["l5_ready"] else "unavailable_no_gpu",
        },
        "gpu": gpu,
        "model_cache": cache,
    }


@app.post("/analyze/image")
async def analyze_image_upload(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Full image analysis via file upload (multipart/form-data).
    Runs v2 layers (L1–L4, SynthID) + v3 forensic cascade all in parallel.
    """
    # MIME allowlist (P3): reject obvious non-images early, before reading bytes
    if not file.content_type or file.content_type.lower() not in ALLOWED_IMAGE_MIMES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported image type '{file.content_type}'. "
                   f"Allowed: {', '.join(sorted(ALLOWED_IMAGE_MIMES))}",
        )

    contents = await file.read()
    max_mb = int(os.getenv("MAX_IMAGE_SIZE_MB", 10))
    if len(contents) > max_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Image must be under {max_mb}MB")

    import asyncio
    from engines.image_engine import analyze_image_from_bytes

    t0 = time.time()
    _inc("requests_total"); _inc("requests_image")
    loop   = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None, analyze_image_from_bytes, contents, file.content_type,
        f"upload_{int(time.time())}",
    )
    _inc("latency_sum_ms", (time.time() - t0) * 1000); _inc("latency_count")

    if result.get("status") == "error":
        _inc("errors_total")
        raise HTTPException(status_code=500, detail=result.get("error", "Analysis failed"))

    return result


@app.post("/analyze/video")
async def analyze_video_upload(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    MODULE 1 — self-hosted video analysis via frame-sampled reuse of
    image_engine.py. Runs PARALLEL to NVIDIA NIM on the frontend (not a
    replacement) — see callPythonCVWorkerVideo() in hf-analyze.ts.

    Returns: composite_cv_score, frame_scores[], temporal_variance,
    per_layer_frame_breakdown.
    """
    ALLOWED_VIDEO_MIMES = {
        "video/mp4", "video/quicktime", "video/webm", "video/x-matroska",
        "video/avi", "video/x-msvideo", "video/mpeg",
    }
    if not file.content_type or file.content_type.lower() not in ALLOWED_VIDEO_MIMES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported video type '{file.content_type}'. "
                   f"Allowed: {', '.join(sorted(ALLOWED_VIDEO_MIMES))}",
        )

    contents = await file.read()
    max_mb = int(os.getenv("MAX_VIDEO_SIZE_MB", 50))
    if len(contents) > max_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Video must be under {max_mb}MB")

    import asyncio
    from engines.video_engine import analyze_video

    t0 = time.time()
    _inc("requests_total"); _inc("requests_video")
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None, analyze_video, contents, file.content_type,
        f"upload_{int(time.time())}",
    )
    _inc("latency_sum_ms", (time.time() - t0) * 1000); _inc("latency_count")

    if result.get("status") == "error":
        _inc("errors_total")
        raise HTTPException(status_code=500, detail=result.get("error", "Video analysis failed"))

    return result


@app.post("/analyze/text")
async def analyze_text_endpoint(req: AnalyzeTextRequest) -> Dict[str, Any]:
    """
    Text AI-detection.
    Runs perplexity (distilgpt2), burstiness, stylometry, and repetition analysis.
    Uses run_in_executor so CPU-heavy inference never blocks the event loop.
    """
    max_len = int(os.getenv("MAX_TEXT_LENGTH", 10000))
    if len(req.text) > max_len:
        raise HTTPException(
            status_code=400,
            detail=f"Text exceeds maximum length of {max_len} characters"
        )

    import asyncio
    from engines.text_engine import analyze_text

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        lambda: analyze_text(text=req.text, job_id=req.jobId, options=req.options),
    )


@app.post("/analyze/audio")
async def analyze_audio_upload(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    MODULE 3 — self-hosted audio forensics via librosa (MFCC consistency,
    pitch jitter/shimmer, spectral stability, silence/breath-pattern,
    harmonic-to-noise ratio). CPU-only, no paid API.

    Returns: composite_audio_score, audio_signals{}, signal_details[].
    Mirrors the /analyze/video and /analyze/image endpoint pattern exactly
    (MIME allowlist, size cap, run_in_executor so CPU work never blocks the
    event loop, error → HTTPException so the frontend's graceful-degrade
    fallback triggers cleanly).
    """
    ALLOWED_AUDIO_MIMES = {
        "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave",
        "audio/webm", "audio/ogg", "audio/flac", "audio/x-flac",
        "audio/mp4", "audio/x-m4a", "audio/aac",
    }
    if not file.content_type or file.content_type.lower() not in ALLOWED_AUDIO_MIMES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported audio type '{file.content_type}'. "
                   f"Allowed: {', '.join(sorted(ALLOWED_AUDIO_MIMES))}",
        )

    contents = await file.read()
    max_mb = int(os.getenv("MAX_AUDIO_SIZE_MB", 25))
    if len(contents) > max_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Audio must be under {max_mb}MB")

    import asyncio
    from engines.audio_engine import analyze_audio

    t0 = time.time()
    _inc("requests_total"); _inc("requests_audio")
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None, analyze_audio, contents, file.content_type,
        f"upload_{int(time.time())}",
    )
    _inc("latency_sum_ms", (time.time() - t0) * 1000); _inc("latency_count")

    if result.get("status") == "error":
        _inc("errors_total")
        raise HTTPException(status_code=500, detail=result.get("error", "Audio analysis failed"))

    return result


@app.post("/analyze/document")
async def analyze_document_upload(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    VerifyDoc — full document verification via file upload (multipart/form-data).
    Accepts PDF, DOCX, or PPTX. Extracts embedded text AND images, then runs
    image detection (full pipeline incl. physical-consistency L11-L14 layers)
    and text detection (perplexity/burstiness/stylometry/repetition) IN
    PARALLEL, plus an offline plagiarism/originality-risk pass on the text.

    Mirrors the /analyze/image and /analyze/audio endpoint pattern (MIME
    allowlist, size cap, run_in_executor so CPU work never blocks the event
    loop, error → HTTPException so the frontend's graceful-degrade fallback
    triggers cleanly).
    """
    ALLOWED_DOCUMENT_MIMES = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }
    name = (file.filename or "").lower()
    is_allowed_ext = name.endswith((".pdf", ".docx", ".pptx"))
    if (not file.content_type or file.content_type.lower() not in ALLOWED_DOCUMENT_MIMES) and not is_allowed_ext:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported document type '{file.content_type}'. Allowed: PDF, DOCX, PPTX.",
        )

    contents = await file.read()
    max_mb = int(os.getenv("MAX_DOCUMENT_SIZE_MB", 25))
    if len(contents) > max_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Document must be under {max_mb}MB")

    import asyncio
    from engines.document_engine import analyze_document_from_bytes, UnsupportedDocumentError

    t0 = time.time()
    _inc("requests_total"); _inc("requests_document")
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(
            None, analyze_document_from_bytes, contents, file.content_type, file.filename,
            f"upload_{int(time.time())}",
        )
    except UnsupportedDocumentError as e:
        raise HTTPException(status_code=415, detail=str(e))
    _inc("latency_sum_ms", (time.time() - t0) * 1000); _inc("latency_count")

    if result.get("status") == "error":
        _inc("errors_total")
        raise HTTPException(status_code=500, detail=result.get("error", "Document analysis failed"))

    return result


@app.post("/analyze-signals")
async def analyze_signals(req: AnalyzeSignalsRequest) -> Dict[str, Any]:
    """
    v2 compatibility endpoint.
    Accepts imageUrl + optional targetRegions, runs v2+v3 image analysis.
    Response preserves the original v2 schema (jobId, status, processingTimeMs, layers, synthid)
    while also including the new forensics and composite_score fields.
    """
    from engines.image_engine import analyze_image_from_url

    target_regions = [r.dict() for r in req.targetRegions]

    result = await analyze_image_from_url(
        image_url=req.imageUrl,
        job_id=req.jobId,
        target_regions=target_regions,
        include_gpu_layers=req.includeDiffusion,
    )

    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("error", "Analysis failed"))

    return result


@app.post("/analyze")
async def analyze_auto(request: Request) -> Dict[str, Any]:
    """
    Auto-routing endpoint.
    Inspects Content-Type and routes to image or text analysis.
    - multipart/form-data with 'file' field → /analyze/image
    - application/json with 'text' field   → /analyze/text
    - application/json with 'imageUrl'     → /analyze-signals
    """
    content_type = request.headers.get("content-type", "")

    if "multipart/form-data" in content_type:
        form = await request.form()
        file = form.get("file")
        if not file:
            raise HTTPException(status_code=400, detail="No 'file' field in multipart form")
        contents = await file.read()
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")

        from engines.image_engine import analyze_image_from_bytes
        return analyze_image_from_bytes(
            image_bytes=contents,
            content_type=file.content_type,
            job_id=f"auto_{int(time.time())}",
        )

    elif "application/json" in content_type:
        body = await request.json()

        if "text" in body:
            from engines.text_engine import analyze_text
            max_len = int(os.getenv("MAX_TEXT_LENGTH", 10000))
            text = str(body["text"])[:max_len]
            return analyze_text(
                text=text,
                job_id=body.get("jobId", ""),
                options=body.get("options"),
            )

        elif "imageUrl" in body:
            from engines.image_engine import analyze_image_from_url
            return await analyze_image_from_url(
                image_url=body["imageUrl"],
                job_id=body.get("jobId", ""),
                target_regions=body.get("targetRegions", []),
                include_gpu_layers=body.get("includeDiffusion", False),
            )

        else:
            raise HTTPException(
                status_code=400,
                detail="JSON body must contain either 'text' (for text detection) or 'imageUrl' (for image detection)"
            )

    else:
        raise HTTPException(
            status_code=415,
            detail="Unsupported Content-Type. Use multipart/form-data (image) or application/json (text or imageUrl)"
        )


@app.post("/diffusion-inversion")
async def diffusion_inversion_endpoint(req: DiffusionRequest) -> Dict[str, Any]:
    """
    Layer 5: DDIM inversion manifold test.
    Requires GPU with >=4GB VRAM. Returns 503 if GPU unavailable.
    """
    gpu = _gpu_status()
    if not gpu["l5_ready"]:
        return JSONResponse(
            status_code=503,
            content={
                "error": "GPU not available or insufficient VRAM",
                "score": 0.5,
                "confidence": 0.0,
                "gpu": gpu,
            },
        )
    try:
        from analyzers.diffusion_inversion import diffusion_inversion_score
        return diffusion_inversion_score(req.imageUrl)
    except Exception as e:
        logger.error("[L5] Diffusion inversion failed: %s", e, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "score": 0.5, "confidence": 0.0},
        )


@app.post("/diffusion-snapback")
async def diffusion_snapback_endpoint(req: DiffusionRequest) -> Dict[str, Any]:
    """
    Layer 5b: Diffusion snap-back multi-strength reconstruction dynamics.
    Requires GPU with >=4GB VRAM. Returns 503 if GPU unavailable.
    """
    gpu = _gpu_status()
    if not gpu["l5_ready"]:
        return JSONResponse(
            status_code=503,
            content={
                "error": "GPU not available or insufficient VRAM",
                "snapBackScore": 0.5,
                "confidence": 0.0,
                "gpu": gpu,
            },
        )
    try:
        from analyzers.diffusion_snapback import diffusion_snapback_score
        return diffusion_snapback_score(req.imageUrl)
    except Exception as e:
        logger.error("[L5b] Snap-back failed: %s", e, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "snapBackScore": 0.5, "confidence": 0.0},
        )


@app.get("/metrics")
async def metrics_endpoint() -> Any:
    """
    P3: Prometheus-compatible metrics endpoint.
    Returns plain text in the standard exposition format so it can be scraped
    by a Prometheus instance or a DO-managed monitoring agent without any
    additional library (no prometheus_client dependency needed for this format).
    """
    from fastapi.responses import PlainTextResponse
    from utils.model_cache import cache_info

    with _metrics_lock:
        snap = dict(_metrics)

    cache = cache_info()
    mem   = cache["memory"]
    avg_latency = (snap["latency_sum_ms"] / snap["latency_count"]) if snap["latency_count"] else 0.0

    lines = [
        "# HELP aiscern_requests_total Total requests received",
        "# TYPE aiscern_requests_total counter",
        f'aiscern_requests_total {snap["requests_total"]}',
        "",
        "# HELP aiscern_requests_by_type Requests broken down by modality",
        "# TYPE aiscern_requests_by_type counter",
        f'aiscern_requests_by_type{{type="image"}} {snap["requests_image"]}',
        f'aiscern_requests_by_type{{type="text"}} {snap["requests_text"]}',
        f'aiscern_requests_by_type{{type="batch"}} {snap["requests_batch"]}',
        "",
        "# HELP aiscern_errors_total Total error responses (5xx)",
        "# TYPE aiscern_errors_total counter",
        f'aiscern_errors_total {snap["errors_total"]}',
        "",
        "# HELP aiscern_avg_latency_ms Rolling average request latency in ms",
        "# TYPE aiscern_avg_latency_ms gauge",
        f"aiscern_avg_latency_ms {avg_latency:.2f}",
        "",
        "# HELP aiscern_cached_models Number of models currently in the cache",
        "# TYPE aiscern_cached_models gauge",
        f'aiscern_cached_models {cache["model_count"]}',
        "",
        "# HELP aiscern_memory_rss_mb Resident set size in MB",
        "# TYPE aiscern_memory_rss_mb gauge",
        f'aiscern_memory_rss_mb {mem["rss_mb"]}',
        "",
        "# HELP aiscern_memory_percent Process memory as % of system total",
        "# TYPE aiscern_memory_percent gauge",
        f'aiscern_memory_percent {mem["percent"]}',
        "",
        "# HELP aiscern_oom_evictions_total Models force-evicted under memory pressure",
        "# TYPE aiscern_oom_evictions_total counter",
        f'aiscern_oom_evictions_total {snap["oom_evictions"]}',
        "",
    ]
    return PlainTextResponse("\n".join(lines), media_type="text/plain; version=0.0.4")


@app.post("/analyze/batch")
async def analyze_batch(req: BatchImageRequest) -> Dict[str, Any]:
    """
    BUG-8: Batch image analysis. Accepts up to 20 image URLs and runs
    all of them concurrently (capped at maxConcurrent, default 5) via
    asyncio.gather, returning one result per URL in the same order.
    Errors per URL are returned as result objects, never 500 the whole batch.
    """
    MAX_BATCH = 20
    if not req.urls:
        raise HTTPException(status_code=400, detail="'urls' must be a non-empty list")
    if len(req.urls) > MAX_BATCH:
        raise HTTPException(status_code=400, detail=f"Batch size capped at {MAX_BATCH} URLs")

    max_concurrent = max(1, min(req.maxConcurrent, 10))
    sem = asyncio.Semaphore(max_concurrent)
    t0  = time.time()
    _inc("requests_total"); _inc("requests_batch")

    from engines.image_engine import analyze_image_from_url

    async def _analyze_one(url: str, idx: int) -> Dict[str, Any]:
        async with sem:
            try:
                return await analyze_image_from_url(
                    image_url=url,
                    job_id=f"{req.jobId}_item{idx}" if req.jobId else f"batch_{idx}",
                    target_regions=[],
                    include_gpu_layers=False,
                )
            except Exception as e:
                _inc("errors_total")
                logger.warning("[Batch] URL %d failed: %s", idx, e)
                return {"status": "error", "url": url, "error": str(e), "index": idx}

    results = await asyncio.gather(*[_analyze_one(u, i) for i, u in enumerate(req.urls)])
    elapsed = int((time.time() - t0) * 1000)
    _inc("latency_sum_ms", elapsed); _inc("latency_count")

    return {
        "status": "success",
        "jobId": req.jobId,
        "total": len(req.urls),
        "processingTimeMs": elapsed,
        "results": list(results),
    }



# ── P5: Rate-limiting middleware ──────────────────────────────────────────────
# Simple in-memory sliding window per client IP.
# Configurable via env:  RATE_LIMIT_REQUESTS (default 60), RATE_LIMIT_WINDOW_S (default 60).

import collections

_RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", 60))
_RATE_LIMIT_WINDOW_S = int(os.getenv("RATE_LIMIT_WINDOW_S", 60))
_rate_buckets: Dict[str, collections.deque] = {}
_rate_lock = __import__("threading").Lock()


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """
    P5: Sliding-window rate limiter.
    Returns HTTP 429 if a client IP exceeds RATE_LIMIT_REQUESTS requests
    within RATE_LIMIT_WINDOW_S seconds.
    Exempts /health and /metrics (scrape-safe).
    """
    exempt_paths = {"/health", "/metrics"}
    if request.url.path not in exempt_paths:
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        with _rate_lock:
            if client_ip not in _rate_buckets:
                _rate_buckets[client_ip] = collections.deque()
            bucket = _rate_buckets[client_ip]
            # Drop timestamps outside the window
            while bucket and now - bucket[0] > _RATE_LIMIT_WINDOW_S:
                bucket.popleft()
            if len(bucket) >= _RATE_LIMIT_REQUESTS:
                from utils.structured_log import slog
                slog.rate_limited(client_ip=client_ip, path=request.url.path)
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "rate_limit_exceeded",
                        "detail": (
                            f"Max {_RATE_LIMIT_REQUESTS} requests per "
                            f"{_RATE_LIMIT_WINDOW_S}s window"
                        ),
                    },
                )
            bucket.append(now)
    return await call_next(request)


# ── P5: /admin/cache endpoints ────────────────────────────────────────────────

ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "")  # Empty → open (DO App-level auth assumed)


def _check_admin(request: Request) -> None:
    """Validate the X-Admin-Key header if ADMIN_API_KEY is configured."""
    if ADMIN_API_KEY:
        key = request.headers.get("X-Admin-Key", "")
        if key != ADMIN_API_KEY:
            raise HTTPException(status_code=403, detail="Invalid admin key")


@app.get("/admin/cache")
async def admin_cache_info(request: Request) -> Dict[str, Any]:
    """
    P5: Inspect the current model cache state.
    Returns the list of cached model keys, per-key idle seconds, and memory usage.
    Protected by X-Admin-Key header if ADMIN_API_KEY env var is set.
    """
    _check_admin(request)
    from utils.model_cache import cache_info
    return {
        "status": "ok",
        "cache": cache_info(),
        "rate_limit": {
            "requests_per_window": _RATE_LIMIT_REQUESTS,
            "window_seconds": _RATE_LIMIT_WINDOW_S,
            "tracked_ips": len(_rate_buckets),
        },
    }


@app.delete("/admin/cache")
async def admin_cache_clear(request: Request) -> Dict[str, Any]:
    """
    P5: Force-clear the entire model cache (all keys).
    Useful after a hot-deploy or when VRAM pressure is critical.
    Protected by X-Admin-Key header if ADMIN_API_KEY env var is set.
    """
    _check_admin(request)
    from utils.model_cache import cache_info, clear_cache
    before = cache_info()
    cleared = clear_cache()
    from utils.structured_log import slog
    slog.cache_evict(keys=cleared, reason="admin_manual_clear")
    return {
        "status": "ok",
        "cleared_keys": cleared,
        "models_before": before["model_count"],
        "models_after": 0,
    }


# ── Entry ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port    = int(os.getenv("PORT", 8080))
    workers = int(os.getenv("UVICORN_WORKERS", 2))  # 2 workers on basic-xs (1GB RAM safe)
    logger.info("Starting uvicorn on port %d with %d workers", port, workers)
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        workers=workers,
        reload=False,
        access_log=True,
        log_level=os.getenv("LOG_LEVEL", "info").lower(),
        timeout_keep_alive=30,   # close idle connections faster
        limit_concurrency=20,    # never queue more than 20 simultaneous requests
    )

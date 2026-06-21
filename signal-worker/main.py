"""
Aiscern Detection Worker v4.2.0 — Unified Entry Point
DigitalOcean App Platform deployment.

Routes:
  GET  /health                  Health check + engine/GPU status
  POST /analyze                 Auto-detect content type and route
  POST /analyze/image           Full image analysis (v2 layers + v3 forensics)
  POST /analyze/text            Text AI-detection (perplexity, burstiness, stylometry)
  POST /analyze-signals         v2 compat: Layers 1, 3, 4, SynthID (JSON body with imageUrl)
  POST /diffusion-inversion     v2 Layer 5: DDIM inversion (GPU required)
  POST /diffusion-snapback      v2 Layer 5b: snap-back reconstruction (GPU required)
"""

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

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Aiscern detection worker v%s starting", VERSION)
    logger.info("GPU_ENABLED=%s", os.getenv("GPU_ENABLED", "false"))

    # Graceful shutdown on SIGTERM (DO sends this before killing the container)
    def _shutdown(signum, frame):
        from utils.model_cache import clear_all_models
        logger.info("SIGTERM received — clearing model cache")
        clear_all_models()

    signal.signal(signal.SIGTERM, _shutdown)

    yield

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


class DiffusionRequest(BaseModel):
    imageUrl: str


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
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
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
    Runs v2 layers (L1, L3, L4, SynthID) + v3 forensic cascade (6 layers)
    all in parallel via ThreadPoolExecutor.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (image/*)")

    contents = await file.read()
    max_mb = int(os.getenv("MAX_IMAGE_SIZE_MB", 10))
    if len(contents) > max_mb * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Image must be under {max_mb}MB")

    import asyncio
    from engines.image_engine import analyze_image_from_bytes

    # Run CPU-heavy analysis in thread pool — never block the event loop
    loop   = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        analyze_image_from_bytes,
        contents,
        file.content_type,
        f"upload_{int(time.time())}",
    )

    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("error", "Analysis failed"))

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

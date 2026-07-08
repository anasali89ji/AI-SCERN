"""
Aiscern — Python Signal Worker v2.0 (Hardened)
FastAPI service implementing Layers 1, 3, 4, 5, 5b, and SynthID detection.

SECURITY CHANGES:
- INTERNAL_API_SECRET bearer token required on all non-health endpoints
- Rate limiting: 10 requests/minute per IP on protected endpoints
- Health endpoint no longer leaks GPU name/VRAM to unauthenticated callers
  (use /health/detailed with auth for that)

Deploy to: DigitalOcean App Platform (CPU) or GPU Droplet (for L5/L5b)
POST /analyze-signals       — main analysis endpoint (auth required)
POST /diffusion-inversion   — Layer 5 (auth required)
POST /diffusion-snapback    — Layer 5b (auth required)
GET  /health                — public, minimal health check
GET  /health/detailed       — auth required, full GPU/layer status
"""

import os
import time
import logging
import hmac
from contextlib import asynccontextmanager
from collections import defaultdict
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from analyzers.pixel_integrity      import analyze_pixel_integrity
from analyzers.diffusion_inversion  import diffusion_inversion_score
from analyzers.diffusion_snapback   import diffusion_snapback_score
from analyzers.noise_stats      import analyze_noise_stats
from analyzers.frequency_domain import analyze_frequency_domain
from analyzers.synthid_local    import check_synthid
from utils.image_loader         import load_image_from_url
from utils.evidence_builder     import build_layer_report

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Security config ────────────────────────────────────────────────────────────

INTERNAL_API_SECRET = os.getenv("INTERNAL_API_SECRET", "")
if not INTERNAL_API_SECRET:
    logger.warning(
        "[security] INTERNAL_API_SECRET not set — signal worker is UNPROTECTED. "
        "Set this environment variable immediately, especially before any public deploy."
    )

# Simple in-memory rate limiter: IP -> list of request timestamps
_rate_limit_store: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_MAX    = 10  # requests
RATE_LIMIT_WINDOW = 60  # seconds


async def _check_rate_limit(client_ip: str) -> bool:
    now = time.time()
    window = _rate_limit_store[client_ip]
    while window and window[0] < now - RATE_LIMIT_WINDOW:
        window.pop(0)
    if len(window) >= RATE_LIMIT_MAX:
        return False
    window.append(now)
    return True


def _verify_auth(authorization: Optional[str]) -> bool:
    if not INTERNAL_API_SECRET:
        return True  # Dev mode — warn (above) but don't block
    if not authorization or not authorization.startswith("Bearer "):
        return False
    token = authorization[7:]
    return hmac.compare_digest(token, INTERNAL_API_SECRET)


# ── Pydantic models ────────────────────────────────────────────────────────────

class TargetRegion(BaseModel):
    x:      float
    y:      float
    width:  float
    height: float
    reason: str

class AnalyzeRequest(BaseModel):
    imageUrl:      str
    jobId:         str
    targetRegions: list[TargetRegion] = []

class DiffusionRequest(BaseModel):
    imageUrl: str

class AnalyzeResponse(BaseModel):
    jobId:            str
    status:           str
    processingTimeMs: int
    layers:           list[dict]
    synthid:          dict
    error:            Optional[str] = None

# ── App ─────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Signal worker starting up")

    # Check optional GPU dependencies at startup so failures are visible in logs
    # immediately, not just at first L5/L5b request.
    try:
        import torch
        import diffusers
        import transformers
        logger.info("[startup] GPU dependencies available")
    except ImportError as e:
        logger.warning(f"[startup] GPU dependencies missing: {e}. L5/L5b will return 503.")

    yield
    logger.info("Signal worker shutting down")

app = FastAPI(
    title="Aiscern Signal Worker",
    description="Forensic image analysis — Layers 1, 3, 4, 5, 5b, SynthID",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────────
# Restrict cross-origin access to known Aiscern origins only.
# Do NOT use allow_origins=["*"] — this is an internal forensic API that
# processes image URLs; wildcard CORS would expose it to arbitrary third-party sites.
_RAW_ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://aiscern.com")
ALLOWED_ORIGINS = [o.strip() for o in _RAW_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    allow_credentials=False,
)

# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Public health check — minimal info, no GPU details (avoid info disclosure)."""
    gpu_available = False
    try:
        import torch
        gpu_available = torch.cuda.is_available()
    except Exception:
        pass
    return {
        "status":    "healthy",
        "service":   "aiscern-signal-worker",
        "version":   "2.0.0",
        "gpu_available": gpu_available,
        "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
    }


@app.get("/health/detailed")
async def health_detailed(authorization: Optional[str] = Header(None)):
    """Detailed health check — requires auth. Returns GPU name, VRAM, layer status."""
    if not _verify_auth(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    gpu_available = False
    gpu_name      = None
    vram_gb       = 0
    try:
        import torch
        gpu_available = torch.cuda.is_available()
        if gpu_available:
            gpu_name = torch.cuda.get_device_name(0)
            vram_gb  = round(torch.cuda.get_device_properties(0).total_memory / 1e9, 1)
    except Exception as e:
        logger.warning(f"GPU detection failed: {e}")

    return {
        "status":  "healthy",
        "service": "aiscern-signal-worker",
        "version": "2.0.0",
        "layers": {
            "l1_pixel":     "available",
            "l3_noise":     "available",
            "l4_frequency": "available",
            "l5_diffusion": "available" if gpu_available and vram_gb >= 4.0 else "unavailable_no_gpu",
            "l5b_snapback": "available" if gpu_available and vram_gb >= 4.0 else "unavailable_no_gpu",
        },
        "gpu": {
            "available": gpu_available,
            "name":      gpu_name,
            "vram_gb":   vram_gb,
        },
        "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
    }


@app.post("/diffusion-inversion")
async def diffusion_inversion_endpoint(
    req: DiffusionRequest,
    request: Request,
    authorization: Optional[str] = Header(None),
):
    """
    Layer 5: DDIM inversion manifold test.
    Requires GPU with >=4GB VRAM. Returns 503 if GPU unavailable.
    """
    client_ip = request.headers.get("x-forwarded-for", request.client.host)
    if not await _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    if not _verify_auth(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    import torch
    if not torch.cuda.is_available():
        return JSONResponse(
            status_code=503,
            content={"error": "GPU not available", "score": 0.5, "confidence": 0.0}
        )
    try:
        result = diffusion_inversion_score(req.imageUrl)
        return result
    except Exception as e:
        logger.error(f"[L5] Diffusion inversion failed: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "score": 0.5, "confidence": 0.0}
        )


@app.post("/diffusion-snapback")
async def diffusion_snapback_endpoint(
    req: DiffusionRequest,
    request: Request,
    authorization: Optional[str] = Header(None),
):
    """
    Layer 5b: Diffusion snap-back multi-strength reconstruction dynamics.
    Runs 4 img2img passes. Requires GPU with >=4GB VRAM. Returns 503 if unavailable.
    """
    client_ip = request.headers.get("x-forwarded-for", request.client.host)
    if not await _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    if not _verify_auth(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    import torch
    if not torch.cuda.is_available():
        return JSONResponse(
            status_code=503,
            content={"error": "GPU not available", "snapBackScore": 0.5, "confidence": 0.0}
        )
    try:
        result = diffusion_snapback_score(req.imageUrl)
        return result
    except Exception as e:
        logger.error(f"[L5b] Snap-back failed: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "snapBackScore": 0.5, "confidence": 0.0}
        )


@app.post("/analyze-signals", response_model=AnalyzeResponse)
async def analyze_signals(
    req: AnalyzeRequest,
    request: Request,
    authorization: Optional[str] = Header(None),
):
    client_ip = request.headers.get("x-forwarded-for", request.client.host)
    if not await _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    if not _verify_auth(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    start_ms = int(time.time() * 1000)

    try:
        logger.info(f"[{req.jobId}] Loading image from {req.imageUrl[:60]}…")
        img_array, img_pil = await load_image_from_url(req.imageUrl)
        logger.info(f"[{req.jobId}] Image loaded: {img_array.shape}")

        target_regions = [r.dict() for r in req.targetRegions]

        layers = []

        # Layer 1: Pixel Integrity
        try:
            l1 = analyze_pixel_integrity(img_array, img_pil, target_regions)
            layers.append(l1)
            logger.info(f"[{req.jobId}] L1 score={l1['layerSuspicionScore']:.2f}")
        except Exception as e:
            logger.warning(f"[{req.jobId}] L1 failed: {e}")
            layers.append(build_layer_report(1, "Pixel Integrity", [], "failure", 0))

        # Layer 3: Noise & Statistical
        try:
            l3 = analyze_noise_stats(img_array, img_pil)
            layers.append(l3)
            logger.info(f"[{req.jobId}] L3 score={l3['layerSuspicionScore']:.2f}")
        except Exception as e:
            logger.warning(f"[{req.jobId}] L3 failed: {e}")
            layers.append(build_layer_report(3, "Noise & Statistical", [], "failure", 0))

        # Layer 4: Frequency Domain
        try:
            l4 = analyze_frequency_domain(img_array, img_pil, target_regions)
            layers.append(l4)
            logger.info(f"[{req.jobId}] L4 score={l4['layerSuspicionScore']:.2f}")
        except Exception as e:
            logger.warning(f"[{req.jobId}] L4 failed: {e}")
            layers.append(build_layer_report(4, "Frequency Domain", [], "failure", 0))

        # SynthID local check
        synthid = {"detected": False, "confidence": 0.0}
        try:
            synthid = check_synthid(img_array)
        except Exception as e:
            logger.warning(f"[{req.jobId}] SynthID check failed: {e}")

        elapsed = int(time.time() * 1000) - start_ms
        return AnalyzeResponse(
            jobId=req.jobId,
            status="success",
            processingTimeMs=elapsed,
            layers=layers,
            synthid=synthid,
        )

    except Exception as e:
        logger.error(f"[{req.jobId}] Fatal error: {e}", exc_info=True)
        elapsed = int(time.time() * 1000) - start_ms
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=False)

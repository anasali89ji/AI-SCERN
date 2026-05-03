"""
Aiscern — Python Signal Worker
FastAPI service implementing Layers 1, 3, 4, and local SynthID detection.

Deploy to: Render.com Web Service (free tier) or HuggingFace Space (Docker)
POST /analyze-signals — main analysis endpoint
GET  /health         — health check
"""

import os
import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import Optional

from analyzers.pixel_integrity  import analyze_pixel_integrity
from analyzers.noise_stats      import analyze_noise_stats
from analyzers.frequency_domain import analyze_frequency_domain
from analyzers.synthid_local    import check_synthid
from utils.image_loader         import load_image_from_url
from utils.evidence_builder     import build_layer_report

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Pydantic models ───────────────────────────────────────────────────────────

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

class AnalyzeResponse(BaseModel):
    jobId:            str
    status:           str
    processingTimeMs: int
    layers:           list[dict]
    synthid:          dict
    error:            Optional[str] = None

# ── App ───────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Signal worker starting up")
    yield
    logger.info("Signal worker shutting down")

app = FastAPI(
    title="Aiscern Signal Worker",
    description="Forensic image analysis — Layers 1, 3, 4, SynthID",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "aiscern-signal-worker"}

@app.post("/analyze-signals", response_model=AnalyzeResponse)
async def analyze_signals(req: AnalyzeRequest):
    start_ms = int(time.time() * 1000)

    try:
        logger.info(f"[{req.jobId}] Loading image from {req.imageUrl[:60]}…")
        img_array, img_pil = await load_image_from_url(req.imageUrl)
        logger.info(f"[{req.jobId}] Image loaded: {img_array.shape}")

        target_regions = [r.dict() for r in req.targetRegions]

        # Run all 3 layers + SynthID in parallel-ish
        # (asyncio not used for CPU-bound numpy — run sequentially,
        #  use ThreadPoolExecutor if needed for production)
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

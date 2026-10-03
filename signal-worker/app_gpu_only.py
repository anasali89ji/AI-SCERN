"""
AI-SCERN GPU Worker — L5/L5b ONLY (HuggingFace ZeroGPU)

This is a LIGHTWEIGHT worker that ONLY runs the GPU layers:
  - L5: Diffusion Inversion (DIRE) — DDIM inversion reconstruction MSE
  - L5b: Diffusion Snap-Back — 4-strength img2img LPIPS/SSIM curve

The main signal-worker on DigitalOcean handles all CPU layers (L1-L25).
This Space is called ONLY when the frontend needs GPU layers.

API:
  POST /analyze/image — runs L5 + L5b, returns scores
  GET  /health        — GPU status check
"""
import spaces  # MUST be first import — initializes ZeroGPU
import gradio as gr
import os
import io
import time
import logging
import numpy as np
from typing import Any, Dict
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

os.environ["GPU_ENABLED"] = "true"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── FastAPI app (for API calls from Vercel) ─────────────────────────────────
fastapi_app = FastAPI(title="AI-SCERN GPU Worker (L5/L5b)")
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@fastapi_app.get("/health")
async def health():
    """Health check — returns GPU status."""
    try:
        import torch
        gpu_available = torch.cuda.is_available()
        gpu_name = torch.cuda.get_device_name(0) if gpu_available else None
        vram = torch.cuda.get_device_properties(0).total_memory / (1024**3) if gpu_available else 0
        return {
            "status": "healthy",
            "gpu_available": gpu_available,
            "gpu_name": gpu_name,
            "vram_gb": round(vram, 1),
            "layers": ["L5_diffusion_inversion", "L5b_diffusion_snapback"],
        }
    except Exception as e:
        return {"status": "error", "error": str(e), "gpu_available": False}


@fastapi_app.post("/analyze/image")
async def analyze_image(file: UploadFile = File(...)):
    """
    Run L5 (Diffusion Inversion) + L5b (Snap-Back) on the uploaded image.

    Returns ONLY the GPU layer results — the caller (Vercel frontend)
    merges these with the CPU layer results from the DigitalOcean worker.
    """
    try:
        contents = await file.read()
        content_type = file.content_type or "image/png"

        # Run L5 (Diffusion Inversion)
        l5_result = await _run_l5(contents, content_type)

        # Run L5b (Snap-Back)
        l5b_result = await _run_l5b(contents, content_type)

        return JSONResponse({
            "status": "success",
            "diffusion_inversion": l5_result,
            "diffusion_snapback": l5b_result,
            "processingTimeMs": 0,  # filled below
        })
    except Exception as e:
        logger.exception("GPU analysis failed")
        return JSONResponse(
            {"status": "error", "error": str(e)},
            status_code=500,
        )


async def _run_l5(image_bytes: bytes, content_type: str) -> Dict[str, Any]:
    """Run L5 Diffusion Inversion."""
    try:
        import sys
        sys.path.insert(0, os.path.dirname(__file__))

        from engines.image_engine import _gpu_available, _gpu_vram_gb

        if not _gpu_available() or _gpu_vram_gb() < 4.0:
            return {"available": False, "reason": "gpu_unavailable", "score": 0.5}

        from engines.image_engine import _run_l5_inversion
        from PIL import Image
        import io as _io

        pil_img = Image.open(_io.BytesIO(image_bytes)).convert("RGB")
        max_dim = max(pil_img.width, pil_img.height)
        if max_dim > 768:
            scale = 768 / max_dim
            pil_img = pil_img.resize((int(pil_img.width * scale), int(pil_img.height * scale)), Image.LANCZOS)
        img_array = np.array(pil_img, dtype=np.uint8)

        result = _run_l5_inversion("", img_array)
        return result
    except Exception as e:
        logger.warning(f"L5 failed: {e}")
        return {"available": False, "reason": f"l5_error: {str(e)[:100]}", "score": 0.5}


async def _run_l5b(image_bytes: bytes, content_type: str) -> Dict[str, Any]:
    """Run L5b Diffusion Snap-Back."""
    try:
        import sys
        sys.path.insert(0, os.path.dirname(__file__))

        from engines.image_engine import _gpu_available, _gpu_vram_gb

        if not _gpu_available() or _gpu_vram_gb() < 4.0:
            return {"available": False, "reason": "gpu_unavailable", "snapBackScore": 0.5}

        from engines.image_engine import _run_l5b_snapback
        from PIL import Image
        import io as _io

        pil_img = Image.open(_io.BytesIO(image_bytes)).convert("RGB").resize((512, 512), Image.LANCZOS)
        img_array = np.array(pil_img, dtype=np.uint8)

        result = _run_l5b_snapback("", img_array)
        return result
    except Exception as e:
        logger.warning(f"L5b failed: {e}")
        return {"available": False, "reason": f"l5b_error: {str(e)[:100]}", "snapBackScore": 0.5}


# ── Gradio UI (visible at /gradio) ─────────────────────────────────────────
def gradio_analyze(image):
    if image is None:
        return "Upload an image to run L5/L5b GPU analysis.", {}
    import io as _io
    buf = _io.BytesIO()
    image.save(buf, format="PNG")
    result = await_analyze(buf.getvalue())
    l5 = result.get("diffusion_inversion", {})
    l5b = result.get("diffusion_snapback", {})
    return f"""
## GPU Analysis Result

| Layer | Status | Score |
|-------|--------|-------|
| **L5 Diffusion Inversion** | {"✅" if l5.get("available") else "❌"} | {l5.get("score", "N/A")} |
| **L5b Snap-Back** | {"✅" if l5b.get("available") else "❌"} | {l5b.get("snapBackScore", "N/A")} |
""", result


import asyncio
def await_analyze(img_bytes):
    # Helper to call the async function synchronously from Gradio
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_run_full_analysis(img_bytes))
    finally:
        loop.close()


async def _run_full_analysis(img_bytes):
    l5 = await _run_l5(img_bytes, "image/png")
    l5b = await _run_l5b(img_bytes, "image/png")
    return {"diffusion_inversion": l5, "diffusion_snapback": l5b}


with gr.Blocks(title="AI-SCERN GPU Worker (L5/L5b)") as demo:
    gr.Markdown("""
    # AI-SCERN GPU Worker — L5/L5b Only (ZeroGPU)
    Upload an image to run Diffusion Inversion + Snap-Back on GPU.
    The main signal-worker on DigitalOcean handles all CPU layers.
    """)
    with gr.Row():
        with gr.Column():
            inp = gr.Image(label="Upload Image", type="pil")
            btn = gr.Button("Run GPU Analysis", variant="primary")
        with gr.Column():
            out_md = gr.Markdown(label="Result")
            out_json = gr.JSON(label="Raw Output")
    btn.click(fn=gradio_analyze, inputs=[inp], outputs=[out_md, out_json])


# ── Mount ───────────────────────────────────────────────────────────────────
app = gr.mount_gradio_app(fastapi_app, demo, path="/gradio")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)

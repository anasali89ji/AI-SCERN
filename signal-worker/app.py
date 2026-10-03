# ============================================================
# AI-SCERN Signal Worker — HuggingFace ZeroGPU Edition
# Runs L5 (Diffusion Inversion) + L5b (Snap-Back) on GPU
# ============================================================
#
# CORRECT SETUP for HuggingFace ZeroGPU:
# 1. SDK must be "gradio" (ZeroGPU only works with Gradio SDK)
# 2. Use `import spaces` BEFORE any torch import
# 3. Decorate GPU functions with @spaces.GPU
# 4. Do NOT install torch/torchvision from PyPI — the spaces
#    library provides CUDA-enabled versions
# 5. Pin huggingface_hub to a compatible version
# ============================================================

import spaces  # MUST be first import — initializes ZeroGPU
import gradio as gr
import os
import io
import json
import logging
import time
from typing import Any, Dict

# Set GPU_ENABLED before importing the worker
os.environ["GPU_ENABLED"] = "true"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Lazy imports (after spaces is initialized) ──────────────────────────────

def _get_worker():
    """Lazy-load the signal-worker main app. Cached after first call."""
    if not hasattr(_get_worker, '_app'):
        import sys
        sys.path.insert(0, os.path.dirname(__file__))
        from main import app
        _get_worker._app = app
    return _get_worker._app


def _run_image_analysis(image_bytes: bytes, content_type: str = "image/png"):
    """Run the full image analysis pipeline with GPU layers enabled."""
    import sys
    sys.path.insert(0, os.path.dirname(__file__))
    from engines.image_engine import analyze_image_from_bytes

    result = analyze_image_from_bytes(
        image_bytes,
        content_type,
        f"hf_zero_gpu_{int(time.time())}",
        brain_result=None,
        include_gpu_layers=True,  # ← THIS enables L5/L5b
    )
    return result


# ── Gradio UI ─────────────────────────────────────────────────────────────

def analyze_image(image):
    """Gradio handler — receives a PIL image, runs full analysis."""
    if image is None:
        return "Please upload an image.", {}, None

    import io
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    image_bytes = buf.getvalue()

    try:
        result = _run_image_analysis(image_bytes, "image/png")
        cs = result.get("composite_score", {})
        fused_score = cs.get("fused_score", 0.5) if isinstance(cs, dict) else 0.5

        verdict = "AI-Generated" if fused_score >= 0.5 else "Human"
        confidence = f"{abs(fused_score - 0.5) * 200:.1f}%"

        # Check if L5/L5b ran
        l5 = result.get("diffusion_inversion", {})
        l5b = result.get("diffusion_snapback", {})
        l5_status = f"✅ Available (score: {l5.get('score', '?')})" if l5.get("available") else f"❌ {l5.get('reason', 'unavailable')}"
        l5b_status = f"✅ Available (score: {l5b.get('snapBackScore', '?')})" if l5b.get("available") else f"❌ {l5b.get('reason', 'unavailable')}"

        summary = f"""
## Result: {verdict} ({confidence})

| Layer | Status |
|-------|--------|
| **Fused Score** | {fused_score:.4f} |
| **L5 Diffusion Inversion** | {l5_status} |
| **L5b Snap-Back** | {l5b_status} |
| **Layers Run** | {len(result.get('layers', []))} |
| **Processing Time** | {result.get('processingTimeMs', '?')}ms |
"""
        return summary, {"fused_score": fused_score, "verdict": verdict}, None
    except Exception as e:
        logger.exception("Analysis failed")
        return f"Error: {str(e)}", {}, None


def health_check():
    """Health check endpoint."""
    try:
        import torch
        gpu_available = torch.cuda.is_available()
        gpu_name = torch.cuda.get_device_name(0) if gpu_available else "N/A"
        vram = torch.cuda.get_device_properties(0).total_memory / (1024**3) if gpu_available else 0
        return {
            "status": "healthy",
            "gpu_available": gpu_available,
            "gpu_name": gpu_name,
            "vram_gb": round(vram, 1),
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ── Gradio App ─────────────────────────────────────────────────────────────

with gr.Blocks(title="AI-SCERN Signal Worker (ZeroGPU)") as demo:
    gr.Markdown("""
    # AI-SCERN Signal Worker — ZeroGPU Edition
    Upload an image to run the full 30-layer physics ensemble including
    **L5 (Diffusion Inversion)** and **L5b (Snap-Back)** on GPU.
    """)

    with gr.Row():
        with gr.Column():
            input_image = gr.Image(label="Upload Image", type="pil")
            analyze_btn = gr.Button("🔍 Analyze (GPU)", variant="primary")
        with gr.Column():
            output_text = gr.Markdown(label="Result")
            output_json = gr.JSON(label="Raw Score")

    analyze_btn.click(
        fn=analyze_image,
        inputs=[input_image],
        outputs=[output_text, output_json, input_image],
    )

    gr.Markdown("""
    ---
    ### API Access
    This Space also serves the FastAPI worker at:
    - `POST /analyze/image` — full image analysis (with GPU layers)
    - `POST /analyze/text` — text analysis
    - `POST /analyze/audio` — audio analysis
    - `GET /health` — health check

    Set `PYTHON_WORKER_URL=https://saghi776-ai-scern-signal-worker-l5-l5b.hf.space`
    in your Vercel env to route all scans through this GPU worker.
    """)

# ── Mount FastAPI ──────────────────────────────────────────────────────────
# The signal-worker's FastAPI app (main:app) is mounted under /api/
# so both Gradio (root) and FastAPI (/api/*) are accessible.

_worker_app = None
try:
    _worker_app = _get_worker()
except Exception as e:
    logger.warning(f"Worker app not loaded yet: {e}")

if _worker_app:
    app = gr.mount_gradio_app(_worker_app, demo, path="/gradio")
else:
    app = demo  # Fallback: Gradio only (FastAPI loads on first request)

# For ZeroGPU: the app must be named `app` and exported at module level

"""
Aiscern L5/L5b GPU Worker — Hugging Face Space (ZeroGPU)

Exposes diffusion_inversion_score() and diffusion_snapback_score() as Gradio
API endpoints, GPU-accelerated via HF's free ZeroGPU (A100 slices, rate-limited
but free). Each call spins up a GPU worker on demand (@spaces.GPU), runs, and
releases it — you don't pay for idle GPU time.

SECURITY:
This Space should be set to PRIVATE in the HF dashboard. Private Spaces require
an Authorization: Bearer <HF_TOKEN> header on every call, which HF verifies for
you at the infra level — that's your primary auth layer.

As defense-in-depth (in case the Space is ever made public by mistake, or the
HF token leaks), every function ALSO checks a shared secret string against the
INTERNAL_API_SECRET environment variable, which you set as a Space secret.
"""

import os
import time
import logging

import gradio as gr
import spaces

from diffusion_inversion import diffusion_inversion_score
from diffusion_snapback import diffusion_snapback_score

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

INTERNAL_API_SECRET = os.environ.get("INTERNAL_API_SECRET", "")
if not INTERNAL_API_SECRET:
    logger.warning(
        "[security] INTERNAL_API_SECRET Space secret not set. "
        "Set it in Space Settings -> Variables and secrets before going live."
    )


def _check_secret(secret: str) -> bool:
    if not INTERNAL_API_SECRET:
        return True  # dev mode, matches signal-worker's own fallback behavior
    return secret == INTERNAL_API_SECRET


@spaces.GPU(duration=60)  # request up to 60s of A100 time for this call
def run_diffusion_inversion(image_url: str, secret: str):
    if not _check_secret(secret):
        return {"error": "unauthorized", "score": 0.5, "confidence": 0.0}
    t0 = time.time()
    try:
        result = diffusion_inversion_score(image_url)
        result["processingTimeMs"] = int((time.time() - t0) * 1000)
        return result
    except Exception as e:
        logger.error(f"[L5] failed: {e}", exc_info=True)
        return {"error": str(e), "score": 0.5, "confidence": 0.0}


@spaces.GPU(duration=90)  # snap-back runs 4 img2img passes, needs more headroom
def run_diffusion_snapback(image_url: str, secret: str):
    if not _check_secret(secret):
        return {"error": "unauthorized", "snapBackScore": 0.5, "confidence": 0.0}
    t0 = time.time()
    try:
        result = diffusion_snapback_score(image_url)
        result["processingTimeMs"] = int((time.time() - t0) * 1000)
        return result
    except Exception as e:
        logger.error(f"[L5b] failed: {e}", exc_info=True)
        return {"error": str(e), "snapBackScore": 0.5, "confidence": 0.0}


def ping():
    """Trivial CPU-only endpoint for the GitHub Actions cron to hit — keeps the
    Space container itself awake without consuming any GPU quota."""
    return {"status": "alive", "timestamp": time.time()}


with gr.Blocks(title="Aiscern GPU Worker (L5/L5b)") as demo:
    gr.Markdown("## Aiscern L5/L5b Diffusion Analysis — internal API, not for public use")

    with gr.Tab("Diffusion Inversion (L5)"):
        l5_url    = gr.Textbox(label="Image URL")
        l5_secret = gr.Textbox(label="Secret", type="password")
        l5_out    = gr.JSON(label="Result")
        l5_btn    = gr.Button("Run")
        l5_btn.click(run_diffusion_inversion, inputs=[l5_url, l5_secret], outputs=l5_out,
                     api_name="diffusion_inversion")

    with gr.Tab("Diffusion Snap-Back (L5b)"):
        l5b_url    = gr.Textbox(label="Image URL")
        l5b_secret = gr.Textbox(label="Secret", type="password")
        l5b_out    = gr.JSON(label="Result")
        l5b_btn    = gr.Button("Run")
        l5b_btn.click(run_diffusion_snapback, inputs=[l5b_url, l5b_secret], outputs=l5b_out,
                      api_name="diffusion_snapback")

    with gr.Tab("Health"):
        health_out = gr.JSON(label="Status")
        health_btn = gr.Button("Ping")
        health_btn.click(ping, inputs=[], outputs=health_out, api_name="ping")

if __name__ == "__main__":
    demo.queue(max_size=20).launch()

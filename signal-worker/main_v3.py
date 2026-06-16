"""
Aiscern Image Forensics Worker v3.0
FastAPI service exposing the 6-layer forensic image analysis pipeline.

New endpoint: POST /analyze/image
Preserves all existing endpoints from main.py (no modification).

Deploy: Docker container on Render/Railway, or HuggingFace Space
"""
import os
import time
import logging
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any

from forensics.metadata_analyzer import analyze_metadata
from forensics.frequency_analysis import frequency_domain_analysis
from forensics.noise_analysis import noise_coherence_analysis
from forensics.texture_color_analysis import texture_analysis, color_analysis, illumination_consistency
from forensics.face_deepfake import face_specific_analysis
from forensics.watermark_detector import detect_watermarks
from forensics.text_artifact_detector import detect_text_artifacts

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app_v3 = FastAPI(
    title="Aiscern Image Forensics Worker v3",
    version="3.0.0",
    description="6-layer cascade forensic image analysis pipeline"
)

_raw_origins = os.environ.get("ALLOWED_ORIGINS", "https://aiscern.com,https://www.aiscern.com,http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app_v3.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
    allow_credentials=False,
)


@app_v3.post("/analyze/image")
async def analyze_image(file: UploadFile = File(...)) -> Dict[str, Any]:
    """Full 6-layer forensic analysis on an uploaded image file."""

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 10MB")

    safe_name = (file.filename or "upload").replace("/", "_").replace("\\", "_")
    temp_path = f"/tmp/aiscern_v3_{int(time.time())}_{safe_name}"

    with open(temp_path, "wb") as f:
        f.write(contents)

    try:
        # Layer 1: Metadata forensics
        metadata = analyze_metadata(temp_path)

        # Layer 2: CV forensics
        frequency = frequency_domain_analysis(temp_path)
        noise = noise_coherence_analysis(temp_path)
        texture = texture_analysis(temp_path)
        color = color_analysis(temp_path)
        illumination = illumination_consistency(temp_path)

        # Layer 5: Specialized detectors
        face = face_specific_analysis(temp_path)
        watermarks = detect_watermarks(temp_path)
        text_artifacts = detect_text_artifacts(temp_path)

        # Composite CV score (0 = human, 1 = AI)
        cv_signals = {
            "metadata": metadata.get("score", 0.5),
            "frequency": min(frequency.get("high_freq_suppression", 0.5) * 2, 1.0),
            "noise_uniformity": 1.0 - noise.get("noise_uniformity_score", 0.5),
            "texture_smoothness": texture.get("texture_smoothness_score", 0.5),
            "illumination_uniformity": 1.0 - min(illumination.get("illumination_variance", 0) / 1000, 1.0),
            "face_deepfake": face.get("deepfake_score", 0.5) if face.get("faces_detected") else 0.5,
            "watermark": watermarks.get("overall_watermark_score", 0),
            "text_artifact": text_artifacts.get("artifact_score", 0)
        }

        weights = {
            "metadata": 0.20,
            "frequency": 0.15,
            "noise_uniformity": 0.15,
            "texture_smoothness": 0.10,
            "illumination_uniformity": 0.10,
            "face_deepfake": 0.15,
            "watermark": 0.10,
            "text_artifact": 0.05
        }

        composite_score = sum(cv_signals[k] * weights[k] for k in weights) / sum(weights.values())

        return {
            "metadata": metadata,
            "frequency_analysis": frequency,
            "noise_analysis": noise,
            "texture_color": {**texture, **color, **illumination},
            "face_deepfake": face,
            "watermark_detection": watermarks,
            "text_artifacts": text_artifacts,
            "composite_cv_score": float(composite_score),
            "cv_signals": cv_signals,
            "version": "3.0.0"
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        logger.error(f"[image-v3] Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app_v3.get("/health")
async def health() -> Dict[str, Any]:
    return {"status": "ok", "version": "3.0.0", "engine": "aiscern-image-forensics-v3"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app_v3, host="0.0.0.0", port=port)

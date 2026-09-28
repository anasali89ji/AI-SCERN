"""
Aiscern Detection Worker — Video Engine
MODULE 1: Video-through-Image-Engine Reuse.

Strategy: video AI-detection has historically depended entirely on NVIDIA NIM
per-frame calls with no self-hosted fallback. This engine gives the worker a
self-hosted alternative by reusing the existing 14-layer image_engine.py
pipeline (pixel integrity, DCT, noise, frequency domain, ZED, DIRE,
generative fingerprint, PAFRA, BDIS, SSWDP, QESM, physical-consistency
layers) frame-by-frame, plus a temporal-consistency signal computed across
those per-frame layer scores.

This is NOT a re-implementation of image detection — every frame is analyzed
via image_engine.analyze_image_from_bytes(), the exact same function the
/analyze/image endpoint uses.

Cost note: analyze_image_from_bytes() is a ~2-4s call (12-way thread pool,
full v3 forensic cascade). Running it on every sampled frame is the dominant
cost of this engine — frame count is deliberately kept low (8-16, adaptive
to clip length) to stay inside a reasonable worker-side timeout. If the
frontend's SIGNAL_WORKER_TIMEOUT_MS (currently 15s) is too tight for this
endpoint specifically, consider a longer, dedicated timeout for
/analyze/video rather than shrinking frame count further — see
callPythonCVWorkerVideo() in hf-analyze.ts.
"""

from __future__ import annotations

import logging
import os
import tempfile
import time
from typing import Any, Dict, List, Optional

import numpy as np

from version import VERSION

logger = logging.getLogger("aiscern.video_engine")

# Layers whose scores are most diagnostic of frame-to-frame AI-generation
# artifacts (compression/noise signature inconsistency is the classic tell
# for AI video — real camera footage has physically-consistent noise/DCT
# characteristics across frames; most video generators do not).
TEMPORAL_WATCH_LAYERS = {
    "noise_analysis",
    "frequency_analysis",
    "dct",
    "l2",  # DCT/quantization-table layer in image_engine's L-numbering
    "l3",  # noise-statistics layer
}

MIN_FRAMES = 8
MAX_FRAMES = 16


def _target_frame_count(duration_sec: float) -> int:
    """8 frames for short clips, scaling up to MAX_FRAMES for longer ones."""
    if duration_sec <= 0:
        return MIN_FRAMES
    # roughly 1 frame per 8 seconds of footage, clamped to [MIN, MAX]
    est = int(round(duration_sec / 8)) + MIN_FRAMES
    return max(MIN_FRAMES, min(MAX_FRAMES, est))


def _extract_frames(video_path: str) -> List[np.ndarray]:
    """Sample evenly-spaced frames from a video file using OpenCV."""
    import cv2  # opencv-python-headless — already a project dependency

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError("could not open video file (unsupported codec or corrupt file)")

    try:
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        duration_sec = (total_frames / fps) if fps > 0 else 0.0

        n_target = _target_frame_count(duration_sec)
        if total_frames <= 0:
            # Fallback: fps unknown / variable — just grab frames as they come,
            # sampling every ~2s of wall-clock decode.
            frames: List[np.ndarray] = []
            idx = 0
            while len(frames) < n_target:
                ok, frame = cap.read()
                if not ok:
                    break
                if idx % max(1, int(fps * 2)) == 0:
                    frames.append(frame)
                idx += 1
            return frames

        # Evenly-spaced frame indices across the whole clip, avoiding the
        # very first/last few frames (often black/fade).
        pad = max(1, int(total_frames * 0.02))
        lo, hi = pad, max(pad + 1, total_frames - pad)
        indices = np.linspace(lo, hi, num=n_target, dtype=int)

        frames = []
        for target_idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(target_idx))
            ok, frame = cap.read()
            if ok and frame is not None:
                frames.append(frame)
        return frames
    finally:
        cap.release()


def _frame_to_jpeg_bytes(frame_bgr: np.ndarray) -> bytes:
    import cv2

    ok, buf = cv2.imencode(".jpg", frame_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    if not ok:
        raise RuntimeError("failed to encode frame to JPEG")
    return buf.tobytes()


def _get_layer_score(layer_report: Dict[str, Any]) -> Optional[float]:
    return layer_report.get("layerSuspicionScore")


def _compute_temporal_variance(frame_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Frame-to-frame delta of each layer's score. High variance in the noise/
    frequency-domain/DCT layers is a distinct signal — AI video tends to
    show inconsistent per-frame compression/noise signatures that real
    camera footage doesn't exhibit.
    """
    # layer name -> list of per-frame scores (in frame order)
    per_layer_scores: Dict[str, List[float]] = {}

    for fr in frame_results:
        if fr.get("status") != "success":
            continue
        for layer in fr.get("layers", []):
            name = str(layer.get("name") or layer.get("layer") or "unknown")
            score = _get_layer_score(layer)
            if score is None:
                continue
            per_layer_scores.setdefault(name, []).append(float(score))

    per_layer_variance: Dict[str, float] = {}
    watch_deltas: List[float] = []

    for name, scores in per_layer_scores.items():
        if len(scores) < 2:
            continue
        deltas = [abs(scores[i] - scores[i - 1]) for i in range(1, len(scores))]
        mean_delta = float(np.mean(deltas))
        per_layer_variance[name] = round(mean_delta, 4)
        if name in TEMPORAL_WATCH_LAYERS or any(w in name.lower() for w in TEMPORAL_WATCH_LAYERS):
            watch_deltas.extend(deltas)

    overall_variance = float(np.mean(list(per_layer_variance.values()))) if per_layer_variance else 0.0
    watch_variance = float(np.mean(watch_deltas)) if watch_deltas else overall_variance

    # High variance in noise/frequency/DCT layers specifically = flagged.
    # Threshold chosen conservatively; calibrate with calibrate-video.js
    # before trusting this signal at a high weight.
    flagged = watch_variance > 0.18

    return {
        "overall_variance": round(overall_variance, 4),
        "watch_layer_variance": round(watch_variance, 4),
        "per_layer_variance": per_layer_variance,
        "flagged": flagged,
    }


def analyze_video(video_bytes: bytes, content_type: str = "", job_id: str = "") -> Dict[str, Any]:
    """
    Self-hosted video analysis via frame-sampled reuse of image_engine.

    Returns composite_cv_score, frame_scores[], temporal_variance, and
    per_layer_frame_breakdown — matching the shape the /analyze/video
    endpoint and callPythonCVWorkerVideo() in hf-analyze.ts expect.

    Degrades to status="error" (never raises) so the caller can fall back
    to NVIDIA NIM cleanly — see MODULE 1 acceptance criteria: this must
    never be the only path or a hard dependency.
    """
    from engines.image_engine import analyze_image_from_bytes

    start = time.time()
    suffix = ".mp4"
    if content_type and "/" in content_type:
        ext = content_type.split("/")[-1].split(";")[0]
        if ext:
            suffix = f".{ext}"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False, dir="/tmp") as tmp:
        tmp.write(video_bytes)
        temp_path = tmp.name

    try:
        try:
            frames = _extract_frames(temp_path)
        except Exception as e:
            logger.error("[VideoEngine] frame extraction failed: %s", e, exc_info=True)
            return {
                "jobId": job_id,
                "status": "error",
                "error": f"frame_extraction_failed: {e}",
                "processingTimeMs": int((time.time() - start) * 1000),
                "version": VERSION,
            }

        if not frames:
            return {
                "jobId": job_id,
                "status": "error",
                "error": "no_frames_extracted",
                "processingTimeMs": int((time.time() - start) * 1000),
                "version": VERSION,
            }

        frame_results: List[Dict[str, Any]] = []
        for i, frame in enumerate(frames):
            try:
                jpeg_bytes = _frame_to_jpeg_bytes(frame)
            except Exception as e:
                logger.warning("[VideoEngine] frame %d encode failed: %s", i, e)
                continue
            fr = analyze_image_from_bytes(jpeg_bytes, "image/jpeg", job_id=f"{job_id}_frame{i}")
            frame_results.append(fr)

        successful = [fr for fr in frame_results if fr.get("status") == "success"]
        if not successful:
            return {
                "jobId": job_id,
                "status": "error",
                "error": "all_frame_analyses_failed",
                "processingTimeMs": int((time.time() - start) * 1000),
                "version": VERSION,
            }

        composite_scores = []
        for fr in successful:
            fused = fr.get("composite_score", {})
            score = fused.get("fused_score") if isinstance(fused, dict) else None
            if score is None:
                score = fr.get("composite_cv_score", 0.5)
            composite_scores.append(float(score))

        composite_cv_score = float(np.mean(composite_scores)) if composite_scores else 0.5
        temporal = _compute_temporal_variance(successful)

        # Temporal inconsistency nudges the composite score up (more
        # suspicious) rather than being silently averaged away — this is
        # the "distinct signal, not just an average" requirement.
        if temporal["flagged"]:
            composite_cv_score = min(1.0, composite_cv_score + 0.10)

        frame_scores = [
            {
                "frame_index": i,
                "composite_cv_score": round(composite_scores[i], 4) if i < len(composite_scores) else None,
                "status": successful[i].get("status"),
            }
            for i in range(len(successful))
        ]

        per_layer_frame_breakdown = {
            layer_name: values
            for layer_name, values in (
                (name, [
                    _get_layer_score(l)
                    for fr in successful
                    for l in fr.get("layers", [])
                    if str(l.get("name") or l.get("layer")) == name
                ])
                for name in temporal["per_layer_variance"].keys()
            )
        }

        elapsed = int((time.time() - start) * 1000)
        logger.info(
            "[VideoEngine] analyzed %d/%d frames in %dms, composite=%.3f, temporal_flagged=%s",
            len(successful), len(frames), elapsed, composite_cv_score, temporal["flagged"],
        )

        return {
            "jobId": job_id,
            "status": "success",
            "composite_cv_score": round(composite_cv_score, 4),
            "frame_scores": frame_scores,
            "temporal_variance": temporal,
            "per_layer_frame_breakdown": per_layer_frame_breakdown,
            "frames_analyzed": len(successful),
            "frames_sampled": len(frames),
            "processingTimeMs": elapsed,
            "version": VERSION,
        }

    except Exception as e:
        logger.error("[VideoEngine] analyze_video failed: %s", e, exc_info=True)
        return {
            "jobId": job_id,
            "status": "error",
            "error": str(e),
            "processingTimeMs": int((time.time() - start) * 1000),
            "version": VERSION,
        }
    finally:
        try:
            os.remove(temp_path)
        except Exception:
            pass

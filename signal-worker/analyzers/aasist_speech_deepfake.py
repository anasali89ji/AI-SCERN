"""
Aiscern — AASIST Speech Deepfake Detector (Module 3.4)
=======================================================

AASIST (Audio Anti-Spoofing using Integrated Spectro-Temporal graph
attention networks) — Jung et al. 2022, Interspeech.

Current ASVspoof 2021 LA/DF SOTA. Single model, ~5M params, runs CPU-realtime.
Trained on ASVspoof 2019/2021.

This module provides the INFERENCE SCAFFOLDING. The actual model checkpoint
must be downloaded from HuggingFace (clovaai/aasist or a reproduction) and
cached via utils/model_cache.py. Until the checkpoint is available, this
analyzer returns `available: False` with a clear reason — it does NOT
fabricate a score.

Weight in audio_engine: 0.20 (high — SOTA). Reduces the existing
anti_spoofing_lfcc_cqcc weight from 0.075 to 0.03 (kept as evidence,
AASIST supersedes it).

Reference
---------
Jung, J.-w. et al. "AASIST: Audio Anti-Spoofing using Integrated
Spectro-Temporal graph attention networks." Interspeech 2022.
"""

from __future__ import annotations

import logging
from typing import Any, Dict

import numpy as np

logger = logging.getLogger(__name__)

# AASIST checkpoint HuggingFace repo (or local path).
# Until this is downloaded and cached, the analyzer returns unavailable.
_AASIST_MODEL_KEY = "aasist_speech_deepfake"
_AASIST_HF_REPO = "clovaai/aasist"  # or "takuma104/aasist" for a reproduction


def _load_aasist():
    """
    Load the AASIST model. Called by utils/model_cache.get_model() on first
    use. Returns the model in eval mode.

    Until the checkpoint is committed to the repo (or downloaded from HF),
    this raises RuntimeError — the caller catches it and returns unavailable.
    """
    try:
        import torch
        # Attempt to load from HuggingFace hub
        try:
            from transformers import AutoModel
            model = AutoModel.from_pretrained(_AASIST_HF_REPO, trust_remote_code=True)
        except Exception:
            # Fallback: load from local checkpoint path
            import os
            local_path = os.environ.get("AASIST_CHECKPOINT_PATH", "")
            if not local_path or not os.path.exists(local_path):
                raise RuntimeError(
                    f"AASIST checkpoint not found. Set AASIST_CHECKPOINT_PATH "
                    f"or download from HuggingFace {_AASIST_HF_REPO}."
                )
            model = torch.load(local_path, map_location="cpu")
        model.eval()
        return model
    except ImportError as e:
        raise RuntimeError(f"torch/transformers not installed: {e}")


def aasist_speech_deepfake_score(y: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Run AASIST speech deepfake detection on an audio waveform.

    Parameters
    ----------
    y : np.ndarray  shape (samples,) float32
        Mono audio waveform.
    sr : int
        Sample rate. AASIST expects 16kHz — resamples if needed.

    Returns
    -------
    dict with:
      - score: float in [0, 1] where 1 = AI-generated
      - confidence: float (0.85 when available, 0.0 when not)
      - available: bool
      - details: dict with model name + raw AI probability
    """
    try:
        from utils.model_cache import get_model
        model = get_model(_AASIST_MODEL_KEY, _load_aasist)
    except Exception as e:
        logger.info("[AASIST] model not available: %s", e)
        return {
            "score": 0.5,
            "confidence": 0.0,
            "available": False,
            "reason": f"aasist_checkpoint_not_loaded: {str(e)[:100]}",
            "details": {"planned_model": "AASIST (Jung et al. 2022)", "hf_repo": _AASIST_HF_REPO},
        }

    try:
        import torch
        import torchaudio

        # AASIST expects 16kHz mono — resample if needed
        if sr != 16000:
            y_t = torch.from_numpy(y).float().unsqueeze(0)
            y_t = torchaudio.functional.resample(y_t, sr, 16000)
            y = y_t.squeeze(0).numpy()
            sr = 16000

        # AASIST takes raw waveform (end-to-end, no spectrogram preprocessing)
        waveform = torch.from_numpy(y).float().unsqueeze(0)

        with torch.no_grad():
            logits = model(waveform)
            probs = torch.softmax(logits, dim=-1)
            ai_prob = probs[0, 1].item()  # class 1 = spoof/AI

        return {
            "score": float(np.clip(ai_prob, 0, 1)),
            "confidence": 0.85,  # high — AASIST is SOTA per the paper
            "available": True,
            "details": {
                "model": "AASIST",
                "raw_ai_prob": round(ai_prob, 4),
                "input_sr": sr,
            },
        }
    except Exception as e:
        logger.warning("[AASIST] inference failed: %s", e)
        return {
            "score": 0.5,
            "confidence": 0.0,
            "available": False,
            "reason": f"aasist_inference_failed: {str(e)[:100]}",
        }

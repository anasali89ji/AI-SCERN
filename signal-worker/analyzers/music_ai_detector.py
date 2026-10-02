"""
Aiscern — Music AI Detector (Module 3.5)
==========================================

Detects AI-generated music from Suno, Udio, MusicGen, and Stable Audio.

No published open Suno/Udio detector exists. This module provides the
INFERENCE SCAFFOLDING for a binary classifier on music-domain embeddings.

Planned approach:
  - Backbone: m-a-p/MERT-v1-95M (music AudioMAE, 95M params) or
    facebook/musicfm-base if available.
  - Classifier head: 2-layer MLP (768 → 256 → 2), trained on a labeled
    corpus.
  - Training corpus: ~200 Suno clips + ~200 Udio clips + ~200 MusicGen
    clips (AI side) vs ~600 FMA + GTZAN clips (real side). Total ~1200 clips.

Until a trained checkpoint is committed, this analyzer returns
`available: False` with a clear reason — it does NOT fabricate a score.

See:
  - aws-training/audio/train_music.py (training script — TODO)
  - signal-worker/scripts/curate_music_dataset.py (dataset curation — TODO)
"""

from __future__ import annotations

import logging
from typing import Any, Dict

import numpy as np

logger = logging.getLogger(__name__)

_MUSIC_AI_MODEL_KEY = "music_ai_detector"
_PLANNED_BACKBONE = "m-a-p/MERT-v1-95M"
_PLANNED_VENDORS = ["Suno", "Udio", "MusicGen", "StableAudio"]


def _load_music_ai():
    """
    Load the music AI detector model. Called by utils/model_cache.get_model()
    on first use.

    Until a trained checkpoint is committed, this raises RuntimeError —
    the caller catches it and returns unavailable.
    """
    import os
    import torch

    local_path = os.environ.get("MUSIC_AI_CHECKPOINT_PATH", "")
    if not local_path or not os.path.exists(local_path):
        raise RuntimeError(
            "Music AI detector checkpoint not found. "
            "Set MUSIC_AI_CHECKPOINT_PATH or run aws-training/audio/train_music.py "
            "to train the checkpoint."
        )
    model = torch.load(local_path, map_location="cpu")
    model.eval()
    return model


def music_ai_score(y: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Music AI detector — Suno / Udio / MusicGen / Stable Audio.

    Parameters
    ----------
    y : np.ndarray  shape (samples,) float32
        Mono audio waveform.
    sr : int
        Sample rate.

    Returns
    -------
    dict with:
      - score: float in [0, 1] where 1 = AI-generated music
      - confidence: float (0.85 when available, 0.0 when not)
      - available: bool — False until checkpoint is trained
      - reason: str — explains why unavailable
    """
    try:
        from utils.model_cache import get_model
        model = get_model(_MUSIC_AI_MODEL_KEY, _load_music_ai)
    except Exception as e:
        logger.info("[MusicAI] model not available: %s", e)
        return {
            "score": 0.5,
            "confidence": 0.0,
            "available": False,
            "reason": "music_ai_checkpoint_not_yet_trained",
            "details": {
                "planned_backbone": _PLANNED_BACKBONE,
                "planned_vendors": _PLANNED_VENDORS,
                "note": "Inference scaffolding ready. Train the checkpoint via "
                        "aws-training/audio/train_music.py to enable.",
            },
        }

    # ONCE CHECKPOINT IS AVAILABLE:
    try:
        import torch
        # Tokenize audio via MERT processor
        # Forward pass through backbone + classifier head
        # Softmax → AI probability
        # This code path is reached only when the checkpoint exists.
        waveform = torch.from_numpy(y).float().unsqueeze(0)
        with torch.no_grad():
            logits = model(waveform)
            probs = torch.softmax(logits, dim=-1)
            ai_prob = probs[0, 1].item()

        return {
            "score": float(np.clip(ai_prob, 0, 1)),
            "confidence": 0.85,
            "available": True,
            "details": {
                "model": "MERT-v1-95M + 2-layer MLP",
                "raw_ai_prob": round(ai_prob, 4),
            },
        }
    except Exception as e:
        logger.warning("[MusicAI] inference failed: %s", e)
        return {
            "score": 0.5,
            "confidence": 0.0,
            "available": False,
            "reason": f"music_ai_inference_failed: {str(e)[:100]}",
        }

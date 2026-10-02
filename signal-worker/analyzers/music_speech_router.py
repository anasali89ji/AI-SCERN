"""
Aiscern — Music / Speech / Silence Pre-Router (Module 3.5)
============================================================

Before any TTS analyzers run, classify the clip as speech / music / silence /
mixed. This prevents TTS analyzers from wasting compute on songs (which don't
have syllable nuclei → every song flagged "implausible" by prosody_temporal)
and routes music to the music AI detector.

Uses spectral flatness + onset density + harmonic-percussive separation
(librosa.decompose.hpss). No ML model required — pure DSP heuristics.

Reference
---------
Fuentes et al. "Harmonic-Percussive Source Separation and its Application
to Music-Type Classification." IEEE/ACM TASLP 2019.
"""

from __future__ import annotations

import logging
from typing import Literal

import numpy as np

logger = logging.getLogger(__name__)

AudioType = Literal["speech", "music", "silence", "mixed"]


def classify_audio_type(y: np.ndarray, sr: int) -> AudioType:
    """
    Classify an audio clip as speech, music, silence, or mixed.

    Parameters
    ----------
    y : np.ndarray  shape (samples,) float32
        Mono audio waveform.
    sr : int
        Sample rate.

    Returns
    -------
    'speech' | 'music' | 'silence' | 'mixed'
    """
    import librosa

    # Silence check — RMS below 1e-5 is genuinely silent (-100dBFS)
    rms = float(np.sqrt(np.mean(y ** 2)))
    if rms < 1e-5:
        return "silence"

    # Harmonic-percussive separation
    D = librosa.stft(y)
    H, P = librosa.decompose.hpss(D)
    harmonic_energy = float(np.mean(np.abs(H)))
    percussive_energy = float(np.mean(np.abs(P)))

    # Spectral flatness (high = noise/percussive, low = tonal/harmonic)
    S = np.abs(D)
    flatness = float(np.mean(librosa.feature.spectral_flatness(S=S)))

    # Onset density (high = percussive/music, low = sustained speech)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onset_density = float(np.mean(onset_env > 0.5 * onset_env.max())) if onset_env.max() > 0 else 0.0

    # Decision tree:
    # 1. Tonal + harmonic-dominant → music (sustained tones, chords)
    # 2. Percussive + onset-dense → music (drums, rhythmic)
    # 3. Harmonic > 2× percussive → speech (voiced speech is harmonic)
    # 4. Otherwise → mixed
    if flatness < 0.1 and harmonic_energy > 5 * percussive_energy:
        return "music"
    elif onset_density > 0.3 and percussive_energy > 0.5 * harmonic_energy:
        return "music"
    elif harmonic_energy > 2 * percussive_energy:
        return "speech"
    else:
        return "mixed"

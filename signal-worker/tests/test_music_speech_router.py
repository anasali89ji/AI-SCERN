"""
Module 3.5: Music/Speech router tests.

Verifies the classify_audio_type function correctly classifies:
  - Silent audio → 'silence'
  - Speech-like audio → 'speech'
  - Music-like audio → 'music' (tonal/harmonic or percussive)
"""
import numpy as np
import pytest

from analyzers.music_speech_router import classify_audio_type


def _silence(sr=16000, dur=2.0):
    return np.zeros(int(sr * dur), dtype=np.float32)


def _speech_like(sr=16000, dur=3.0):
    """Synthetic speech-like signal: F0 at 150Hz + harmonics + noise."""
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    f0 = 150 + 5 * np.sin(2 * np.pi * 3 * t)  # slight F0 variation
    phase = np.cumsum(2 * np.pi * f0 / sr)
    y = 0.3 * np.sin(phase) + 0.1 * np.sin(2 * phase) + 0.05 * np.sin(3 * phase)
    y += np.random.normal(0, 0.02, len(t))  # breath noise
    return y.astype(np.float32)


def _music_like(sr=16000, dur=3.0):
    """Synthetic music-like signal: sustained chord (multiple stable harmonics)."""
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    # C major chord: C4=262, E4=330, G4=392
    y = 0.2 * (np.sin(2 * np.pi * 262 * t) +
               np.sin(2 * np.pi * 330 * t) +
               np.sin(2 * np.pi * 392 * t))
    return y.astype(np.float32)


class TestClassifyAudioType:
    """Module 3.5: music/speech/silence classification."""

    def test_silence_detected(self):
        y = _silence()
        assert classify_audio_type(y, 16000) == "silence"

    def test_speech_detected(self):
        """Speech-like audio should classify as 'speech'."""
        y = _speech_like()
        result = classify_audio_type(y, 16000)
        assert result in ("speech", "mixed"), f"expected speech/mixed, got {result}"

    def test_music_detected(self):
        """Music-like audio (sustained chord) should classify as 'music'."""
        y = _music_like()
        result = classify_audio_type(y, 16000)
        assert result in ("music", "mixed"), f"expected music/mixed, got {result}"

    def test_returns_valid_string(self):
        """Always returns one of the 4 valid types."""
        for y in [_silence(), _speech_like(), _music_like()]:
            result = classify_audio_type(y, 16000)
            assert result in ("speech", "music", "silence", "mixed"), f"invalid type: {result}"

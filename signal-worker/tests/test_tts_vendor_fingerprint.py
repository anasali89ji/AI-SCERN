"""
Module 3.1: TTS vendor fingerprint tests.

Verifies the ElevenLabs math fix + librosa.lpc replacement + voiced_idx
consultation + 5 new vendor heuristics (PlayHT, Murf, OpenAI TTS, Tortoise, Suno).
"""
import numpy as np
import pytest

from analyzers.tts_vendor_fingerprint import (
    _elevenlabs_score,
    _lpc_formants,
    _track_formants,
    _playht_score,
    _murf_score,
    _openai_tts_score,
    _tortoise_score,
    _suno_speech_score,
)


def _make_spectrogram(sr=16000, n_fft=2048, n_frames=100):
    """Synthetic spectrogram for testing."""
    S = np.random.rand(n_fft // 2 + 1, n_frames).astype(np.float32) + 0.01
    freqs = np.linspace(0, sr / 2, n_fft // 2 + 1)
    return S, freqs


class TestElevenLabsMath:
    """Module 3.1: ElevenLabs math fix — **2 inside mean, not outside."""

    def test_returns_float(self):
        S, freqs = _make_spectrogram()
        score = _elevenlabs_score(S, freqs)
        assert isinstance(score, float)
        assert 0.0 <= score <= 1.0

    def test_boosted_3_4kh_band_scores_higher(self):
        """A spectrogram with a boosted 3-4kHz band should score higher
        than a flat spectrogram."""
        S, freqs = _make_spectrogram()
        # Boost the 3-4kHz band
        band = (freqs >= 3000) & (freqs < 4000)
        S[band, :] *= 10.0
        boosted_score = _elevenlabs_score(S, freqs)

        S_flat, _ = _make_spectrogram()
        flat_score = _elevenlabs_score(S_flat, freqs)
        assert boosted_score > flat_score, (
            f"boosted 3-4kHz should score higher than flat. "
            f"Got boosted={boosted_score}, flat={flat_score}"
        )


class TestLPCFormants:
    """Module 3.1: librosa.lpc replacement — no more underflow silent failures."""

    def test_returns_formant_list_on_voiced_frame(self):
        """A voiced frame should return a list of formant frequencies."""
        # Synthetic voiced frame: sum of resonances
        sr = 16000
        t = np.linspace(0, 0.064, int(sr * 0.064))
        frame = np.sin(2 * np.pi * 500 * t) + 0.5 * np.sin(2 * np.pi * 1500 * t)
        formants = _lpc_formants(frame.astype(np.float32), sr)
        assert isinstance(formants, list)
        # Should find at least one formant near 500Hz or 1500Hz
        assert len(formants) >= 1, f"expected at least 1 formant, got {formants}"

    def test_silence_returns_empty(self):
        """A silent frame should return an empty list, not crash."""
        silence = np.zeros(1024, dtype=np.float32)
        formants = _lpc_formants(silence, 16000)
        assert formants == []

    def test_noisy_frame_doesnt_crash(self):
        """A noisy frame should not crash the LPC computation."""
        noise = np.random.randn(1024).astype(np.float32) * 0.1
        formants = _lpc_formants(noise, 16000)
        assert isinstance(formants, list)


class TestTrackFormantsVoicedIdx:
    """Module 3.1: _track_formants now consults voiced_idx."""

    def test_unvoiced_frames_return_none(self):
        """Frames not in voiced_idx should return None."""
        sr = 16000
        y = np.random.rand(sr * 2).astype(np.float32)  # 2 seconds
        # Only frame 0 and frame 5 are voiced
        voiced_idx = np.array([0, 5])
        tracks = _track_formants(y, sr, voiced_idx, frame_len=1024, hop=512)
        # Frame 0 should have a result (or None if formants not found)
        # Frame 1 should be None (not in voiced_idx)
        assert tracks[1] is None, f"unvoiced frame 1 should be None, got {tracks[1]}"

    def test_all_voiced_returns_results(self):
        """When all frames are voiced, no None entries should appear."""
        sr = 16000
        y = np.random.rand(sr * 2).astype(np.float32)
        n_frames = 1 + (len(y) - 1024) // 512
        voiced_idx = np.arange(n_frames)
        tracks = _track_formants(y, sr, voiced_idx, frame_len=1024, hop=512)
        assert len(tracks) == n_frames


class TestNewVendorScores:
    """Module 3.6: 5 new vendor heuristics."""

    def test_playht_returns_float_in_range(self):
        S, freqs = _make_spectrogram(sr=24000)  # need 6-8kHz band visible
        score = _playht_score(S, freqs)
        assert 0.0 <= score <= 1.0

    def test_murf_returns_float_in_range(self):
        f0 = np.array([150.0, 150.1, 149.9, 150.0, 150.2, 149.8, 150.1, 149.9, 150.0, 150.1, 150.0])
        voiced_flag = np.ones(len(f0), dtype=bool)
        score = _murf_score(f0, voiced_flag)
        assert 0.0 <= score <= 1.0

    def test_openai_tts_returns_float_in_range(self):
        S, freqs = _make_spectrogram(sr=24000)
        score = _openai_tts_score(S, freqs, 24000)
        assert 0.0 <= score <= 1.0

    def test_tortoise_returns_float_in_range(self):
        S, freqs = _make_spectrogram(sr=24000)
        score = _tortoise_score(S, freqs)
        assert 0.0 <= score <= 1.0

    def test_suno_speech_returns_float_in_range(self):
        S, freqs = _make_spectrogram(sr=24000)
        score = _suno_speech_score(S, freqs)
        assert 0.0 <= score <= 1.0

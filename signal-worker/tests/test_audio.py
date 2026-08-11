"""
Aiscern Detection Worker — audio engine tests (MODULE 3)

HONEST LIMITATION: this sandbox has no network egress to fetch a real
labeled real-speech/synthetic-speech dataset (module doc's task 5 asks for
"at least one known labeled real + one known labeled synthetic sample").
What's below instead is a synthetic proxy pair — a noisy/irregular signal
standing in for "human-like" and a perfectly regular tone standing in for
"synthetic/robotic" — used only to check the composite score moves in the
RIGHT DIRECTION, not to validate real-world accuracy. Before trusting this
module's weight above the conservative 35% starting point (see
audio_engine.py docstring), replace this with real labeled audio and run
it through a proper calibration script, same as Module 4 did for images.
"""
import io
import numpy as np
import pytest
import soundfile as sf


def _wav_bytes(y: np.ndarray, sr: int = 16000) -> bytes:
    buf = io.BytesIO()
    sf.write(buf, y.astype(np.float32), sr, format="WAV")
    return buf.getvalue()


def _human_like_proxy(sr: int = 16000, dur: float = 6.0) -> np.ndarray:
    """Pitch vibrato + amplitude modulation + noise + irregular pauses."""
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    f0 = 150 + 12 * np.sin(2 * np.pi * 3.3 * t) + np.random.normal(0, 3, len(t))
    phase = np.cumsum(2 * np.pi * f0 / sr)
    y = 0.3 * np.sin(phase) * (0.6 + 0.4 * np.sin(2 * np.pi * 2.1 * t)) + np.random.normal(0, 0.03, len(t))
    for start_s, dur_s in [(1.1, 0.15), (2.7, 0.35), (4.4, 0.22)]:
        if start_s + dur_s >= dur:
            continue  # skip pauses that would fall outside a short test clip
        s = int(start_s * sr); e = min(len(y), s + int(dur_s * sr))
        y[s:e] = np.random.normal(0, 0.001, e - s)
    return y.astype(np.float32)


def _robotic_proxy(sr: int = 16000, dur: float = 6.0) -> np.ndarray:
    """Perfectly steady pitch, zero jitter, perfectly uniform pause spacing."""
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    y = 0.3 * np.sin(2 * np.pi * 150 * t)
    for start_s in [1.0, 2.5, 4.0]:  # exactly 1.5s apart, every time
        s = int(start_s * sr); e = s + int(0.25 * sr)
        y[s:e] = 0.0
    return y.astype(np.float32)


# ── Endpoint smoke tests ────────────────────────────────────────────────────

def test_analyze_audio_rejects_unsupported_type(client):
    resp = client.post(
        "/analyze/audio",
        files={"file": ("test.txt", b"not audio", "text/plain")},
    )
    assert resp.status_code == 415


def test_analyze_audio_smoke(client):
    y = _human_like_proxy(dur=3.0)
    resp = client.post(
        "/analyze/audio",
        files={"file": ("test.wav", _wav_bytes(y), "audio/wav")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "composite_audio_score" in data
    assert 0.0 <= data["composite_audio_score"] <= 1.0
    assert "audio_signals" in data
    assert "signal_details" in data
    assert "version" in data


# ── Graceful-degrade cases (engine-level, not endpoint — faster, no HTTP overhead) ──

def test_silence_handling():
    from engines.audio_engine import analyze_audio
    silence = np.zeros(16000 * 3, dtype=np.float32)
    result = analyze_audio(_wav_bytes(silence), "audio/wav", "test-silence")
    assert result["status"] == "success"
    assert result.get("insufficient_audio") is True
    assert result["composite_audio_score"] == 0.5  # honest "uncertain", not a false claim


def test_very_short_clip_under_2s():
    from engines.audio_engine import analyze_audio
    y = _human_like_proxy(dur=0.5)  # well under MIN_DURATION_SEC
    result = analyze_audio(_wav_bytes(y), "audio/wav", "test-short")
    assert result["status"] == "success"
    assert result.get("insufficient_audio") is True


def test_short_but_analyzable_clip():
    """Just above MIN_DURATION_SEC — should attempt real analysis, not degrade."""
    from engines.audio_engine import analyze_audio
    y = _human_like_proxy(dur=1.5)
    result = analyze_audio(_wav_bytes(y), "audio/wav", "test-short-ok")
    assert result["status"] == "success"
    assert result.get("insufficient_audio") is not True


def test_clipped_distorted_audio_does_not_crash():
    """Hard-clipped waveform (all samples at +/-1.0) — a degenerate input
    that real user uploads sometimes are. Must not throw."""
    from engines.audio_engine import analyze_audio
    y = _human_like_proxy(dur=3.0)
    clipped = np.clip(y * 20, -1.0, 1.0).astype(np.float32)  # force hard clipping
    result = analyze_audio(_wav_bytes(clipped), "audio/wav", "test-clipped")
    assert result["status"] == "success"
    assert 0.0 <= result["composite_audio_score"] <= 1.0


def test_pure_noise_does_not_crash():
    """White noise — no pitch, no harmonic structure. Individual signals
    should gracefully report unavailable rather than raising."""
    from engines.audio_engine import analyze_audio
    noise = np.random.normal(0, 0.2, 16000 * 3).astype(np.float32)
    result = analyze_audio(_wav_bytes(noise), "audio/wav", "test-noise")
    assert result["status"] == "success"
    assert 0.0 <= result["composite_audio_score"] <= 1.0


def test_malformed_bytes_returns_error_not_crash():
    from engines.audio_engine import analyze_audio
    result = analyze_audio(b"this is not a valid audio file at all", "audio/wav", "test-malformed")
    assert result["status"] == "error"
    assert "error" in result


# ── Regression guard (synthetic proxy — see module docstring limitation) ────

def test_synthetic_regression_direction():
    """
    Directional check only: a perfectly-regular ('robotic-proxy') signal
    should score at least as suspicious as a noisy/irregular ('human-like-
    proxy') one. This is NOT validated against real speech — see module
    docstring. A failure here means a signal's suspicion direction is
    inverted (a real bug); a small margin should not be treated as proof
    of real-world accuracy either way.
    """
    from engines.audio_engine import analyze_audio
    np.random.seed(42)  # reduce test flakiness from the noise components
    human = analyze_audio(_wav_bytes(_human_like_proxy()), "audio/wav", "reg-human")
    robotic = analyze_audio(_wav_bytes(_robotic_proxy()), "audio/wav", "reg-robotic")

    assert human["status"] == "success"
    assert robotic["status"] == "success"
    # Directional, not magnitude — see docstring on why this is deliberately loose.
    assert robotic["composite_audio_score"] >= human["composite_audio_score"] - 0.05

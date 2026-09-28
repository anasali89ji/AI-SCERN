"""
Aiscern Detection Worker — voiceprint liveness / anti-spoofing tests
(MODULE 19a, spec Section 2.3 items 2-3)

Same honest-limitation framing as tests/test_audio.py: no network egress
to fetch real ASVspoof/replay-attack corpora in this sandbox. Synthetic
proxies below are built from the PHYSICAL mechanism each detector is
checking (single vs. double exponential decay for reverberation
liveness; stable vs. switched noise-floor spectral shape for noise-floor
consistency) so a directionally-correct pass here is real evidence the
DSP is implemented correctly -- not evidence of real-world accuracy,
which still needs a proper calibration pass against real fixtures.
"""
import numpy as np
import pytest

from analyzers.voiceprint_liveness import (
    anti_spoofing_lfcc_cqcc,
    reverberation_liveness,
    noise_floor_consistency,
    run_all,
)

SR = 16000


def _voiced_signal(sr: int = SR, dur: float = 3.0, seed: int = 0) -> np.ndarray:
    rng = np.random.RandomState(seed)
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    f0 = 150 + 10 * np.sin(2 * np.pi * 3.0 * t) + rng.normal(0, 2, len(t))
    phase = np.cumsum(2 * np.pi * f0 / sr)
    y = 0.3 * np.sin(phase) + 0.15 * np.sin(2 * phase) + rng.normal(0, 0.01, len(t))
    return y.astype(np.float32)


def _exp_decay_ir(sr: int, rt60_sec: float, length_sec: float = 1.0) -> np.ndarray:
    """Single-exponential synthetic room impulse response."""
    n = int(sr * length_sec)
    t = np.arange(n) / sr
    decay_rate = -np.log(1e-3) / rt60_sec   # -60dB point
    ir = np.random.RandomState(1).normal(0, 1, n) * np.exp(-decay_rate * t)
    ir[0] = 1.0
    return ir


def _convolve_norm(y: np.ndarray, ir: np.ndarray) -> np.ndarray:
    out = np.convolve(y, ir, mode="full")[: len(y) + len(ir) // 2]
    peak = np.max(np.abs(out)) + 1e-9
    return (out / peak * 0.3).astype(np.float32)


# ── anti_spoofing_lfcc_cqcc ────────────────────────────────────────────────

def test_anti_spoofing_available_on_voiced_signal():
    y = _voiced_signal(dur=2.0)
    res = anti_spoofing_lfcc_cqcc(y, SR)
    assert res["available"] is True
    assert 0.0 <= res["score"] <= 1.0
    assert "high_quefrency_ratio" in res


def test_anti_spoofing_too_short_is_unavailable():
    y = _voiced_signal(dur=0.1)
    res = anti_spoofing_lfcc_cqcc(y, SR)
    assert res["available"] is False


def test_anti_spoofing_flags_synthetic_high_frequency_texture():
    """A clean tone plus dense high-frequency comb noise (proxy for
    vocoder-style excess high-quefrency texture) should score higher
    than plain voiced speech."""
    y_clean = _voiced_signal(dur=2.0, seed=2)
    rng = np.random.RandomState(3)
    t = np.linspace(0, 2.0, len(y_clean), endpoint=False)
    buzz = 0.05 * np.sin(2 * np.pi * 3800 * t) + 0.05 * rng.normal(0, 1, len(t))
    y_textured = (y_clean + buzz).astype(np.float32)

    res_clean = anti_spoofing_lfcc_cqcc(y_clean, SR)
    res_textured = anti_spoofing_lfcc_cqcc(y_textured, SR)
    assert res_clean["available"] and res_textured["available"]
    assert res_textured["high_quefrency_ratio"] > res_clean["high_quefrency_ratio"]


# ── reverberation_liveness ─────────────────────────────────────────────────

def test_reverb_liveness_single_room_is_more_linear_than_double_room():
    # A real decay tail needs the source to actually stop -- convolving a
    # continuous voice signal end-to-end never lets the room "ring down"
    # on its own, so the loudest-frame-to-tail window would capture the
    # voice's own amplitude dynamics instead of the room's decay. Append
    # silence after the voiced burst so the IR's tail is measurable in
    # isolation, same as how a real utterance's reverb tail is only
    # visible once the speaker stops.
    voice = _voiced_signal(dur=0.8, seed=4)
    y = np.concatenate([voice, np.zeros(int(SR * 1.7), dtype=np.float32)])
    single_room = _convolve_norm(y, _exp_decay_ir(SR, rt60_sec=0.4))
    double_room = _convolve_norm(single_room, _exp_decay_ir(SR, rt60_sec=0.6))

    res_single = reverberation_liveness(single_room, SR)
    res_double = reverberation_liveness(double_room, SR)
    assert res_single["available"] is True
    assert res_double["available"] is True
    # Core claim: convolving a second room's decay onto the first bends
    # the dB decay curve away from a straight line more than a single
    # room does.
    assert res_double["linearity_deviation"] > res_single["linearity_deviation"]
    assert res_double["score"] >= res_single["score"]


def test_reverb_liveness_too_short_unavailable():
    y = _voiced_signal(dur=0.5)
    res = reverberation_liveness(y, SR)
    assert res["available"] is False


def test_reverb_liveness_silence_unavailable():
    y = np.zeros(SR * 2, dtype=np.float32)
    res = reverberation_liveness(y, SR)
    assert res["available"] is False


# ── noise_floor_consistency ────────────────────────────────────────────────

def test_noise_floor_consistency_stable_scores_lower_than_switched():
    rng = np.random.RandomState(5)
    dur = 4.0
    n = int(SR * dur)
    voice = _voiced_signal(dur=dur, seed=6)

    # stable: same white-ish noise floor character throughout
    stable_noise = rng.normal(0, 0.01, n).astype(np.float32)
    y_stable = voice + stable_noise

    # switched: first half low-pass-ish (simulated via smoothing) noise,
    # second half raw high-frequency-heavier noise -- proxy for a
    # capture-chain switch partway through the clip.
    raw_noise = rng.normal(0, 0.01, n).astype(np.float32)
    kernel = np.ones(9) / 9.0
    smoothed_noise = np.convolve(raw_noise, kernel, mode="same").astype(np.float32)
    half = n // 2
    switched_noise = np.concatenate([smoothed_noise[:half], raw_noise[half:] * 3.0])
    y_switched = voice + switched_noise

    res_stable = noise_floor_consistency(y_stable, SR)
    res_switched = noise_floor_consistency(y_switched, SR)
    assert res_stable["available"] is True
    assert res_switched["available"] is True
    assert res_switched["score"] >= res_stable["score"]


def test_noise_floor_consistency_too_short_unavailable():
    y = _voiced_signal(dur=0.5)
    res = noise_floor_consistency(y, SR)
    assert res["available"] is False


# ── run_all / integration shape ────────────────────────────────────────────

def test_run_all_returns_all_three_keys():
    y = _voiced_signal(dur=2.0)
    out = run_all(y, SR)
    assert set(out.keys()) == {
        "anti_spoofing_lfcc_cqcc",
        "reverberation_liveness",
        "noise_floor_consistency",
    }
    for v in out.values():
        assert "available" in v


def test_run_all_never_raises_on_pathological_input():
    y = np.array([], dtype=np.float32)
    out = run_all(y, SR)
    assert set(out.keys()) == {
        "anti_spoofing_lfcc_cqcc",
        "reverberation_liveness",
        "noise_floor_consistency",
    }
    for v in out.values():
        assert v["available"] is False

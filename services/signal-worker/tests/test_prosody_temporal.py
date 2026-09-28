"""
Aiscern Detection Worker — prosodic & temporal analysis tests (MODULE 20,
spec Section 2.4)

Same honest-limitation framing as tests/test_audio.py and
tests/test_voiceprint_liveness.py: synthetic proxies built from the
mechanism each detector targets, checked for directional correctness
only -- not a substitute for calibration against real labeled speech.
"""
import numpy as np

from analyzers.prosody_temporal import (
    prosody_analysis,
    pause_analysis,
    coarticulation_analysis,
    run_all,
)

SR = 16000


def _varied_intonation_voice(sr: int = SR, dur: float = 4.0, seed: int = 0) -> np.ndarray:
    """Continuously, gently drifting spectral content — bounded per-frame
    change throughout, no long held-steady segments and no isolated huge
    jumps (co-articulation proxy: real speech keeps transitioning)."""
    rng = np.random.RandomState(seed)
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    f0_drift = np.cumsum(rng.normal(0, 1.2, len(t)))
    f0_drift = 40 * f0_drift / (np.max(np.abs(f0_drift)) + 1e-6)
    f0 = 160 + f0_drift + 8 * np.sin(2 * np.pi * 0.7 * t)
    f0 = np.clip(f0, 80, 320)
    phase = np.cumsum(2 * np.pi * f0 / sr)
    # Continuously-varying formant-ish content (drifting mixture of two
    # partials, weight shifting slowly and constantly -- never flat/held).
    mix = 0.5 + 0.5 * np.sin(2 * np.pi * 0.6 * t + rng.uniform(0, 6))
    y = 0.3 * ((1 - mix) * np.sin(phase) + mix * np.sin(2 * phase)) + rng.normal(0, 0.01, len(t))
    return y.astype(np.float32)


def _monotone_templated_voice(sr: int = SR, dur: float = 4.0, seed: int = 1) -> np.ndarray:
    """Near-flat F0 (low entropy) + long HELD-STEADY segments with an
    instantaneous full-spectrum swap at each boundary (staccato
    co-articulation proxy: near-zero delta within a segment, one sharp
    isolated spike exactly at the swap)."""
    rng = np.random.RandomState(seed)
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    f0 = 150 + rng.normal(0, 0.3, len(t))   # essentially flat pitch
    phase = np.cumsum(2 * np.pi * f0 / sr)
    base = 0.3 * np.sin(phase)
    seg_len = int(0.7 * sr)   # long enough that most frames sit fully
                              # inside one steady segment (hop=512 -> only
                              # a couple of frames straddle each boundary)
    y = base.copy()
    for i in range(0, len(y), seg_len):
        if (i // seg_len) % 2 == 1:
            y[i:i + seg_len] = base[i:i + seg_len] + 0.28 * np.sin(2 * np.pi * 1400 * t[i:i + seg_len])
    y = y + rng.normal(0, 0.003, len(t))
    return y.astype(np.float32)


def _speech_with_pauses(sr: int, pause_durs_sec, speech_dur: float = 0.5, seed: int = 2,
                         pause_fill=None) -> np.ndarray:
    rng = np.random.RandomState(seed)
    chunks = []
    for i, pause_dur in enumerate(pause_durs_sec):
        t = np.linspace(0, speech_dur, int(sr * speech_dur), endpoint=False)
        f0 = 150 + 10 * np.sin(2 * np.pi * 2.5 * t) + rng.normal(0, 2, len(t))
        phase = np.cumsum(2 * np.pi * f0 / sr)
        speech = (0.3 * np.sin(phase)).astype(np.float32)
        chunks.append(speech)
        n_pause = int(sr * pause_dur)
        if pause_fill is not None:
            chunks.append(pause_fill(n_pause, i, rng).astype(np.float32))
        else:
            chunks.append(np.zeros(n_pause, dtype=np.float32))
    return np.concatenate(chunks)


# ── prosody_analysis ────────────────────────────────────────────────────────

def test_prosody_varied_intonation_scores_lower_than_monotone():
    y_varied = _varied_intonation_voice()
    y_flat = _monotone_templated_voice()
    r_varied = prosody_analysis(y_varied, SR)
    r_flat = prosody_analysis(y_flat, SR)
    assert r_varied["available"] and r_flat["available"]
    assert r_flat["f0_entropy_normalized"] < r_varied["f0_entropy_normalized"]
    assert r_flat["score"] > r_varied["score"]


def test_prosody_too_short_unavailable():
    y = _varied_intonation_voice(dur=0.05)
    res = prosody_analysis(y, SR)
    assert res["available"] is False


# ── pause_analysis ──────────────────────────────────────────────────────────

def test_pause_analysis_uniform_gaps_score_higher_than_varied():
    varied_gaps = [0.15, 0.42, 0.28, 0.61, 0.19, 0.35]
    uniform_gaps = [0.30, 0.30, 0.30, 0.30, 0.30, 0.30]

    y_varied = _speech_with_pauses(SR, varied_gaps)
    y_uniform = _speech_with_pauses(SR, uniform_gaps)

    r_varied = pause_analysis(y_varied, SR)
    r_uniform = pause_analysis(y_uniform, SR)
    assert r_varied["available"] and r_uniform["available"]
    assert r_uniform["near_duplicate_gap_ratio"] > r_varied["near_duplicate_gap_ratio"]
    assert r_uniform["score"] >= r_varied["score"]


def test_pause_analysis_reused_breath_sample_flagged():
    gaps = [0.25, 0.30, 0.28, 0.32, 0.27]
    rng_global = np.random.RandomState(42)
    breath_template = rng_global.normal(0, 0.003, int(SR * 0.4)).astype(np.float32)

    def digital_silence_fill(n, i, rng):
        return np.zeros(n, dtype=np.float32)

    def reused_breath_fill(n, i, rng):
        return breath_template[:n] if n <= len(breath_template) else np.pad(
            breath_template, (0, n - len(breath_template))
        )

    y_silent = _speech_with_pauses(SR, gaps, pause_fill=digital_silence_fill)
    y_reused_breath = _speech_with_pauses(SR, gaps, pause_fill=reused_breath_fill)

    r_silent = pause_analysis(y_silent, SR)
    r_reused = pause_analysis(y_reused_breath, SR)
    assert r_silent["available"] and r_reused["available"]
    assert r_silent["digitally_silent_pause_ratio"] == 1.0
    assert r_reused["duplicate_breath_similarity_score"] > r_silent["duplicate_breath_similarity_score"]


def test_pause_analysis_too_few_pauses_unavailable():
    y = _speech_with_pauses(SR, [0.2])
    res = pause_analysis(y, SR)
    assert res["available"] is False


# ── coarticulation_analysis ─────────────────────────────────────────────────

def test_coarticulation_smooth_scores_lower_than_staccato():
    sr = SR
    dur = 4.0
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)

    # Smooth: a single continuous linear chirp -- spectral content shifts
    # at a constant, gentle rate every frame, so frame-to-frame MFCC
    # delta magnitude stays roughly CONSTANT (no isolated outliers).
    f0_chirp = np.linspace(120, 220, len(t))
    phase_chirp = np.cumsum(2 * np.pi * f0_chirp / sr)
    y_smooth = (0.3 * np.sin(phase_chirp)).astype(np.float32)

    # Staccato: long steady-tone segments (so within-segment delta ~0),
    # with an instantaneous jump to a very different tone at each of a
    # few segment boundaries -- isolated large spikes among a near-zero
    # baseline is exactly the "few extreme values, high kurtosis" shape.
    seg_len = int(1.0 * sr)
    tones = [150.0, 2400.0, 150.0, 2400.0]
    y_staccato = np.zeros(len(t), dtype=np.float32)
    for i, f in enumerate(tones):
        s, e = i * seg_len, min(len(t), (i + 1) * seg_len)
        y_staccato[s:e] = 0.3 * np.sin(2 * np.pi * f * t[s:e])

    r_smooth = coarticulation_analysis(y_smooth, sr)
    r_staccato = coarticulation_analysis(y_staccato, sr)
    assert r_smooth["available"] and r_staccato["available"]
    assert r_staccato["delta_excess_kurtosis"] > r_smooth["delta_excess_kurtosis"]
    assert r_staccato["score"] >= r_smooth["score"]


def test_coarticulation_too_short_unavailable():
    y = _varied_intonation_voice(dur=0.05)
    res = coarticulation_analysis(y, SR)
    assert res["available"] is False


# ── run_all / integration shape ─────────────────────────────────────────────

def test_run_all_returns_all_three_keys():
    y = _varied_intonation_voice(dur=2.0)
    out = run_all(y, SR)
    assert set(out.keys()) == {"prosody_analysis", "pause_analysis", "coarticulation_analysis"}
    for v in out.values():
        assert "available" in v


def test_run_all_never_raises_on_pathological_input():
    y = np.array([], dtype=np.float32)
    out = run_all(y, SR)
    assert set(out.keys()) == {"prosody_analysis", "pause_analysis", "coarticulation_analysis"}
    for v in out.values():
        assert v["available"] is False

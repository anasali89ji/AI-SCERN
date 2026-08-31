"""
Aiscern Detection Worker — Audio Spectral Deep Analysis (MODULE 16)
Giant-Level Optimization Spec, Section 2.1, items 1-2:
  1. Harmonic Structure Analysis (F0 track, per-frame HNR variability,
     harmonic amplitude envelope micro-variation)
  2. Phase Coherence Analysis (inter-harmonic phase coherence, group delay)

Audit note (pre-implementation, per established workflow): the spec's
"Current: Only runs HF models" framing for the audio engine was already
stale before this module — engines/audio_engine.py (MODULE 3) added 5 CPU
heuristic signals, one of which (`harmonic_noise_ratio`) is a coarse
*global* HPSS-based HNR proxy (one number for the whole clip). That is NOT
the same signal as spec item 1's per-frame HNR *variability* claim ("Real
speech: HNR varies naturally 15-40 dB; TTS: HNR is unnaturally high and
stable") — the existing signal has no notion of variation over time at
all, so it cannot distinguish "stable-and-clean" from "stable-and-noisy"
the way the spec's mechanism requires. This module does not touch the
existing `harmonic_noise_ratio` signal; it adds the genuinely-missing
per-frame-variability version alongside it under a different name so both
are visible and neither silently overwrites the other's semantics.

F0 tracking: spec item 1 says "CREPE or YIN". CREPE requires a
TensorFlow/torch pitch-tracking model dependency signal-worker does not
currently carry (would need to be added + a GPU/CPU inference-time
tradeoff decision — out of scope for a single sub-module). librosa.pyin
(used here and already used by audio_engine.py's jitter/shimmer signal) is
a YIN-family probabilistic tracker, which is the spec's other explicitly
named acceptable option — implemented honestly as YIN, not mislabeled as
CREPE.

Phase coherence / group delay: implemented directly from STFT phase,
sampled at each frame's estimated harmonic positions (F0 * 1..N) rather
than assuming fixed bin spacing, since F0 (and therefore true harmonic
bin positions) varies frame to frame in real speech.
"""

import logging
from typing import Any, Dict

import numpy as np

logger = logging.getLogger(__name__)

N_FFT = 2048
HOP_LENGTH = 512
N_HARMONICS = 6          # how many harmonic partials above F0 to sample per frame
MIN_VOICED_FRAMES = 8    # below this, per-frame statistics are too noisy to trust


# ─────────────────────────────────────────────────────────────────────────────
# Sub-module 2.1 item 1 — Harmonic Structure Analysis
# ─────────────────────────────────────────────────────────────────────────────

def harmonic_structure_analysis(y: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Per-frame HNR (autocorrelation-based, on voiced frames only) plus its
    variability across the clip, and the harmonic amplitude envelope's
    frame-to-frame smoothness.

    Real speech: HNR value itself varies naturally frame-to-frame
    (different phonemes, vocal effort) -> HIGH std of per-frame HNR.
    TTS (esp. neural vocoders): HNR is unnaturally stable even when the
    absolute level differs -> LOW std of per-frame HNR ("too clean" in the
    sense of "too uniform", independent of whether the mean is high).

    Harmonic amplitude envelope: real speech has amplitude micro-variation
    within the harmonic-dominant regions from vocal fold tension changes;
    TTS envelopes are frequently over-smoothed.
    """
    try:
        import librosa

        f0, voiced_flag, voiced_prob = librosa.pyin(
            y, fmin=65, fmax=400, sr=sr, frame_length=N_FFT, hop_length=HOP_LENGTH,
        )
        voiced_idx = np.where(voiced_flag & ~np.isnan(f0))[0]
        if len(voiced_idx) < MIN_VOICED_FRAMES:
            return {"available": False, "reason": "insufficient_voiced_frames"}

        S = np.abs(librosa.stft(y, n_fft=N_FFT, hop_length=HOP_LENGTH))
        n_bins, n_frames = S.shape
        freqs = librosa.fft_frequencies(sr=sr, n_fft=N_FFT)

        # A pure-tone harmonic's energy leaks into neighboring FFT bins
        # (spectral leakage from the analysis window), so summing a single
        # bin under-counts harmonic energy for BOTH real and synthetic
        # audio roughly equally. Worse: pyin's per-frame F0 estimate has a
        # few Hz of its own tracking jitter even on a *perfectly static*
        # tone, and at this FFT resolution (~7.8Hz/bin at 16kHz/2048pt)
        # that jitter alone can shift which discrete bin the nominal
        # harmonic position rounds to -- which showed up in the smoke test
        # below as a STATIC pure-tone fixture producing HIGHER measured
        # HNR variance than a genuinely time-varying real-speech-like
        # fixture (backwards). Fix: search a slightly wider neighborhood
        # for each harmonic's actual local energy peak first (robust to a
        # few bins of F0-estimate jitter), THEN sum a fixed window around
        # that measured peak, instead of trusting the nominal
        # F0-multiple bin position directly.
        BIN_WINDOW = 2
        SEARCH_RADIUS = 4

        per_frame_hnr = []
        harmonic_amp_envelope = []
        for i in voiced_idx:
            if i >= n_frames:
                continue
            f0_i = f0[i]
            frame_spec = S[:, i]
            nominal_centers = [int(round((f0_i * h) / (sr / 2) * (n_bins - 1))) for h in range(1, N_HARMONICS + 1)]
            harm_centers = []
            for b in nominal_centers:
                if not (0 <= b < n_bins):
                    continue
                lo, hi = max(0, b - SEARCH_RADIUS), min(n_bins, b + SEARCH_RADIUS + 1)
                peak = lo + int(np.argmax(frame_spec[lo:hi]))
                harm_centers.append(peak)
            if not harm_centers:
                continue
            harm_bin_set = set()
            for b in harm_centers:
                for off in range(-BIN_WINDOW, BIN_WINDOW + 1):
                    bb = b + off
                    if 0 <= bb < n_bins:
                        harm_bin_set.add(bb)
            harm_bins = sorted(harm_bin_set)
            harmonic_energy = float(np.sum(frame_spec[harm_bins] ** 2))
            total_energy = float(np.sum(frame_spec ** 2)) + 1e-12
            noise_energy = max(total_energy - harmonic_energy, 1e-12)
            hnr_db = 10 * np.log10(harmonic_energy / noise_energy) if harmonic_energy > 0 else -99.0
            per_frame_hnr.append(hnr_db)
            harmonic_amp_envelope.append(float(frame_spec[harm_centers[0]]))

        # Drop the first/last couple of analyzed frames: STFT windowing at
        # the very start/end of the clip (partial-overlap with
        # zero-padding under librosa's default center=True) suppresses
        # measured harmonic energy there regardless of whether the
        # underlying audio is synthetic or real, which the smoke test
        # below caught inflating a genuinely-STATIC pure-tone fixture's
        # std well above a time-varying fixture's std (4-frame edge
        # artifact dominating a ~90-frame population).
        EDGE_TRIM = 2
        if len(per_frame_hnr) > 2 * EDGE_TRIM + MIN_VOICED_FRAMES:
            per_frame_hnr = per_frame_hnr[EDGE_TRIM:-EDGE_TRIM]
            harmonic_amp_envelope = harmonic_amp_envelope[EDGE_TRIM:-EDGE_TRIM]

        if len(per_frame_hnr) < MIN_VOICED_FRAMES:
            return {"available": False, "reason": "insufficient_harmonic_frames"}

        per_frame_hnr = np.array(per_frame_hnr)
        hnr_mean = float(np.mean(per_frame_hnr))
        hnr_std = float(np.std(per_frame_hnr))

        # Continuous scaling (see phase_coherence_analysis for the same fix
        # and the smoke-test failure that motivated it) rather than a
        # plateau: SCALE_STD is the std at which suspicion reaches 0.
        # Uncalibrated heuristic against real labeled data — same caveat
        # as audio_engine.py's existing 5 signals.
        SCALE_STD = 3.0
        hnr_variability_score = float(np.clip(1.0 - hnr_std / SCALE_STD, 0.0, 1.0))

        env = np.array(harmonic_amp_envelope)
        if len(env) >= MIN_VOICED_FRAMES and np.mean(env) > 1e-9:
            env_delta = np.abs(np.diff(env)) / (np.mean(env) + 1e-9)
            env_dynamism = float(np.mean(env_delta))
            LOW_DYNAMISM = 0.05
            envelope_score = (
                1.0 if env_dynamism < LOW_DYNAMISM
                else max(0.0, 1.0 - (env_dynamism - LOW_DYNAMISM) / 0.25)
            )
            envelope_score = float(np.clip(envelope_score, 0.0, 1.0))
        else:
            envelope_score = None

        combined = (
            (hnr_variability_score + envelope_score) / 2
            if envelope_score is not None else hnr_variability_score
        )

        return {
            "available": True,
            "score": round(float(combined), 4),
            "raw_hnr_mean_db": round(hnr_mean, 2),
            "raw_hnr_std_db": round(hnr_std, 3),
            "raw_harmonic_envelope_dynamism": round(float(env_dynamism), 4) if envelope_score is not None else None,
            "frames_analyzed": int(len(per_frame_hnr)),
            "description": (
                f"Per-frame HNR std {hnr_std:.2f}dB across {len(per_frame_hnr)} voiced frames "
                f"({'unnaturally stable HNR (too clean)' if hnr_variability_score > 0.6 else 'natural HNR variability'})."
                + (f" Harmonic envelope dynamism {env_dynamism:.3f}."
                   if envelope_score is not None else "")
            ),
        }
    except Exception as e:
        logger.warning("[AudioSpectralDeep] Harmonic structure analysis failed: %s", e)
        return {"available": False, "reason": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# Sub-module 2.1 item 2 — Phase Coherence Analysis
# ─────────────────────────────────────────────────────────────────────────────

def phase_coherence_analysis(y: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Inter-harmonic phase coherence + group delay flatness.

    Real speech: harmonics have effectively random phase relationships to
    each other frame-to-frame, because the vocal tract filter's phase
    response interacts with a time-varying glottal source -> LOW phase
    coherence (high circular variance) across frames for a given harmonic
    index, and group delay that fluctuates with the (also time-varying)
    formant structure.

    Vocoder-based TTS (WaveGlow/HiFi-GAN-style neural vocoders in
    particular): tends to leave a more phase-locked relationship between
    harmonics from frame to frame, and flatter group delay, since the
    vocoder's upsampling/synthesis filters impose a more consistent phase
    response than a real time-varying vocal tract -> HIGH phase coherence,
    LOW group-delay variance.

    Implementation: for each voiced frame, sample the STFT phase at the
    harmonic bin positions (F0 * 1..N, recomputed per frame since F0
    moves), track each harmonic's phase difference from the previous frame
    it was seen in (accounts for hop-length-induced expected phase
    advance), then take circular variance of the *unwrapped-mod-2pi
    residual* across frames per harmonic index. Group delay is estimated
    as -d(phase)/d(frequency) via finite difference across adjacent
    harmonic bins within a frame, and its across-time variance is the
    reported group-delay statistic.
    """
    try:
        import librosa

        f0, voiced_flag, _ = librosa.pyin(
            y, fmin=65, fmax=400, sr=sr, frame_length=N_FFT, hop_length=HOP_LENGTH,
        )
        voiced_idx = np.where(voiced_flag & ~np.isnan(f0))[0]
        if len(voiced_idx) < MIN_VOICED_FRAMES:
            return {"available": False, "reason": "insufficient_voiced_frames"}

        stft = librosa.stft(y, n_fft=N_FFT, hop_length=HOP_LENGTH)
        n_bins, n_frames = stft.shape
        phase = np.angle(stft)
        expected_advance = 2 * np.pi * HOP_LENGTH / N_FFT  # bin-index-dependent term added below

        # per-harmonic-index list of "instantaneous frequency deviation"
        # residuals across consecutive voiced frames (standard phase-vocoder
        # trick for measuring how far a bin's phase is from a pure-tone
        # prediction — used here as the phase-coherence proxy instead of a
        # raw phase value, since raw phase is not directly comparable
        # frame-to-frame at a fixed bin when F0 drifts).
        per_harmonic_residuals = [[] for _ in range(N_HARMONICS)]
        group_delays = []

        prev_i = None
        for i in voiced_idx:
            if i >= n_frames:
                continue
            f0_i = f0[i]
            harm_bins = [int(round((f0_i * h) / (sr / 2) * (n_bins - 1))) for h in range(1, N_HARMONICS + 1)]

            # Group delay within this frame: -d(phase)/d(bin), finite
            # difference across the harmonic bins actually present.
            valid = [(h, b) for h, b in enumerate(harm_bins) if 0 <= b < n_bins]
            if len(valid) >= 3:
                bins = np.array([b for _, b in valid])
                ph = np.unwrap(phase[bins, i])
                gd = -np.diff(ph) / np.diff(bins.astype(float))
                group_delays.append(float(np.mean(gd)))

            if prev_i is not None and (i - prev_i) == 1:
                for h, b in enumerate(harm_bins):
                    if not (0 <= b < n_bins):
                        continue
                    bin_freq_rad = 2 * np.pi * b / N_FFT
                    predicted = phase[b, prev_i] + bin_freq_rad * HOP_LENGTH
                    residual = phase[b, i] - predicted
                    residual = (residual + np.pi) % (2 * np.pi) - np.pi  # wrap to [-pi, pi]
                    per_harmonic_residuals[h].append(residual)
            prev_i = i

        coherences = []
        for h in range(N_HARMONICS):
            res = np.array(per_harmonic_residuals[h])
            if len(res) < MIN_VOICED_FRAMES:
                continue
            # Circular variance of the residuals: 0 = perfectly phase-locked
            # (residual always the same -> "coherent"/synthetic-leaning),
            # 1 = uniformly random (real-speech-leaning).
            R = np.abs(np.mean(np.exp(1j * res)))
            circular_var = 1.0 - R
            coherences.append(circular_var)

        if not coherences:
            return {"available": False, "reason": "insufficient_harmonic_phase_data"}

        mean_circular_var = float(np.mean(coherences))
        # Continuous scaling rather than a plateau-then-decline shape: a
        # step function that stays pinned at 1.0 for the entire
        # [0, LOW_VAR) range (the smoke test below caught this) can't
        # distinguish "essentially zero variance" (genuinely phase-locked)
        # from "some but below-threshold variance" (moderately natural),
        # which is exactly the distinction this signal exists to make.
        # SCALE_VAR is the circular variance at which suspicion reaches 0;
        # chosen so fully-random phase (circular var approaching ~0.6-0.8
        # for a 6-harmonic sample in practice) reads as clearly non-suspicious.
        SCALE_VAR = 0.45
        phase_score = float(np.clip(1.0 - mean_circular_var / SCALE_VAR, 0.0, 1.0))

        if len(group_delays) >= MIN_VOICED_FRAMES:
            gd_arr = np.array(group_delays)
            gd_std = float(np.std(gd_arr))
            LOW_GD_STD = 0.05
            gd_score = (
                1.0 if gd_std < LOW_GD_STD
                else max(0.0, 1.0 - (gd_std - LOW_GD_STD) / 0.3)
            )
            gd_score = float(np.clip(gd_score, 0.0, 1.0))
            combined = (phase_score + gd_score) / 2
        else:
            gd_std = None
            combined = phase_score

        return {
            "available": True,
            "score": round(float(combined), 4),
            "raw_mean_circular_variance": round(mean_circular_var, 4),
            "raw_group_delay_std": round(gd_std, 4) if gd_std is not None else None,
            "harmonics_analyzed": len(coherences),
            "description": (
                f"Inter-harmonic phase circular variance {mean_circular_var:.3f} across {len(coherences)} harmonics "
                f"({'phase-locked (vocoder-like)' if phase_score > 0.6 else 'natural phase incoherence'})."
                + (f" Group delay std {gd_std:.4f}." if gd_std is not None else "")
            ),
        }
    except Exception as e:
        logger.warning("[AudioSpectralDeep] Phase coherence analysis failed: %s", e)
        return {"available": False, "reason": str(e)}


def run_all(y: np.ndarray, sr: int) -> Dict[str, Dict[str, Any]]:
    """Entry point audio_engine.py calls — returns both signals keyed by name."""
    return {
        "harmonic_structure": harmonic_structure_analysis(y, sr),
        "phase_coherence": phase_coherence_analysis(y, sr),
    }

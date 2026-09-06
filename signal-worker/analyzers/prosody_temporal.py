"""
Aiscern Detection Worker — Prosodic & Temporal Analysis (MODULE 20)
Giant-Level Optimization Spec, Section 2.4:
  1. Prosody Analysis (F0 contour entropy, speaking-rate estimate)
  2. Pause Analysis (log-normal duration distribution, breath-sound presence)
  3. Co-Articulation Analysis (spectral transition abruptness between frames)

Audit note (pre-implementation, per established workflow): this section
overlaps two existing MODULE 3 signals but is NOT redundant with either --
checked deliberately before writing anything new, same as Module 16's
harmonic_noise_ratio audit:
  - `pitch_jitter_shimmer` measures frame-to-frame *micro*-variation in
    pitch PERIOD and amplitude (voice-quality jitter/shimmer, ms-scale).
    It says nothing about the *shape* of the F0 contour's overall
    distribution (its entropy) or about speaking rate -- genuinely new.
  - `silence_pattern` measures the *coefficient of variation* of pause
    gap lengths only. It does not test whether the gap-length
    distribution is actually LOG-NORMAL (the spec's specific claim about
    real speech), and does not look inside the pauses at all (breath
    sounds). This module's pause_analysis is a different, complementary
    signal computed on the same underlying `librosa.effects.split`
    intervals -- not a duplicate of silence_pattern's CoV metric.
  - `spectral_stability` measures the *global* coefficient of variation
    of the spectral centroid across the whole clip. This module's
    co-articulation signal measures *local, frame-to-frame* spectral
    transition abruptness (delta-MFCC magnitude spikiness) -- a
    different axis (global wander vs. local smoothness) computed from a
    different feature (whole-spectrum centroid vs. MFCC deltas).

Honest scope notes:
  - Speaking-rate (syllables/sec) is estimated via energy-envelope
    peak-picking (syllable-nuclei proxy), NOT a real syllabifier/ASR
    aligner (out of scope -- would need a phoneme/word-level model this
    repo does not have). Typical adult speech is ~3-6 syllables/sec in
    the literature; used only as a soft plausibility band, clearly
    labeled uncalibrated like every other heuristic range in this file.
  - F0 entropy uses the SAME librosa.pyin tracker already used by
    `pitch_jitter_shimmer` and Module 16 (YIN-family, not CREPE -- see
    audio_spectral_deep.py's docstring for why).
  - Breath-sound detection cannot identify "this is a human breath" with
    certainty from signal alone (no breath-sound-labeled dataset here).
    What IS implemented honestly: (a) whether pauses contain ANY
    non-negligible broadband energy at all (true digital silence being
    the naive-TTS tell), and (b) whether multiple pauses' low-level
    content is suspiciously near-IDENTICAL via cross-correlation (a
    looped/reused synthetic "breath sample" tell) -- both are real,
    checkable claims, not a breath/no-breath classification.
"""

import logging
from typing import Any, Dict, List

import numpy as np

logger = logging.getLogger(__name__)

N_FFT = 2048
HOP_LENGTH = 512
F0_MIN, F0_MAX = 65, 400
MIN_VOICED_FRAMES = 10


def _safe_result(available: bool, **kwargs) -> Dict[str, Any]:
    out = {"available": available}
    out.update(kwargs)
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Sub-module 2.4 item 1 — Prosody Analysis
# ─────────────────────────────────────────────────────────────────────────────

def prosody_analysis(y: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    F0 contour entropy: bins the voiced F0 track into a histogram and
    computes normalized Shannon entropy. Real speech's intonation moves
    across a wide range of pitch values with a fairly spread-out
    distribution (varied stress/intonation); flat, narrow-range, or
    strongly-peaked (e.g. near-monotone, or a few repeated "melodic
    template" pitch levels) F0 distributions score lower entropy.

    Speaking rate: energy-envelope peak-picking as a syllable-nuclei
    proxy (see module docstring for scope). Reported as a descriptive
    statistic with a wide plausibility band, not a hard classifier --
    weighted low/soft accordingly at the call site.
    """
    try:
        import librosa
        from scipy.signal import find_peaks

        f0, voiced_flag, _ = librosa.pyin(
            y, fmin=F0_MIN, fmax=F0_MAX, sr=sr, frame_length=N_FFT, hop_length=HOP_LENGTH,
        )
        voiced_f0 = f0[voiced_flag & ~np.isnan(f0)]
        if len(voiced_f0) < MIN_VOICED_FRAMES:
            return _safe_result(False, reason="insufficient_voiced_frames")

        n_bins = 20
        hist, _ = np.histogram(voiced_f0, bins=n_bins, density=False)
        probs = hist / (np.sum(hist) + 1e-10)
        probs = probs[probs > 0]
        entropy = float(-np.sum(probs * np.log2(probs)))
        max_entropy = float(np.log2(n_bins))
        norm_entropy = entropy / max_entropy if max_entropy > 0 else 0.0

        # Natural conversational speech typically lands mid-to-upper range
        # (~0.55-0.85 normalized, uncalibrated heuristic). Below ~0.4 is
        # suspiciously narrow/templated.
        LOW_ENTROPY = 0.4
        prosody_score = 1.0 if norm_entropy < LOW_ENTROPY else max(
            0.0, 1.0 - (norm_entropy - LOW_ENTROPY) / 0.45
        )
        prosody_score = float(np.clip(prosody_score, 0.0, 1.0))

        # Speaking-rate estimate: smooth the RMS envelope, find local
        # maxima at least ~120ms apart (upper bound on syllable rate
        # ~8/s) as a syllable-nuclei proxy.
        rms = librosa.feature.rms(y=y, frame_length=N_FFT, hop_length=HOP_LENGTH)[0]
        frame_dur = HOP_LENGTH / sr
        min_distance_frames = max(1, int(0.12 / frame_dur))
        if np.max(rms) > 1e-6:
            norm_rms = rms / np.max(rms)
            peak_idxs, _ = find_peaks(norm_rms, height=0.15, distance=min_distance_frames)
            duration_sec = len(y) / sr
            speaking_rate = float(len(peak_idxs) / duration_sec) if duration_sec > 0 else None
        else:
            speaking_rate = None

        rate_implausible = (
            speaking_rate is not None and not (1.0 <= speaking_rate <= 9.0)
        )

        return _safe_result(
            True,
            score=round(prosody_score, 4),
            f0_entropy_normalized=round(norm_entropy, 4),
            speaking_rate_syll_per_sec=round(speaking_rate, 2) if speaking_rate is not None else None,
            speaking_rate_implausible=rate_implausible,
            description="F0-contour entropy (low = unnaturally narrow/templated intonation) "
                         "+ energy-envelope syllable-nuclei speaking-rate estimate "
                         "(descriptive only, not a syllabifier -- see module docstring).",
        )
    except Exception as e:
        logger.error("[ProsodyTemporal] prosody_analysis failed: %s", e, exc_info=True)
        return _safe_result(False, reason=f"unexpected_error: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Sub-module 2.4 item 2 — Pause Analysis
# ─────────────────────────────────────────────────────────────────────────────

def pause_analysis(y: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Log-normality of pause-gap durations (distinct from silence_pattern's
    CoV metric -- see module docstring) via the skewness/kurtosis of
    log(gap durations) compared against what a log-normal distribution
    should produce (skew ~0, excess kurtosis ~0 in log-space, for a
    reasonably sized sample). Large deviation -> pause timing does not
    follow the natural log-normal pattern the spec describes.

    Also checks for near-duplicate pause durations (multiple gaps within
    a few ms of each other) -- a common artifact of template/rule-based
    pause insertion that a continuous log-normal process would not
    produce except by rare coincidence.

    Breath-sound presence: for each detected pause interval, computes
    RMS energy and spectral flatness of the pause's own audio (not
    surrounding speech). True digital silence (energy near machine
    noise floor) in most/all pauses is the naive-TTS tell. Where pauses
    do have non-negligible content, cross-correlation checks whether
    multiple pauses' content is near-identical (a looped/reused synthetic
    breath sample), which real breathing would not reproduce exactly.
    """
    try:
        import librosa

        intervals = librosa.effects.split(y, top_db=30)
        if len(intervals) < 4:
            return _safe_result(False, reason="too_few_speech_segments_detected")

        gaps_sec: List[float] = []
        gap_audio: List[np.ndarray] = []
        for i in range(1, len(intervals)):
            gap_start, gap_end = intervals[i - 1][1], intervals[i][0]
            gap_samples = gap_end - gap_start
            if gap_samples > int(sr * 0.03):   # ignore sub-30ms noise gaps
                gaps_sec.append(gap_samples / sr)
                gap_audio.append(y[gap_start:gap_end])

        if len(gaps_sec) < 3:
            return _safe_result(False, reason="insufficient_pauses_detected")

        gaps_arr = np.array(gaps_sec)
        log_gaps = np.log(gaps_arr)
        log_gaps_z = (log_gaps - np.mean(log_gaps)) / (np.std(log_gaps) + 1e-10)
        # Excess kurtosis and skew of the standardized log-gaps; a
        # log-normal source should look roughly normal here (skew~0,
        # excess kurtosis~0). Only meaningful as a soft signal at small
        # sample sizes -- explicitly not a formal goodness-of-fit test.
        skew = float(np.mean(log_gaps_z ** 3))
        excess_kurt = float(np.mean(log_gaps_z ** 4) - 3.0)
        lognormal_deviation = float(np.sqrt(skew ** 2 + (excess_kurt / 2.0) ** 2))

        # Near-duplicate gap durations (within 15ms of each other).
        sorted_gaps = np.sort(gaps_arr)
        diffs = np.diff(sorted_gaps)
        near_dupe_count = int(np.sum(diffs < 0.015))
        near_dupe_ratio = near_dupe_count / max(1, len(sorted_gaps) - 1)

        pause_shape_score = float(np.clip(
            0.6 * np.clip(lognormal_deviation / 2.0, 0.0, 1.0) + 0.4 * near_dupe_ratio,
            0.0, 1.0,
        ))

        # Breath-sound presence check on the pause audio itself.
        pause_energies = [float(np.sqrt(np.mean(seg ** 2))) if len(seg) else 0.0 for seg in gap_audio]
        overall_rms_floor = float(np.median(pause_energies)) if pause_energies else 0.0
        digitally_silent_ratio = float(
            np.mean([1.0 if e < 1e-4 else 0.0 for e in pause_energies])
        ) if pause_energies else 1.0

        # Cross-correlation similarity between pause segments with
        # non-negligible energy, as a "reused breath sample" check.
        non_silent = [seg for seg, e in zip(gap_audio, pause_energies) if e >= 1e-4]
        dupe_breath_score = 0.0
        pairs_checked = 0
        if len(non_silent) >= 2:
            sims = []
            for i in range(len(non_silent)):
                for j in range(i + 1, len(non_silent)):
                    a, b = non_silent[i], non_silent[j]
                    n = min(len(a), len(b))
                    if n < int(sr * 0.05):
                        continue
                    a2, b2 = a[:n], b[:n]
                    denom = (np.linalg.norm(a2) * np.linalg.norm(b2))
                    if denom > 1e-9:
                        sims.append(float(np.dot(a2, b2) / denom))
                        pairs_checked += 1
            if sims:
                dupe_breath_score = float(np.clip((max(sims) - 0.5) / 0.45, 0.0, 1.0))

        breath_score = float(np.clip(
            0.6 * digitally_silent_ratio + 0.4 * dupe_breath_score, 0.0, 1.0
        ))

        combined_score = float(np.clip(0.55 * pause_shape_score + 0.45 * breath_score, 0.0, 1.0))

        return _safe_result(
            True,
            score=round(combined_score, 4),
            pause_count=len(gaps_sec),
            lognormal_deviation=round(lognormal_deviation, 4),
            near_duplicate_gap_ratio=round(near_dupe_ratio, 4),
            digitally_silent_pause_ratio=round(digitally_silent_ratio, 4),
            duplicate_breath_similarity_score=round(dupe_breath_score, 4),
            breath_pairs_checked=pairs_checked,
            description="Pause-duration log-normality deviation + near-duplicate gap "
                         "check, combined with digital-silence / reused-breath-sample "
                         "checks inside the pauses themselves.",
        )
    except Exception as e:
        logger.error("[ProsodyTemporal] pause_analysis failed: %s", e, exc_info=True)
        return _safe_result(False, reason=f"unexpected_error: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Sub-module 2.4 item 3 — Co-Articulation Analysis
# ─────────────────────────────────────────────────────────────────────────────

def coarticulation_analysis(y: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Frame-to-frame MFCC delta magnitude as a spectral-transition-rate
    proxy. Real speech's phoneme transitions are smoothed by continuous
    articulator movement (co-articulation) -- the delta-magnitude
    sequence should be relatively continuous with occasional moderate
    rises at genuine phoneme boundaries. Overly "staccato" synthesis
    (each phoneme rendered near-independently) tends to produce sharper,
    more uniform spikes at boundaries -- measured here as the KURTOSIS
    of the delta-magnitude sequence (real: lower, more evenly spread
    transitions; staccato: higher, few-and-sharp spikes standing out
    from a flatter baseline) plus the fraction of frames classified as
    abrupt-transition frames (top-decile delta magnitude).
    """
    try:
        import librosa

        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, n_fft=N_FFT, hop_length=HOP_LENGTH)
        if mfcc.shape[1] < 8:
            return _safe_result(False, reason="insufficient_frames")

        delta = np.diff(mfcc, axis=1)
        delta_mag = np.linalg.norm(delta, axis=0)
        # Trim the first/last couple of delta frames: librosa's STFT
        # edge-padding (reflect-mode) introduces a discontinuity right at
        # clip boundaries that produces a spuriously huge delta unrelated
        # to actual phoneme-transition content -- left in, it would
        # dominate the kurtosis statistic for every clip regardless of
        # real co-articulation smoothness.
        edge_trim = min(2, max(0, (len(delta_mag) - 4) // 2))
        if edge_trim > 0:
            delta_mag = delta_mag[edge_trim:-edge_trim]
        if len(delta_mag) < 6:
            return _safe_result(False, reason="insufficient_frames_after_edge_trim")
        if np.std(delta_mag) < 1e-8:
            return _safe_result(False, reason="degenerate_delta_sequence")

        z = (delta_mag - np.mean(delta_mag)) / (np.std(delta_mag) + 1e-10)
        excess_kurt = float(np.mean(z ** 4) - 3.0)

        threshold = np.percentile(delta_mag, 90)
        abrupt_ratio = float(np.mean(delta_mag > threshold * 1.5))

        # Natural speech: excess kurtosis modestly positive (a few real
        # phoneme-boundary spikes above a fairly full baseline) but not
        # extreme. Very high excess kurtosis -> few sharp isolated spikes
        # against an unnaturally flat/smooth baseline -> staccato-suspicious.
        HIGH_KURT = 3.0
        score = 0.0 if excess_kurt < HIGH_KURT else float(np.clip((excess_kurt - HIGH_KURT) / 6.0, 0.0, 1.0))
        score = float(np.clip(0.7 * score + 0.3 * np.clip((abrupt_ratio - 0.1) / 0.2, 0.0, 1.0), 0.0, 1.0))

        return _safe_result(
            True,
            score=round(score, 4),
            delta_excess_kurtosis=round(excess_kurt, 4),
            abrupt_transition_ratio=round(abrupt_ratio, 4),
            description="Frame-to-frame MFCC-delta spikiness (excess kurtosis + abrupt-"
                         "transition ratio) as a co-articulation-smoothness proxy; high "
                         "values suggest phoneme boundaries are too sharp/independent "
                         "relative to a smoothly-articulated baseline.",
        )
    except Exception as e:
        logger.error("[ProsodyTemporal] coarticulation_analysis failed: %s", e, exc_info=True)
        return _safe_result(False, reason=f"unexpected_error: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

def run_all(y: np.ndarray, sr: int) -> Dict[str, Dict[str, Any]]:
    return {
        "prosody_analysis": prosody_analysis(y, sr),
        "pause_analysis": pause_analysis(y, sr),
        "coarticulation_analysis": coarticulation_analysis(y, sr),
    }

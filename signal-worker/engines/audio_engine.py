"""
Aiscern Detection Worker — Audio Engine v1.0.0 (MODULE 3)

Was a stub returning "not_implemented" for every request. This replaces it
with CPU-only forensic signals computed via librosa — no paid API, follows
the same per-signal-breakdown + composite-score response shape as
image_engine.py's v3 forensics (see analyze_image_from_bytes()) so the
frontend's callPythonAudioWorker() (hf-analyze.ts) can parse it the same
way callPythonCVWorker() parses image results.

Signals (all CPU-computable, none require a GPU or paid API):
  1. MFCC consistency        — real speech has natural frame-to-frame
                                fluctuation in its spectral envelope; many
                                TTS systems over-smooth it.
  2. Pitch jitter & shimmer  — classic voice-quality metrics. Real human
                                speech has natural micro-variation in pitch
                                period (jitter) and amplitude (shimmer)
                                that many TTS systems under- or over-smooth.
  3. Spectral flatness/centroid stability — natural speech's spectral
                                centroid wanders; overly stable spectral
                                shape over time is a synthesis tell.
  4. Silence/breath-pattern  — synthetic speech often has unnaturally
                                uniform pause timing; real speech's pauses
                                (including breaths) vary.
  5. Harmonic-to-noise ratio — autocorrelation-based HNR estimate. Both
                                unnaturally clean (too high, uniform) and
                                degraded (too low) HNR can indicate
                                synthesis or post-processing artifacts.

IMPORTANT — calibration status: these are heuristic starting points, not
yet calibrated against a labeled dataset (unlike image_engine.py's 14
layers, which have been through real accuracy monitoring). Per Module 3
task 4, this worker's audio signals are blended in the frontend ensemble
at a conservative 35% initial weight — lower starting trust than image,
since this is genuinely new code. Do not raise that weight without running
a calibration pass equivalent to calibrate-images.js first.
"""

import io
import time
import logging
from typing import Any, Dict, List, Tuple

import numpy as np

from version import VERSION

logger = logging.getLogger(__name__)

TARGET_SR = 16000            # resample target — matches most TTS/ASR pipelines, keeps CPU cost down
MIN_DURATION_SEC = 1.0       # below this, per-signal stats are too noisy to trust


# ─────────────────────────────────────────────────────────────────────────────
# Audio loading
# ─────────────────────────────────────────────────────────────────────────────

def _load_audio(audio_bytes: bytes) -> Tuple[np.ndarray, int]:
    """
    Decode arbitrary audio bytes to a mono float32 waveform at TARGET_SR.
    librosa.load handles format detection (via soundfile, falling back to
    audioread/ffmpeg for containers soundfile can't read) and resampling
    in one call.
    """
    import librosa
    y, sr = librosa.load(io.BytesIO(audio_bytes), sr=TARGET_SR, mono=True)
    return y.astype(np.float32), sr


# ─────────────────────────────────────────────────────────────────────────────
# Signal 1 — MFCC consistency
# ─────────────────────────────────────────────────────────────────────────────

def _signal_mfcc_consistency(y: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Frame-to-frame MFCC delta magnitude. Unnaturally low dynamism (an
    over-smoothed spectral envelope across time) is a synthesis tell for
    some TTS systems; very high dynamism can indicate noise/distortion.
    Score is a suspicion score: higher = more AI-like.
    """
    try:
        import librosa
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        if mfcc.shape[1] < 3:
            return {"available": False, "reason": "clip_too_short_for_mfcc"}

        delta = np.abs(np.diff(mfcc, axis=1))
        dynamism = float(np.mean(delta))

        # Heuristic thresholds derived from typical natural-speech MFCC
        # delta magnitude (~3-9 on librosa's default scale for 16kHz
        # speech). Below ~2.0 = suspiciously smooth. Not yet calibrated
        # against a labeled dataset — see module docstring.
        LOW_THRESHOLD = 2.0
        if dynamism < LOW_THRESHOLD:
            score = min(1.0, (LOW_THRESHOLD - dynamism) / LOW_THRESHOLD + 0.5)
        else:
            score = max(0.0, 0.5 - (dynamism - LOW_THRESHOLD) / (LOW_THRESHOLD * 4))

        return {
            "available": True,
            "score": round(float(np.clip(score, 0.0, 1.0)), 4),
            "raw_dynamism": round(dynamism, 4),
            "description": (
                f"MFCC frame-to-frame dynamism {dynamism:.2f} "
                f"({'unusually smooth spectral envelope' if dynamism < LOW_THRESHOLD else 'natural variation'})."
            ),
        }
    except Exception as e:
        logger.warning("[AudioEngine] MFCC consistency signal failed: %s", e)
        return {"available": False, "reason": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# Signal 2 — Pitch jitter & shimmer
# ─────────────────────────────────────────────────────────────────────────────

def _signal_jitter_shimmer(y: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Classic voice-quality metrics computed from librosa's pyin F0 tracker:
      jitter  = mean(|period_i - period_i-1|) / mean(period)   (pitch-period micro-variation)
      shimmer = mean(|amp_i - amp_i-1|) / mean(amp)            (amplitude micro-variation on voiced frames)
    Natural human speech: jitter ~0.5-1.5%, shimmer ~3-8%.
    Many TTS systems under-smooth both toward ~0 (too clean) or, less
    commonly, over-vary them. Score is a suspicion score.
    """
    try:
        import librosa
        f0, voiced_flag, _ = librosa.pyin(
            y, fmin=65, fmax=400, sr=sr, frame_length=2048,
        )
        voiced_f0 = f0[voiced_flag & ~np.isnan(f0)]
        if len(voiced_f0) < 5:
            return {"available": False, "reason": "insufficient_voiced_frames"}

        periods = 1.0 / voiced_f0
        jitter = float(np.mean(np.abs(np.diff(periods))) / np.mean(periods))

        rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
        voiced_idx = np.where(voiced_flag & ~np.isnan(f0))[0]
        voiced_idx = voiced_idx[voiced_idx < len(rms)]
        voiced_rms = rms[voiced_idx]
        shimmer = (
            float(np.mean(np.abs(np.diff(voiced_rms))) / np.mean(voiced_rms))
            if len(voiced_rms) >= 5 and np.mean(voiced_rms) > 1e-6
            else None
        )

        # Natural ranges (approximate, from voice-quality literature).
        # Suspiciously low = over-smoothed/synthetic; suspiciously high =
        # unstable/noisy (less common but possible for degraded synthesis).
        jitter_pct = jitter * 100
        j_score = 1.0 if jitter_pct < 0.15 else max(0.0, 1.0 - (jitter_pct - 0.15) / 2.0)
        j_score = float(np.clip(j_score, 0.0, 1.0))

        if shimmer is not None:
            shimmer_pct = shimmer * 100
            s_score = 1.0 if shimmer_pct < 1.0 else max(0.0, 1.0 - (shimmer_pct - 1.0) / 8.0)
            s_score = float(np.clip(s_score, 0.0, 1.0))
            combined = (j_score + s_score) / 2
        else:
            combined = j_score

        return {
            "available": True,
            "score": round(combined, 4),
            "raw_jitter_pct": round(jitter_pct, 4),
            "raw_shimmer_pct": round(shimmer * 100, 4) if shimmer is not None else None,
            "description": (
                f"Pitch jitter {jitter_pct:.2f}%"
                + (f", shimmer {shimmer * 100:.2f}%" if shimmer is not None else ", shimmer unavailable")
                + (" — below natural human micro-variation range" if combined > 0.6 else " — within natural range")
                + "."
            ),
        }
    except Exception as e:
        logger.warning("[AudioEngine] Jitter/shimmer signal failed: %s", e)
        return {"available": False, "reason": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# Signal 3 — Spectral flatness / centroid stability
# ─────────────────────────────────────────────────────────────────────────────

def _signal_spectral_stability(y: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Spectral centroid should wander over the course of natural speech
    (different phonemes have different spectral shapes). An unnaturally
    stable centroid over time — low coefficient of variation — suggests a
    monotone/over-regularized synthesis. Spectral flatness (tonal vs
    noise-like) is reported alongside as a supporting statistic.
    """
    try:
        import librosa
        centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        flatness = librosa.feature.spectral_flatness(y=y)[0]
        if len(centroid) < 3:
            return {"available": False, "reason": "clip_too_short_for_spectral_analysis"}

        centroid_mean = float(np.mean(centroid))
        centroid_std = float(np.std(centroid))
        cov = centroid_std / centroid_mean if centroid_mean > 1e-6 else 0.0

        # Natural speech centroid CoV is typically >0.15 over a multi-second
        # clip. Below ~0.08 is unusually stable. Heuristic, uncalibrated.
        LOW_COV = 0.08
        score = 1.0 if cov < LOW_COV else max(0.0, 1.0 - (cov - LOW_COV) / 0.3)
        score = float(np.clip(score, 0.0, 1.0))

        return {
            "available": True,
            "score": round(score, 4),
            "raw_centroid_cov": round(cov, 4),
            "raw_flatness_mean": round(float(np.mean(flatness)), 4),
            "description": (
                f"Spectral centroid coefficient of variation {cov:.3f} "
                f"({'suspiciously stable over time' if score > 0.6 else 'moderate variation' if score > 0.3 else 'natural spectral wandering'})."
            ),
        }
    except Exception as e:
        logger.warning("[AudioEngine] Spectral stability signal failed: %s", e)
        return {"available": False, "reason": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# Signal 4 — Silence / breath-pattern analysis
# ─────────────────────────────────────────────────────────────────────────────

def _signal_silence_pattern(y: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Detects non-silent intervals and measures the variability of the gaps
    (pauses/breaths) between them. Real speech pause lengths vary
    naturally (breath timing, hesitation, sentence structure); some TTS
    systems insert unnaturally uniform pause lengths between segments.
    """
    try:
        import librosa
        intervals = librosa.effects.split(y, top_db=30)
        if len(intervals) < 3:
            return {"available": False, "reason": "too_few_speech_segments_detected"}

        gaps = []
        for i in range(1, len(intervals)):
            gap_samples = intervals[i][0] - intervals[i - 1][1]
            if gap_samples > 0:
                gaps.append(gap_samples / sr)

        if len(gaps) < 2:
            return {"available": False, "reason": "insufficient_pauses_detected"}

        gap_mean = float(np.mean(gaps))
        gap_std = float(np.std(gaps))
        gap_cov = gap_std / gap_mean if gap_mean > 1e-6 else 0.0

        # Real pause timing is irregular (breath, hesitation, sentence
        # boundaries) — CoV typically well above 0.3 for multi-pause clips.
        # Very uniform pause spacing (<0.15) is the suspicious end.
        LOW_COV = 0.15
        score = 1.0 if gap_cov < LOW_COV else max(0.0, 1.0 - (gap_cov - LOW_COV) / 0.6)
        score = float(np.clip(score, 0.0, 1.0))

        return {
            "available": True,
            "score": round(score, 4),
            "raw_gap_count": len(gaps),
            "raw_gap_cov": round(gap_cov, 4),
            "description": (
                f"{len(gaps)} pauses detected, timing coefficient of variation {gap_cov:.3f} "
                f"({'suspiciously uniform pause timing' if score > 0.6 else 'moderate variability' if score > 0.3 else 'natural pause variability'})."
            ),
        }
    except Exception as e:
        logger.warning("[AudioEngine] Silence pattern signal failed: %s", e)
        return {"available": False, "reason": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# Signal 5 — Harmonic-to-noise ratio (phase coherence proxy)
# ─────────────────────────────────────────────────────────────────────────────

def _signal_harmonic_noise_ratio(y: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Lightweight harmonic/percussive-separation-based HNR estimate:
    HNR ≈ energy(harmonic) / energy(residual). Used as a cheaper proxy for
    full phase-coherence analysis. Both extremes are suspicious —
    unnaturally clean/uniform HNR (over-synthesized) and unnaturally low
    HNR (noisy/degraded synthesis artifacts).
    """
    try:
        import librosa
        y_harmonic, _ = librosa.effects.hpss(y)
        harmonic_energy = float(np.sum(y_harmonic ** 2))
        residual_energy = float(np.sum((y - y_harmonic) ** 2)) + 1e-9
        hnr_db = 10 * np.log10(max(harmonic_energy, 1e-9) / residual_energy)

        # Natural speech HNR typically falls ~5-20dB depending on phoneme
        # mix. Above ~25dB (unnaturally clean/tonal) or below ~0dB
        # (excessively noisy) are the flagged ranges. Uncalibrated heuristic.
        if hnr_db > 25:
            score = min(1.0, (hnr_db - 25) / 15 + 0.5)
        elif hnr_db < 0:
            score = min(1.0, (0 - hnr_db) / 15 + 0.5)
        else:
            score = 0.2  # comfortably in the natural range
        score = float(np.clip(score, 0.0, 1.0))

        return {
            "available": True,
            "score": round(score, 4),
            "raw_hnr_db": round(hnr_db, 2),
            "description": (
                f"Harmonic-to-noise ratio {hnr_db:.1f}dB "
                f"({'unnaturally clean/tonal' if hnr_db > 25 else 'unnaturally noisy' if hnr_db < 0 else 'within natural range'})."
            ),
        }
    except Exception as e:
        logger.warning("[AudioEngine] HNR signal failed: %s", e)
        return {"available": False, "reason": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# Composite
# ─────────────────────────────────────────────────────────────────────────────

# Equal-weight starting point across the 5 signals — renormalized over
# whichever subset is actually available for a given clip (short/silent
# clips may not produce all 5). Deliberately not weighted by "confidence
# in this signal category" yet — that needs a calibration pass against a
# labeled dataset, same as image_engine.py went through before its weights
# were trusted (see docs/CALIBRATION_LOG.md for that precedent).
_SIGNAL_WEIGHTS = {
    "mfcc_consistency": 0.20,
    "pitch_jitter_shimmer": 0.25,
    "spectral_stability": 0.20,
    "silence_pattern": 0.15,
    "harmonic_noise_ratio": 0.20,
}


def analyze_audio(audio_bytes: bytes, content_type: str = "", job_id: str = "") -> Dict[str, Any]:
    """
    Full CPU-only audio forensic analysis. Returns composite_audio_score
    (0-1 suspicion, higher = more AI-like) + per-signal breakdown, mirroring
    the response-shape pattern of image_engine.py's /analyze/image
    (top-level composite + nested signal detail + status + version).

    Graceful degrade: silence, very short clips, and decode failures all
    return status="success" with fewer available signals and an honest
    composite based on whatever did compute — never a silent crash the
    frontend has no visibility into. Only truly unrecoverable failures
    (can't decode the bytes at all) return status="error".
    """
    start = time.time()

    try:
        y, sr = _load_audio(audio_bytes)
    except Exception as e:
        logger.error("[AudioEngine] Failed to decode audio bytes: %s", e, exc_info=True)
        return {
            "jobId": job_id,
            "status": "error",
            "error": f"Could not decode audio: {e}",
            "processingTimeMs": int((time.time() - start) * 1000),
            "version": VERSION,
        }

    duration_sec = float(len(y) / sr) if sr else 0.0

    if duration_sec < MIN_DURATION_SEC or not np.any(np.abs(y) > 1e-4):
        # Too short or effectively silent — no crash, just an honest
        # "insufficient signal" result the frontend can degrade around
        # (surfaces via degraded_signals, same pattern as Module 5).
        elapsed = int((time.time() - start) * 1000)
        return {
            "jobId": job_id,
            "status": "success",
            "insufficient_audio": True,
            "reason": "clip_too_short_or_silent",
            "duration_sec": round(duration_sec, 2),
            "composite_audio_score": 0.5,
            "audio_signals": {},
            "signal_details": [],
            "processingTimeMs": elapsed,
            "version": VERSION,
        }

    signal_fns = {
        "mfcc_consistency": _signal_mfcc_consistency,
        "pitch_jitter_shimmer": _signal_jitter_shimmer,
        "spectral_stability": _signal_spectral_stability,
        "silence_pattern": _signal_silence_pattern,
        "harmonic_noise_ratio": _signal_harmonic_noise_ratio,
    }

    results: Dict[str, Dict[str, Any]] = {}
    for name, fn in signal_fns.items():
        try:
            results[name] = fn(y, sr)
        except Exception as e:
            # Belt-and-braces — individual signal fns already catch, but a
            # bug in a signal fn itself must never take down the whole
            # request (matches the "never break the fallback path" rule).
            logger.error("[AudioEngine] Signal '%s' raised unexpectedly: %s", name, e, exc_info=True)
            results[name] = {"available": False, "reason": f"unexpected_error: {e}"}

    available = {k: v for k, v in results.items() if v.get("available")}
    if available:
        total_w = sum(_SIGNAL_WEIGHTS[k] for k in available)
        composite = sum(v["score"] * _SIGNAL_WEIGHTS[k] for k, v in available.items()) / total_w
    else:
        composite = 0.5  # no usable signal — uncertain, not a false claim of confidence

    signal_details: List[Dict[str, Any]] = []
    for name, res in results.items():
        signal_details.append({
            "name": name,
            "available": res.get("available", False),
            "value": res.get("score"),
            "weight": _SIGNAL_WEIGHTS[name],
            "flagged": bool(res.get("available") and res.get("score", 0) > 0.6),
            "description": res.get("description", res.get("reason", "")),
        })

    elapsed = int((time.time() - start) * 1000)
    logger.info("[AudioEngine] analysis done in %dms, %d/%d signals available",
                elapsed, len(available), len(signal_fns))

    return {
        "jobId": job_id,
        "status": "success",
        "duration_sec": round(duration_sec, 2),
        "composite_audio_score": round(float(np.clip(composite, 0.0, 1.0)), 4),
        "audio_signals": {k: v.get("score") for k, v in results.items()},
        "signal_details": signal_details,
        "signals_available": len(available),
        "signals_total": len(signal_fns),
        "processingTimeMs": elapsed,
        "version": VERSION,
    }

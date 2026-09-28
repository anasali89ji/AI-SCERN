"""
Aiscern Detection Worker — Voiceprint Liveness & Anti-Spoofing (MODULE 19a)
Giant-Level Optimization Spec, Section 2.3, items 2-3:
  2. Anti-Spoofing (ASVspoof-style LFCC/CQCC features)
  3. Liveness Detection (replay-of-a-recording, room reverberation, mic
     frequency response fingerprinting)

Audit note / scope split (per established workflow, same pattern as
Module 18): Section 2.3 item 1 (Speaker Embedding Extraction via
ECAPA-TDNN, matched against a speaker database) is NOT in this module.
That needs a pretrained speaker-encoder checkpoint (speechbrain's
spkrec-ecapa-voxceleb, hosted on huggingface.co) baked into the Docker
image the same way engines/audio_engine.py's Module 3 setup bakes in
distilgpt2 at build time -- but doing that requires network access to
huggingface.co to fetch and smoke-test the checkpoint against synthetic
fixtures before shipping, which was not available in the sandbox this
module was authored in. Shipping it untested would violate the "smoke-
test before shipping" rule, so it is deliberately left as a separate,
flagged open item rather than written blind. This module ships item 2
and item 3 only, since both are real DSP with no trained-model or
labeled-dataset dependency and are fully testable here.

Anti-spoofing scope (item 2): ASVspoof research pairs LFCC/CQCC features
with a TRAINED classifier (GMM or neural) fit on the ASVspoof protocol's
labeled bonafide/spoof corpus. That corpus is not present in this repo
and fabricating one (or shipping an untrained/random classifier) is
explicitly against the "no stubs" rule -- same reasoning as Module 18's
TTS classifier. What IS implemented: the LFCC and CQCC feature
extractors themselves (real, standard, deterministic signal processing
-- no training required to compute a cepstrum), combined with the same
"heuristic distance from natural speech statistics" approach Module 18
used for its per-vendor rules: known ASVspoof-literature findings about
*where* spoofed/synthetic speech deviates from bonafide speech in the
linear-frequency and constant-Q cepstral domains (flatter high-quefrency
LFCC energy from vocoder artifacts; unnaturally regular CQCC delta
patterns from block-based synthesis) are checked directly, rather than
learned. Labeled heuristic-derived, not classifier output, same as
Module 18's likely_tts_model.

Liveness scope (item 3): RT60 is estimated via Schroeder backward
integration on the energy decay curve of the clip's own tail (a
real acoustic-engineering technique, no reference recording needed).
This tells us whether a room's reverberant signature is present and
physically plausible at all -- a replay-of-a-recording (playing a
recording through a speaker into a second microphone) typically
convolves in a SECOND room's reverberation on top of whatever was
already in the original recording, so the decay curve becomes doubly-
structured (non-single-exponential) in a way a direct live recording's
decay curve is not. Mic frequency-response fingerprinting is scoped
honestly: without a reference microphone or a known calibration tone,
we cannot recover an absolute frequency response. What we CAN check is
spectral-flatness consistency of the noise floor across the clip (a
single microphone's self-noise + preamp coloration should be spectrally
stable across the whole recording; a replay chain introduces a SECOND
mic + speaker's combined response, which tends to shift the noise-floor
spectral shape between segments recorded live vs. segments that are
"electronically silent" pauses reproduced by the playback chain).
"""

import logging
from typing import Any, Dict

import numpy as np

logger = logging.getLogger(__name__)

N_FFT = 2048
HOP_LENGTH = 512
MIN_DURATION_FOR_RT60_SEC = 1.5   # need enough tail to fit a decay curve
N_LFCC = 20
N_CQCC_BINS = 84                   # 7 octaves x 12 bins/octave, ASVspoof-typical


# ─────────────────────────────────────────────────────────────────────────────
# Shared helpers
# ─────────────────────────────────────────────────────────────────────────────

def _safe_result(available: bool, **kwargs) -> Dict[str, Any]:
    out = {"available": available}
    out.update(kwargs)
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Sub-module 2.3 item 2a — LFCC (Linear Frequency Cepstral Coefficients)
# ─────────────────────────────────────────────────────────────────────────────

def _lfcc(y: np.ndarray, sr: int, n_lfcc: int = N_LFCC) -> np.ndarray:
    """
    LFCC differs from MFCC only in using a LINEAR filterbank instead of
    the mel (perceptual) scale -- ASVspoof literature prefers linear
    spacing because spoofing artifacts often live in frequency bands the
    mel scale under-resolves (mel compresses high-frequency resolution,
    which is exactly where vocoder/neural-synthesis artifacts cluster).
    """
    import librosa

    S = np.abs(librosa.stft(y, n_fft=N_FFT, hop_length=HOP_LENGTH)) ** 2
    freqs = librosa.fft_frequencies(sr=sr, n_fft=N_FFT)
    n_bands = n_lfcc + 2
    edges = np.linspace(0, sr / 2, n_bands)
    filterbank = np.zeros((n_lfcc, len(freqs)))
    for i in range(n_lfcc):
        lo, mid, hi = edges[i], edges[i + 1], edges[i + 2]
        rising = (freqs >= lo) & (freqs <= mid)
        falling = (freqs > mid) & (freqs <= hi)
        if mid > lo:
            filterbank[i, rising] = (freqs[rising] - lo) / (mid - lo)
        if hi > mid:
            filterbank[i, falling] = (hi - freqs[falling]) / (hi - mid)

    band_energy = filterbank @ S
    log_energy = np.log(band_energy + 1e-10)
    from scipy.fftpack import dct
    lfcc = dct(log_energy, type=2, axis=0, norm="ortho")
    return lfcc


def _cqcc(y: np.ndarray, sr: int, n_bins: int = N_CQCC_BINS) -> np.ndarray:
    """
    CQCC uses a constant-Q transform (log-frequency, better time
    resolution at low frequencies / better frequency resolution at high
    frequencies than the fixed-window STFT) before the cepstral step.
    ASVspoof's original CQCC baseline is the other half of the standard
    LFCC+CQCC pairing.
    """
    import librosa

    C = np.abs(librosa.cqt(y, sr=sr, n_bins=n_bins, bins_per_octave=12))
    log_C = np.log(C + 1e-10)
    from scipy.fftpack import dct
    cqcc = dct(log_C, type=2, axis=0, norm="ortho")
    return cqcc


def anti_spoofing_lfcc_cqcc(y: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Heuristic (NOT a trained classifier -- see module docstring) checks
    on LFCC/CQCC statistics known from ASVspoof-literature descriptions
    of where spoofed speech deviates from bonafide:

      - High-quefrency LFCC energy ratio: vocoder-based synthesis (and
        many replay chains, via speaker/mic coloration) tends to leave
        excess energy in the higher cepstral coefficients relative to
        natural voiced speech, where energy should concentrate in the
        low-order coefficients (spectral envelope) and decay quickly.
      - CQCC delta regularity: block-based/frame-based neural vocoders
        can leave a subtly periodic signature in frame-to-frame CQCC
        deltas that continuous natural phonation does not; measured as
        the autocorrelation of the CQCC delta trajectory at short lags.
    """
    try:
        if len(y) < sr * 0.5:
            return _safe_result(False, reason="clip_too_short")

        lfcc = _lfcc(y, sr)
        if lfcc.shape[1] < 4:
            return _safe_result(False, reason="insufficient_frames")

        low_order = lfcc[1:6, :]     # skip c0 (overall energy)
        high_order = lfcc[6:, :]
        low_energy = float(np.mean(np.abs(low_order)))
        high_energy = float(np.mean(np.abs(high_order)))
        high_quefrency_ratio = high_energy / (low_energy + 1e-6)
        # Natural voiced speech: ratio typically well under ~0.4 (envelope
        # dominated by low-order coefficients). Higher ratio -> flatter,
        # more "textured" high-quefrency content -> spoof-suspicious.
        lfcc_score = float(np.clip((high_quefrency_ratio - 0.25) / 0.5, 0.0, 1.0))

        try:
            cqcc = _cqcc(y, sr)
            if cqcc.shape[1] >= 6:
                delta = np.diff(cqcc, axis=1)
                # autocorrelation of the mean delta trajectory at lag 1-3,
                # normalized -- high regularity (values close to 1) across
                # multiple short lags suggests a periodic block-synthesis
                # artifact rather than continuous natural articulation.
                mean_delta = np.mean(delta, axis=0)
                mean_delta = mean_delta - np.mean(mean_delta)
                denom = np.sum(mean_delta ** 2) + 1e-10
                lags = [1, 2, 3]
                autocorrs = []
                for lag in lags:
                    if len(mean_delta) > lag:
                        ac = np.sum(mean_delta[:-lag] * mean_delta[lag:]) / denom
                        autocorrs.append(abs(ac))
                cqcc_regularity = float(np.mean(autocorrs)) if autocorrs else 0.0
                cqcc_score = float(np.clip((cqcc_regularity - 0.15) / 0.5, 0.0, 1.0))
                cqcc_available = True
            else:
                cqcc_score = 0.0
                cqcc_regularity = None
                cqcc_available = False
        except Exception as e:
            logger.warning("[VoiceprintLiveness] CQCC computation failed, LFCC-only: %s", e)
            cqcc_score = 0.0
            cqcc_regularity = None
            cqcc_available = False

        if cqcc_available:
            score = 0.6 * lfcc_score + 0.4 * cqcc_score
        else:
            score = lfcc_score

        return _safe_result(
            True,
            score=round(score, 4),
            high_quefrency_ratio=round(high_quefrency_ratio, 4),
            cqcc_delta_regularity=round(cqcc_regularity, 4) if cqcc_regularity is not None else None,
            cqcc_available=cqcc_available,
            description="Heuristic LFCC/CQCC anomaly score (ASVspoof-style features, "
                         "rule-based -- NOT a trained classifier; no labeled ASVspoof "
                         "corpus available in this repo).",
        )
    except Exception as e:
        logger.error("[VoiceprintLiveness] anti_spoofing_lfcc_cqcc failed: %s", e, exc_info=True)
        return _safe_result(False, reason=f"unexpected_error: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Sub-module 2.3 item 3a — RT60 reverberation / replay-chain detection
# ─────────────────────────────────────────────────────────────────────────────

def _schroeder_decay_curve(energy: np.ndarray) -> np.ndarray:
    """Backward (Schroeder) integration of an energy envelope -> smooth
    monotonic decay curve, standard RT60-estimation technique."""
    reversed_cumsum = np.cumsum(energy[::-1])[::-1]
    total = reversed_cumsum[0] if len(reversed_cumsum) else 0.0
    if total <= 0:
        return np.zeros_like(energy)
    curve = reversed_cumsum / total
    return curve


def reverberation_liveness(y: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Finds the clip's most prominent decay tail (loudest onset followed by
    a fall in energy) and fits an RT60 via Schroeder integration on it.

    Single-room live recording: the decay curve (in dB) is close to a
    single straight line over its usable range (the classic RT60
    assumption -- energy decays exponentially, i.e. linearly in dB).

    Replay-of-a-recording (recording played through a speaker, re-
    captured by a second microphone): the original room's decay is
    convolved with a SECOND room's impulse response, which is the
    convolution of two exponential decays -- this is measurably NOT a
    single straight line in dB (it has curvature / a "knee"), and often
    also has an unnaturally short or unnaturally long apparent RT60
    relative to typical room acoustics (0.2s-1.2s).

    Fully anechoic / heavily processed audio (RT60 essentially returns as
    ~0, no decay tail to measure): flagged as unavailable rather than
    guessing -- studio-processed TTS output routinely has this property
    too so it is not usable evidence on its own, only the shape/plausible-
    range checks are.
    """
    try:
        import librosa

        if len(y) < sr * MIN_DURATION_FOR_RT60_SEC:
            return _safe_result(False, reason="clip_too_short_for_rt60")

        frame_energy = librosa.feature.rms(y=y, frame_length=N_FFT, hop_length=HOP_LENGTH)[0]
        if len(frame_energy) < 8 or np.max(frame_energy) < 1e-6:
            return _safe_result(False, reason="insufficient_energy")

        peak_idx = int(np.argmax(frame_energy))
        tail = frame_energy[peak_idx:]
        if len(tail) < 6:
            return _safe_result(False, reason="no_usable_decay_tail")

        tail_power = tail ** 2
        decay_curve = _schroeder_decay_curve(tail_power)
        decay_db = 10 * np.log10(decay_curve + 1e-12)
        decay_db = decay_db - decay_db[0]

        # usable range: from 0dB down to -20dB (or as far as the tail goes)
        usable_mask = decay_db > -20
        if np.sum(usable_mask) < 5:
            return _safe_result(False, reason="decay_too_short_for_fit")

        x = np.arange(len(decay_db))[usable_mask]
        yv = decay_db[usable_mask]

        # linear fit -> RT60 estimate + residual curvature (linearity check)
        slope, intercept = np.polyfit(x, yv, 1)
        fitted = slope * x + intercept
        residual = yv - fitted
        # normalized RMS deviation from the straight-line fit: a live
        # single-room decay should hug this line closely; a double-room
        # (replay) decay bends away from it.
        linearity_deviation = float(np.sqrt(np.mean(residual ** 2)) / (np.std(yv) + 1e-6))

        frame_dur_sec = HOP_LENGTH / sr
        if abs(slope) > 1e-6:
            rt60_frames = -60.0 / slope
            rt60_sec = float(rt60_frames * frame_dur_sec)
        else:
            rt60_sec = float("inf")

        # Plausibility: real rooms ~0.15s (dead/dampened) to ~1.5s (large/
        # hard-surfaced room); outside that range (after excluding the
        # near-anechoic case handled above) is itself mildly suspicious,
        # but the linearity deviation is the primary signal since replay
        # chains can still land in a "normal-looking" RT60 by chance.
        implausible_rt60 = not (0.1 <= rt60_sec <= 2.0) if np.isfinite(rt60_sec) else True

        # Score: primarily linearity deviation, secondarily implausible RT60.
        score = float(np.clip(linearity_deviation / 1.5, 0.0, 1.0))
        if implausible_rt60:
            score = float(np.clip(score + 0.2, 0.0, 1.0))

        return _safe_result(
            True,
            score=round(score, 4),
            rt60_estimate_sec=round(rt60_sec, 3) if np.isfinite(rt60_sec) else None,
            linearity_deviation=round(linearity_deviation, 4),
            implausible_rt60=implausible_rt60,
            description="Schroeder-integration RT60 decay-curve linearity check "
                         "(replay-of-a-recording tends to convolve a second room's "
                         "decay onto the first, bending the dB decay curve away from "
                         "a straight line).",
        )
    except Exception as e:
        logger.error("[VoiceprintLiveness] reverberation_liveness failed: %s", e, exc_info=True)
        return _safe_result(False, reason=f"unexpected_error: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Sub-module 2.3 item 3b — noise-floor spectral consistency
# ─────────────────────────────────────────────────────────────────────────────

def noise_floor_consistency(y: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Splits the clip into segments, isolates the quietest (below-median-
    energy) frames within each segment as a noise-floor proxy, and
    compares the spectral SHAPE (normalized spectral centroid + flatness)
    of the noise floor across segments.

    A single microphone's self-noise + preamp response is stable across
    a recording (same physical hardware/room throughout). A replay chain
    introduces a second mic+speaker pair whose combined response differs
    from the original capture chain's, so segments straddling a
    real-vs-replayed transition boundary (or a recording assembled from
    clips through different playback/recapture chains) show a spectral-
    shape shift in the noise floor that continuous single-chain audio
    does not.

    Explicitly scoped as noise-floor SHAPE consistency, not an absolute
    microphone-model fingerprint -- no calibration reference or known
    mic database is available, so identifying a specific mic model is
    out of scope (same honesty pattern as Module 18's rule-based-not-
    classifier framing).
    """
    try:
        import librosa

        n_segments = 4
        seg_len = len(y) // n_segments
        if seg_len < sr * 0.3:
            return _safe_result(False, reason="clip_too_short_for_segmentation")

        centroids = []
        flatness_vals = []
        for i in range(n_segments):
            seg = y[i * seg_len: (i + 1) * seg_len]
            if len(seg) < N_FFT:
                continue
            frame_energy = librosa.feature.rms(y=seg, frame_length=N_FFT, hop_length=HOP_LENGTH)[0]
            if len(frame_energy) < 3:
                continue
            threshold = np.percentile(frame_energy, 30)
            quiet_frame_idxs = np.where(frame_energy <= threshold)[0]
            if len(quiet_frame_idxs) < 2:
                continue

            S = np.abs(librosa.stft(seg, n_fft=N_FFT, hop_length=HOP_LENGTH))
            quiet_frame_idxs = quiet_frame_idxs[quiet_frame_idxs < S.shape[1]]
            if len(quiet_frame_idxs) < 2:
                continue
            quiet_spec = S[:, quiet_frame_idxs]
            noise_floor = np.mean(quiet_spec, axis=1) + 1e-10

            freqs = librosa.fft_frequencies(sr=sr, n_fft=N_FFT)
            centroid = float(np.sum(freqs * noise_floor) / np.sum(noise_floor))
            flat = float(
                np.exp(np.mean(np.log(noise_floor))) / (np.mean(noise_floor) + 1e-10)
            )
            centroids.append(centroid)
            flatness_vals.append(flat)

        if len(centroids) < 3:
            return _safe_result(False, reason="insufficient_quiet_segments")

        centroid_cv = float(np.std(centroids) / (np.mean(centroids) + 1e-6))
        flatness_cv = float(np.std(flatness_vals) / (np.mean(flatness_vals) + 1e-6))

        # Natural single-chain recordings: low coefficient of variation
        # across segments (same mic/room noise floor throughout).
        score = float(np.clip((0.5 * centroid_cv + 0.5 * flatness_cv - 0.15) / 0.5, 0.0, 1.0))

        return _safe_result(
            True,
            score=round(score, 4),
            noise_floor_centroid_cv=round(centroid_cv, 4),
            noise_floor_flatness_cv=round(flatness_cv, 4),
            segments_used=len(centroids),
            description="Noise-floor spectral-shape consistency across the clip "
                         "(shape only -- not a calibrated microphone-model fingerprint).",
        )
    except Exception as e:
        logger.error("[VoiceprintLiveness] noise_floor_consistency failed: %s", e, exc_info=True)
        return _safe_result(False, reason=f"unexpected_error: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

def run_all(y: np.ndarray, sr: int) -> Dict[str, Dict[str, Any]]:
    return {
        "anti_spoofing_lfcc_cqcc": anti_spoofing_lfcc_cqcc(y, sr),
        "reverberation_liveness": reverberation_liveness(y, sr),
        "noise_floor_consistency": noise_floor_consistency(y, sr),
    }

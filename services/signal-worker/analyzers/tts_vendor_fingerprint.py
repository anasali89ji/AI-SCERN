"""
Aiscern Detection Worker — TTS Vendor Fingerprinting (MODULE 18)
Giant-Level Optimization Spec, Section 2.2: TTS-Specific Fingerprinting.

HONEST SCOPE-DOWN (pre-implementation, per established workflow) --
this is the audio-engine equivalent of the image engine's L21 PRNU-deep
and C2PA-trust-chain items: the spec's actual implementation ask is not
buildable with what this repo/pipeline has available. Specifically:

  "Extract 1024-D spectral fingerprint vector per 100ms frame. Train a
   lightweight classifier (XGBoost or small MLP) on labeled TTS samples
   to identify the specific TTS model. Return likely_tts_model with
   confidence score."

This pipeline has NO labeled TTS-model dataset (ElevenLabs vs Bark vs
VALL-E vs ... samples with ground-truth vendor labels), no training
harness for one (scripts/calibrate.py explicitly has "No sklearn
dependency" and calibrates thresholds against real-vs-AI ground truth,
not a multi-class vendor classifier), and no XGBoost/sklearn dependency
actually used anywhere in the codebase (confirmed by audit: only
docstring mentions of "no sklearn" exist). Training a classifier here
would mean fabricating training data or shipping an untrained/randomly-
initialized model that returns meaningless confidence scores -- explicitly
against the "no stubs, no fabrication" rule.

What IS implemented instead: real, testable, rule-based heuristic
detectors for the spectral/temporal signatures the spec ITSELF describes
per vendor (its own prose, not a black-box model) -- e.g. ElevenLabs'
"slight boost at 3-4kHz", Bark's "broad spectral noise during pauses",
WaveNet's "high-frequency chirping, periodic noise modulation",
concatenative TTS's "micro-pauses, pitch discontinuities at unit
boundaries", RVC/SVC's "chipmunk formant ratios". These are honest,
narrower signals than a trained multi-class classifier would be -- each
one is a single hand-specified rule, not a learned decision boundary, and
should be read as "does this clip exhibit the textbook signature vendor X
is known for", not "this clip IS from vendor X with N% probability" in
any calibrated sense. `likely_tts_model` below is therefore the
argmax of these heuristic match scores, explicitly labeled as
heuristic-derived, not classifier output.

NOT implemented, flagged rather than faked:
  - VALL-E "source speaker leakage" (formant structure is a blend of
    target and source speaker) -- detecting this needs a REFERENCE
    recording of the source/training speaker to compare against, which
    is never available at inference time for a zero-shot clone. What CAN
    be checked honestly without a reference is formant trajectory
    *smoothness/consistency* (a cloned voice's formants can show more
    frame-to-frame instability as the model reconciles competing
    speaker identities) -- implemented as a proxy, clearly weaker
    evidence than true source-leakage detection, and named accordingly
    (formant_instability, not source_leakage).
  - Per-vendor confidence calibration (spec wants a genuine probability
    a classifier would produce). Heuristic match strength is reported on
    a comparable 0-1 scale for the argmax to remain meaningful across
    vendors, but is NOT a calibrated probability of any kind.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

N_FFT = 2048
HOP_LENGTH = 512
MIN_FRAMES = 8


# ─────────────────────────────────────────────────────────────────────────────
# Formant tracking (F1/F2/F3 via LPC) — shared foundation for RVC/SVC and
# the VALL-E formant-instability proxy.
# ─────────────────────────────────────────────────────────────────────────────

def _lpc_formants(frame: np.ndarray, sr: int, order: int = 12) -> List[float]:
    """LPC-based formant estimate for one windowed frame. Returns up to 3
    formant frequencies (Hz), sorted ascending. Standard technique:
    Levinson-Durbin LPC coefficients -> polynomial roots -> angles of
    roots inside the unit circle with positive imaginary part -> Hz.
    """
    windowed = frame * np.hamming(len(frame))
    # Pre-emphasis (standard for formant LPC — flattens the natural -6dB/
    # octave spectral tilt of voiced speech so LPC doesn't just model that).
    emphasized = np.append(windowed[0], windowed[1:] - 0.97 * windowed[:-1])
    if np.allclose(emphasized, 0):
        return []
    try:
        # Levinson-Durbin via autocorrelation + solving the normal equations.
        autocorr = np.correlate(emphasized, emphasized, mode="full")
        mid = len(autocorr) // 2
        r = autocorr[mid:mid + order + 1]
        if r[0] == 0:
            return []
        a = np.zeros(order + 1)
        a[0] = 1.0
        e = r[0]
        for i in range(1, order + 1):
            acc = r[i] + np.sum(a[1:i] * r[i - 1:0:-1])
            k = -acc / e if e != 0 else 0.0
            a_new = a.copy()
            for j in range(1, i):
                a_new[j] = a[j] + k * a[i - j]
            a_new[i] = k
            a = a_new
            e *= (1 - k ** 2)
            if e <= 0:
                break
        roots = np.roots(a)
        roots = roots[np.imag(roots) >= 0]
        angles = np.arctan2(np.imag(roots), np.real(roots))
        freqs = angles * (sr / (2 * np.pi))
        # Formants are resonances, i.e. roots close to the unit circle
        # (low bandwidth); filter out heavily-damped roots.
        bandwidths = -0.5 * (sr / np.pi) * np.log(np.abs(roots) + 1e-12)
        valid = (freqs > 90) & (freqs < sr / 2 - 90) & (bandwidths < 400)
        formants = sorted(freqs[valid].tolist())
        return formants[:3]
    except Exception:
        return []


def _track_formants(y: np.ndarray, sr: int, voiced_idx: np.ndarray, frame_len: int = 1024, hop: int = 512) -> List[Optional[Tuple[float, float, float]]]:
    n_frames = 1 + (len(y) - frame_len) // hop if len(y) >= frame_len else 0
    results: List[Optional[Tuple[float, float, float]]] = []
    for i in range(n_frames):
        start = i * hop
        frame = y[start:start + frame_len]
        formants = _lpc_formants(frame, sr)
        if len(formants) >= 3:
            results.append((formants[0], formants[1], formants[2]))
        else:
            results.append(None)
    return results


# ─────────────────────────────────────────────────────────────────────────────
# Per-vendor heuristic detectors
# ─────────────────────────────────────────────────────────────────────────────

def _elevenlabs_score(S: np.ndarray, freqs: np.ndarray) -> float:
    """'Slight boost at 3-4kHz (clarity enhancement)' — measured as that
    band's energy relative to its immediate neighbors (2-3kHz, 4-5kHz),
    which isolates a genuine local boost from a generally bright/dark clip.
    """
    band = (freqs >= 3000) & (freqs < 4000)
    lo_neighbor = (freqs >= 2000) & (freqs < 3000)
    hi_neighbor = (freqs >= 4000) & (freqs < 5000)
    if not (np.any(band) and np.any(lo_neighbor) and np.any(hi_neighbor)):
        return 0.0
    band_e = float(np.mean(S[band, :] ** 2))
    neighbor_e = float(np.mean(np.concatenate([S[lo_neighbor, :], S[hi_neighbor, :]])) ** 2)
    if neighbor_e <= 1e-12:
        return 0.0
    ratio_db = 10 * np.log10((band_e + 1e-12) / neighbor_e)
    # A genuine local boost lands a few dB above neighbors; uncalibrated.
    return float(np.clip(ratio_db / 6.0, 0.0, 1.0))


def _bark_score(S: np.ndarray, rms: np.ndarray, silence_mask: np.ndarray) -> float:
    """'Broad spectral noise during pauses (model uncertainty)' — measured
    as spectral flatness specifically WITHIN detected low-energy/pause
    frames (not the whole clip, which is what spectral_stability already
    covers) being unusually high (noise-like) rather than near-silent.
    """
    if not np.any(silence_mask):
        return 0.0
    pause_spec = S[:, silence_mask]
    if pause_spec.shape[1] < 3:
        return 0.0
    gmean = np.exp(np.mean(np.log(pause_spec + 1e-12), axis=0))
    amean = np.mean(pause_spec, axis=0) + 1e-12
    flatness = float(np.mean(gmean / amean))
    pause_energy = float(np.mean(rms[silence_mask]))
    # High flatness AND non-trivial energy during nominal silence = broad
    # noise filling the pause, rather than genuine near-silence.
    FLAT_THRESH = 0.25
    flat_score = float(np.clip((flatness - FLAT_THRESH) / 0.3, 0.0, 1.0)) if flatness > FLAT_THRESH else 0.0
    energy_gate = float(np.clip(pause_energy / 0.01, 0.0, 1.0))  # don't credit true digital silence
    return float(flat_score * energy_gate)


def _wavenet_chirp_score(S: np.ndarray, freqs: np.ndarray, sr: int) -> float:
    """'High-frequency chirping, periodic noise modulation' — measured as
    periodicity (via autocorrelation) of the high-band (>4kHz, when the
    sample rate covers it) energy envelope over time. Real high-frequency
    content (sibilance, breath) is noise-like/aperiodic; a periodic
    modulation there is the described artifact.
    """
    high_mask = freqs >= 4000
    if not np.any(high_mask) or sr / 2 <= 4000:
        return 0.0
    high_env = np.sum(S[high_mask, :] ** 2, axis=0)
    if len(high_env) < 16 or np.std(high_env) < 1e-9:
        return 0.0
    centered = high_env - np.mean(high_env)
    ac = np.correlate(centered, centered, mode="full")
    ac = ac[len(ac) // 2:]
    if ac[0] <= 1e-9:
        return 0.0
    ac_norm = ac / ac[0]
    # Look for a secondary peak (periodicity) beyond a small lag exclusion
    # zone, ignoring the trivial zero-lag peak.
    excl = 3
    if len(ac_norm) <= excl + 2:
        return 0.0
    secondary = float(np.max(ac_norm[excl:]))
    PERIODIC_LOW = 0.2
    return float(np.clip((secondary - PERIODIC_LOW) / 0.5, 0.0, 1.0))


def _concatenative_score(rms: np.ndarray, frame_times: np.ndarray) -> float:
    """'Micro-pauses, pitch discontinuities at unit boundaries' — proxied
    here via the RATE of very-short (< 60ms) near-zero-energy dips in the
    RMS envelope. True concatenative synthesis has more of these brief
    gaps than continuous natural speech or continuous neural TTS.
    """
    if len(rms) < 16:
        return 0.0
    threshold = np.percentile(rms, 20) * 0.5
    low = rms < max(threshold, 1e-6)
    # Count runs of `low` shorter than ~60ms.
    hop_sec = frame_times[1] - frame_times[0] if len(frame_times) > 1 else 0.032
    max_run = max(1, int(round(0.06 / hop_sec)))
    runs = 0
    run_len = 0
    for v in low:
        if v:
            run_len += 1
        else:
            if 0 < run_len <= max_run:
                runs += 1
            run_len = 0
    if 0 < run_len <= max_run:
        runs += 1
    rate = runs / (len(rms) * hop_sec)  # micro-gaps per second
    MICRO_GAP_LOW = 0.15
    return float(np.clip((rate - MICRO_GAP_LOW) / 0.6, 0.0, 1.0))


def _rvc_formant_ratio_score(formant_tracks: List[Optional[Tuple[float, float, float]]]) -> Tuple[float, Optional[float]]:
    """'Chipmunk or robot formant ratios' — natural human vowels keep
    F2/F1 in a bounded range (roughly 1.5-4.5 across the vowel space in
    adult speech); pitch/formant-shifted voice conversion frequently pushes
    this ratio outside that range while still sounding vaguely speech-like.
    """
    ratios = [f2 / f1 for f1, f2, _f3 in (t for t in formant_tracks if t is not None) if f1 > 1e-6]
    if len(ratios) < MIN_FRAMES:
        return 0.0, None
    ratios = np.array(ratios)
    out_of_range = (ratios < 1.3) | (ratios > 5.0)
    frac_out = float(np.mean(out_of_range))
    OUT_LOW = 0.1
    score = float(np.clip((frac_out - OUT_LOW) / 0.5, 0.0, 1.0))
    return score, float(np.median(ratios))


def _formant_instability_score(formant_tracks: List[Optional[Tuple[float, float, float]]]) -> Tuple[float, Optional[float]]:
    """Proxy for VALL-E-style source-speaker-leakage (see module docstring
    for why true leakage detection isn't buildable without a reference
    speaker): frame-to-frame formant JUMP rate, on the theory that a model
    reconciling two competing speaker identities produces more abrupt
    formant discontinuities than a single consistent vocal tract would.
    Weaker evidence than true leakage detection -- named accordingly.
    """
    valid = [t for t in formant_tracks if t is not None]
    if len(valid) < MIN_FRAMES + 1:
        return 0.0, None
    f1 = np.array([t[0] for t in valid])
    jumps = np.abs(np.diff(f1)) / (f1[:-1] + 1e-9)
    jump_rate = float(np.mean(jumps > 0.15))  # >15% frame-to-frame F1 jump
    JUMP_LOW = 0.1
    score = float(np.clip((jump_rate - JUMP_LOW) / 0.4, 0.0, 1.0))
    return score, jump_rate


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

def tts_vendor_fingerprint(y: np.ndarray, sr: int) -> Dict[str, Any]:
    try:
        import librosa

        S = np.abs(librosa.stft(y, n_fft=N_FFT, hop_length=HOP_LENGTH))
        freqs = librosa.fft_frequencies(sr=sr, n_fft=N_FFT)
        n_frames = S.shape[1]
        if n_frames < MIN_FRAMES:
            return {"available": False, "reason": "clip_too_short"}

        rms = librosa.feature.rms(y=y, frame_length=N_FFT, hop_length=HOP_LENGTH)[0]
        frame_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=HOP_LENGTH)
        # BUG FOUND IN SMOKE TEST: a relative percentile (bottom 25% of
        # RMS) misfires as "silence" on a continuous, unmodulated clip
        # with no real pauses at all -- the bottom 25% there is still
        # full-amplitude voiced content, not silence, which made
        # _bark_score fire at max suspicion identically on BOTH a
        # real-like and a synthetic test fixture (neither had actual
        # pause structure), defeating the whole differentiation. Require
        # an ABSOLUTE near-silence threshold relative to the clip's own
        # peak RMS, not just a relative rank among whatever frames exist.
        peak_rms = float(np.max(rms)) if len(rms) else 0.0
        silence_mask = rms < max(peak_rms * 0.12, 1e-6)

        f0, voiced_flag, _ = librosa.pyin(y, fmin=65, fmax=400, sr=sr, frame_length=N_FFT, hop_length=HOP_LENGTH)
        voiced_idx = np.where(voiced_flag & ~np.isnan(f0))[0]

        formant_tracks = _track_formants(y, sr, voiced_idx, frame_len=1024, hop=HOP_LENGTH)

        elevenlabs = _elevenlabs_score(S, freqs)
        bark = _bark_score(S, rms, silence_mask)
        wavenet = _wavenet_chirp_score(S, freqs, sr)
        concatenative = _concatenative_score(rms, frame_times)
        rvc_score, rvc_median_ratio = _rvc_formant_ratio_score(formant_tracks)
        instability_score, instability_rate = _formant_instability_score(formant_tracks)

        vendor_scores = {
            "elevenlabs_clarity_boost": round(elevenlabs, 4),
            "bark_pause_noise": round(bark, 4),
            "wavenet_chirping": round(wavenet, 4),
            "concatenative_micro_gaps": round(concatenative, 4),
            "rvc_svc_formant_ratio": round(rvc_score, 4),
            "vall_e_formant_instability_proxy": round(instability_score, 4),
        }
        likely = max(vendor_scores, key=vendor_scores.get)
        likely_strength = vendor_scores[likely]
        # If nothing clears a modest floor, report "none" rather than
        # forcing an argmax pick on noise -- an argmax is always defined
        # even when every score is near 0, which would be a false signal.
        FLOOR = 0.2
        likely_tts_model = likely if likely_strength >= FLOOR else "none_detected"

        combined = float(np.mean(list(vendor_scores.values())))

        return {
            "available": True,
            "score": round(combined, 4),
            "likely_tts_model": likely_tts_model,
            "likely_tts_model_match_strength": round(likely_strength, 4),
            "vendor_heuristic_scores": vendor_scores,
            "raw_rvc_median_f2_f1_ratio": round(rvc_median_ratio, 3) if rvc_median_ratio is not None else None,
            "raw_formant_instability_rate": round(instability_rate, 4) if instability_rate is not None else None,
            "formant_frames_tracked": sum(1 for t in formant_tracks if t is not None),
            "formant_frames_total": len(formant_tracks),
            "method_disclosure": (
                "Rule-based heuristic match against the spec's own described "
                "per-vendor signatures -- NOT a trained classifier (no labeled "
                "TTS dataset available in this pipeline). likely_tts_model is "
                "an argmax of heuristic match strength, not a calibrated "
                "probability. See analyzers/tts_vendor_fingerprint.py module "
                "docstring for full scope-down rationale."
            ),
            "description": (
                f"Top heuristic match: {likely_tts_model} (strength {likely_strength:.2f}). "
                f"Scores: {vendor_scores}."
            ),
        }
    except Exception as e:
        logger.warning("[TTSVendorFingerprint] Analysis failed: %s", e)
        return {"available": False, "reason": str(e)}


def run_all(y: np.ndarray, sr: int) -> Dict[str, Dict[str, Any]]:
    return {"tts_vendor_fingerprint": tts_vendor_fingerprint(y, sr)}

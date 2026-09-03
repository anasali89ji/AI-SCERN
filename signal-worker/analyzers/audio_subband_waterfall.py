"""
Aiscern Detection Worker — Audio Spectral Envelope / Sub-Band / Waterfall
Analysis (MODULE 17)

Giant-Level Optimization Spec, Section 2.1, items 3-5:
  3. Spectral Envelope Analysis (MFCC velocity/acceleration distribution
     shape, spectral tilt)
  4. Sub-Band Analysis (8 fixed frequency bands)
  5. Waterfall / Spectrogram Artifact Detection (horizontal lines,
     vertical lines, checkerboard, spectral duplication)

Audit note (pre-implementation, per established workflow): audio_engine.py
already has an `mfcc_consistency` signal (MODULE 3) and a
`spectral_stability` signal (MODULE 3) that overlap in *topic* with items
3-4 but not in *mechanism* --  `mfcc_consistency` is frame-to-frame MFCC
DELTA magnitude only (a single aggregate 1st-derivative number), with no
acceleration (2nd derivative) term and no comparison of the delta/
delta-delta *distribution shape* against a Gaussian, which is specifically
what item 3 asks for ("velocity/acceleration distributions are Gaussian
with specific variance"). `spectral_stability` tracks spectral centroid
CoV globally -- there is no per-sub-band decomposition anywhere in the
codebase, and no spectrogram-image-level artifact detection (waterfall
lines/checkerboard/duplication) at all. Items 3's velocity piece and item
4/5 are genuinely new, not renamed-existing -- confirmed by reading both
existing signal functions in full before writing this module.

Spectral tilt (item 3): defined here as the slope of a linear fit to the
log-magnitude spectrum vs. log-frequency (the standard definition used in
voice-quality research, e.g. Hanson & Chuang's H1-H2 family is a related
but narrower measure -- a full linear-regression tilt was chosen instead
since it needs no formant/harmonic tracking and is robust on any frame,
voiced or not).

Sub-band edges (item 4): spec's 8 bands assume up to 20kHz, which requires
sr >= 40000. Real-world audio uploads (esp. phone recordings, compressed
web audio) are very often 16kHz. Rather than silently only checking the
bands that happen to fit, or silently upsampling (which would fabricate
data no upsampling can recover), each band's availability is checked
against the actual Nyquist frequency and unavailable bands are reported
as unavailable rather than zero -- flagged explicitly here since spec-vs-
reality mismatches on sample-rate assumptions have been an issue before
(see cross-engine notes on the C2PA URL-path re-encoding limitation from
the image engine).
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

N_FFT = 2048
HOP_LENGTH = 512
MIN_FRAMES = 8

# Spec's 8 bands, in Hz. Bands whose lower edge exceeds Nyquist are marked
# unavailable at analysis time rather than silently dropped from the list,
# so the caller can see *why* fewer than 8 bands were scored.
SUBBAND_EDGES: List[Tuple[float, float]] = [
    (0, 500), (500, 1000), (1000, 2000), (2000, 4000),
    (4000, 8000), (8000, 12000), (12000, 16000), (16000, 20000),
]


# ─────────────────────────────────────────────────────────────────────────────
# Sub-module 2.1 item 3 — Spectral Envelope Analysis
# ─────────────────────────────────────────────────────────────────────────────

def spectral_envelope_analysis(y: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    MFCC delta/delta-delta distribution shape (not just aggregate
    magnitude -- audio_engine.py's mfcc_consistency already covers mean
    delta magnitude) + spectral tilt trajectory.

    Real speech: delta/delta-delta values across frames approximate a
    roughly Gaussian distribution with non-trivial variance (natural
    articulatory dynamics vary continuously). Over-smoothed TTS: delta
    values cluster tightly near zero with excess kurtosis (many
    near-silent transitions, few large ones) rather than a normal spread.
    Spectral tilt: real speech tilt shifts with phoneme/emotion; TTS tilt
    is often close to constant across the clip.
    """
    try:
        import librosa
        from scipy import stats as scipy_stats

        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        if mfcc.shape[1] < MIN_FRAMES + 2:
            return {"available": False, "reason": "clip_too_short_for_mfcc"}

        delta = np.diff(mfcc, axis=1)
        delta2 = np.diff(delta, axis=1)

        # Excess kurtosis of the flattened delta distribution. Gaussian
        # has kurtosis 0 (scipy's "fisher" convention, default). TTS
        # over-smoothing -> many small deltas + occasional larger jumps
        # at phoneme boundaries -> heavy-tailed/peaked -> high positive
        # excess kurtosis. This is a shape check, independent of the mean
        # magnitude mfcc_consistency already reports.
        delta_flat = delta.flatten()
        delta2_flat = delta2.flatten()
        delta_kurtosis = float(scipy_stats.kurtosis(delta_flat))
        delta2_kurtosis = float(scipy_stats.kurtosis(delta2_flat))

        # BUG FOUND IN SMOKE TEST: KURT_SCALE was originally set assuming
        # real speech lands in "low single digits" of excess kurtosis --
        # both synthetic fixtures (being pure sine-sum constructions, which
        # are inherently far more periodic/peaked than any real broadband
        # speech signal) blew past that scale and saturated at 1.0
        # identically, destroying the very differentiation this signal
        # exists to provide. Widened substantially. Even so: this
        # component's absolute thresholds remain UNVALIDATED against real
        # human/TTS audio -- hand-built sine constructions are a poor
        # proxy for kurtosis specifically (periodicity itself inflates
        # kurtosis regardless of "naturalness"), unlike the harmonic/phase
        # signals in Module 16 where direction validated cleanly. Flagging
        # this explicitly rather than presenting it as tuned; owner's call
        # on whether it needs real labeled samples before trusting the
        # weight, same as Module 16's harmonic_structure open item.
        avg_kurtosis = (delta_kurtosis + delta2_kurtosis) / 2
        KURT_ZERO = 1.0
        KURT_SCALE = 200.0
        kurtosis_score = float(np.clip((avg_kurtosis - KURT_ZERO) / KURT_SCALE, 0.0, 1.0))

        # Spectral tilt per frame: linear fit of log-magnitude vs
        # log-frequency (skip DC bin, which has no defined log).
        S = np.abs(librosa.stft(y, n_fft=N_FFT, hop_length=HOP_LENGTH))
        freqs = librosa.fft_frequencies(sr=sr, n_fft=N_FFT)
        log_freqs = np.log10(freqs[1:] + 1e-9)
        n_frames = S.shape[1]
        if n_frames < MIN_FRAMES:
            tilt_score = None
            tilt_std = None
        else:
            tilts = []
            for i in range(n_frames):
                mag = S[1:, i]
                log_mag = np.log10(mag + 1e-9)
                if np.std(log_mag) < 1e-6:
                    continue
                slope, _intercept, r_value, _p, _se = scipy_stats.linregress(log_freqs, log_mag)
                # BUG FOUND IN SMOKE TEST: an ungated tilt trajectory
                # produced a HIGHER std (more "natural"-looking by this
                # signal's own scoring) on a synthetic pure-harmonic-comb
                # fixture than on a broader/noisier fixture -- inverted.
                # Root cause: a linear fit against a near-empty spectrum
                # (all-but-a-few-bins near the noise floor) is
                # ill-conditioned and its slope estimate is dominated by
                # which few bins happen to poke above the floor that
                # frame, producing spuriously volatile slopes that have
                # nothing to do with genuine spectral-tilt variation. Gate
                # on fit quality (R^2) so only frames with a genuinely
                # well-determined tilt contribute to the std.
                if np.isfinite(slope) and (r_value ** 2) > 0.5:
                    tilts.append(float(slope))
            if len(tilts) < MIN_FRAMES:
                tilt_score = None
                tilt_std = None
            else:
                tilts = np.array(tilts)
                tilt_std = float(np.std(tilts))
                # Real speech tilt genuinely wanders with phoneme/emotion;
                # near-constant tilt across the clip is the TTS tell.
                # Continuous scaling: 0 variance -> max suspicion, high
                # variance -> 0 suspicion. (Removed a duplicate/dead
                # tilt_score assignment that was here before the R^2-gating
                # fix -- left over from an earlier draft, caught on review.)
                LOW_TILT_STD = 0.15
                SCALE_TILT_STD = 0.6
                tilt_score = float(np.clip(1.0 - tilt_std / (LOW_TILT_STD + SCALE_TILT_STD), 0.0, 1.0))

        combined = (kurtosis_score + tilt_score) / 2 if tilt_score is not None else kurtosis_score

        return {
            "available": True,
            "score": round(float(combined), 4),
            "raw_delta_kurtosis": round(delta_kurtosis, 3),
            "raw_delta2_kurtosis": round(delta2_kurtosis, 3),
            "raw_tilt_std": round(tilt_std, 4) if tilt_std is not None else None,
            "description": (
                f"MFCC delta/delta2 excess kurtosis {avg_kurtosis:.2f} "
                f"({'over-smoothed (TTS-like)' if kurtosis_score > 0.6 else 'natural variance shape'})."
                + (f" Spectral tilt std {tilt_std:.4f}." if tilt_std is not None else "")
            ),
        }
    except Exception as e:
        logger.warning("[AudioSubbandWaterfall] Spectral envelope analysis failed: %s", e)
        return {"available": False, "reason": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# Sub-module 2.1 item 4 — Sub-Band Analysis
# ─────────────────────────────────────────────────────────────────────────────

def subband_analysis(y: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    8 fixed sub-bands (spec's edges). Two checks, per the spec's own
    stated mechanism, not a generic per-band energy comparison:
      - High-frequency bands (>8kHz, when the sample rate covers them):
        real speech has a natural gradual rolloff + noise-like content up
        there (breath, sibilance, room noise); some TTS either cuts off
        abruptly (vocoder synthesis ceiling) or has artificially flat/
        tonal energy where noise should be.
      - Low-frequency band (0-500Hz): real speech has breath noise and
        plosive-burst energy leaking down there between voiced segments;
        overly-clean synthetic audio is often near-silent in this band
        during pauses.
    """
    try:
        import librosa

        nyquist = sr / 2
        S = np.abs(librosa.stft(y, n_fft=N_FFT, hop_length=HOP_LENGTH))
        freqs = librosa.fft_frequencies(sr=sr, n_fft=N_FFT)
        n_frames = S.shape[1]
        if n_frames < MIN_FRAMES:
            return {"available": False, "reason": "clip_too_short_for_subband_analysis"}

        total_energy_per_frame = np.sum(S ** 2, axis=0) + 1e-12

        band_results = {}
        for lo, hi in SUBBAND_EDGES:
            label = f"{int(lo)}-{int(hi)}Hz"
            if lo >= nyquist:
                band_results[label] = {"available": False, "reason": "above_nyquist_for_this_sample_rate"}
                continue
            hi_eff = min(hi, nyquist)
            mask = (freqs >= lo) & (freqs < hi_eff)
            if not np.any(mask):
                band_results[label] = {"available": False, "reason": "no_fft_bins_in_range"}
                continue
            band_energy = np.sum(S[mask, :] ** 2, axis=0)
            band_fraction = band_energy / total_energy_per_frame
            # Spectral flatness within the band (noise-like vs tonal),
            # geometric-mean/arithmetic-mean ratio on the band's magnitudes.
            band_mag = S[mask, :]
            gmean = np.exp(np.mean(np.log(band_mag + 1e-12), axis=0))
            amean = np.mean(band_mag, axis=0) + 1e-12
            flatness = float(np.mean(gmean / amean))
            band_results[label] = {
                "available": True,
                "mean_energy_fraction": round(float(np.mean(band_fraction)), 5),
                "flatness": round(flatness, 4),
            }

        # High-band rolloff naturalness: bands above 8kHz should carry
        # SOME energy (noise-like, non-zero flatness) if the sample rate
        # covers them at all -- near-total silence there, or unnaturally
        # tonal (low flatness, i.e. high peakiness) content, both read as
        # synthetic per the spec's stated mechanism.
        high_labels = [f"{int(lo)}-{int(hi)}Hz" for lo, hi in SUBBAND_EDGES if lo >= 8000]
        high_available = [band_results[l] for l in high_labels if band_results[l].get("available")]
        if high_available:
            mean_high_fraction = float(np.mean([b["mean_energy_fraction"] for b in high_available]))
            mean_high_flatness = float(np.mean([b["flatness"] for b in high_available]))
            # Near-zero energy AND low flatness together = abrupt cutoff /
            # artificially clean high band. Either alone is weaker evidence.
            LOW_FRACTION = 0.01
            LOW_FLATNESS = 0.15
            frac_suspicion = float(np.clip(1.0 - mean_high_fraction / LOW_FRACTION, 0.0, 1.0)) if mean_high_fraction < LOW_FRACTION else 0.0
            flat_suspicion = float(np.clip(1.0 - mean_high_flatness / LOW_FLATNESS, 0.0, 1.0)) if mean_high_flatness < LOW_FLATNESS else 0.0
            high_band_score = (frac_suspicion + flat_suspicion) / 2
        else:
            high_band_score = None
            mean_high_fraction = None

        # Low-band (0-500Hz) presence: near-total silence there across the
        # WHOLE clip (not just during actual silence, which is expected)
        # is the "too clean" tell -- measured as the band's energy
        # fraction not dropping to near-zero anywhere, i.e. its own
        # temporal variance being suspiciously low is not the point here;
        # the spec's mechanism is about baseline PRESENCE, so we check the
        # band's raw fraction level, not its variability (that's what
        # spectral_stability/mfcc signals already check elsewhere).
        # Low-band (0-500Hz) noise-vs-tonal check, NOT raw energy presence.
        # BUG FOUND IN SMOKE TEST: a raw-energy-fraction check is nearly
        # useless here because the voiced fundamental itself always
        # dominates 0-500Hz for any voiced speech (both TTS and real) --
        # it fired 0.0 on BOTH fixtures regardless of design intent. The
        # spec's actual mechanism is "breath noise and plosive artifacts"
        # specifically, i.e. NOISE-LIKE content, not just any energy --
        # use the band's flatness (already computed above, was unused in
        # scoring) instead: low flatness = purely tonal (fundamental only,
        # no breath) = "too clean"; higher flatness = noise floor present.
        low_label = f"{int(SUBBAND_EDGES[0][0])}-{int(SUBBAND_EDGES[0][1])}Hz"
        low_band = band_results[low_label]
        if low_band.get("available"):
            low_flatness = low_band["flatness"]
            LOW_FLATNESS_FLOOR = 0.02
            SCALE_LOW_FLATNESS = 0.08
            low_band_score = float(np.clip(1.0 - (low_flatness - LOW_FLATNESS_FLOOR) / SCALE_LOW_FLATNESS, 0.0, 1.0))
        else:
            low_band_score = None

        component_scores = [s for s in (high_band_score, low_band_score) if s is not None]
        if not component_scores:
            return {"available": False, "reason": "no_scorable_bands_for_this_sample_rate", "bands": band_results}
        combined = float(np.mean(component_scores))

        n_available_bands = sum(1 for b in band_results.values() if b.get("available"))
        return {
            "available": True,
            "score": round(combined, 4),
            "raw_high_band_mean_fraction": round(mean_high_fraction, 5) if mean_high_fraction is not None else None,
            "raw_low_band_fraction": round(low_band["mean_energy_fraction"], 5) if low_band.get("available") else None,
            "bands_available": n_available_bands,
            "bands_total": len(SUBBAND_EDGES),
            "bands": band_results,
            "description": (
                f"{n_available_bands}/{len(SUBBAND_EDGES)} bands scorable at this sample rate ({sr}Hz). "
                + (f"High-band (>8kHz) energy fraction {mean_high_fraction:.4f}. " if mean_high_fraction is not None else "High bands unavailable (sample rate too low). ")
                + (f"Low-band (0-500Hz) fraction {low_band['mean_energy_fraction']:.4f}." if low_band.get("available") else "")
            ),
        }
    except Exception as e:
        logger.warning("[AudioSubbandWaterfall] Sub-band analysis failed: %s", e)
        return {"available": False, "reason": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# Sub-module 2.1 item 5 — Waterfall / Spectrogram Artifact Detection
# ─────────────────────────────────────────────────────────────────────────────

def waterfall_artifact_detection(y: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    High-res spectrogram (2048-pt FFT, 75% overlap per spec) checked for:
      - Horizontal lines: a frequency bin with unnaturally CONSTANT
        energy across time relative to its own neighborhood -> vocoder
        carrier-frequency leakage.
      - Vertical lines: broadband impulses (energy spike across many
        frequency bins in a single frame) -> real plosives are expected;
        their near-total ABSENCE across an otherwise speech-like clip is
        itself a signal (spec: "TTS may have... missing plosives"), so
        this is reported as a rate rather than a binary presence flag.
      - Checkerboard pattern: alternating high/low energy in a regular
        grid -> autocorrelation-based periodicity check on the spectrogram
        in both axes simultaneously.
      - Spectral duplication: repeated spectral patches -> frame-to-frame
        spectral cross-correlation matrix checked for above-diagonal peaks
        (near-identical non-adjacent frames), which plain frame-to-frame
        smoothness metrics elsewhere in this pipeline would not catch
        since they only ever look at ADJACENT frames.
    """
    try:
        import librosa

        hop = N_FFT // 4  # 75% overlap per spec, distinct from HOP_LENGTH used elsewhere
        S = np.abs(librosa.stft(y, n_fft=N_FFT, hop_length=hop))
        n_bins, n_frames = S.shape
        if n_frames < 16:
            return {"available": False, "reason": "clip_too_short_for_waterfall_analysis"}

        log_S = np.log10(S + 1e-9)

        # Horizontal lines: for each bin, coefficient of variation of its
        # energy across time relative to the median CoV across all bins.
        # A bin that is anomalously FLAT (low CoV) relative to its
        # neighbors is a carrier-line candidate.
        bin_means = np.mean(S, axis=1)
        bin_stds = np.std(S, axis=1)
        active_bins = bin_means > (np.percentile(bin_means, 60))  # ignore near-silent bins
        bin_cov = np.where(bin_means > 1e-9, bin_stds / (bin_means + 1e-9), np.inf)
        if np.any(active_bins):
            median_active_cov = float(np.median(bin_cov[active_bins]))
            LINE_COV_FRACTION = 0.35  # a bin below 35% of the neighborhood's typical CoV is "too flat"
            line_bins = active_bins & (bin_cov < median_active_cov * LINE_COV_FRACTION)
            horizontal_line_count = int(np.sum(line_bins))
            horizontal_line_fraction = horizontal_line_count / max(1, int(np.sum(active_bins)))
        else:
            horizontal_line_fraction = 0.0
            horizontal_line_count = 0

        HL_SCALE = 0.08
        horizontal_score = float(np.clip(horizontal_line_fraction / HL_SCALE, 0.0, 1.0))

        # Vertical lines / plosive rate: frames whose total energy spikes
        # well above the local rolling median -> broadband impulse.
        frame_energy = np.sum(S ** 2, axis=0)
        window = min(21, n_frames if n_frames % 2 == 1 else n_frames - 1)
        window = max(window, 3)
        pad = window // 2
        padded = np.pad(frame_energy, pad, mode="edge")
        rolling_median = np.array([
            np.median(padded[i:i + window]) for i in range(n_frames)
        ])
        spikes = frame_energy > (rolling_median * 2.5 + 1e-9)
        plosive_rate = float(np.sum(spikes)) / n_frames
        # Real conversational speech has SOME plosive rate; a rate near
        # zero across a multi-second clip with otherwise-present speech
        # energy is the suspicious case per the spec ("missing plosives").
        LOW_PLOSIVE_RATE = 0.01
        vertical_score = float(np.clip(1.0 - plosive_rate / LOW_PLOSIVE_RATE, 0.0, 1.0)) if plosive_rate < LOW_PLOSIVE_RATE else 0.0

        # Checkerboard: 2D autocorrelation of the log-spectrogram, checked
        # for a secondary peak at a non-trivial (freq_lag, time_lag) offset
        # comparable in height to the zero-lag peak -- a true checkerboard
        # produces strong periodicity in BOTH axes at once, which a
        # per-axis-only check would miss.
        centered = log_S - np.mean(log_S)
        # Use FFT-based 2D autocorrelation for tractable cost on typical
        # clip lengths (n_bins x n_frames can be ~1000x hundreds).
        f_ac = np.fft.fft2(centered)
        power = f_ac * np.conj(f_ac)
        ac2d = np.fft.ifft2(power).real
        ac2d = np.fft.fftshift(ac2d)
        zero_lag = ac2d[ac2d.shape[0] // 2, ac2d.shape[1] // 2]
        if zero_lag > 1e-9:
            ac2d_norm = ac2d / zero_lag
            # Exclude a small neighborhood around the zero-lag peak itself.
            cy, cx = ac2d_norm.shape[0] // 2, ac2d_norm.shape[1] // 2
            excl = 3
            mask = np.ones_like(ac2d_norm, dtype=bool)
            mask[max(0, cy - excl):cy + excl + 1, max(0, cx - excl):cx + excl + 1] = False
            secondary_peak = float(np.max(np.abs(ac2d_norm[mask]))) if np.any(mask) else 0.0
        else:
            secondary_peak = 0.0
        CHECKERBOARD_LOW = 0.15
        CHECKERBOARD_SCALE = 0.5
        checkerboard_score = float(np.clip((secondary_peak - CHECKERBOARD_LOW) / CHECKERBOARD_SCALE, 0.0, 1.0))

        # Spectral duplication: cosine similarity between all NON-adjacent
        # frame pairs (|i-j| > 4, to skip natural short-range smoothness),
        # looking for near-identical frames that shouldn't occur by chance
        # in real speech's continuously-evolving spectrum.
        max_frames_for_pairwise = 300  # cap cost on long clips
        if n_frames > max_frames_for_pairwise:
            idx = np.linspace(0, n_frames - 1, max_frames_for_pairwise).astype(int)
            S_sub = S[:, idx]
        else:
            S_sub = S
        norms = np.linalg.norm(S_sub, axis=0) + 1e-9
        S_norm = S_sub / norms
        sim = S_norm.T @ S_norm
        m = sim.shape[0]
        i_idx, j_idx = np.triu_indices(m, k=5)
        off_diag_sims = sim[i_idx, j_idx]
        DUP_THRESHOLD = 0.985
        duplication_rate = float(np.mean(off_diag_sims > DUP_THRESHOLD)) if len(off_diag_sims) else 0.0
        DUP_SCALE = 0.02
        duplication_score = float(np.clip(duplication_rate / DUP_SCALE, 0.0, 1.0))

        combined = float(np.mean([horizontal_score, vertical_score, checkerboard_score, duplication_score]))

        return {
            "available": True,
            "score": round(combined, 4),
            "raw_horizontal_line_fraction": round(horizontal_line_fraction, 4),
            "raw_plosive_rate": round(plosive_rate, 4),
            "raw_checkerboard_secondary_peak": round(secondary_peak, 4),
            "raw_duplication_rate": round(duplication_rate, 5),
            "sub_scores": {
                "horizontal_lines": round(horizontal_score, 4),
                "vertical_lines_missing_plosives": round(vertical_score, 4),
                "checkerboard": round(checkerboard_score, 4),
                "spectral_duplication": round(duplication_score, 4),
            },
            "description": (
                f"Horizontal line fraction {horizontal_line_fraction:.3f}, plosive rate {plosive_rate:.3f}, "
                f"checkerboard peak {secondary_peak:.3f}, duplication rate {duplication_rate:.4f}."
            ),
        }
    except Exception as e:
        logger.warning("[AudioSubbandWaterfall] Waterfall artifact detection failed: %s", e)
        return {"available": False, "reason": str(e)}


def run_all(y: np.ndarray, sr: int) -> Dict[str, Dict[str, Any]]:
    """Entry point audio_engine.py calls — returns all 3 signals keyed by name."""
    return {
        "spectral_envelope": spectral_envelope_analysis(y, sr),
        "subband_analysis": subband_analysis(y, sr),
        "waterfall_artifacts": waterfall_artifact_detection(y, sr),
    }

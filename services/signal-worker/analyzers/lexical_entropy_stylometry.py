"""
Aiscern Detection Worker — Lexical Richness & Entropy Stylometry (MODULE 21)
Giant-Level Optimization Spec, Section 3.2, items 1 and 4:
  1. Lexical Features (TTR/MATTR, Brunet's Index, Honore's Statistic,
     hapax legomena / Zipf deviation)
  4. Entropy & Information Theory (character-level entropy, word-level
     entropy)

Audit note (pre-implementation, per established workflow): checked
engines/text_engine.py's existing `_compute_stylometry` before writing
anything -- it already computes plain TTR, sentence-length variance,
avg word length, lexical density, passive-voice rate, and transition-
word rate. It does NOT compute MATTR (windowed TTR, more robust to
length than raw TTR), Brunet's Index, Honore's Statistic, hapax-legomena
ratio, a Zipf-law rank/frequency check, or any Shannon-entropy measure
(character- or word-level). None of the below duplicates the existing
function; this module is additive.

Honest scope notes:
  - Brunet's Index and Honore's Statistic are reported as descriptive
    stylometric statistics, not scored as strong suspicion signals on
    their own. Both are well-established authorship-attribution metrics,
    but their "normal" range is heavily length- and genre-dependent, and
    this repo has no labeled human-vs-AI corpus to calibrate a threshold
    against (same honesty pattern as every other uncalibrated heuristic
    range in this codebase -- see text_engine.py's stylometry docstring
    and Module 18/19a's calibration caveats). They are computed correctly
    and returned for transparency/future calibration, but carry a small,
    explicit weight discount in this module's own internal scoring
    relative to the Zipf/hapax and entropy checks, which have a much
    more literature-grounded expected direction (real English hews close
    to Zipf's law; heavily template-driven generation measurably does
    not, in a way that doesn't require a length/genre-specific baseline
    to detect).
  - "Perplexity under different language models" and "cross-entropy
    fingerprinting" (spec item 4's other two bullets) are NOT in this
    module -- those need multiple loaded LM checkpoints beyond the single
    distilgpt2 this worker already runs for `_compute_perplexity`, which
    is a dependency/resource-budget decision (this runs on a
    DigitalOcean basic-xs 1GB RAM box per text_engine.py's own docstring)
    rather than a "write it now" call. Flagged as a separate open item.
"""

import logging
import math
from collections import Counter
from typing import Any, Dict, List

import numpy as np

logger = logging.getLogger(__name__)

MIN_WORDS = 40    # below this, per-window/rank-frequency stats are too noisy to trust
MATTR_WINDOW = 30


def _safe_result(score: float, confidence: float, **kwargs) -> Dict[str, Any]:
    out = {"score": round(float(np.clip(score, 0.0, 1.0)), 4), "confidence": round(float(confidence), 4)}
    out.update(kwargs)
    return out


def _empty(reason: str) -> Dict[str, Any]:
    return {"score": 0.5, "confidence": 0.0, "details": {"reason": reason}}


# ─────────────────────────────────────────────────────────────────────────────
# Sub-module 3.2 item 1 — Lexical Richness
# ─────────────────────────────────────────────────────────────────────────────

def _mattr(words: List[str], window: int = MATTR_WINDOW) -> float:
    """Moving-Average Type-Token Ratio: TTR computed over a sliding
    window and averaged, so it isn't confounded by document length the
    way raw TTR is (TTR mechanically falls as text gets longer)."""
    if len(words) < window:
        unique = len(set(words))
        return unique / len(words) if words else 0.0
    ratios = []
    for i in range(len(words) - window + 1):
        win = words[i:i + window]
        ratios.append(len(set(win)) / window)
    return float(np.mean(ratios))


def _brunets_index(n_tokens: int, vocab_size: int) -> float:
    """W = N^(V^-0.165). Lower W = richer vocabulary relative to length."""
    if n_tokens <= 0 or vocab_size <= 0:
        return 0.0
    return float(n_tokens ** (vocab_size ** -0.165))


def _honores_statistic(n_tokens: int, vocab_size: int, hapax_count: int) -> float:
    """R = 100 * log(N) / (1 - V1/V). Higher R = richer vocabulary.
    Undefined (division by zero) if every word type appears exactly
    once (V1 == V, i.e. a very short/all-unique sample) -- returned as
    None in that case rather than a fabricated infinity."""
    if vocab_size <= 0 or n_tokens <= 1:
        return None
    ratio = hapax_count / vocab_size
    if ratio >= 0.999:
        return None
    return float(100 * math.log(n_tokens) / (1 - ratio))


def _zipf_slope_deviation(word_counts: Counter) -> float:
    """
    Rank-frequency log-log linear regression slope. Zipf's law predicts
    a slope close to -1 for natural language at the word-frequency
    level. Returns the absolute deviation from -1 (0 = perfect Zipf fit,
    larger = further from the natural pattern).
    """
    freqs = sorted(word_counts.values(), reverse=True)
    if len(freqs) < 10:
        return None
    ranks = np.arange(1, len(freqs) + 1)
    log_ranks = np.log(ranks)
    log_freqs = np.log(freqs)
    slope, _ = np.polyfit(log_ranks, log_freqs, 1)
    return float(abs(slope - (-1.0)))


def lexical_richness(words: List[str]) -> Dict[str, Any]:
    try:
        if len(words) < MIN_WORDS:
            return _empty("too_few_words")

        lower_words = [w.lower() for w in words]
        n_tokens = len(lower_words)
        word_counts = Counter(lower_words)
        vocab_size = len(word_counts)
        hapax = [w for w, c in word_counts.items() if c == 1]
        hapax_ratio = len(hapax) / vocab_size if vocab_size else 0.0

        mattr = _mattr(lower_words)
        brunet = _brunets_index(n_tokens, vocab_size)
        honore = _honores_statistic(n_tokens, vocab_size, len(hapax))
        zipf_dev = _zipf_slope_deviation(word_counts)

        # MATTR: natural English prose typically lands roughly 0.55-0.90
        # over a 30-word window in short samples (uncalibrated heuristic
        # band -- genuinely varied short narrative text often legitimately
        # scores close to 1.0 simply because a 30-word window rarely
        # repeats a word at all, so the high end of this band is set
        # conservatively to avoid flagging ordinary non-repetitive prose).
        # Below ~0.45 (heavily repetitive within-window vocabulary) is
        # the much more reliable suspicious direction and is weighted
        # accordingly; only extreme (>0.95) high-end values contribute
        # at all, and only mildly.
        if mattr < 0.45:
            mattr_score = 0.75
        elif mattr > 0.95:
            mattr_score = 0.35
        else:
            mattr_score = 0.0

        # Hapax ratio: natural English text of moderate length typically
        # has 40-60% of its vocabulary appearing exactly once (Zipf-
        # consistent). Notably lower (heavy reuse of a smaller core
        # vocabulary -- template-like) is the primary suspicious
        # direction; notably higher is a weaker, secondary signal.
        if hapax_ratio < 0.30:
            hapax_score = 0.7
        elif hapax_ratio > 0.75:
            hapax_score = 0.55
        else:
            hapax_score = float(np.clip(abs(hapax_ratio - 0.5) / 0.25, 0.0, 0.35))

        # Zipf deviation: real text's rank-frequency slope is usually
        # within ~0.15-0.3 of -1 for texts in this length range. Larger
        # deviation suggests an unnaturally flat or unnaturally
        # concentrated frequency distribution.
        zipf_score = float(np.clip((zipf_dev - 0.2) / 0.5, 0.0, 1.0)) if zipf_dev is not None else None

        # Weighted rather than plain-mean combination: hapax ratio is a
        # direct, reliable measure of vocabulary reuse; zipf_slope
        # deviation is a noisier derivative statistic at the word-type
        # sample sizes typical of moderate-length documents (rank-
        # frequency regression on a few dozen points is genuinely
        # noisier than a direct ratio), so it's included at half weight
        # rather than treated as equally decisive.
        components = [(mattr_score, 1.0), (hapax_score, 1.5)]
        if zipf_score is not None:
            components.append((zipf_score, 0.5))
        total_w = sum(w for _, w in components)
        score = float(sum(s * w for s, w in components) / total_w)
        confidence = min(0.7, 0.3 + n_tokens / 500)

        return _safe_result(
            score, confidence,
            mattr=round(mattr, 4),
            brunets_index=round(brunet, 4),
            honores_statistic=round(honore, 2) if honore is not None else None,
            hapax_legomena_ratio=round(hapax_ratio, 4),
            zipf_slope_deviation=round(zipf_dev, 4) if zipf_dev is not None else None,
            details={
                "token_count": n_tokens,
                "vocabulary_size": vocab_size,
                "hapax_count": len(hapax),
                "note": "Brunet's Index / Honore's Statistic reported descriptively -- "
                        "no labeled human/AI corpus available in this repo to calibrate "
                        "a length/genre-specific threshold (see module docstring).",
            },
        )
    except Exception as e:
        logger.error("[LexicalEntropyStylometry] lexical_richness failed: %s", e, exc_info=True)
        return _empty(f"unexpected_error: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Sub-module 3.2 item 4 — Entropy & Information Theory
# ─────────────────────────────────────────────────────────────────────────────

def _shannon_entropy(counts: Counter, total: int) -> float:
    if total <= 0:
        return 0.0
    entropy = 0.0
    for c in counts.values():
        p = c / total
        entropy -= p * math.log2(p)
    return float(entropy)


def entropy_fingerprint(text: str, words: List[str]) -> Dict[str, Any]:
    """
    Character-level Shannon entropy (bits/char, over the printable
    characters actually present) and word-level Shannon entropy (bits/
    word, over this document's own word-frequency distribution -- NOT a
    language-model cross-entropy, which needs a loaded LM; this is the
    text's own empirical unigram entropy, a real and distinct
    information-theoretic measure that needs no model).

    Spec's cited reference numbers (~4.5 bits/char for English, ~11
    bits/word) are corpus-level averages from the literature, not
    validated against any labeled sample in this repo -- used only as a
    rough plausibility band, same uncalibrated-heuristic caveat as
    everywhere else in this file.
    """
    try:
        if len(words) < MIN_WORDS:
            return _empty("too_few_words")

        chars = [c for c in text if c.isprintable() and not c.isspace()]
        if len(chars) < 50:
            return _empty("too_few_characters")

        char_counts = Counter(chars)
        char_entropy = _shannon_entropy(char_counts, len(chars))

        lower_words = [w.lower() for w in words]
        word_counts = Counter(lower_words)
        word_entropy = _shannon_entropy(word_counts, len(lower_words))
        # Normalize against log2(token_count) -- the entropy the text
        # WOULD have if every token were unique -- rather than
        # log2(vocab_size). Normalizing against the document's own
        # vocabulary size hides exactly the case this signal needs to
        # catch: a small, evenly-reused template vocabulary scores
        # maximal entropy relative to ITSELF even though it's a strong
        # repetition tell. Normalizing against length ties the ratio to
        # effective vocabulary size relative to text length instead
        # (this is mathematically bounded by TTR: entropy <=
        # log2(vocab_size) <= log2(token_count), so a small or unevenly
        # -reused vocabulary both show up as a lower ratio here).
        max_word_entropy = math.log2(len(lower_words)) if len(lower_words) > 1 else 1.0
        norm_word_entropy = word_entropy / max_word_entropy if max_word_entropy > 0 else 0.0

        # Char entropy: natural English text typically 4.0-4.6 bits/char.
        # Well below ~3.8 suggests unusually repetitive/predictable
        # character usage.
        char_score = float(np.clip((4.0 - char_entropy) / 1.0, 0.0, 1.0)) if char_entropy < 4.0 else 0.0

        # Normalized word entropy: natural prose's word distribution is
        # rarely maximally flat (max_word_entropy) because of function-
        # word skew, but heavily templated text pushes it noticeably
        # LOWER than typical natural skew (over-concentration on a small
        # repeated core vocabulary beyond ordinary function-word reuse).
        LOW_NORM = 0.72
        word_score = float(np.clip((LOW_NORM - norm_word_entropy) / 0.25, 0.0, 1.0)) if norm_word_entropy < LOW_NORM else 0.0

        score = float(0.45 * char_score + 0.55 * word_score)
        confidence = min(0.65, 0.3 + len(lower_words) / 600)

        return _safe_result(
            score, confidence,
            char_entropy_bits=round(char_entropy, 4),
            word_entropy_bits=round(word_entropy, 4),
            word_entropy_normalized=round(norm_word_entropy, 4),
            details={
                "char_count": len(chars),
                "unique_chars": len(char_counts),
                "word_count": len(lower_words),
                "unique_words": len(word_counts),
            },
        )
    except Exception as e:
        logger.error("[LexicalEntropyStylometry] entropy_fingerprint failed: %s", e, exc_info=True)
        return _empty(f"unexpected_error: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

def run_all(text: str, words: List[str]) -> Dict[str, Dict[str, Any]]:
    return {
        "lexical_richness": lexical_richness(words),
        "entropy_fingerprint": entropy_fingerprint(text, words),
    }

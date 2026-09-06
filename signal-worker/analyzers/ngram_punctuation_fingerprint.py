"""
Aiscern Detection Worker — N-Gram & Punctuation/Formatting Fingerprint
(MODULE 22)
Giant-Level Optimization Spec, Section 3.2, items 5-6:
  5. N-Gram Fingerprinting
  6. Punctuation & Formatting Fingerprint

Audit note / scope-down (per established workflow, same honesty pattern
as Module 18's TTS classifier and Module 19a's ECAPA-TDNN split): the
spec's item 5 describes building "author profile vectors" and comparing
n-gram distributions against "the training data distribution (often web
text)" -- that requires either a reference corpus of known-human writing
or a reference n-gram distribution of known-AI web-scale training data,
neither of which exists in this repo (same category of missing infra as
Module 3.4's "database of 100M+ documents" for plagiarism, which this
module does not attempt either). Fabricating a reference distribution or
hand-waving a comparison against one that isn't there would violate the
"no stubs, no fabrication" rule.

What IS implemented instead, honestly scoped to what's checkable from
the document ALONE with no external reference: internal n-gram
diversity and concentration. A human author naturally reuses some
phrases but rarely leans on a small handful of multi-word n-grams
repeatedly across a whole document; heavily template-driven generation
(including many AI outputs, which favor certain connective phrasings)
tends to concentrate more of its n-gram mass on a small repeated set.
This is a real, self-contained, computable signal -- described here as
"n-gram concentration", not mislabeled as "matches known AI training
distribution", which is a claim this module cannot actually support.

Punctuation & Formatting Fingerprint (item 6) is fully implementable
without any external reference -- it's entirely about internal
consistency/habits within the document itself, which is exactly what
the spec's own prose describes (Oxford comma usage, dash style,
quotation style, paragraph-length distribution).
"""

import logging
import re
from collections import Counter
from typing import Any, Dict, List

import numpy as np

logger = logging.getLogger(__name__)

MIN_WORDS = 40


def _safe_result(score: float, confidence: float, **kwargs) -> Dict[str, Any]:
    out = {"score": round(float(np.clip(score, 0.0, 1.0)), 4), "confidence": round(float(confidence), 4)}
    out.update(kwargs)
    return out


def _empty(reason: str) -> Dict[str, Any]:
    return {"score": 0.5, "confidence": 0.0, "details": {"reason": reason}}


# ─────────────────────────────────────────────────────────────────────────────
# Sub-module 3.2 item 5 — N-Gram Fingerprinting (internal diversity/concentration)
# ─────────────────────────────────────────────────────────────────────────────

def _ngrams(seq: List[str], n: int) -> List[tuple]:
    return [tuple(seq[i:i + n]) for i in range(len(seq) - n + 1)]


def _concentration(counts: Counter, total: int, top_k: int = 5) -> float:
    """Fraction of total n-gram occurrences accounted for by the top_k
    most frequent n-grams -- a simple concentration/repetition proxy."""
    if total <= 0 or not counts:
        return 0.0
    top = sum(c for _, c in counts.most_common(top_k))
    return top / total


def ngram_fingerprint(text: str, words: List[str]) -> Dict[str, Any]:
    try:
        if len(words) < MIN_WORDS:
            return _empty("too_few_words")

        lower_words = [w.lower() for w in words]

        word_bigrams = _ngrams(lower_words, 2)
        word_trigrams = _ngrams(lower_words, 3)
        bigram_counts = Counter(word_bigrams)
        trigram_counts = Counter(word_trigrams)

        bigram_diversity = len(bigram_counts) / len(word_bigrams) if word_bigrams else 1.0
        trigram_diversity = len(trigram_counts) / len(word_trigrams) if word_trigrams else 1.0
        bigram_concentration = _concentration(bigram_counts, len(word_bigrams))
        trigram_concentration = _concentration(trigram_counts, len(word_trigrams))

        # Character n-grams (n=3), lower-cased, whitespace-collapsed --
        # catches sub-word repetition patterns word-level n-grams miss.
        chars = re.sub(r"\s+", " ", text.lower())
        char_trigrams = _ngrams(list(chars), 3)
        char_trigram_counts = Counter(char_trigrams)
        char_trigram_diversity = (
            len(char_trigram_counts) / len(char_trigrams) if char_trigrams else 1.0
        )

        # Natural connected prose of this length typically keeps bigram/
        # trigram diversity reasonably high (few EXACT multi-word repeats
        # outside genuinely common short phrases) -- uncalibrated
        # heuristic bands, same caveat as the rest of this file. High
        # concentration on a handful of repeated bigrams/trigrams is the
        # primary suspicious signal (template-like phrase reuse).
        bigram_score = float(np.clip((bigram_concentration - 0.06) / 0.18, 0.0, 1.0))
        trigram_score = float(np.clip((trigram_concentration - 0.03) / 0.12, 0.0, 1.0))
        char_score = float(np.clip((0.55 - char_trigram_diversity) / 0.25, 0.0, 1.0)) if char_trigram_diversity < 0.55 else 0.0

        score = float(0.4 * bigram_score + 0.4 * trigram_score + 0.2 * char_score)
        confidence = min(0.6, 0.25 + len(lower_words) / 700)

        return _safe_result(
            score, confidence,
            bigram_diversity=round(bigram_diversity, 4),
            trigram_diversity=round(trigram_diversity, 4),
            bigram_concentration_top5=round(bigram_concentration, 4),
            trigram_concentration_top5=round(trigram_concentration, 4),
            char_trigram_diversity=round(char_trigram_diversity, 4),
            details={
                "note": "Internal n-gram diversity/concentration only -- NOT a comparison "
                        "against a reference human or AI training-data n-gram distribution "
                        "(no such reference corpus exists in this repo; see module docstring).",
                "top_bigrams": [" ".join(g) for g, _ in bigram_counts.most_common(3)],
                "top_trigrams": [" ".join(g) for g, _ in trigram_counts.most_common(3)],
            },
        )
    except Exception as e:
        logger.error("[NgramPunctuationFingerprint] ngram_fingerprint failed: %s", e, exc_info=True)
        return _empty(f"unexpected_error: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Sub-module 3.2 item 6 — Punctuation & Formatting Fingerprint
# ─────────────────────────────────────────────────────────────────────────────

_OXFORD_LIST_RE = re.compile(r"\b\w+(?:,\s*\w+(?:\s+\w+)?){1,},\s+and\s+\w+")
_NON_OXFORD_LIST_RE = re.compile(r"\b\w+(?:,\s*\w+(?:\s+\w+)?){1,}\s+and\s+\w+(?!,)")


def punctuation_formatting_fingerprint(text: str) -> Dict[str, Any]:
    """
    Internal-consistency check on dash style, quotation-mark style,
    Oxford-comma usage, and paragraph-length distribution. All of these
    are checkable purely from the document's own habits -- no external
    reference needed. Mixed/inconsistent usage within a single document
    (e.g. both em-dash and a lone hyphen-as-dash, or both straight and
    curly quotes) is itself informative: human writers are usually
    locally consistent within one piece; text assembled or edited by
    multiple tools/passes (including AI-plus-human-editing) more often
    mixes conventions.
    """
    try:
        if len(text.strip()) < 200:
            return _empty("too_short")

        em_dash_count = text.count("\u2014")
        en_dash_count = text.count("\u2013")
        hyphen_as_dash_count = len(re.findall(r"\s-\s", text))  # " - " used as a dash, not a hyphenated word

        dash_total = em_dash_count + en_dash_count + hyphen_as_dash_count
        dash_styles_used = sum(1 for c in (em_dash_count, en_dash_count, hyphen_as_dash_count) if c > 0)

        curly_quotes = len(re.findall(r"[\u2018\u2019\u201c\u201d]", text))
        straight_quotes = len(re.findall(r"['\"]", text))
        quote_styles_used = sum(1 for c in (curly_quotes, straight_quotes) if c > 0)

        oxford_matches = len(_OXFORD_LIST_RE.findall(text))
        non_oxford_matches = len(_NON_OXFORD_LIST_RE.findall(text)) - oxford_matches
        non_oxford_matches = max(0, non_oxford_matches)
        total_lists = oxford_matches + non_oxford_matches

        paragraphs = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
        para_lengths = [len(p.split()) for p in paragraphs]

        # Dash-style mixing: using 2+ distinct dash conventions in one
        # document is a mild inconsistency signal (only meaningful once
        # there's enough dash usage at all to judge).
        dash_mix_score = 0.0
        if dash_total >= 3 and dash_styles_used >= 2:
            dash_mix_score = 0.5

        # Quote-style mixing: same idea for curly vs straight quotes.
        quote_mix_score = 0.0
        if (curly_quotes + straight_quotes) >= 4 and quote_styles_used == 2:
            quote_mix_score = 0.4

        # Oxford comma consistency: within one document, an author is
        # usually consistent one way or the other. Using BOTH styles
        # with meaningful frequency of each is the inconsistency signal
        # (not which style is used -- that's a stylistic choice, not a
        # tell on its own).
        oxford_consistency_score = 0.0
        if total_lists >= 4:
            minority_ratio = min(oxford_matches, non_oxford_matches) / total_lists
            oxford_consistency_score = float(np.clip((minority_ratio - 0.15) / 0.35, 0.0, 1.0)) * 0.5

        # Paragraph length uniformity: real writing's paragraph lengths
        # vary meaningfully (topic shifts, emphasis via short
        # paragraphs); suspiciously uniform paragraph length (low CoV)
        # is a template-like tell, same directional logic as
        # text_engine.py's existing sentence-level burstiness check but
        # at the paragraph level (distinct granularity, not a duplicate).
        para_score = 0.0
        para_available = len(para_lengths) >= 4
        para_cov = None
        if para_available:
            mean_len = float(np.mean(para_lengths))
            para_cov = float(np.std(para_lengths) / mean_len) if mean_len > 0 else 0.0
            LOW_COV = 0.2
            para_score = 1.0 if para_cov < LOW_COV else float(np.clip(1.0 - (para_cov - LOW_COV) / 0.5, 0.0, 1.0))

        components = [dash_mix_score, quote_mix_score, oxford_consistency_score]
        weights = [0.3, 0.25, 0.25]
        if para_available:
            components.append(para_score)
            weights.append(0.3)
        # renormalize
        weights = np.array(weights)
        score = float(np.dot(components, weights) / weights.sum())

        confidence = 0.35 if para_available else 0.2

        return _safe_result(
            score, confidence,
            em_dash_count=em_dash_count,
            en_dash_count=en_dash_count,
            hyphen_as_dash_count=hyphen_as_dash_count,
            dash_styles_used=dash_styles_used,
            curly_quote_count=curly_quotes,
            straight_quote_count=straight_quotes,
            oxford_comma_lists=oxford_matches,
            non_oxford_comma_lists=non_oxford_matches,
            paragraph_count=len(paragraphs),
            paragraph_length_cov=round(para_cov, 4) if para_cov is not None else None,
            details={
                "note": "Internal consistency/habit fingerprint only -- not compared "
                        "against a known-author reference profile (none available).",
            },
        )
    except Exception as e:
        logger.error("[NgramPunctuationFingerprint] punctuation_formatting_fingerprint failed: %s", e, exc_info=True)
        return _empty(f"unexpected_error: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

def run_all(text: str, words: List[str]) -> Dict[str, Dict[str, Any]]:
    return {
        "ngram_fingerprint": ngram_fingerprint(text, words),
        "punctuation_formatting_fingerprint": punctuation_formatting_fingerprint(text),
    }

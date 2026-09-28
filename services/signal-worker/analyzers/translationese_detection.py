"""
Aiscern Detection Worker — Translationese / Back-Translation Detection
(MODULE 25)
Giant-Level Optimization Spec, Section 3.4 item 2's back-translation
sub-bullet: "Detect text that has been translated to another language
and back to obfuscate plagiarism."

Audit note: checked engines/plagiarism_engine.py in full before writing
anything -- it's already well beyond the spec's stale "basic difflib"
description (internal duplication, paraphrase-resistant shingling,
SimHash, citation density, all already implemented and documented with
their own honest limitations). None of it targets translation artifacts
specifically; this module is additive.

Honest scope note: the spec's main paraphrase-detection ask (Sentence-
BERT semantic similarity) and the cross-language ask (LaBSE/LASER
multilingual embeddings) both need a fetchable sentence-embedding model,
which is not in requirements.txt and -- like Module 19a/19b's ECAPA-TDNN
-- would need network access to huggingface.co to fetch and smoke-test,
unavailable in this sandbox. NOT attempted here; flagged as a separate
open item alongside Module 19b's speaker-embedding gap.

What IS implemented: round-trip machine translation ("back-translation")
leaves real, well-documented lexical/stylistic artifacts even without
any embedding model -- this is the linguistics concept of "translationese".
Round-tripping text through MT tends to:
  - flatten contractions (produces "do not" far more than "don't",
    even in otherwise casual-register text)
  - drop idioms and phrasal verbs almost entirely (idioms rarely survive
    round-trip translation intact; "figure out" becomes "determine",
    "look into" becomes "investigate")
  - over-use a specific set of formal connective phrases relative to
    their more natural equivalents ("in addition to this" vs "also",
    "for the purpose of" vs "for", "due to the fact that" vs "because")
  - occasionally produce "calque" collocations -- literal word-for-word
    equivalents that are slightly off from natural English collocation
    (e.g. "make a mistake" is natural; "do a mistake" / "make an error
    of judgement" patterns are common MT-artifact substitutes)

None of these is proof of back-translation on its own (a genuinely
formal register human writer could trip several by legitimate style),
which is why this is scored as a soft signal with an explicit note, the
same honesty pattern as every other heuristic range in this codebase.
KNOWN CONFOUND, stated plainly rather than hidden: several of these
formal-register markers overlap with what text_engine.py's
ai_phrase_fingerprint targets for LLM-generated text, because LLM
training data and MT training data both skew toward the same formal,
edited-prose register. This module cannot and does not claim to
distinguish "translated" from "AI-generated formal register" -- both
produce the same surface artifacts. It is offered as one input among
several, not a standalone verdict.
"""

import logging
import re
from typing import Any, Dict, List

import numpy as np

logger = logging.getLogger(__name__)

MIN_WORDS = 60

# A representative (not exhaustive) sample of common English idioms and
# phrasal verbs -- round-trip MT tends to replace these with more
# literal single-word equivalents almost across the board.
_IDIOMS_PHRASAL_VERBS = [
    "figure out", "look into", "come up with", "run into", "put off",
    "give up", "get away with", "look forward to", "on the fence",
    "cut corners", "under the weather", "hit the nail on the head",
    "back to square one", "let the cat out of the bag", "piece of cake",
    "break the ice", "bite the bullet", "call it a day", "in the loop",
    "keep an eye on", "make ends meet", "come across", "point out",
    "bring up", "carry out", "turn out", "work out", "find out",
    "set up", "sort out", "take over", "look up", "check out",
]

# Curated formal-connective / natural-equivalent pairs. The FORMAL member
# is the one over-represented in translationese; the NATURAL member is
# the more common equivalent in ordinary English prose. Distinct from
# text_engine.py's ai_phrase_fingerprint lexicon (different word/phrase
# set, different purpose) -- see module docstring for the honest overlap
# caveat regardless.
_FORMAL_NATURAL_PAIRS = [
    ("in addition to this", "also"),
    ("for the purpose of", "for"),
    ("due to the fact that", "because"),
    ("in the event that", "if"),
    ("with regard to", "about"),
    ("in order to", "to"),
    ("on the other hand,", "but"),
    ("it should be noted that", ""),
    ("in the majority of cases", "usually"),
]

# Small curated "calque" collocation anomalies: a slightly-off literal
# construction vs. the natural English collocation it commonly replaces
# in round-trip-translated text.
_CALQUE_PATTERNS = [
    (re.compile(r"\bdo (?:a|an) mistake\b", re.I), "make a mistake"),
    (re.compile(r"\bmake (?:a|an) research\b", re.I), "do research / conduct research"),
    (re.compile(r"\bgive (?:a|an) call\b", re.I), "make a call"),
    (re.compile(r"\bdo (?:a|an) party\b", re.I), "have/throw a party"),
]


def _empty(reason: str) -> Dict[str, Any]:
    return {"score": 0.5, "confidence": 0.0, "details": {"reason": reason}}


def _safe_result(score: float, confidence: float, **kwargs) -> Dict[str, Any]:
    out = {"score": round(float(np.clip(score, 0.0, 1.0)), 4), "confidence": round(float(confidence), 4)}
    out.update(kwargs)
    return out


def detect_translationese(text: str) -> Dict[str, Any]:
    try:
        words = re.findall(r"[a-zA-Z']+", text)
        if len(words) < MIN_WORDS:
            return _empty("too_few_words")

        lower = text.lower()
        word_count = len(words)

        contraction_count = len(re.findall(r"\b\w+'(?:t|re|ve|ll|d|s|m)\b", lower))
        contraction_rate_per_1k = (contraction_count / word_count) * 1000

        idiom_hits = sum(lower.count(p) for p in _IDIOMS_PHRASAL_VERBS)
        idiom_density_per_1k = (idiom_hits / word_count) * 1000

        formal_hits = 0
        natural_hits = 0
        for formal, natural in _FORMAL_NATURAL_PAIRS:
            formal_hits += lower.count(formal)
            if natural:
                natural_hits += len(re.findall(r"\b" + re.escape(natural) + r"\b", lower))

        calque_hits = sum(len(pat.findall(text)) for pat, _ in _CALQUE_PATTERNS)

        # Contraction rate: near-zero contractions in text long enough to
        # plausibly use them at all (>150 words) is mildly suspicious,
        # but ONLY a soft signal -- plenty of legitimate formal human
        # writing (academic papers, legal text) also has near-zero
        # contractions. Weighted low accordingly.
        contraction_score = 0.0
        if word_count >= 150:
            contraction_score = 1.0 if contraction_rate_per_1k < 1.0 else float(
                np.clip((3.0 - contraction_rate_per_1k) / 3.0, 0.0, 1.0)
            )

        # Idiom/phrasal-verb density: near-total absence over a
        # reasonably long sample is the more distinctive translationese
        # tell (natural English writers use SOME idiomatic phrasing even
        # in formal registers; MT round-trip strips almost all of it).
        idiom_score = 0.0
        if word_count >= 200:
            idiom_score = 1.0 if idiom_density_per_1k == 0 else float(
                np.clip((1.5 - idiom_density_per_1k) / 1.5, 0.0, 1.0)
            )

        # Formal-connective over-representation relative to their natural
        # equivalents, when both have enough occurrences to compare.
        formal_natural_score = 0.0
        if formal_hits + natural_hits >= 3:
            formal_ratio = formal_hits / (formal_hits + natural_hits)
            formal_natural_score = float(np.clip((formal_ratio - 0.3) / 0.5, 0.0, 1.0))

        # Calque hits: rare, curated, high-precision-when-it-fires but
        # low-recall (only a handful of patterns) -- any hit at all is
        # worth a meaningful bump, but this alone never dominates the
        # score given how narrow the pattern list is.
        calque_score = float(np.clip(calque_hits / 3.0, 0.0, 1.0))

        components = [
            (contraction_score, 0.9),
            (idiom_score, 1.3),
            (formal_natural_score, 1.0),
            (calque_score, 0.8),
        ]
        total_w = sum(w for _, w in components)
        score = float(sum(s * w for s, w in components) / total_w)
        confidence = min(0.4, 0.15 + word_count / 1500)   # capped low -- see module docstring's confound note

        return _safe_result(
            score, confidence,
            contraction_rate_per_1000_words=round(contraction_rate_per_1k, 3),
            idiom_phrasal_verb_density_per_1000_words=round(idiom_density_per_1k, 3),
            formal_connective_hits=formal_hits,
            natural_connective_hits=natural_hits,
            calque_pattern_hits=calque_hits,
            details={
                "word_count": word_count,
                "note": "Soft, confound-prone signal -- formal register overlaps with "
                        "LLM-generated text's own register (see module docstring). Not "
                        "proof of translation on its own.",
            },
        )
    except Exception as e:
        logger.error("[TranslationeseDetection] detect_translationese failed: %s", e, exc_info=True)
        return _empty(f"unexpected_error: {e}")


def run_all(text: str) -> Dict[str, Dict[str, Any]]:
    return {"translationese_detection": detect_translationese(text)}

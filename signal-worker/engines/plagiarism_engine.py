"""
Plagiarism / originality analysis engine — VerifyDoc.

This is a self-contained, offline plagiarism-*risk* signal. It does NOT crawl
the web (no external search API is wired in), so it cannot claim "this exact
sentence appears on example.com". What it CAN do reliably, with zero external
dependencies or API keys, is flag the patterns that correlate strongly with
copy-pasted / lightly-reworded academic and web content:

  1. Internal duplication      — repeated blocks within the same document
                                   (a common tell for copy-paste-patchwork
                                   plagiarism / mosaic plagiarism).
  2. N-gram fingerprint density — unusually low lexical diversity in long
                                   shingles, which tends to appear in text
                                   stitched together from a small number of
                                   sources.
  3. Boilerplate / stock-phrase matching — a curated set of extremely common
                                   textbook/essay-mill openers and transition
                                   clichés that show up disproportionately in
                                   unoriginal writing.
  4. Citation-density check     — near-zero citation markers in a
                                   long-form academic-style document is itself
                                   a soft originality-risk signal (either
                                   totally original or unreferenced source use).

If/when a real web-crawl plagiarism check (Copyscape/Turnitin-style) is wired
in later, that should become a 5th, much more heavily-weighted, signal here.
"""

from __future__ import annotations

import hashlib
import re
from collections import Counter
from typing import Any, Dict, List, Tuple

SHINGLE_SIZE = 8            # words per shingle for fingerprinting
MIN_TEXT_LEN = 200          # below this, plagiarism scoring is unreliable

_BOILERPLATE_PHRASES = [
    "in today's society", "since the dawn of time", "in this essay i will",
    "throughout history", "it is important to note that", "in conclusion,",
    "in the world we live in today", "as we can see", "little did they know",
    "in a nutshell", "last but not least", "needless to say",
    "it goes without saying", "at the end of the day", "when all is said and done",
]

_CITATION_PATTERNS = [
    re.compile(r"\(([A-Z][a-zA-Z\-]+,?\s+\d{4})\)"),   # (Smith, 2020)
    re.compile(r"\[\d+\]"),                             # [12]
    re.compile(r"[A-Z][a-zA-Z\-]+ et al\.?,?\s+\d{4}"), # Smith et al. 2020
]


def _normalize(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _shingles(words: List[str], size: int) -> List[str]:
    if len(words) < size:
        return []
    return [" ".join(words[i:i + size]) for i in range(len(words) - size + 1)]


def _internal_duplication(norm_text: str) -> Tuple[float, List[str]]:
    """Fraction of shingles that recur elsewhere in the same document,
    plus a few example duplicated snippets for the UI."""
    words = norm_text.split()
    shingles = _shingles(words, SHINGLE_SIZE)
    if not shingles:
        return 0.0, []

    counts = Counter(shingles)
    dup_shingles = [s for s, c in counts.items() if c > 1]
    dup_ratio = len(dup_shingles) / max(len(shingles), 1)

    examples = sorted(dup_shingles, key=lambda s: -counts[s])[:3]
    return round(dup_ratio, 4), examples


def _fingerprint_density(norm_text: str) -> float:
    """Ratio of unique shingles to total shingles — low value = repetitive /
    low lexical diversity, a soft originality-risk signal on its own."""
    words = norm_text.split()
    shingles = _shingles(words, SHINGLE_SIZE)
    if not shingles:
        return 1.0
    unique_ratio = len(set(shingles)) / len(shingles)
    return round(unique_ratio, 4)


def _boilerplate_hits(raw_text_lower: str) -> List[str]:
    return [p for p in _BOILERPLATE_PHRASES if p in raw_text_lower]


def _citation_density(text: str) -> float:
    """Citations per 1000 words."""
    word_count = max(len(text.split()), 1)
    hits = 0
    for pat in _CITATION_PATTERNS:
        hits += len(pat.findall(text))
    return round((hits / word_count) * 1000, 3)


def document_fingerprint(text: str) -> str:
    """Stable content fingerprint — useful for de-duplicating repeat scans
    of the exact same document across the platform."""
    return hashlib.sha256(_normalize(text).encode("utf-8")).hexdigest()


def analyze_plagiarism_risk(text: str) -> Dict[str, Any]:
    """
    Returns an offline plagiarism-*risk* assessment. `risk_score` is 0-100,
    where higher = more of the patterns associated with unoriginal / stitched
    content are present. This is a *signal*, not proof — always surfaced to
    the user as "originality risk indicators", never as a plagiarism
    accusation.
    """
    if not text or len(text.strip()) < MIN_TEXT_LEN:
        return {
            "status": "insufficient_text",
            "risk_score": 0,
            "risk_level": "UNKNOWN",
            "signals": {},
            "summary": "Not enough text to assess originality risk (minimum ~200 characters).",
        }

    norm = _normalize(text)
    dup_ratio, dup_examples = _internal_duplication(norm)
    diversity = _fingerprint_density(norm)
    boilerplate = _boilerplate_hits(text.lower())
    citation_density = _citation_density(text)
    word_count = len(text.split())

    # Weighted composite (tuned to be conservative — internal duplication is
    # the strongest and most reliable of these offline signals).
    score = 0.0
    score += min(dup_ratio * 140, 55)                      # up to 55 pts
    score += min((1 - diversity) * 60, 25)                  # up to 25 pts
    score += min(len(boilerplate) * 4, 12)                  # up to 12 pts
    if word_count > 600 and citation_density == 0:
        score += 8                                          # up to 8 pts
    score = round(min(score, 100), 1)

    risk_level = (
        "LOW" if score < 25 else
        "MODERATE" if score < 55 else
        "HIGH"
    )

    summary = {
        "LOW":      f"No significant originality-risk patterns detected ({score}/100).",
        "MODERATE": f"Some patterns associated with unoriginal or stitched content were found ({score}/100). Worth a manual look.",
        "HIGH":     f"Multiple strong originality-risk indicators found ({score}/100), including repeated passages within the document.",
    }[risk_level]

    return {
        "status": "ok",
        "risk_score": score,
        "risk_level": risk_level,
        "signals": {
            "internal_duplication_ratio": dup_ratio,
            "duplicated_snippet_examples": dup_examples,
            "lexical_diversity": diversity,
            "boilerplate_phrases_found": boilerplate,
            "citation_density_per_1000_words": citation_density,
            "word_count": word_count,
        },
        "summary": summary,
        "note": "Offline heuristic signal only — does not check against external web sources.",
    }

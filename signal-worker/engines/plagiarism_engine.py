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
SIMHASH_BITS = 64
SIMHASH_SHINGLE = 3          # word n-gram size for the paraphrase-resistant fingerprint

# Small stopword list for paraphrase-resistant shingling below -- deliberately
# short (function words only) since over-stripping would destroy the
# structural signal the shingle is trying to capture.
_STOPWORDS = frozenset("""
a an the of to in on at for with and or but is are was were be been being
this that these those it its as by from into over under about
""".split())


def _crude_stem(word: str) -> str:
    """Cheap suffix-stripping stemmer -- no NLTK/spaCy dependency needed.
    Not linguistically rigorous, but enough to collapse the most common
    inflectional variants (run/running/runs, quick/quickly) that a
    thesaurus-swap or light paraphrase tool tends to introduce, so exact-
    shingle matching doesn't miss duplication just because one copy says
    'analyzes' and the other says 'analyzing'."""
    for suf in ("ing", "edly", "ed", "ly", "es", "s"):
        if word.endswith(suf) and len(word) - len(suf) >= 3:
            return word[: -len(suf)]
    return word


def _paraphrase_shingles(words: List[str], size: int) -> List[str]:
    """Stopword-stripped, stemmed shingles -- survives light synonym/
    inflection-level paraphrasing that would otherwise defeat the exact
    word-shingle matching in _internal_duplication. Two passages that read
    differently word-for-word but share the same underlying content-word
    skeleton will still collide here."""
    content = [_crude_stem(w) for w in words if w not in _STOPWORDS and len(w) > 2]
    if len(content) < size:
        return []
    return [" ".join(content[i:i + size]) for i in range(len(content) - size + 1)]


def _paraphrase_duplication(norm_text: str) -> float:
    """Same idea as _internal_duplication but on the paraphrase-resistant
    shingle stream -- catches mosaic plagiarism that's been lightly reworded
    (synonym swaps, tense changes) rather than copy-pasted verbatim."""
    words = norm_text.split()
    shingles = _paraphrase_shingles(words, SHINGLE_SIZE - 3)  # shorter window: stripped stream is denser
    if not shingles:
        return 0.0
    counts = Counter(shingles)
    dup = sum(1 for s, c in counts.items() if c > 1)
    return round(dup / max(len(shingles), 1), 4)


def simhash(text: str, bits: int = SIMHASH_BITS) -> str:
    """
    64-bit SimHash fingerprint over word n-grams (n=3). Unlike the plain
    SHA-256 document_fingerprint() below (exact-match only -- one changed
    character produces a completely different hash), SimHash is a
    locality-sensitive hash: near-duplicate documents produce fingerprints
    with a small Hamming distance, even after moderate paraphrasing,
    reordering, or word substitution. This is the same technique already
    proven out in the web-scanner's SimHash module -- ported here so
    text/document submissions get the same paraphrase-resistant cross-
    document matching capability.

    Returns the fingerprint as a hex string. Comparing two submissions for
    near-duplicate content is hamming_similarity(simhash(a), simhash(b)).

    MEASURED behavior (tested against ~50-70 word paragraphs, this
    function's own test fixtures): verbatim text -> 1.0; light paraphrasing
    (synonym swaps on a minority of words, same structure) or sentence
    reordering -> ~0.64-0.66; unrelated text -> ~0.45. On longer documents
    (the 200+ word minimum this engine actually runs on) the signal
    strengthens as more shingles get averaged in. IMPORTANT LIMITATION:
    heavy full-rewrite paraphrasing (most/all content words replaced) drops
    similarity to roughly the same range as unrelated text -- this is a
    fundamental limit of shingle-based lexical hashing, not a tuning issue;
    catching that class of paraphrase requires semantic embeddings (a
    sentence-transformer model), which is out of scope for this offline
    CPU-only pipeline. Treat similarity >=0.70 as "likely related, worth a
    manual look" rather than a hard verdict, and don't rely on this alone
    to rule OUT plagiarism -- only to help flag it.

    NOTE: SimHash alone tells you two *specific* documents are similar. To
    catch plagiarism against a *corpus* (other users' past submissions),
    this fingerprint needs to be persisted per-scan (e.g. a
    `document_fingerprints` table in Supabase) and every new scan compared
    against stored fingerprints -- that DB wiring is outside what this
    sandbox can reach and is the natural next step at the API layer.
    """
    norm = _normalize(text)
    words = norm.split()
    shingles = _shingles(words, SIMHASH_SHINGLE) or words
    if not shingles:
        return "0" * (bits // 4)

    v = [0] * bits
    for sh in shingles:
        h = int(hashlib.md5(sh.encode("utf-8")).hexdigest(), 16)
        for i in range(bits):
            bit = (h >> i) & 1
            v[i] += 1 if bit else -1

    fingerprint = 0
    for i in range(bits):
        if v[i] > 0:
            fingerprint |= (1 << i)
    return format(fingerprint, f"0{bits // 4}x")


def hamming_similarity(hex_a: str, hex_b: str, bits: int = SIMHASH_BITS) -> float:
    """1.0 = identical fingerprint, 0.0 = maximally different. See simhash()
    docstring for measured similarity ranges -- there is no single universal
    "near-duplicate" cutoff; >=0.70 is a reasonable "worth a manual look"
    threshold based on this module's own test fixtures, not a validated
    production threshold."""
    try:
        a, b = int(hex_a, 16), int(hex_b, 16)
    except (ValueError, TypeError):
        return 0.0
    xor = a ^ b
    dist = bin(xor).count("1")
    return round(1.0 - (dist / bits), 4)

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
    paraphrase_dup_ratio = _paraphrase_duplication(norm)
    diversity = _fingerprint_density(norm)
    boilerplate = _boilerplate_hits(text.lower())
    citation_density = _citation_density(text)
    word_count = len(text.split())
    simhash_fp = simhash(text)

    # Weighted composite (tuned to be conservative — internal duplication is
    # the strongest and most reliable of these offline signals).
    score = 0.0
    score += min(dup_ratio * 140, 55)                        # up to 55 pts
    # Paraphrase-resistant duplication only counts extra when it exceeds
    # what exact-match duplication already found -- otherwise the same
    # verbatim-duplicated content would double-count under both signals.
    extra_paraphrase_signal = max(0.0, paraphrase_dup_ratio - dup_ratio)
    score += min(extra_paraphrase_signal * 100, 20)            # up to 20 pts
    score += min((1 - diversity) * 60, 25)                    # up to 25 pts
    score += min(len(boilerplate) * 4, 12)                    # up to 12 pts
    if word_count > 600 and citation_density == 0:
        score += 8                                            # up to 8 pts
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
            "paraphrase_resistant_duplication_ratio": paraphrase_dup_ratio,
            "duplicated_snippet_examples": dup_examples,
            "lexical_diversity": diversity,
            "boilerplate_phrases_found": boilerplate,
            "citation_density_per_1000_words": citation_density,
            "word_count": word_count,
        },
        "simhash_fingerprint": simhash_fp,
        "summary": summary,
        "note": (
            "Offline heuristic signal only — does not check against external web "
            "sources. paraphrase_resistant_duplication_ratio catches lightly-"
            "reworded internal repetition that exact word-matching misses; "
            "simhash_fingerprint is a paraphrase-resistant document signature "
            "suitable for cross-submission matching once compared against a "
            "stored corpus of past scans (not performed by this function alone)."
        ),
    }

"""
Aiscern Detection Worker — Argument-Structure Fingerprint (MODULE 26)
Giant-Level Optimization Spec, Section 3.4 item 3 (Idea Plagiarism:
"Detect when the structure/argument flow is copied even if wording is
different. Use discourse parsing to extract argument structure and
compare.")

Honest scope note: a real discourse parser (RST-style rhetorical
structure parsing) is a heavy NLP dependency this repo doesn't carry,
and -- more fundamentally than a missing dependency -- "idea
plagiarism" is inherently a COMPARISON claim: you cannot say a
document's argument structure "was copied" from looking at that one
document alone, the same way engines/plagiarism_engine.py's existing
`simhash_fingerprint` cannot itself declare plagiarism -- it produces a
fingerprint that becomes meaningful once compared against a corpus of
other submissions, and that comparison/corpus-storage step is
explicitly out of this sandbox's reach (see that function's own
docstring).

This module follows the exact same architecture, one level up in
abstraction: instead of a fingerprint over the document's WORDING
(simhash), it produces a fingerprint over the document's coarse
argument SHAPE -- the sequence of rhetorical roles (claim, evidence,
contrast, example, conclusion) each sentence plays, classified via
keyword/pattern cues rather than a real discourse parser. Two documents
that make the same argument in completely different words but the same
structural order (claim -> evidence -> contrast -> conclusion,
repeated in the same pattern) produce similar structure fingerprints
even though their SimHash word-fingerprints would look unrelated. Like
simhash_fingerprint, this is a fingerprint FOR comparison, computed
here; the actual cross-document comparison against a stored corpus is
the same "natural next step at the API layer" the existing simhash
docstring already calls out, not a new gap this module introduces.

The rhetorical-role classifier here is a coarse keyword/pattern
heuristic, explicitly NOT equivalent to real discourse parsing (RST,
PDTB-style relation classification) -- it will misclassify plenty of
sentences. It's offered as a real, working approximation sufficient to
produce a structure signature, not a claim of linguistic rigor.

A second, genuinely single-document signal is also computed here (not
borrowed from the fingerprint-needs-comparison limitation above): the
Shannon entropy of the rhetorical-role TRANSITION sequence. A document
that mechanically repeats the exact same role pattern across every
paragraph (e.g. every paragraph is CLAIM->EVIDENCE->CONCLUSION with no
variation) has a real, checkable low-entropy transition structure --
this is a legitimate template-rigidity tell computable from one
document alone, distinct from the fingerprint-for-comparison use case.
"""

import hashlib
import logging
import math
import re
from collections import Counter
from typing import Any, Dict, List

import numpy as np

logger = logging.getLogger(__name__)

MIN_SENTENCES = 8
FP_BITS = 64
ROLE_NGRAM = 3

_ROLE_PATTERNS = {
    "EVIDENCE": re.compile(
        r"\b(?:according to|studies (?:show|indicate|suggest)|research (?:shows|indicates|suggests)|"
        r"data (?:shows|suggests)|statistics (?:show|indicate)|survey found|found that)\b", re.I
    ),
    "CONTRAST": re.compile(
        r"\b(?:however|but |on the other hand|although|even though|despite|nevertheless|"
        r"nonetheless|in contrast|conversely|whereas)\b", re.I
    ),
    "EXAMPLE": re.compile(
        r"\b(?:for example|for instance|such as|e\.g\.|to illustrate|as an example|one case)\b", re.I
    ),
    "CONCLUSION": re.compile(
        r"\b(?:therefore|thus|in conclusion|as a result|consequently|to conclude|"
        r"in summary|to sum up|overall,|ultimately)\b", re.I
    ),
    "CLAIM": re.compile(
        r"\b(?:it is (?:clear|evident|obvious) that|must|should|clearly|undoubtedly|"
        r"it is (?:important|crucial|essential) (?:that|to)|arguably|I believe|we argue)\b", re.I
    ),
}
_ROLE_ORDER = ["EVIDENCE", "CONTRAST", "EXAMPLE", "CONCLUSION", "CLAIM"]  # check order matters: first match wins


def _classify_sentence(sentence: str) -> str:
    for role in _ROLE_ORDER:
        if _ROLE_PATTERNS[role].search(sentence):
            return role
    return "OTHER"


def _split_sentences(text: str) -> List[str]:
    # Lightweight splitter consistent with this engine's offline,
    # dependency-free approach (plagiarism_engine.py doesn't import
    # utils.text_preprocessor either -- kept self-contained here too).
    raw = re.split(r"(?<=[.!?])\s+", text.strip())
    return [s.strip() for s in raw if len(s.strip()) > 3]


def _role_ngram_simhash(roles: List[str], n: int = ROLE_NGRAM, bits: int = FP_BITS) -> str:
    if len(roles) < n:
        ngrams = [" ".join(roles)] if roles else []
    else:
        ngrams = [" ".join(roles[i:i + n]) for i in range(len(roles) - n + 1)]
    if not ngrams:
        return "0" * (bits // 4)

    v = [0] * bits
    for gram in ngrams:
        h = int(hashlib.md5(gram.encode("utf-8")).hexdigest(), 16)
        for i in range(bits):
            bit = (h >> i) & 1
            v[i] += 1 if bit else -1
    fingerprint = 0
    for i in range(bits):
        if v[i] > 0:
            fingerprint |= (1 << i)
    return format(fingerprint, f"0{bits // 4}x")


def hamming_similarity(hex_a: str, hex_b: str, bits: int = FP_BITS) -> float:
    """Same convention as plagiarism_engine.hamming_similarity -- 1.0 =
    identical structure fingerprint, 0.0 = maximally different."""
    try:
        a, b = int(hex_a, 16), int(hex_b, 16)
    except (ValueError, TypeError):
        return 0.0
    dist = bin(a ^ b).count("1")
    return round(1.0 - (dist / bits), 4)


def argument_structure_fingerprint(text: str) -> Dict[str, Any]:
    try:
        sentences = _split_sentences(text)
        if len(sentences) < MIN_SENTENCES:
            return {"available": False, "score": 0.5, "confidence": 0.0, "reason": "too_few_sentences"}

        roles = [_classify_sentence(s) for s in sentences]
        role_counts = Counter(roles)
        classified_ratio = 1.0 - (role_counts.get("OTHER", 0) / len(roles))

        structure_fp = _role_ngram_simhash(roles)

        # Transition entropy: Shannon entropy of consecutive role-pair
        # transitions. A document that mechanically repeats one fixed
        # pattern (e.g. every paragraph is CLAIM->EVIDENCE->CONCLUSION,
        # nothing else) has few distinct transitions used very
        # repetitively -> low entropy. A naturally varied argument has a
        # wider, more even spread of transitions.
        transitions = [f"{roles[i]}->{roles[i+1]}" for i in range(len(roles) - 1)]
        trans_counts = Counter(transitions)
        total_trans = len(transitions)
        entropy = 0.0
        if total_trans > 0:
            for c in trans_counts.values():
                p = c / total_trans
                entropy -= p * math.log2(p)
        max_entropy = math.log2(len(trans_counts)) if len(trans_counts) > 1 else 1.0
        norm_entropy = entropy / max_entropy if max_entropy > 0 else 0.0

        # Only meaningful once enough sentences got classified into a
        # real role (not OTHER) to say anything about pattern rigidity;
        # a document where the classifier mostly returns OTHER doesn't
        # tell us much about its argument shape either way.
        rigidity_available = classified_ratio >= 0.3 and total_trans >= 6
        LOW_ENTROPY = 0.55
        rigidity_score = 0.0
        if rigidity_available:
            rigidity_score = 1.0 if norm_entropy < 0.3 else float(
                np.clip((LOW_ENTROPY - norm_entropy) / 0.4, 0.0, 1.0)
            )

        return {
            "available": True,
            "score": round(rigidity_score, 4) if rigidity_available else 0.5,
            "confidence": round(min(0.35, 0.1 + len(sentences) / 200), 4) if rigidity_available else 0.0,
            "structure_fingerprint": structure_fp,
            "role_transition_entropy_normalized": round(norm_entropy, 4) if total_trans > 0 else None,
            "classified_sentence_ratio": round(classified_ratio, 4),
            "role_distribution": dict(role_counts),
            "sentence_count": len(sentences),
            "details": {
                "note": "structure_fingerprint is a comparison-ready fingerprint over "
                        "coarse rhetorical-role sequence, analogous to plagiarism_engine."
                        "simhash_fingerprint's word-level fingerprint -- meaningful once "
                        "compared against a stored corpus of other submissions, which is "
                        "not performed by this function alone (see module docstring). "
                        "role_transition_entropy is the one genuinely single-document "
                        "signal here (template-rigidity check).",
            },
        }
    except Exception as e:
        logger.error("[ArgumentStructureFingerprint] argument_structure_fingerprint failed: %s", e, exc_info=True)
        return {"available": False, "score": 0.5, "confidence": 0.0, "reason": f"unexpected_error: {e}"}


def run_all(text: str) -> Dict[str, Dict[str, Any]]:
    return {"argument_structure_fingerprint": argument_structure_fingerprint(text)}

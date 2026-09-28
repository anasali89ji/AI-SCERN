"""
Aiscern Detection Worker — Near-Synonym Lexical-Choice Consistency
(MODULE 24)
Giant-Level Optimization Spec, Section 3.3 item 2 (Semantic Watermark
Detection) and the spec's own note that Claude has "no known watermark,
but [is] detectable via specific stylistic patterns."

Relationship to Module 23 and honest scope: real provider-specific
semantic/synonym watermarking schemes (if any provider uses one) are
undisclosed, same fundamental problem as Module 23's greenlist scheme --
see that module's docstring. This module does NOT attempt to detect any
specific provider's scheme. What it measures instead is a real,
self-contained, fully computable signal that doesn't depend on any
secret: how consistently the document picks ONE member of a common
near-synonym pair (e.g. "utilize" vs. "use") every time the choice
arises, across the whole document.

This is offered as a stylistic-CONSISTENCY proxy, in the same spirit as
the spec's "detectable via specific stylistic patterns" framing for
Claude -- not as evidence of a specific watermark. Rigid single-choice
consistency across many independent opportunities is a real property a
single generating process (human or AI) tends toward, versus more
natural human within-document variation (people say "use" sometimes and
"utilize" other times, even in the same piece) -- but it is a WEAK,
indirect signal and is explicitly documented as such, not oversold as a
"watermark detector."

Audit note: checked engines/text_engine.py's `_compute_ai_phrase_fingerprint`
before writing this -- that function matches a FIXED lexicon of stock
AI phrases/words (density-based). This module is structurally different:
it doesn't care which member of a pair is used, only whether usage is
internally consistent across multiple independent occurrences. A
document that never uses any of the listed words at all produces no
signal here (available: False), regardless of what
`ai_phrase_fingerprint` finds elsewhere -- these are not the same
computation and don't double-count the same evidence.
"""

import logging
import re
from typing import Any, Dict, List, Tuple

import numpy as np

logger = logging.getLogger(__name__)

MIN_TOTAL_OCCURRENCES = 6   # need several independent choices to say anything about consistency
MIN_PAIRS_WITH_DATA = 2

# Common near-synonym pairs where either member is broadly interchangeable
# in most register-neutral prose contexts (not a claim that they're
# ALWAYS interchangeable, just that both appear regularly in ordinary
# writing regardless of topic).
NEAR_SYNONYM_PAIRS: List[Tuple[str, str]] = [
    ("utilize", "use"),
    ("purchase", "buy"),
    ("commence", "start"),
    ("terminate", "end"),
    ("individuals", "people"),
    ("assist", "help"),
    ("obtain", "get"),
    ("additionally", "also"),
    ("however", "but"),
    ("demonstrate", "show"),
    ("sufficient", "enough"),
    ("approximately", "about"),
    ("regarding", "about"),
    ("prior to", "before"),
    ("subsequent to", "after"),
    ("in order to", "to"),
]


def _count(pattern: str, lower_text: str) -> int:
    return len(re.findall(r"\b" + re.escape(pattern) + r"\b", lower_text))


def near_synonym_consistency(text: str) -> Dict[str, Any]:
    try:
        lower_text = text.lower()
        pair_stats = []
        for formal, plain in NEAR_SYNONYM_PAIRS:
            c_formal = _count(formal, lower_text)
            c_plain = _count(plain, lower_text)
            total = c_formal + c_plain
            if total > 0:
                pair_stats.append((formal, plain, c_formal, c_plain, total))

        total_occurrences = sum(p[4] for p in pair_stats)
        pairs_with_data = len(pair_stats)

        if total_occurrences < MIN_TOTAL_OCCURRENCES or pairs_with_data < MIN_PAIRS_WITH_DATA:
            return {"available": False, "score": 0.5, "confidence": 0.0, "reason": "insufficient_synonym_pair_occurrences"}

        # For each pair with enough occurrences to judge (>=2 total),
        # consistency = how skewed the split is toward one member
        # (1.0 = always the same member, 0.0 = perfectly split).
        consistencies = []
        pair_details = []
        for formal, plain, c_formal, c_plain, total in pair_stats:
            if total < 2:
                continue
            dominant = max(c_formal, c_plain)
            consistency = dominant / total
            consistencies.append(consistency)
            pair_details.append({
                "pair": f"{formal}/{plain}",
                "formal_count": c_formal,
                "plain_count": c_plain,
                "consistency": round(consistency, 4),
            })

        if len(consistencies) < MIN_PAIRS_WITH_DATA:
            return {"available": False, "score": 0.5, "confidence": 0.0, "reason": "insufficient_judgeable_pairs"}

        mean_consistency = float(np.mean(consistencies))

        # Natural human writing on a topic that uses these words at all
        # typically shows SOME mixing across a whole document, especially
        # once several independent pairs are pooled -- perfect or
        # near-perfect single-choice consistency across MULTIPLE
        # independent pairs simultaneously is the more unusual pattern.
        # This is a soft, explicitly weak signal (see module docstring),
        # reflected in the low confidence cap below regardless of how
        # extreme the observed consistency is.
        LOW = 0.75
        score = 0.0 if mean_consistency < LOW else float(np.clip((mean_consistency - LOW) / 0.25, 0.0, 1.0))
        confidence = min(0.35, 0.15 + pairs_with_data * 0.03)

        return {
            "available": True,
            "score": round(score, 4),
            "confidence": round(confidence, 4),
            "mean_pair_consistency": round(mean_consistency, 4),
            "pairs_with_data": pairs_with_data,
            "total_occurrences": total_occurrences,
            "pair_details": pair_details,
            "description": "Near-synonym lexical-choice consistency -- a weak, self-"
                            "contained stylistic-consistency proxy, NOT a detector for any "
                            "specific provider's undisclosed semantic watermark scheme "
                            "(see module docstring).",
        }
    except Exception as e:
        logger.error("[NearSynonymConsistency] near_synonym_consistency failed: %s", e, exc_info=True)
        return {"available": False, "score": 0.5, "confidence": 0.0, "reason": f"unexpected_error: {e}"}


def run_all(text: str) -> Dict[str, Dict[str, Any]]:
    return {"near_synonym_consistency": near_synonym_consistency(text)}

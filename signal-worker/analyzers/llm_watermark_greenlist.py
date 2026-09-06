"""
Aiscern Detection Worker — Statistical Greenlist Watermark Detection
(MODULE 23)
Giant-Level Optimization Spec, Section 3.3 item 1 (statistical
watermark detection / greenlist z-score).

HONEST SCOPE-DOWN -- read before extending this module (per established
"audit infra before implementing, flag rather than fabricate" workflow,
same category as Module 19a's ECAPA-TDNN split, but a harder limit than
that one):

The spec asks this to detect real watermarks from OpenAI/GPT-4, Google/
Gemini SynthID, etc. Every published statistical text-watermarking
scheme (Kirchenbauer et al.'s greenlist method, which is what OpenAI is
believed to have experimented with; Google's SynthID) works by having
the GENERATING model bias its next-token sampling using a pseudo-random
partition of the vocabulary into a "green" set and a "red" set, where
that partition is reproducibly derived from a SECRET seed/key plus the
preceding token(s) via a hash function. Detecting the watermark means
recomputing that same partition and checking whether the observed text
is anomalously green-heavy.

This is fundamentally different from every prior scope-down in this
series (Module 18's missing labeled TTS corpus, Module 19a/b's missing
pretrained checkpoint or sandbox network access): those were things
that COULD be obtained or built with more infrastructure. A provider's
watermarking seed/hash function is a secret the provider has never
published, precisely because publishing it would let anyone strip the
watermark by re-sampling around it. There is no public seed to plug in
for OpenAI or Google's schemes. Absent that secret (or a verification
API the provider runs on their own infrastructure, which does not
publicly exist for this purpose either), NO implementation -- from this
repo or anyone else's -- can actually detect a real GPT-4 or Gemini
watermark from text alone. Claiming otherwise would be fabrication.

What IS implemented, honestly: the greenlist detection ALGORITHM itself
(vocabulary partitioning via a seeded hash of the previous token, and
the z-score statistic from Kirchenbauer et al., "A Watermark for Large
Language Models", 2023) is public and can be implemented and verified
correctly. This module runs it in two modes:
  - Given an explicit `seed`/`gamma` config (e.g. a research scenario,
    an internal test, or a future case where a provider discloses or
    licenses their scheme to this platform), it performs REAL detection
    against that specific scheme.
  - With no config (the default, and the only currently-possible mode
    for real-world OpenAI/Gemini/Anthropic/Llama traffic), it returns
    `available: False` with an explicit explanation, rather than
    returning a fabricated score of 0.5 that looks like a real "not
    watermarked" finding.

Section 3.3 item 2 (Semantic Watermark Detection) has the identical
problem -- provider-specific synonym-substitution watermark schemes are
equally undisclosed -- and is not attempted here for the same reason.
A related-but-distinct, fully self-contained signal (near-synonym
lexical-choice consistency, NOT tied to any specific provider's secret
scheme) is implemented separately in
analyzers/near_synonym_consistency.py (Module 24) -- see that module's
docstring for why it's a different, honestly-scoped claim.
"""

import hashlib
import logging
import math
from typing import Any, Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)

MIN_TOKENS = 40
DEFAULT_GAMMA = 0.5   # fraction of vocabulary treated as "green" in the reference scheme


def _pseudo_tokenize(text: str) -> List[str]:
    """
    Word-level pseudo-tokenization. Real provider watermarks operate on
    the provider's own subword tokenizer (e.g. OpenAI's tiktoken), which
    this repo cannot exactly reproduce for a proprietary/undisclosed
    scheme anyway -- using word-level tokens here is an explicit,
    disclosed approximation for the self-test/known-config path, not an
    attempt to match any real provider's tokenization.
    """
    return text.split()


def _is_green(prev_token: str, token: str, seed: int, gamma: float) -> bool:
    """
    Deterministic pseudo-random green/red partition: hash(seed, prev_token)
    seeds a per-position permutation of a coarse token-hash space, and a
    token is 'green' if its own hash falls in the first `gamma` fraction
    of that space. This mirrors the *shape* of Kirchenbauer et al.'s
    scheme (partition depends on the previous token; a secret seed
    controls the permutation) using a simple, fully disclosed hash in
    place of whatever undisclosed hash a real provider might use.
    """
    combined = f"{seed}:{prev_token}".encode("utf-8")
    prev_hash = int(hashlib.sha256(combined).hexdigest(), 16)
    token_hash = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16)
    # Mix the previous-token hash into the token hash so the partition
    # genuinely changes per position, then map to [0, 1).
    mixed = (token_hash ^ prev_hash) % (10 ** 8)
    return (mixed / (10 ** 8)) < gamma


def greenlist_z_score(tokens: List[str], seed: int, gamma: float = DEFAULT_GAMMA) -> Dict[str, Any]:
    """
    Kirchenbauer et al. z-score: z = (|s|_G - gamma*T) / sqrt(T*gamma*(1-gamma))
    where T is the number of scored tokens and |s|_G is the observed
    green-token count. z > 4 is the paper's suggested high-confidence
    watermark-present threshold; z > 3 (as the spec states) is a looser
    "worth flagging" threshold.
    """
    if len(tokens) < 2:
        return {"available": False, "reason": "insufficient_tokens"}

    green_count = 0
    scored = 0
    for i in range(1, len(tokens)):
        if _is_green(tokens[i - 1], tokens[i], seed, gamma):
            green_count += 1
        scored += 1

    if scored == 0:
        return {"available": False, "reason": "insufficient_tokens"}

    expected = gamma * scored
    variance = scored * gamma * (1 - gamma)
    z = (green_count - expected) / math.sqrt(variance) if variance > 0 else 0.0

    return {
        "available": True,
        "z_score": round(float(z), 4),
        "green_token_count": green_count,
        "scored_tokens": scored,
        "green_ratio": round(green_count / scored, 4),
        "expected_ratio": gamma,
    }


def detect_greenlist_watermark(
    text: str,
    watermark_config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    watermark_config, if provided, must include at least {"seed": int}
    and optionally {"gamma": float}. This is intentionally NOT
    auto-populated with any real provider's parameters (none are
    public) -- see module docstring. Without it, this returns
    available=False rather than a fabricated result.
    """
    try:
        tokens = _pseudo_tokenize(text)
        if len(tokens) < MIN_TOKENS:
            return {"available": False, "score": 0.5, "confidence": 0.0, "reason": "insufficient_tokens"}

        if not watermark_config or "seed" not in watermark_config:
            return {
                "available": False,
                "score": 0.5,
                "confidence": 0.0,
                "reason": "no_disclosed_watermark_scheme",
                "description": (
                    "No publicly disclosed seed/hash scheme exists for OpenAI's, "
                    "Google's, Anthropic's, or Meta's models -- real-world detection "
                    "of an actual provider watermark is not currently possible from "
                    "text alone without that secret. This detector runs only when an "
                    "explicit watermark_config (seed + gamma) is supplied, e.g. for a "
                    "disclosed/licensed scheme or a self-test. See module docstring."
                ),
            }

        seed = watermark_config["seed"]
        gamma = watermark_config.get("gamma", DEFAULT_GAMMA)
        result = greenlist_z_score(tokens, seed, gamma)
        if not result.get("available"):
            return result

        z = result["z_score"]
        # Confidence-style score: z=0 (no watermark) -> 0.0, z>=4 (paper's
        # high-confidence threshold) -> ~1.0, smooth ramp between.
        score = float(np.clip(z / 4.0, 0.0, 1.0))
        watermark_detected = z > 3.0   # spec's stated threshold
        confidence = min(0.6, 0.2 + result["scored_tokens"] / 500)

        return {
            "available": True,
            "score": round(score, 4),
            "confidence": round(confidence, 4),
            "watermark_detected": watermark_detected,
            "z_score": z,
            "green_ratio": result["green_ratio"],
            "expected_ratio": result["expected_ratio"],
            "scored_tokens": result["scored_tokens"],
            "config_used": {"seed": seed, "gamma": gamma},
            "description": "Greenlist z-score against the SUPPLIED watermark_config only "
                            "-- not a check against any real provider's undisclosed scheme.",
        }
    except Exception as e:
        logger.error("[LLMWatermarkGreenlist] detect_greenlist_watermark failed: %s", e, exc_info=True)
        return {"available": False, "reason": f"unexpected_error: {e}"}


def run_all(text: str, watermark_config: Optional[Dict[str, Any]] = None) -> Dict[str, Dict[str, Any]]:
    return {"greenlist_watermark": detect_greenlist_watermark(text, watermark_config)}

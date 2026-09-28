"""
Aiscern Detection Worker — greenlist watermark algorithm (MODULE 23) and
near-synonym consistency (MODULE 24) tests, spec Section 3.3.

MODULE 23 note: this can only self-test the ALGORITHM's correctness
(does it correctly flag text deliberately constructed to be green-heavy
under a KNOWN seed, and correctly not-flag ordinary text under that same
seed) -- it cannot and does not claim to test detection of any real
provider's watermark, since no real provider's seed/scheme is public.
See analyzers/llm_watermark_greenlist.py module docstring.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analyzers.llm_watermark_greenlist import (
    _is_green,
    _pseudo_tokenize,
    detect_greenlist_watermark,
    run_all as run_all_watermark,
)
from analyzers.near_synonym_consistency import (
    near_synonym_consistency,
    run_all as run_all_synonym,
)

SEED = 424242
GAMMA = 0.5

NATURAL_TEXT = (
    "The committee reviewed the proposal for nearly three hours before "
    "reaching a decision. Several members raised concerns about the "
    "budget projections, while others focused on the timeline. In the "
    "end, a modest majority voted to proceed with revisions. The chair "
    "noted that further discussion would follow at the next session, "
    "and asked the finance team to prepare updated figures beforehand. "
    "Nobody seemed fully satisfied, but most agreed it was a reasonable "
    "compromise given the constraints everyone was working under."
) * 3


def _build_green_heavy_text(seed: int, gamma: float, n_tokens: int = 200) -> str:
    """
    Constructs a token sequence where EVERY token (after the first) is
    deliberately chosen to be green under the given seed -- i.e. a
    stand-in for what a real greenlist-watermarking generator would
    produce. Uses a small vocabulary pool and, at each step, picks
    whichever candidate word is green given the previous token.
    """
    vocab_pool = [f"tok{i}" for i in range(200)]
    tokens = [vocab_pool[0]]
    for _ in range(n_tokens - 1):
        prev = tokens[-1]
        chosen = None
        for candidate in vocab_pool:
            if _is_green(prev, candidate, seed, gamma):
                chosen = candidate
                break
        # Every position must find at least one green candidate out of
        # 200 pool words at gamma=0.5 in practice; if not (degenerate
        # hash collision run), fall back to the pool's first word so the
        # fixture never raises.
        tokens.append(chosen or vocab_pool[0])
    return " ".join(tokens)


def test_greenlist_z_score_high_for_deliberately_green_text():
    watermarked_text = _build_green_heavy_text(SEED, GAMMA, n_tokens=200)
    result = detect_greenlist_watermark(watermarked_text, {"seed": SEED, "gamma": GAMMA})
    assert result["available"] is True
    assert result["z_score"] > 3.0
    assert result["watermark_detected"] is True
    assert result["green_ratio"] > 0.9   # should be at/near 1.0 by construction


def test_greenlist_z_score_low_for_natural_text_under_same_seed():
    result = detect_greenlist_watermark(NATURAL_TEXT, {"seed": SEED, "gamma": GAMMA})
    assert result["available"] is True
    # Natural text was not constructed with knowledge of this seed's
    # partition, so its green ratio should sit close to gamma (0.5),
    # giving a z-score nowhere near the watermark threshold.
    assert abs(result["z_score"]) < 3.0
    assert result["watermark_detected"] is False


def test_greenlist_watermark_wrong_seed_does_not_detect():
    """Same watermarked text, but checked against a DIFFERENT seed than
    the one it was constructed under -- should not fire. This is the
    core reason real-world detection needs the true secret seed."""
    watermarked_text = _build_green_heavy_text(SEED, GAMMA, n_tokens=200)
    result = detect_greenlist_watermark(watermarked_text, {"seed": SEED + 1, "gamma": GAMMA})
    assert result["available"] is True
    assert result["watermark_detected"] is False


def test_greenlist_watermark_unavailable_without_config():
    result = detect_greenlist_watermark(NATURAL_TEXT, None)
    assert result["available"] is False
    assert result["reason"] == "no_disclosed_watermark_scheme"
    assert "description" in result


def test_greenlist_watermark_too_short():
    result = detect_greenlist_watermark("short text here", {"seed": SEED})
    assert result["available"] is False
    assert result["reason"] == "insufficient_tokens"


def test_watermark_run_all_returns_key():
    out = run_all_watermark(NATURAL_TEXT, None)
    assert set(out.keys()) == {"greenlist_watermark"}
    assert out["greenlist_watermark"]["available"] is False


# ── near_synonym_consistency ────────────────────────────────────────────────

def test_near_synonym_consistency_flags_rigid_choice_over_mixed():
    rigid_text = (
        "We need to utilize the new system before we utilize the old one "
        "becomes obsolete. Individuals who utilize the platform regularly "
        "should also utilize the reporting tools. Additionally, individuals "
        "should utilize the backup feature. Individuals must utilize the "
        "updated guide as well, and utilize the checklist provided."
    )
    mixed_text = (
        "We need to use the new system before the old one becomes obsolete. "
        "People who utilize the platform regularly should also use the "
        "reporting tools. Additionally, individuals should use the backup "
        "feature. People must utilize the updated guide as well, and use "
        "the checklist provided."
    )
    r_rigid = near_synonym_consistency(rigid_text)
    r_mixed = near_synonym_consistency(mixed_text)
    assert r_rigid["available"] is True and r_mixed["available"] is True
    assert r_rigid["mean_pair_consistency"] > r_mixed["mean_pair_consistency"]
    assert r_rigid["score"] >= r_mixed["score"]


def test_near_synonym_consistency_unavailable_when_no_pairs_used():
    text = "The cat sat quietly on the warm windowsill all afternoon long."
    result = near_synonym_consistency(text)
    assert result["available"] is False


def test_synonym_run_all_returns_key():
    out = run_all_synonym(NATURAL_TEXT)
    assert set(out.keys()) == {"near_synonym_consistency"}

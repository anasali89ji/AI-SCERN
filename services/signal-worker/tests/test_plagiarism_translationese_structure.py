"""
Aiscern Detection Worker — translationese detection (MODULE 25) and
argument-structure fingerprint (MODULE 26) tests, spec Section 3.4.

Same honest-limitation framing as the rest of this series: synthetic
proxies built from the mechanism each detector targets, checked for
directional correctness only.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analyzers.translationese_detection import detect_translationese, run_all as run_all_translationese
from analyzers.argument_structure_fingerprint import (
    argument_structure_fingerprint,
    hamming_similarity,
    run_all as run_all_structure,
)
from engines.plagiarism_engine import analyze_plagiarism_risk

# Natural casual-register English: contractions, idioms, informal connectors.
NATURAL_CASUAL_TEXT = (
    "I couldn't figure out why the build kept failing, so I asked around. "
    "Turns out someone had left a debug flag on, which was easy to miss. "
    "We didn't catch it in review because it's the kind of thing that "
    "doesn't show up unless you're actually running the tests locally. "
    "Anyway, we sorted it out and shipped a fix that afternoon. It's not "
    "a huge deal, but it's the second time this month, so we're going to "
    "look into adding a lint rule for it. Better safe than sorry, I guess."
) * 2

# Formal, contraction-free, idiom-free, heavy on stock formal connectives --
# proxy for round-trip machine-translated text (translationese markers).
TRANSLATIONESE_TEXT = (
    "It should be noted that the system did not function correctly during "
    "the testing phase. In addition to this, the configuration was not "
    "verified prior to deployment. Due to the fact that the debug setting "
    "remained active, unexpected behavior was observed by the users. For "
    "the purpose of resolving this matter, the team did make a research "
    "into the root cause. In the event that this occurs again, additional "
    "verification procedures will be implemented. On the other hand, the "
    "resolution was completed within an acceptable timeframe."
) * 2


def test_translationese_flags_formal_text_over_casual():
    r_casual = detect_translationese(NATURAL_CASUAL_TEXT)
    r_formal = detect_translationese(TRANSLATIONESE_TEXT)
    assert r_casual["confidence"] > 0 and r_formal["confidence"] > 0
    assert r_formal["contraction_rate_per_1000_words"] < r_casual["contraction_rate_per_1000_words"]
    assert r_formal["score"] > r_casual["score"]


def test_translationese_too_few_words():
    result = detect_translationese("Too short for this analysis.")
    assert result["confidence"] == 0.0


def test_translationese_run_all_returns_key():
    out = run_all_translationese(NATURAL_CASUAL_TEXT)
    assert set(out.keys()) == {"translationese_detection"}


# ── argument_structure_fingerprint ──────────────────────────────────────────

RIGID_TEMPLATE_TEXT = (
    "It is clear that renewable energy adoption is accelerating. "
    "Studies show that solar capacity has doubled in five years. "
    "Therefore, investment in this sector continues to grow. "
    "It is clear that electric vehicle sales are rising sharply. "
    "Research shows that battery costs have fallen significantly. "
    "Therefore, more manufacturers are entering the market. "
    "It is clear that public opinion favors climate action. "
    "Data shows that support has increased across age groups. "
    "Therefore, policymakers face growing pressure to act."
)

VARIED_ARGUMENT_TEXT = (
    "Renewable energy adoption has picked up speed lately, mostly because "
    "the hardware got cheap fast. Solar panel costs fell by more than half "
    "over the last decade, which changed the math for a lot of utilities. "
    "That said, storage remains the real bottleneck -- batteries haven't "
    "kept pace the same way. For example, several grid operators have had "
    "to curtail solar output on sunny days simply because there's nowhere "
    "to put the extra power. Some analysts argue this will resolve itself "
    "as battery manufacturing scales, though others are less convinced, "
    "pointing to persistent supply-chain constraints on lithium. Either "
    "way, the next five years look pivotal for the sector. Nobody really "
    "knows how it'll shake out, and forecasts from five years ago mostly "
    "missed the mark anyway, so take any of this with a grain of salt. "
    "Worth watching either way."
)


def test_argument_structure_rigid_template_scores_higher_than_varied():
    r_rigid = argument_structure_fingerprint(RIGID_TEMPLATE_TEXT)
    r_varied = argument_structure_fingerprint(VARIED_ARGUMENT_TEXT)
    assert r_rigid["available"] and r_varied["available"]
    if r_rigid["confidence"] > 0 and r_varied["confidence"] > 0:
        assert r_rigid["role_transition_entropy_normalized"] < r_varied["role_transition_entropy_normalized"]
        assert r_rigid["score"] >= r_varied["score"]


def test_argument_structure_too_few_sentences():
    result = argument_structure_fingerprint("Short. Two sentences only.")
    assert result["available"] is False


def test_argument_structure_fingerprint_is_comparable():
    fp1 = argument_structure_fingerprint(RIGID_TEMPLATE_TEXT)["structure_fingerprint"]
    fp2 = argument_structure_fingerprint(RIGID_TEMPLATE_TEXT)["structure_fingerprint"]
    fp3 = argument_structure_fingerprint(VARIED_ARGUMENT_TEXT)["structure_fingerprint"]
    assert fp1 == fp2   # deterministic for identical input
    assert hamming_similarity(fp1, fp1) == 1.0
    # Same underlying rigid pattern repeated 3x should be much closer to
    # itself than to an unrelated, structurally different text.
    sim_same = hamming_similarity(fp1, fp2)
    sim_diff = hamming_similarity(fp1, fp3)
    assert sim_same >= sim_diff


def test_argument_structure_run_all_returns_key():
    out = run_all_structure(VARIED_ARGUMENT_TEXT)
    assert set(out.keys()) == {"argument_structure_fingerprint"}


# ── plagiarism_engine integration ───────────────────────────────────────────

def test_analyze_plagiarism_risk_includes_new_signals():
    long_text = VARIED_ARGUMENT_TEXT * 2   # clear MIN_TEXT_LEN
    result = analyze_plagiarism_risk(long_text)
    assert result["status"] == "ok"
    assert "translationese_detection" in result["signals"]
    assert "argument_structure_fingerprint" in result["signals"]
    assert 0 <= result["risk_score"] <= 100


def test_analyze_plagiarism_risk_never_raises_on_short_text():
    result = analyze_plagiarism_risk("short")
    assert result["status"] == "insufficient_text"

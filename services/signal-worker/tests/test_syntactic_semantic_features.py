"""
Aiscern Detection Worker — syntactic structure & semantic LSA feature tests
(MODULE 31, spec Section 3.2 items 2-3)

Same honest framing as Modules 21-30: synthetic fixtures exercising the
mechanism each signal targets, checked for directional correctness and for
not-crashing. NOT an accuracy benchmark.

Several tests here assert MEASURED values from these exact fixtures. That is
deliberate: the scoring thresholds in _score() were set from these
measurements after an earlier guessed set was shown to fire on everything, so
if a fixture's measured value drifts, the threshold it justified needs
revisiting and the test should fail loudly rather than silently.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analyzers.syntactic_semantic_features import (  # noqa: E402
    coarse_tag,
    tag_sentence,
    run_all,
    syntactic_features,
    semantic_features,
    _syntactic_template_signal,
    _clause_structure_signal,
    _opener_signal,
    _content_gap_signal,
    _build_lsa_space,
    _cosine,
    MIN_SENTENCES,
    MIN_WORDS,
)

import numpy as np  # noqa: E402


# Varied human prose: contractions, digressions, fragments, rhetorical
# questions, subordinate clauses of wildly different depth.
HUMAN_TEXT = """I couldn't figure out why the build kept failing. Turns out someone left a debug
flag on. Easy to miss, honestly. We didn't catch it in review because it's the kind of thing that
doesn't show up unless you're running the tests locally, which nobody does anymore. Anyway, fixed it
that afternoon. Second time this month though. My manager wants a lint rule. Fine by me, but lint
rules have a way of multiplying until the linter takes longer than the build itself. Remember when we
added that import-order rule? Three weeks of arguing. Nobody liked the outcome. I still think the real
problem is that our review process rewards speed over care, and no amount of tooling fixes a culture
problem. But try saying that in a retro without sounding like a jerk. So: lint rule it is. The funny
part is that the flag had been there for two years. Someone added it during a hackathon and never took
it out. We only noticed because the build finally got slow enough that people complained. Before that
it just sat there, quietly doubling our CI bill. I asked around and nobody remembered adding it. Git
blame pointed at a contractor who left in 2024. So we deleted it, and the build went from eleven
minutes to six, and everyone acted like I'd done something clever."""

# Template-heavy prose: uniform declarative frames, discourse-marker openers
# recycled on a short loop, zero subordination, heavy nominalisation.
TEMPLATE_TEXT = """Effective software development requires careful attention to code quality.
Implementing robust review processes is essential for maintaining high standards. Furthermore,
automated tooling can significantly improve the consistency of codebases. Additionally, establishing
clear guidelines helps teams align on expectations. Moreover, continuous integration ensures that
regressions are caught early in the development cycle. Implementing comprehensive testing strategies
is crucial for long-term maintainability. Furthermore, documentation plays a vital role in knowledge
transfer. Additionally, regular retrospectives enable teams to identify improvement opportunities.
Moreover, investing in developer experience yields substantial productivity gains. Establishing a
culture of continuous improvement is fundamental to organizational success. Furthermore, monitoring
key performance indicators enables data-driven decision making. Additionally, fostering psychological
safety encourages constructive feedback. Moreover, standardizing development environments reduces
onboarding friction. Implementing automated dependency management improves security posture.
Furthermore, conducting regular architecture reviews prevents technical debt accumulation.
Additionally, establishing service level objectives clarifies reliability expectations. Moreover,
investing in observability infrastructure accelerates incident resolution."""


# ── Coarse tagger ───────────────────────────────────────────────────────────

def test_closed_class_tagging():
    assert coarse_tag("the") == "DET"
    assert coarse_tag("The") == "DET"
    assert coarse_tag("because") == "SUBORD"
    assert coarse_tag("and") == "COORD"
    assert coarse_tag("should") == "MODAL"
    assert coarse_tag("were") == "AUX"
    assert coarse_tag("n't") == "NEG"
    assert coarse_tag("through") == "PREP"


def test_suffix_morphology_fallbacks():
    assert coarse_tag("quickly") == "ADV"
    assert coarse_tag("running") == "VBG"
    assert coarse_tag("walked") == "VBD"
    assert coarse_tag("implementation") == "NOMZ"
    assert coarse_tag("productive") == "ADJ"
    assert coarse_tag("dog") == "CONTENT"


def test_tag_priority_is_deterministic():
    """`that` is in both _DET and _REL; the tag order must resolve it stably."""
    assert coarse_tag("that") == coarse_tag("that")
    assert coarse_tag("that") == "DET"


def test_tag_sentence_ignores_punctuation_and_digits():
    tags = tag_sentence("The 3 dogs ran, quickly!")
    assert "DET" in tags
    assert all(t.isupper() or t.isalpha() for t in tags)


# ── Length and language guards ──────────────────────────────────────────────

def test_short_text_is_unavailable():
    out = run_all("Too short. Way too short. Really.")
    assert out["syntactic_structure"]["status"] == "unavailable"
    assert str(MIN_SENTENCES) in out["syntactic_structure"]["details"]["reason"]
    assert str(MIN_WORDS) in out["syntactic_structure"]["details"]["reason"]


def test_empty_and_whitespace_input():
    for text in ("", "   \n  "):
        out = run_all(text)
        assert out["syntactic_structure"]["status"] == "unavailable"
        assert out["semantic_lsa"]["confidence"] == 0.0


def test_non_english_is_rejected_not_silently_tagged():
    """
    The closed-class lexicon is English. Non-English input must be refused
    rather than producing confident nonsense.
    """
    german = "Der Hund lief schnell über die Straße und niemand bemerkte ihn dabei. " * 12
    out = run_all(german)
    assert out["syntactic_structure"]["status"] == "unavailable"
    assert "function_word_coverage" in out["syntactic_structure"]["details"]["reason"]


def test_english_passes_the_coverage_guard():
    assert run_all(HUMAN_TEXT)["syntactic_structure"]["status"] == "ok"


# ── S1: template repetition ─────────────────────────────────────────────────

def test_template_signal_needs_enough_trigrams():
    result = _syntactic_template_signal([["DET", "CONTENT"]])
    assert result["available"] is False


def test_top5_concentration_separates_the_fixtures():
    human = syntactic_features(HUMAN_TEXT)["details"]["template_repetition"]
    template = syntactic_features(TEMPLATE_TEXT)["details"]["template_repetition"]
    assert template["top5_concentration"] > human["top5_concentration"]


def test_concentration_is_gated_on_trigram_count():
    """Concentration rises mechanically as trigram count falls."""
    result = syntactic_features(HUMAN_TEXT)["details"]["template_repetition"]
    assert "concentration_scorable" in result
    assert result["concentration_scorable"] is (result["trigram_count"] >= 100)


def test_trigram_repeat_rate_is_reported_but_does_not_separate():
    """
    Regression guard on a measurement, not a behaviour. repeat_rate came out
    0.397 (human) vs 0.413 (template-heavy) — inside noise — which is why it
    is reported without carrying score weight. If this gap ever widens
    materially the decision not to score it should be revisited.
    """
    human = syntactic_features(HUMAN_TEXT)["details"]["template_repetition"]
    template = syntactic_features(TEMPLATE_TEXT)["details"]["template_repetition"]
    assert "trigram_repeat_rate" in human
    assert abs(template["trigram_repeat_rate"] - human["trigram_repeat_rate"]) < 0.10

    observations = syntactic_features(HUMAN_TEXT)["details"]["observations"]
    assert "high_syntactic_frame_reuse" not in observations


def test_normalised_entropy_field_is_gone():
    """
    Regression: `normalised_entropy` measured ~0.94 for BOTH fixtures because
    it normalised by log2(min(distinct, total)) and saturated. It was a dead
    signal that looked alive. The field must not come back without a working
    normalisation.
    """
    details = syntactic_features(HUMAN_TEXT)["details"]["template_repetition"]
    assert "normalised_entropy" not in details
    assert "trigram_repeat_rate" in details


# ── S2: clause structure ────────────────────────────────────────────────────

def test_flat_prose_has_zero_clause_depth_variance():
    clauses = syntactic_features(TEMPLATE_TEXT)["details"]["clause_structure"]
    assert clauses["clause_depth_proxy_std"] < 0.35
    assert clauses["simple_sentence_fraction"] > 0.9


def test_varied_prose_has_clause_depth_variance():
    clauses = syntactic_features(HUMAN_TEXT)["details"]["clause_structure"]
    assert clauses["clause_depth_proxy_std"] > 0.35
    assert clauses["subordinator_variance"] > 0.30


def test_uniformly_flat_case_is_scored_not_skipped():
    """
    Regression: the original gate required mean_clause_depth > 1.2, so prose
    with NO subordination anywhere (std=0.0, mean=1.0) — the most extreme
    case — fired nothing at all.
    """
    observations = syntactic_features(TEMPLATE_TEXT)["details"]["observations"]
    assert "uniform_clause_depth_flat" in observations
    assert "no_subordinate_clauses_anywhere" in observations


def test_clause_depth_is_labelled_as_a_proxy():
    clauses = syntactic_features(HUMAN_TEXT)["details"]["clause_structure"]
    assert "proxy" in clauses["note"].lower()
    assert "mean_clause_depth_proxy" in clauses
    assert "parse_tree_depth" not in clauses


# ── S3: sentence openers ────────────────────────────────────────────────────

def test_recycled_openers_are_detected():
    openers = syntactic_features(TEMPLATE_TEXT)["details"]["sentence_openers"]
    assert openers["repeated_two_word_opener_fraction"] > 0.20
    assert openers["top_openers"]


def test_varied_openers_not_flagged():
    openers = syntactic_features(HUMAN_TEXT)["details"]["sentence_openers"]
    assert openers["repeated_two_word_opener_fraction"] < 0.15
    assert "repeated_sentence_openers" not in syntactic_features(HUMAN_TEXT)["details"]["observations"]


# ── S4: dependency-distance proxy ───────────────────────────────────────────

def test_content_gap_needs_enough_samples():
    assert _content_gap_signal([["CONTENT", "DET"]])["available"] is False


def test_content_gap_cv_separates_the_fixtures():
    human = syntactic_features(HUMAN_TEXT)["details"]["dependency_distance_proxy"]
    template = syntactic_features(TEMPLATE_TEXT)["details"]["dependency_distance_proxy"]
    assert human["content_gap_cv"] > template["content_gap_cv"]
    assert "proxy" in human["note"].lower()


# ── S5/S6: LSA ──────────────────────────────────────────────────────────────

def test_lsa_space_builds_on_real_text():
    sentences = [s.strip() for s in HUMAN_TEXT.replace("\n", " ").split(".") if s.strip()]
    embeddings, spectrum = _build_lsa_space(sentences)
    assert embeddings is not None
    assert embeddings.shape[0] >= MIN_SENTENCES
    assert embeddings.shape[1] >= 2
    assert spectrum is not None


def test_lsa_space_returns_none_on_thin_vocabulary():
    embeddings, _ = _build_lsa_space(["a b", "c d", "e f", "g h", "i j", "k l"])
    assert embeddings is None


def test_cosine_handles_zero_vectors():
    assert _cosine(np.zeros(3), np.ones(3)) == 0.0
    assert _cosine(np.ones(3), np.ones(3)) == pytest.approx(1.0)


def test_lsa_block_is_provisional_and_unscored():
    """
    The honest-scope contract for item 3. A guessed threshold set fired
    'frequent_topic_shifts' on every fixture; measured coherence sat at
    0.08-0.11 for both. Rather than retune against two documents, LSA is
    emitted at zero score weight until there is a corpus to fit against.
    """
    result = semantic_features(HUMAN_TEXT)
    assert result["status"] == "ok"
    assert result["details"]["provisional"] is True
    assert result["details"]["scored"] is False
    assert result["score"] == 0.5
    assert result["details"]["observations"] == []
    assert "ZERO weight" in result["details"]["provisional_reason"]


def test_lsa_score_is_identical_regardless_of_content():
    """If LSA carried weight, these two would differ. It must not."""
    assert semantic_features(HUMAN_TEXT)["score"] == semantic_features(TEMPLATE_TEXT)["score"] == 0.5


def test_lsa_reports_real_measurements():
    lsa = semantic_features(HUMAN_TEXT)["details"]["lsa"]
    assert lsa["available"] is True
    assert 0.0 <= lsa["spectral_concentration_top2"] <= 1.0
    assert -1.0 <= lsa["mean_adjacent_coherence"] <= 1.0
    assert lsa["sentences_embedded"] >= MIN_SENTENCES
    assert "no LDA, no WordNet" in lsa["note"]


# ── Directional check ───────────────────────────────────────────────────────

def test_template_heavy_prose_scores_above_varied_prose():
    human = syntactic_features(HUMAN_TEXT)
    template = syntactic_features(TEMPLATE_TEXT)
    assert template["score"] > human["score"] + 0.15
    assert len(template["details"]["observations"]) > len(human["details"]["observations"])


def test_scores_and_confidence_bounded():
    for text in (HUMAN_TEXT, TEMPLATE_TEXT):
        for block in run_all(text).values():
            assert 0.0 <= block["score"] <= 1.0
            assert 0.0 <= block["confidence"] <= 1.0


# ── Contract ────────────────────────────────────────────────────────────────

def test_run_all_shape():
    out = run_all(HUMAN_TEXT)
    assert set(out.keys()) == {"syntactic_structure", "semantic_lsa"}
    for block in out.values():
        for key in ("score", "confidence", "status", "details"):
            assert key in block


def test_interpretation_names_the_unimplemented_items():
    interpretation = syntactic_features(HUMAN_TEXT)["details"]["interpretation"]
    assert "WordNet" in interpretation
    assert "LDA" in interpretation


def test_accepts_presplit_sentences():
    sentences = [s.strip() + "." for s in HUMAN_TEXT.replace("\n", " ").split(".") if s.strip()]
    out = run_all(HUMAN_TEXT, sentences=sentences)
    assert out["syntactic_structure"]["status"] == "ok"

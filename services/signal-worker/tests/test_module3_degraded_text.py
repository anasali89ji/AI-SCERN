"""
tests/test_module3_degraded_text.py

Regression tests for Module 3: text engine silent ML fallback degrades
detection without surfacing it.

Per the accuracy benchmark, when perplexity is unavailable, casual/technical/
terse-register genuinely-AI-generated text was scored by heuristics alone
(burstiness/stylometry/repetition) and came back falsely confident and
often wrongly "human" -- with no signal to the caller that the pipeline was
running degraded.

These tests force perplexity to fail (simulating a model-load failure, cold
start, or offline deployment) and verify:
  1. The response carries an explicit `degraded: true` / `degraded_reason`.
  2. Reported confidence is reduced relative to a normal (non-degraded) run.
  3. This holds across multiple text registers (casual/blog, technical/
     README-style, formal essay), not just the "obviously AI" case.
"""

from unittest.mock import patch

import pytest

from engines.text_engine import analyze_text


# Genuinely-AI-style text across three registers. These are hand-authored
# stand-ins (this sandbox has no access to a live AI text generator) meant
# to be representative of each register's typical AI "tells" -- uniform
# sentence rhythm, hedged transitions, low burstiness -- while differing
# in tone/vocabulary the way real casual vs. technical vs. essay text would.

CASUAL_AI_TEXT = (
    "So I've been thinking about this a lot lately, and honestly, it's pretty "
    "interesting how things have changed. It's worth noting that most people "
    "don't really think about it this way, but once you start looking, you "
    "notice it everywhere. It's also worth mentioning that this isn't a new "
    "idea, but it's definitely picking up steam. At the end of the day, it "
    "really comes down to how you look at it, and I think that's a good thing."
) * 3

TECHNICAL_README_AI_TEXT = (
    "This module provides a lightweight interface for handling configuration "
    "loading across environments. It is designed to be extensible and easy "
    "to integrate into existing pipelines. The configuration loader reads "
    "values from environment variables, falling back to defaults when not "
    "present. It is important to note that all values are validated before "
    "being returned. This ensures that downstream consumers receive "
    "consistent, well-formed configuration objects at all times."
) * 3

ESSAY_AI_TEXT = (
    "Artificial intelligence has fundamentally transformed numerous industries. "
    "Furthermore, machine learning algorithms have demonstrated remarkable "
    "capabilities. Moreover, natural language processing has enabled "
    "unprecedented text understanding. Additionally, computer vision systems "
    "have achieved superhuman performance. Consequently, businesses are "
    "rapidly adopting AI solutions."
) * 3

REGISTERS = {
    "casual": CASUAL_AI_TEXT,
    "technical_readme": TECHNICAL_README_AI_TEXT,
    "essay": ESSAY_AI_TEXT,
}


def _force_perplexity_failure():
    return patch(
        "engines.text_engine._compute_perplexity",
        side_effect=RuntimeError("simulated model load failure"),
    )


class TestModule3DegradedMode:

    def test_degraded_flag_surfaced_on_perplexity_failure(self):
        with _force_perplexity_failure():
            result = analyze_text(CASUAL_AI_TEXT, job_id="t1")
        assert result["degraded"] is True
        assert result["degraded_reason"] == "perplexity_unavailable"
        assert "message" in result

    def test_not_degraded_when_perplexity_succeeds(self):
        # Sanity check: a normal run (perplexity mocked to succeed cheaply)
        # must NOT be marked degraded.
        fake_perplexity_result = {
            "score": 0.7, "confidence": 0.6, "perplexity": 40.0,
            "model": "distilgpt2", "token_count": 50, "details": {},
        }
        with patch("engines.text_engine._compute_perplexity", return_value=fake_perplexity_result):
            result = analyze_text(CASUAL_AI_TEXT, job_id="t2")
        assert result["degraded"] is False
        assert result.get("degraded_reason") is None

    @pytest.mark.parametrize("register", list(REGISTERS.keys()))
    def test_register_diversity_degraded_or_correctly_flagged(self, register):
        """
        Acceptance test (Module 3): with perplexity forcibly disabled, each
        register must either score >0.55 (AI-leaning) or carry a degraded
        flag with reduced confidence -- never a falsely-confident low score
        with no indication the pipeline was running short-handed.
        """
        text = REGISTERS[register]

        # Baseline: confidence WITH a (mocked, high-confidence) perplexity
        # signal, for comparison against the degraded run below.
        fake_perplexity_result = {
            "score": 0.85, "confidence": 0.9, "perplexity": 18.0,
            "model": "distilgpt2", "token_count": 80, "details": {},
        }
        with patch("engines.text_engine._compute_perplexity", return_value=fake_perplexity_result):
            baseline = analyze_text(text, job_id=f"baseline-{register}")

        with _force_perplexity_failure():
            degraded_result = analyze_text(text, job_id=f"degraded-{register}")

        composite = degraded_result["composite_score"]
        assert composite > 0.55 or (
            degraded_result["degraded"] is True
            and degraded_result["degraded_reason"] == "perplexity_unavailable"
            and degraded_result["confidence"] < baseline["confidence"]
        ), (
            f"register={register!r}: expected either composite_score > 0.55 "
            f"(got {composite}) or a degraded flag with reduced confidence "
            f"(degraded={degraded_result['degraded']}, "
            f"confidence={degraded_result['confidence']} vs "
            f"baseline={baseline['confidence']})"
        )

    def test_degraded_confidence_meaningfully_lower_than_baseline(self):
        fake_perplexity_result = {
            "score": 0.85, "confidence": 0.9, "perplexity": 18.0,
            "model": "distilgpt2", "token_count": 80, "details": {},
        }
        with patch("engines.text_engine._compute_perplexity", return_value=fake_perplexity_result):
            baseline = analyze_text(ESSAY_AI_TEXT, job_id="baseline")
        with _force_perplexity_failure():
            degraded = analyze_text(ESSAY_AI_TEXT, job_id="degraded")

        assert degraded["confidence"] < baseline["confidence"] * 0.8, (
            f"Expected meaningfully reduced confidence when degraded, "
            f"got degraded={degraded['confidence']} vs baseline={baseline['confidence']}"
        )

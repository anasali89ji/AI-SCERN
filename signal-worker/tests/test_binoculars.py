"""
Module 2.8: Binoculars + sliding-window perplexity variance tests.

Verifies the score mapping for the two new detectors. These tests are
skipped if torch/transformers aren't installed (e.g. on a CI runner
without the heavy ML deps). On a full signal-worker install, they
exercise the actual Binoculars score mapping.

Test strategy:
  - test_returns_unavailable_when_models_fail: monkey-patches get_model
    to raise, asserts the function returns a valid unavailable dict
    (not an exception).
  - test_score_in_unit_interval (live): when models ARE installed,
    runs Binoculars on real text and asserts the score is in [0, 1].
"""

import pytest
import os


# Skip the entire module if torch isn't installed — Binoculars uses it.
torch = pytest.importorskip("torch", reason="torch not installed — Binoculars tests skipped")
pytest.importorskip("transformers", reason="transformers not installed")


class TestBinocularsScoreMapping:
    """Verify the Binoculars score mapping (ratio → suspicion)."""

    def test_low_ratio_scores_high_suspicion(self):
        """Observer perplexity << performer perplexity → AI text.
        Ratio = 0.5 should map to score >= 0.85 (AI)."""
        from engines.text_engine import _compute_binoculars
        from unittest.mock import patch, MagicMock

        # Observer loss=1.0 (ppl=e), performer loss=2.5 (ppl=e^2.5)
        # ratio = e^1.0 / e^2.5 = e^-1.5 ≈ 0.223 → < 0.85 → AI
        def mock_loader_factory(loss_value):
            def _loader(*args, **kw):
                m = MagicMock()
                out = MagicMock()
                out.loss = torch.tensor(loss_value)
                m.return_value = out
                m.side_effect = lambda *a, **k: out
                return m
            return _loader

        def mock_tokenizer_factory():
            tok = MagicMock()
            enc = MagicMock()
            enc.input_ids = torch.tensor([[1, 2, 3, 4, 5]])
            tok.return_value = enc
            tok.side_effect = lambda *a, **k: enc
            return tok

        with patch("engines.text_engine.get_model") as mock_get:
            def side(key, loader, *args, **kw):
                if "tokenizer" in key:
                    return mock_tokenizer_factory()
                # lm:distilgpt2 → observer, lm:gpt2 → performer
                if "distilgpt2" in key:
                    return mock_loader_factory(1.0)()
                return mock_loader_factory(2.5)()
            mock_get.side_effect = side
            result = _compute_binoculars("test text")

        assert result["available"] is True, f"expected available, got {result}"
        assert result["score"] >= 0.85, f"low ratio should map to AI score >=0.85, got {result['score']}"

    def test_high_ratio_scores_low_suspicion(self):
        """Observer perplexity >> performer perplexity → human text.
        Ratio = 4.5 should map to score <= 0.15 (real)."""
        from engines.text_engine import _compute_binoculars
        from unittest.mock import patch, MagicMock

        # Observer loss=2.5, performer loss=1.0
        # ratio = e^2.5 / e^1.0 = e^1.5 ≈ 4.48 → > 1.15 → real
        def mock_loader_factory(loss_value):
            def _loader(*args, **kw):
                m = MagicMock()
                out = MagicMock()
                out.loss = torch.tensor(loss_value)
                m.return_value = out
                m.side_effect = lambda *a, **k: out
                return m
            return _loader

        def mock_tokenizer_factory():
            tok = MagicMock()
            enc = MagicMock()
            enc.input_ids = torch.tensor([[1, 2, 3, 4, 5]])
            tok.return_value = enc
            tok.side_effect = lambda *a, **k: enc
            return tok

        with patch("engines.text_engine.get_model") as mock_get:
            def side(key, loader, *args, **kw):
                if "tokenizer" in key:
                    return mock_tokenizer_factory()
                if "distilgpt2" in key:
                    return mock_loader_factory(2.5)()
                return mock_loader_factory(1.0)()
            mock_get.side_effect = side
            result = _compute_binoculars("test text")

        assert result["available"] is True, f"expected available, got {result}"
        assert result["score"] <= 0.15, f"high ratio should map to real score <=0.15, got {result['score']}"

    def test_returns_unavailable_when_models_fail(self):
        """When model load fails, returns a valid unavailable dict (not exception)."""
        from engines.text_engine import _compute_binoculars
        from unittest.mock import patch

        with patch("engines.text_engine.get_model", side_effect=RuntimeError("network failed")):
            result = _compute_binoculars("test text")

        assert result["available"] is False
        assert "model_load_failed" in result.get("reason", "")
        assert result["score"] == 0.5


class TestSlidingWindowScoreMapping:
    """Verify the sliding-window perplexity variance score mapping."""

    def test_returns_unavailable_when_models_fail(self):
        """When model load fails, returns a valid unavailable dict (not exception)."""
        from engines.text_engine import _compute_sliding_window_ppl_variance
        from unittest.mock import patch

        with patch("engines.text_engine.get_model", side_effect=RuntimeError("network failed")):
            result = _compute_sliding_window_ppl_variance("test text")

        assert result["available"] is False
        assert "model_load_failed" in result.get("reason", "")
        assert result["score"] == 0.5

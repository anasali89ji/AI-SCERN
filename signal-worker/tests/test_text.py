"""
Aiscern Detection Worker — /analyze/text endpoint tests
"""
import pytest
from version import VERSION

SAMPLE_AI_TEXT = (
    "Artificial intelligence has fundamentally transformed numerous industries. "
    "Furthermore, machine learning algorithms have demonstrated remarkable capabilities. "
    "Moreover, natural language processing has enabled unprecedented text understanding. "
    "Additionally, computer vision systems have achieved superhuman performance. "
    "Consequently, businesses are rapidly adopting AI solutions. "
    "Furthermore, the economic impact of AI adoption continues to grow substantially. "
    "Moreover, ethical considerations remain paramount in AI development. "
    "Additionally, regulatory frameworks are being established globally."
) * 3

SAMPLE_HUMAN_TEXT = (
    "I wasn't sure about this at first, honestly. The thing is, it worked — but barely. "
    "My colleague pointed out three bugs before lunch (which, frankly, I should have caught). "
    "We pushed anyway. Why? Because the deadline was yesterday and the client called twice. "
    "Production held. No idea how. I'm not complaining."
) * 5


def test_text_endpoint_returns_200(client):
    resp = client.post("/analyze/text", json={"text": SAMPLE_AI_TEXT, "jobId": "test-1"})
    assert resp.status_code == 200


def test_text_response_schema(client):
    data = client.post("/analyze/text", json={"text": SAMPLE_AI_TEXT, "jobId": "test-2"}).json()
    assert data["status"] == "success"
    assert "composite_score" in data
    assert "confidence" in data
    assert "engines" in data
    assert "text_stats" in data
    assert data["version"] == VERSION


def test_text_too_short_returns_error(client):
    data = client.post("/analyze/text", json={"text": "Too short", "jobId": "test-3"}).json()
    assert data["status"] == "error"
    assert "too_short" in data.get("error", "")


def test_text_engines_present(client):
    data = client.post(
        "/analyze/text",
        json={"text": SAMPLE_AI_TEXT, "jobId": "test-4", "options": {"burstiness": True, "stylometry": True, "repetition": True, "perplexity": False}},
    ).json()
    engines = data["engines"]
    assert "burstiness" in engines
    assert "stylometry" in engines
    assert "repetition" in engines


def test_text_score_range(client):
    data = client.post("/analyze/text", json={"text": SAMPLE_AI_TEXT, "jobId": "test-5"}).json()
    if data.get("composite_score") is not None:
        assert 0.0 <= data["composite_score"] <= 1.0


# Module 2.12: New tests verifying AI-scores-AI / human-scores-human direction.
# The original test_text.py only validated schema/range — never checked that
# an AI sample actually scores > 0.5 or that a human sample scores < 0.5.
# This is the smoke-test-level regression test that catches direction bugs.

def test_ai_sample_scores_above_midpoint(client):
    """AI sample should score > 0.5 (suspicion of AI)."""
    data = client.post("/analyze/text", json={"text": SAMPLE_AI_TEXT, "jobId": "test-ai-1"}).json()
    score = data.get("composite_score")
    if score is None:
        pytest.skip("composite_score not available (engine degraded?)")
    assert score > 0.5, (
        f"AI sample should score > 0.5 (suspicion of AI). Got {score}. "
        f"If this fails, the text engine's direction has regressed — check the "
        f"weights table and the perplexity/Binoculars score mappings."
    )


def test_human_sample_scores_below_midpoint(client):
    """Human sample should score < 0.5 (low suspicion of AI)."""
    data = client.post("/analyze/text", json={"text": SAMPLE_HUMAN_TEXT, "jobId": "test-human-1"}).json()
    score = data.get("composite_score")
    if score is None:
        pytest.skip("composite_score not available (engine degraded?)")
    assert score < 0.5, (
        f"Human sample should score < 0.5 (low suspicion). Got {score}. "
        f"If this fails, the text engine is producing false positives on "
        f"genuine human text — check for over-weighted heuristic engines "
        f"(burstiness/stylometry) or a miscalibrated perplexity curve."
    )


def test_ai_sample_scores_higher_than_human(client):
    """AI sample should score higher than human sample (direction check)."""
    ai_data = client.post("/analyze/text", json={"text": SAMPLE_AI_TEXT, "jobId": "test-dir-ai"}).json()
    human_data = client.post("/analyze/text", json={"text": SAMPLE_HUMAN_TEXT, "jobId": "test-dir-human"}).json()
    ai_score = ai_data.get("composite_score")
    human_score = human_data.get("composite_score")
    if ai_score is None or human_score is None:
        pytest.skip("composite_score not available for one of the samples")
    assert ai_score > human_score, (
        f"AI sample should score higher than human sample. "
        f"Got AI={ai_score}, human={human_score}. "
        f"If this fails, the engine has lost its ability to distinguish AI from human."
    )

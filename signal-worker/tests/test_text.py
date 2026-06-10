"""
Aiscern Detection Worker — /analyze/text endpoint tests
"""
import pytest

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
    assert data["version"] == "4.0.0"


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

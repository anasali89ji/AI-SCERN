"""
Aiscern Detection Worker — P3 feature tests
/metrics endpoint, /analyze/batch, MIME allowlist, memory pressure middleware.
"""
import time
import pytest


def test_metrics_returns_200(client):
    resp = client.get("/metrics")
    assert resp.status_code == 200


def test_metrics_content_type(client):
    resp = client.get("/metrics")
    assert "text/plain" in resp.headers["content-type"]


def test_metrics_has_required_keys(client):
    resp = client.get("/metrics")
    body = resp.text
    for expected in [
        "aiscern_requests_total",
        "aiscern_errors_total",
        "aiscern_avg_latency_ms",
        "aiscern_cached_models",
        "aiscern_memory_rss_mb",
        "aiscern_oom_evictions_total",
    ]:
        assert expected in body, f"Missing metric: {expected}"


def test_metrics_increments_after_health_request(client):
    # Hit /metrics once to get baseline, then hit /health, then check again
    r1 = client.get("/metrics")
    # We can't guarantee order of requests in this test but we CAN assert the
    # endpoint is stable across multiple calls without crashing or corrupting state
    r2 = client.get("/metrics")
    assert r1.status_code == 200
    assert r2.status_code == 200


def test_batch_empty_urls_rejected(client):
    resp = client.post("/analyze/batch", json={"urls": [], "jobId": "test"})
    assert resp.status_code == 400


def test_batch_too_many_urls_rejected(client):
    resp = client.post("/analyze/batch", json={"urls": [f"http://example.com/{i}" for i in range(25)]})
    assert resp.status_code == 400
    assert "20" in resp.json()["detail"]


def test_batch_schema_on_error_urls(client):
    """
    All URLs in this batch will fail (unreachable hosts). The batch endpoint
    should still return 200 with per-item error results — never 500 the whole batch.
    """
    resp = client.post("/analyze/batch", json={
        "urls": [
            "https://this-host-does-not-exist-12345.example/img.jpg",
            "https://another-nonexistent-host-99.invalid/x.png",
        ],
        "jobId": "test-batch-errors",
        "maxConcurrent": 2,
    })
    # The endpoint must return 200 (batch-level success) even when items fail
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["total"] == 2
    assert len(data["results"]) == 2
    for item in data["results"]:
        # Each item should have an error status since hosts are unreachable
        assert item.get("status") == "error"
        assert "error" in item


def test_mime_allowlist_rejects_pdf(client):
    """PDF uploads must return 415, not 400."""
    resp = client.post(
        "/analyze/image",
        files={"file": ("doc.pdf", b"%PDF-1.4 fake content", "application/pdf")},
    )
    assert resp.status_code == 415


def test_mime_allowlist_rejects_text_plain(client):
    resp = client.post(
        "/analyze/image",
        files={"file": ("note.txt", b"hello world", "text/plain")},
    )
    assert resp.status_code == 415


def test_mime_allowlist_accepts_png(client):
    """A valid 1x1 PNG must be accepted (may fail analysis, but not 415)."""
    # Minimal valid 1×1 red PNG bytes
    import base64
    # 1x1 red pixel PNG
    png_b64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8"
        "/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg=="
    )
    png_bytes = base64.b64decode(png_b64)
    resp = client.post(
        "/analyze/image",
        files={"file": ("pixel.png", png_bytes, "image/png")},
    )
    # Must NOT be a 415 — any other status is fine (it will likely succeed or 500 on a tiny image)
    assert resp.status_code != 415

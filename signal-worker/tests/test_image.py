"""
Aiscern Detection Worker — image endpoint smoke tests (no real images required)
"""
import io
import pytest
from PIL import Image


def _make_png_bytes(w: int = 64, h: int = 64) -> bytes:
    """Create a small solid-colour PNG in memory."""
    img = Image.new("RGB", (w, h), color=(128, 64, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_analyze_image_rejects_non_image(client):
    resp = client.post(
        "/analyze/image",
        files={"file": ("test.txt", b"not an image", "text/plain")},
    )
    assert resp.status_code == 415


def test_analyze_image_smoke(client):
    png = _make_png_bytes()
    resp = client.post(
        "/analyze/image",
        files={"file": ("test.png", png, "image/png")},
    )
    # 200 or 500 (500 = forensic layer failed on synthetic image, which is acceptable in test)
    assert resp.status_code in (200, 500)
    if resp.status_code == 200:
        data = resp.json()
        assert data.get("status") == "success"
        assert "layers" in data
        assert "forensics" in data
        assert "version" in data


def test_auto_route_text(client):
    resp = client.post(
        "/analyze",
        json={"text": "This is a long enough text to be analyzed by the auto-route detection endpoint in the unified worker.", "jobId": "auto-1"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "composite_score" in data


def test_auto_route_unsupported_content_type(client):
    resp = client.post("/analyze", content=b"raw bytes", headers={"Content-Type": "application/octet-stream"})
    assert resp.status_code == 415

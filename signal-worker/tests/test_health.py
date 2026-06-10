"""
Aiscern Detection Worker — /health endpoint tests
"""


def test_health_returns_200(client):
    resp = client.get("/health")
    assert resp.status_code == 200


def test_health_schema(client):
    data = client.get("/health").json()
    assert data["status"] == "healthy"
    assert data["version"] == "4.0.0"
    assert "engines" in data
    assert "gpu" in data
    assert "timestamp" in data


def test_health_engine_keys(client):
    engines = client.get("/health").json()["engines"]
    assert "image_v2" in engines
    assert "image_v3_forensics" in engines
    assert "text" in engines
    assert "audio" in engines
    assert "video" in engines
    assert "l5_diffusion_inversion" in engines
    assert "l5b_diffusion_snapback" in engines

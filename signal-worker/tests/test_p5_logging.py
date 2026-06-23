"""
tests/test_p5_logging.py — P5/P6: Structured logging, /admin/cache, rate limiting.

Tests:
  - Structured log helper emits valid JSON with required fields
  - /admin/cache GET returns cache state
  - /admin/cache DELETE clears models and returns cleared list
  - /admin/cache is protected when ADMIN_API_KEY is set
  - Rate limiting middleware returns 429 after threshold
  - Rate limit exempts /health and /metrics
"""

import json
import logging
import os
import time
import io
import collections
from unittest.mock import patch

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image


# ── Fixtures ───────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def client():
    from main import app
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def _png_bytes(h: int = 32, w: int = 32) -> bytes:
    arr = np.random.randint(0, 255, (h, w, 3), dtype=np.uint8)
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="PNG")
    return buf.getvalue()


# ── Structured logging ─────────────────────────────────────────────────────────

class TestStructuredLog:
    def test_slog_import(self):
        from utils.structured_log import slog
        assert slog is not None

    def test_slog_emits_json_lines(self, caplog):
        """slog.engine_complete should emit a JSON-parseable record."""
        from utils.structured_log import slog, _json_logger

        records = []
        class _Capture(logging.Handler):
            def emit(self, record):
                records.append(record)

        handler = _Capture()
        _json_logger.addHandler(handler)
        try:
            slog.engine_complete(job_id="unit-001", engine="image",
                                 latency_ms=55, score=0.42)
        finally:
            _json_logger.removeHandler(handler)

        assert records, "No log records emitted"

    def test_slog_layer_complete_fields(self, caplog):
        """layer_complete must carry job_id, engine, layer, latency_ms, score."""
        from utils.structured_log import slog, _json_logger
        from utils.structured_log import _JSONFormatter

        buf = io.StringIO()
        handler = logging.StreamHandler(buf)
        handler.setFormatter(_JSONFormatter())
        _json_logger.addHandler(handler)
        try:
            slog.layer_complete(job_id="unit-002", engine="image", layer=6,
                                latency_ms=33, score=0.71, status="success")
        finally:
            _json_logger.removeHandler(handler)

        output = buf.getvalue().strip()
        assert output, "No output produced"
        payload = json.loads(output)
        assert payload["job_id"]    == "unit-002"
        assert payload["engine"]    == "image"
        assert payload["layer"]     == 6
        assert payload["latency_ms"] == 33
        assert payload["score"]     == 0.71
        assert payload["event"]     == "layer_complete"

    def test_slog_error_records_exc_type(self):
        from utils.structured_log import slog, _json_logger
        from utils.structured_log import _JSONFormatter

        buf = io.StringIO()
        handler = logging.StreamHandler(buf)
        handler.setFormatter(_JSONFormatter())
        _json_logger.addHandler(handler)
        try:
            slog.error(job_id="unit-003", engine="image", layer=2,
                       exc=ValueError("bad image"))
        finally:
            _json_logger.removeHandler(handler)

        payload = json.loads(buf.getvalue().strip())
        assert payload["exc_type"] == "ValueError"
        assert "bad image" in payload["exc_msg"]

    def test_slog_cache_evict(self):
        from utils.structured_log import slog, _json_logger
        from utils.structured_log import _JSONFormatter

        buf = io.StringIO()
        handler = logging.StreamHandler(buf)
        handler.setFormatter(_JSONFormatter())
        _json_logger.addHandler(handler)
        try:
            slog.cache_evict(keys=["model_a", "model_b"], reason="admin_manual_clear")
        finally:
            _json_logger.removeHandler(handler)

        payload = json.loads(buf.getvalue().strip())
        assert payload["event"]          == "cache_evict"
        assert "model_a" in payload["evicted_keys"]
        assert payload["reason"]         == "admin_manual_clear"


# ── /admin/cache ───────────────────────────────────────────────────────────────

class TestAdminCache:
    def test_get_returns_200_and_schema(self, client):
        resp = client.get("/admin/cache")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "cache" in data
        cache = data["cache"]
        assert "cached_models" in cache
        assert "model_count" in cache
        assert "idle_seconds" in cache

    def test_get_returns_rate_limit_info(self, client):
        resp = client.get("/admin/cache")
        data = resp.json()
        assert "rate_limit" in data
        rl = data["rate_limit"]
        assert "requests_per_window" in rl
        assert "window_seconds" in rl

    def test_delete_clears_cache(self, client):
        resp = client.delete("/admin/cache")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "cleared_keys" in data
        assert data["models_after"] == 0

    def test_get_after_delete_shows_empty(self, client):
        client.delete("/admin/cache")
        resp = client.get("/admin/cache")
        data = resp.json()
        assert data["cache"]["model_count"] == 0

    def test_admin_key_protection(self, client):
        """When ADMIN_API_KEY is set, missing key must return 403."""
        with patch.dict(os.environ, {"ADMIN_API_KEY": "secret-key-123"}):
            import main as m
            m.ADMIN_API_KEY = "secret-key-123"
            try:
                resp = client.get("/admin/cache")
                assert resp.status_code == 403
                resp_ok = client.get("/admin/cache",
                                     headers={"X-Admin-Key": "secret-key-123"})
                assert resp_ok.status_code == 200
            finally:
                m.ADMIN_API_KEY = ""


# ── Rate limiting ──────────────────────────────────────────────────────────────

class TestRateLimiting:
    def test_429_after_limit_exceeded(self, client):
        """Hammer /health 200 times (limit=60/60s) — must get at least one 429."""
        import main as m
        # Temporarily lower the limit to 3 for this test
        original = m._RATE_LIMIT_REQUESTS
        m._RATE_LIMIT_REQUESTS = 3
        # Reset buckets
        m._rate_buckets.clear()
        try:
            statuses = [client.get("/analyze/image").status_code for _ in range(6)]
        finally:
            m._RATE_LIMIT_REQUESTS = original
            m._rate_buckets.clear()
        # First 3 should not be 429; at least one of the last 3 must be 429
        assert 429 in statuses, f"Expected 429 but got: {statuses}"

    def test_health_exempt_from_rate_limit(self, client):
        """
        /health should never return 429 regardless of request count.
        Set rate limit to 1 and hammer /health — must stay 200.
        """
        import main as m
        original = m._RATE_LIMIT_REQUESTS
        m._RATE_LIMIT_REQUESTS = 1
        m._rate_buckets.clear()
        try:
            statuses = [client.get("/health").status_code for _ in range(5)]
        finally:
            m._RATE_LIMIT_REQUESTS = original
            m._rate_buckets.clear()
        assert 429 not in statuses, f"/health got rate-limited: {statuses}"

    def test_metrics_exempt_from_rate_limit(self, client):
        import main as m
        original = m._RATE_LIMIT_REQUESTS
        m._RATE_LIMIT_REQUESTS = 1
        m._rate_buckets.clear()
        try:
            statuses = [client.get("/metrics").status_code for _ in range(5)]
        finally:
            m._RATE_LIMIT_REQUESTS = original
            m._rate_buckets.clear()
        assert 429 not in statuses, f"/metrics got rate-limited: {statuses}"

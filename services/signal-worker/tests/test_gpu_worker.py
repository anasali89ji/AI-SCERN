#!/usr/bin/env python3
"""
AISCERN GPU Worker Integration Tests
Run after deployment to verify auth, rate limiting, and all layers work.

Usage:
    SIGNAL_WORKER_URL=https://gpu-worker.aiscern.com \
    INTERNAL_API_SECRET=your-secret \
    python3 tests/test_gpu_worker.py
"""
import os
import sys
import requests

BASE_URL = os.getenv("SIGNAL_WORKER_URL", "http://localhost:8080")
AUTH = os.getenv("INTERNAL_API_SECRET", "")
HEADERS = {"Authorization": f"Bearer {AUTH}"} if AUTH else {}


def test_health():
    r = requests.get(f"{BASE_URL}/health", timeout=5)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "healthy"
    print("OK /health")


def test_health_detailed():
    r = requests.get(f"{BASE_URL}/health/detailed", headers=HEADERS, timeout=5)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    print(f"OK /health/detailed -- GPU: {data.get('gpu', {})}")


def test_analyze_signals_no_auth():
    r = requests.post(f"{BASE_URL}/analyze-signals", json={
        "imageUrl": "https://picsum.photos/512/512",
        "jobId": "test-no-auth",
        "targetRegions": []
    }, timeout=30)
    if not AUTH:
        print("WARN INTERNAL_API_SECRET not set -- skipping auth-rejection assertion")
        return
    assert r.status_code == 401, f"Expected 401, got {r.status_code}"
    print("OK Auth rejection works")


def test_analyze_signals_with_auth():
    r = requests.post(f"{BASE_URL}/analyze-signals", headers=HEADERS, json={
        "imageUrl": "https://picsum.photos/512/512",
        "jobId": "test-with-auth",
        "targetRegions": []
    }, timeout=30)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    assert data["status"] == "success"
    assert len(data["layers"]) >= 3
    print(f"OK /analyze-signals -- {len(data['layers'])} layers returned")


def test_diffusion_inversion():
    r = requests.post(f"{BASE_URL}/diffusion-inversion", headers=HEADERS, json={
        "imageUrl": "https://picsum.photos/512/512"
    }, timeout=60)
    if r.status_code == 503:
        print("WARN /diffusion-inversion returned 503 (no GPU -- expected on CPU-only deploy)")
        return
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    print(f"OK /diffusion-inversion -- score={data.get('score')}, mse={data.get('mse')}")


def test_rate_limit():
    responses = []
    for i in range(15):
        try:
            r = requests.post(f"{BASE_URL}/analyze-signals", headers=HEADERS, json={
                "imageUrl": "https://picsum.photos/512/512",
                "jobId": f"rate-limit-test-{i}",
                "targetRegions": []
            }, timeout=5)
            responses.append(r.status_code)
        except Exception:
            responses.append(0)

    rate_limited = sum(1 for s in responses if s == 429)
    print(f"OK Rate limit test -- {rate_limited}/15 requests got 429")
    assert rate_limited > 0, "Expected at least one 429 response"


if __name__ == "__main__":
    print(f"Testing signal worker at {BASE_URL}")
    test_health()
    test_health_detailed()
    test_analyze_signals_no_auth()
    test_analyze_signals_with_auth()
    test_diffusion_inversion()
    test_rate_limit()
    print("\nAll tests passed!")

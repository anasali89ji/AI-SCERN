#!/usr/bin/env python3
"""
scripts/load_test.py — P6 load test for Aiscern signal-worker.

Usage
-----
  # Against local dev server (uvicorn main:app --port 8000)
  python3 scripts/load_test.py --url http://localhost:8000 --workers 10 --requests 100

  # Against DO App Platform
  python3 scripts/load_test.py --url https://<your-app>.ondigitalocean.app \
      --workers 5 --requests 50

Metrics printed at the end:
  - Total requests, success %, error %
  - p50 / p95 / p99 latency in ms
  - Requests/sec (wall-clock throughput)
  - Rate-limit hits (429 count)
  - Per-endpoint breakdown if --all-endpoints is passed

No external dependencies beyond stdlib + httpx (already in requirements.txt).
"""

from __future__ import annotations

import argparse
import io
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List

import httpx
import numpy as np
from PIL import Image


# ── Image generation ───────────────────────────────────────────────────────────

def _make_png(h: int = 64, w: int = 64) -> bytes:
    rng = np.random.default_rng()
    arr = rng.integers(0, 255, (h, w, 3), dtype=np.uint8)
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="PNG")
    return buf.getvalue()


# ── Single request ─────────────────────────────────────────────────────────────

def _post_image(base_url: str, timeout: float) -> Dict:
    """POST one PNG to /analyze/image, return timing + status."""
    img_bytes = _make_png()
    t0 = time.monotonic()
    try:
        resp = httpx.post(
            f"{base_url}/analyze/image",
            content=img_bytes,
            headers={"Content-Type": "image/png", "X-Job-ID": f"loadtest-{time.time_ns()}"},
            timeout=timeout,
        )
        elapsed_ms = (time.monotonic() - t0) * 1000
        return {
            "status_code": resp.status_code,
            "elapsed_ms": elapsed_ms,
            "ok": resp.status_code == 200,
            "rate_limited": resp.status_code == 429,
            "error": None,
        }
    except Exception as exc:
        elapsed_ms = (time.monotonic() - t0) * 1000
        return {
            "status_code": 0,
            "elapsed_ms": elapsed_ms,
            "ok": False,
            "rate_limited": False,
            "error": str(exc),
        }


def _get_admin_cache(base_url: str, timeout: float = 5.0) -> Dict:
    try:
        resp = httpx.get(f"{base_url}/admin/cache", timeout=timeout)
        return resp.json()
    except Exception as exc:
        return {"error": str(exc)}


def _get_metrics(base_url: str, timeout: float = 5.0) -> str:
    try:
        resp = httpx.get(f"{base_url}/metrics", timeout=timeout)
        return resp.text
    except Exception as exc:
        return f"ERROR: {exc}"


# ── Print helpers ──────────────────────────────────────────────────────────────

def _percentile(data: List[float], p: float) -> float:
    if not data:
        return 0.0
    return float(np.percentile(data, p))


def _print_results(results: List[Dict], wall_time: float, workers: int) -> None:
    total     = len(results)
    successes = [r for r in results if r["ok"]]
    errors    = [r for r in results if not r["ok"] and not r["rate_limited"]]
    rate_429  = [r for r in results if r["rate_limited"]]
    latencies = [r["elapsed_ms"] for r in results]

    print("\n" + "=" * 60)
    print("  LOAD TEST RESULTS")
    print("=" * 60)
    print(f"  Total requests   : {total}")
    print(f"  Workers          : {workers}")
    print(f"  Wall time        : {wall_time:.1f}s")
    print(f"  Throughput       : {total / wall_time:.1f} req/s")
    print()
    print(f"  ✓ Success (200)  : {len(successes)}  ({100*len(successes)/total:.1f}%)")
    print(f"  ✗ Errors         : {len(errors)}   ({100*len(errors)/total:.1f}%)")
    print(f"  ⚡ Rate-limited   : {len(rate_429)}  ({100*len(rate_429)/total:.1f}%)")
    print()
    if latencies:
        print(f"  Latency p50      : {_percentile(latencies, 50):.0f} ms")
        print(f"  Latency p95      : {_percentile(latencies, 95):.0f} ms")
        print(f"  Latency p99      : {_percentile(latencies, 99):.0f} ms")
        print(f"  Latency max      : {max(latencies):.0f} ms")
    if errors:
        print()
        print("  Sample errors:")
        for r in errors[:3]:
            print(f"    status={r['status_code']} err={r['error']}")
    print("=" * 60)


# ── CLI ────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Aiscern signal-worker load test")
    parser.add_argument("--url",      default="http://localhost:8000", help="Base URL")
    parser.add_argument("--workers",  type=int, default=5,   help="Concurrent threads")
    parser.add_argument("--requests", type=int, default=50,  help="Total requests")
    parser.add_argument("--timeout",  type=float, default=30.0, help="Per-request timeout (s)")
    parser.add_argument("--admin",    action="store_true", help="Show /admin/cache before+after")
    parser.add_argument("--metrics",  action="store_true", help="Dump /metrics after run")
    args = parser.parse_args()

    base = args.url.rstrip("/")
    print(f"\nAiscern Load Test → {base}")
    print(f"  {args.requests} requests  |  {args.workers} workers  |  timeout={args.timeout}s")

    # Warm-up health check
    try:
        health = httpx.get(f"{base}/health", timeout=5)
        print(f"  /health → {health.status_code}")
    except Exception as exc:
        print(f"  /health FAILED: {exc}")
        sys.exit(1)

    if args.admin:
        print("\n[admin/cache] Before:")
        print(_get_admin_cache(base))

    # Run load test
    results: List[Dict] = []
    t_start = time.monotonic()
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = [pool.submit(_post_image, base, args.timeout)
                for _ in range(args.requests)]
        for fut in as_completed(futs):
            results.append(fut.result())
    wall_time = time.monotonic() - t_start

    _print_results(results, wall_time, args.workers)

    if args.admin:
        print("\n[admin/cache] After:")
        print(_get_admin_cache(base))

    if args.metrics:
        print("\n[/metrics]")
        print(_get_metrics(base))


if __name__ == "__main__":
    main()

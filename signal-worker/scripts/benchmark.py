#!/usr/bin/env python3
"""
AISCERN Signal Worker — Object Physics Benchmark Script (Phase 9).

Usage:
    python scripts/benchmark.py --size 768 --iterations 10

Profiles every layer function, reports:
- Average runtime per layer
- Worst-case runtime per layer
- Memory usage per layer
- Combined pipeline runtime
- Aggregated statistics
"""

from __future__ import annotations

import argparse
import gc
import logging
import sys
import time
import tracemalloc
from pathlib import Path
from typing import Callable, Dict, List, Tuple

import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))

from analyzers.object_physics import (
    analyze_obp,
    analyze_mrc,
    analyze_gpc,
    analyze_tsad,
    analyze_osip,
)

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")

LAYERS: Dict[int, Tuple[str, Callable]] = {
    15: ("L15 OBP", analyze_obp),
    16: ("L16 MRC", analyze_mrc),
    17: ("L17 GPC", analyze_gpc),
    18: ("L18 TSAD", analyze_tsad),
    19: ("L19 OSIP", analyze_osip),
}


def _generate_test_image(size: int, seed: int = 42) -> np.ndarray:
    """Generate a realistic synthetic test image."""
    rng = np.random.default_rng(seed)
    img = rng.integers(0, 255, (size, size, 3), dtype=np.uint8)
    # Add some structure (not just noise)
    img = img.astype(np.float32)
    for i in range(3):
        img[:, :, i] += np.linspace(0, 50, size)[None, :]
        img[:, :, i] += np.linspace(0, 30, size)[:, None]
    img = np.clip(img, 0, 255).astype(np.uint8)
    return img


def _benchmark_layer(
    layer_id: int,
    name: str,
    func: Callable,
    img: np.ndarray,
    iterations: int,
) -> Dict[str, float]:
    """
    Benchmark a single layer.

    Returns dict with:
        avg_ms, worst_ms, min_ms, std_ms, peak_mb, total_ms
    """
    times: List[float] = []
    peak_memories: List[float] = []

    # Warmup
    for _ in range(2):
        func(img)
    gc.collect()

    for _ in range(iterations):
        gc.collect()
        tracemalloc.start()
        t0 = time.monotonic()
        result = func(img)
        t1 = time.monotonic()
        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        elapsed_ms = (t1 - t0) * 1000
        times.append(elapsed_ms)
        peak_memories.append(peak / (1024 * 1024))  # MB

        # Validate result
        assert 0.0 <= result["layerSuspicionScore"] <= 1.0
        assert result["status"] in ("success", "failure", "neutral_scene_type")

    return {
        "avg_ms": float(np.mean(times)),
        "worst_ms": float(np.max(times)),
        "min_ms": float(np.min(times)),
        "std_ms": float(np.std(times)),
        "peak_mb": float(np.max(peak_memories)),
        "total_ms": float(np.sum(times)),
    }


def _benchmark_combined(
    img: np.ndarray,
    iterations: int,
) -> Dict[str, float]:
    """Benchmark all layers running sequentially."""
    times: List[float] = []

    for _ in range(iterations):
        gc.collect()
        t0 = time.monotonic()
        for layer_id, (name, func) in LAYERS.items():
            func(img)
        t1 = time.monotonic()
        times.append((t1 - t0) * 1000)

    return {
        "avg_ms": float(np.mean(times)),
        "worst_ms": float(np.max(times)),
        "min_ms": float(np.min(times)),
        "std_ms": float(np.std(times)),
        "total_ms": float(np.sum(times)),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark object physics layers.")
    parser.add_argument("--size", type=int, default=768, help="Image size (square)")
    parser.add_argument("--iterations", type=int, default=10, help="Number of iterations")
    args = parser.parse_args()

    img = _generate_test_image(args.size)
    logger.info("Benchmarking with %d×%d RGB image, %d iterations",
                args.size, args.size, args.iterations)

    print("\n" + "=" * 70)
    print("AISCERN Object Physics Layer Benchmark")
    print(f"Image size: {args.size}×{args.size} px  |  Iterations: {args.iterations}")
    print("=" * 70)

    # Per-layer benchmarks
    print(f"\n{'Layer':<12} {'Avg (ms)':<12} {'Worst (ms)':<14} {'Min (ms)':<12} {'Std (ms)':<12} {'Peak (MB)':<12} {'Status'}")
    print("-" * 90)

    all_within_budget = True
    for layer_id, (name, func) in LAYERS.items():
        stats = _benchmark_layer(layer_id, name, func, img, args.iterations)
        status = "PASS" if stats["avg_ms"] < 400 and stats["peak_mb"] < 300 else "FAIL"
        if status == "FAIL":
            all_within_budget = False

        print(f"{name:<12} {stats['avg_ms']:>10.2f}  {stats['worst_ms']:>12.2f}  "
              f"{stats['min_ms']:>10.2f}  {stats['std_ms']:>10.2f}  "
              f"{stats['peak_mb']:>10.2f}  {status}")

    # Combined benchmark
    print("\n" + "-" * 90)
    combined = _benchmark_combined(img, args.iterations)
    status = "PASS" if combined["avg_ms"] < 2000 else "FAIL"
    if status == "FAIL":
        all_within_budget = False

    print(f"{'COMBINED':<12} {combined['avg_ms']:>10.2f}  {combined['worst_ms']:>12.2f}  "
          f"{combined['min_ms']:>10.2f}  {combined['std_ms']:>10.2f}  "
          f"{'—':>10}  {status}")

    print("\n" + "=" * 70)
    print("Budget Requirements:")
    print("  Per layer:  < 400 ms runtime, < 300 MB memory")
    print("  Combined:   < 2000 ms runtime")
    print(f"  Result:     {'ALL WITHIN BUDGET' if all_within_budget else 'BUDGET EXCEEDED'}")
    print("=" * 70 + "\n")

    return 0 if all_within_budget else 1


if __name__ == "__main__":
    sys.exit(main())

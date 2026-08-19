#!/usr/bin/env python3
"""
AISCERN Signal Worker — Calibration Dataset Fetcher

Streams a labeled real-vs-AI dataset from the Hugging Face Hub and writes it
to disk as <output>/real/*.jpg and <output>/ai/*.jpg — the exact layout
scripts/calibrate.py expects. Uses streaming=True so it never downloads the
full multi-GB parquet shards; it only pulls the N samples you ask for.

Default target: TheKernel01/Tiny-GenImage (28k train / 7k val, labeled
real/fake + generator: Midjourney, SD14, SD15, ADM, BigGAN, GLIDE, VQDM,
Wukong). Schema: {"image": PIL.Image, "label": 0=real/1=fake,
"generator": class_label}.

Usage:
    python scripts/fetch_calibration_dataset.py --output ./calib_data --per-class 150
    python scripts/fetch_calibration_dataset.py --output ./calib_data --per-class 100 --split validation
    python scripts/fetch_calibration_dataset.py --output ./calib_data --per-class 200 --generators Midjourney,SD14

Then:
    python scripts/calibrate.py --dataset ./calib_data
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

try:
    from datasets import load_dataset
except ImportError:
    print(
        "Missing dependency. Install with:\n"
        "  pip install datasets pillow --break-system-packages\n",
        file=sys.stderr,
    )
    sys.exit(1)

# Must match TheKernel01/Tiny-GenImage's generator ClassLabel mapping exactly
# (see the dataset README) — used only to support --generators filtering by name.
GENERATOR_NAMES = {
    0: "Real", 1: "ADM", 2: "BigGAN", 3: "GLIDE", 4: "Midjourney",
    5: "SD14", 6: "SD15", 7: "VQDM", 8: "Wukong",
}
GENERATOR_NAME_TO_ID = {v.lower(): k for k, v in GENERATOR_NAMES.items()}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--dataset", default="TheKernel01/Tiny-GenImage",
                    help="HF dataset repo id (default: TheKernel01/Tiny-GenImage)")
    p.add_argument("--output", required=True, type=Path,
                    help="Output directory — will contain real/ and ai/ subfolders")
    p.add_argument("--split", default="train", choices=["train", "validation"],
                    help="Which split to stream from (default: train)")
    p.add_argument("--per-class", type=int, default=150,
                    help="How many REAL images and how many AI images to fetch (default: 150 each)")
    p.add_argument("--generators", default=None,
                    help="Comma-separated generator names to restrict AI samples to "
                         "(e.g. 'Midjourney,SD14'). Default: all generators, round-robin sampled.")
    p.add_argument("--seed", type=int, default=42, help="Shuffle seed (default: 42)")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    real_dir = args.output / "real"
    ai_dir = args.output / "ai"
    real_dir.mkdir(parents=True, exist_ok=True)
    ai_dir.mkdir(parents=True, exist_ok=True)

    wanted_generators: set[int] | None = None
    if args.generators:
        wanted_generators = set()
        for name in args.generators.split(","):
            key = name.strip().lower()
            if key not in GENERATOR_NAME_TO_ID:
                valid = ", ".join(GENERATOR_NAMES[i] for i in range(1, 9))
                print(f"Unknown generator '{name}'. Valid options: {valid}", file=sys.stderr)
                sys.exit(1)
            wanted_generators.add(GENERATOR_NAME_TO_ID[key])

    print(f"Streaming {args.dataset} [{args.split}] ... (no full download, samples pulled on demand)")
    ds = load_dataset(args.dataset, split=args.split, streaming=True)
    ds = ds.shuffle(seed=args.seed, buffer_size=2000)

    n_real = 0
    n_ai = 0
    ai_generator_counts: Counter[str] = Counter()
    target_total = args.per_class * 2

    for row in ds:
        if n_real >= args.per_class and n_ai >= args.per_class:
            break

        label = row.get("label")
        generator_id = row.get("generator")
        img = row.get("image")
        if img is None or label is None:
            continue

        if label == 0:  # real
            if n_real >= args.per_class:
                continue
            out_path = real_dir / f"real_{n_real:05d}.jpg"
            n_real += 1
        else:  # fake / AI
            if n_ai >= args.per_class:
                continue
            if wanted_generators is not None and generator_id not in wanted_generators:
                continue
            gen_name = GENERATOR_NAMES.get(generator_id, "Unknown")
            out_path = ai_dir / f"ai_{gen_name.lower()}_{n_ai:05d}.jpg"
            ai_generator_counts[gen_name] += 1
            n_ai += 1

        try:
            img.convert("RGB").save(out_path, "JPEG", quality=95)
        except Exception as e:  # noqa: BLE001 - skip bad rows, keep going
            print(f"  skipped one image ({e})", file=sys.stderr)
            continue

        done = n_real + n_ai
        if done % 25 == 0 or done == target_total:
            print(f"  [{done}/{target_total}] real={n_real} ai={n_ai}")

    print(f"\nDone. Wrote {n_real} real -> {real_dir}")
    print(f"      Wrote {n_ai} ai   -> {ai_dir}")
    if ai_generator_counts:
        print("AI generator breakdown:")
        for gen, count in ai_generator_counts.most_common():
            print(f"  {gen:<12} {count}")

    if n_real < args.per_class or n_ai < args.per_class:
        print(
            f"\nWARNING: got fewer samples than requested "
            f"(real={n_real}/{args.per_class}, ai={n_ai}/{args.per_class}). "
            f"Dataset/split may be smaller than expected, or --generators filter too narrow.",
            file=sys.stderr,
        )

    print(f"\nNext step:\n  python scripts/calibrate.py --dataset {args.output}")


if __name__ == "__main__":
    main()

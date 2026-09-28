#!/usr/bin/env python3
"""
AISCERN Signal Worker — Calibration Harness (v1.0, Track A)

Runs the full image pipeline (L1-L21) over a labeled dataset and reports,
per layer:
  - how many images it actually voted on (excludes "failure"/"not_applicable"/
    "neutral_scene_type" — same exclusion rule _fuse_scores() uses)
  - ROC-AUC of that layer's raw layerSuspicionScore vs. ground truth
  - the current real_threshold/ai_threshold this repo effectively uses
    (LAYER_WEIGHTS entry + observed score distribution)
  - a suggested threshold (Youden's J statistic: the score that maximizes
    TPR - FPR) and what AUC/precision/recall look like there

It also reports the end-to-end fused_score AUC so layer-level calibration
can be checked against overall pipeline accuracy, not just in isolation.

No sklearn dependency — AUC is computed via the Mann-Whitney U / rank-sum
identity (AUC = U / (n_pos * n_neg)), which is exact and needs only numpy.

Dataset layout expected:
    <dataset_root>/
        real/   *.jpg, *.png, ...   (label = 0, "not AI-generated")
        ai/     *.jpg, *.png, ...   (label = 1, "AI-generated")

Usage:
    python scripts/calibrate.py --dataset ./dataset
    python scripts/calibrate.py --dataset ./dataset --output config/calibration_report.json
    python scripts/calibrate.py --dataset ./dataset --layers 15,16,17,18,19,20,21
    python scripts/calibrate.py --dataset ./dataset --min-per-class 5

This script does NOT auto-rewrite config/object_physics_thresholds.json or
LAYER_WEIGHTS in engines/image_engine.py — sub-signal thresholds inside that
file are per-metric (edge roughness, highlight variance, etc.), one level
below what a black-box calibration pass over layerSuspicionScore can safely
recommend. This harness tells you WHICH layers need attention and what
threshold the evidence supports; a human (or a follow-up per-signal pass)
still applies it. Treat the "suggested_threshold" numbers as a diagnostic,
not an auto-patch.
"""

from __future__ import annotations

import argparse
import json
import logging
import mimetypes
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

# Ensure signal-worker root is importable regardless of cwd
sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger("calibrate")

# Statuses that _fuse_scores() itself excludes from the composite — a layer
# that opted out (scene not applicable, or it hard-failed) contributes zero
# information about real-vs-AI and must not be scored as if it voted "real".
NEUTRAL_STATUSES = ("failure", "neutral_scene_type", "not_applicable")

# layer_num -> (name, current_weight_in_fusion) — kept in sync manually with
# engines/image_engine.py's LAYER_WEIGHTS. Not imported directly because
# LAYER_WEIGHTS is a local variable inside _fuse_scores(), not a module-level
# constant; duplicating it here is the lesser evil vs. refactoring that
# function's internals just for this script. If you change LAYER_WEIGHTS,
# update this table too.
LAYER_INFO: Dict[int, Tuple[str, float]] = {
    1:  ("Pixel Integrity (ELA)",                 1.1),
    2:  ("DCT Compression",                       1.0),
    3:  ("Noise & Statistical",                   0.9),
    4:  ("Frequency Domain",                      0.9),
    6:  ("Zero-Shot Entropy Detector",             1.0),
    7:  ("DIRE Approximation",                    1.0),
    8:  ("NLM Noise Entropy Tensor",               0.9),
    9:  ("Modern AI Fingerprint",                 1.3),
    10: ("Generative Fingerprinting Engine",       1.2),
    11: ("PAFRA (Polarization)",                  1.0),
    12: ("BDIS (Bayer Demosaicing)",               1.3),
    13: ("SSWDP (Subsurface Scattering)",          1.0),
    14: ("QESM (Quantum Efficiency Spectral)",     0.9),
    15: ("OBP (Object Boundary Physics)",          1.1),
    16: ("MRC (Material Reflectance)",             1.0),
    17: ("GPC (Geometry & Perspective)",           0.9),
    18: ("TSAD (Texture Synthesis Artifacts)",     1.2),
    19: ("OSIP (Object-Scene Interaction)",        1.0),
    20: ("MISG (Multi-Illuminant/Shadow)",         0.35),
    21: ("LOP (Lens & Optical Physics)",           0.45),
}

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


# ── AUC / threshold math (no sklearn) ───────────────────────────────────────

def roc_auc(scores: np.ndarray, labels: np.ndarray) -> Optional[float]:
    """
    AUC via the Mann-Whitney U / rank-sum identity:
        AUC = (sum of ranks of positive class - n_pos*(n_pos+1)/2) / (n_pos*n_neg)
    Ties are handled by average-ranking (standard scipy.rankdata behavior,
    reimplemented here to avoid a scipy dependency).
    Returns None if either class is empty (AUC undefined).
    """
    n_pos = int(np.sum(labels == 1))
    n_neg = int(np.sum(labels == 0))
    if n_pos == 0 or n_neg == 0:
        return None

    order = np.argsort(scores, kind="mergesort")
    ranks = np.empty(len(scores), dtype=float)
    sorted_scores = scores[order]

    # average-rank ties
    i = 0
    rank = 1
    while i < len(sorted_scores):
        j = i
        while j < len(sorted_scores) and sorted_scores[j] == sorted_scores[i]:
            j += 1
        avg_rank = (rank + (rank + (j - i) - 1)) / 2.0
        ranks[order[i:j]] = avg_rank
        rank += (j - i)
        i = j

    sum_ranks_pos = float(np.sum(ranks[labels == 1]))
    u = sum_ranks_pos - n_pos * (n_pos + 1) / 2.0
    return u / (n_pos * n_neg)


def best_threshold_youden(scores: np.ndarray, labels: np.ndarray) -> Dict[str, Any]:
    """
    Sweep every observed score as a candidate threshold (score >= t => "AI"),
    pick the one maximizing Youden's J = TPR - FPR. Returns the threshold plus
    the confusion-matrix stats at that point, so precision/recall are
    inspectable rather than trusting J blindly.
    """
    n_pos = int(np.sum(labels == 1))
    n_neg = int(np.sum(labels == 0))
    candidates = np.unique(scores)
    best = {"threshold": 0.5, "j": -1.0, "tpr": 0.0, "fpr": 0.0,
            "precision": 0.0, "recall": 0.0, "accuracy": 0.0}

    for t in candidates:
        pred_ai = scores >= t
        tp = int(np.sum(pred_ai & (labels == 1)))
        fp = int(np.sum(pred_ai & (labels == 0)))
        fn = n_pos - tp
        tn = n_neg - fp

        tpr = tp / n_pos if n_pos else 0.0
        fpr = fp / n_neg if n_neg else 0.0
        j = tpr - fpr
        if j > best["j"]:
            precision = tp / (tp + fp) if (tp + fp) else 0.0
            recall = tpr
            accuracy = (tp + tn) / (n_pos + n_neg) if (n_pos + n_neg) else 0.0
            best = {"threshold": round(float(t), 4), "j": round(float(j), 4),
                    "tpr": round(tpr, 4), "fpr": round(fpr, 4),
                    "precision": round(precision, 4), "recall": round(recall, 4),
                    "accuracy": round(accuracy, 4)}
    return best


# ── Dataset loading + pipeline execution ────────────────────────────────────

def discover_dataset(root: Path) -> List[Tuple[Path, int]]:
    """Returns [(image_path, label)] where label 1='ai', 0='real'."""
    items: List[Tuple[Path, int]] = []
    for subdir, label in (("real", 0), ("ai", 1)):
        d = root / subdir
        if not d.is_dir():
            logger.warning("Expected subdirectory not found: %s", d)
            continue
        for p in sorted(d.iterdir()):
            if p.suffix.lower() in IMAGE_EXTS:
                items.append((p, label))
    return items


def run_pipeline_on_dataset(
    items: List[Tuple[Path, int]],
) -> Tuple[List[Dict[str, Any]], List[int], List[float], List[str]]:
    """
    Runs analyze_image_from_bytes() on every image. Returns:
      per_image_layers : list of {layer_num: (score, status)} dicts, one per image
      labels            : ground-truth label per image (0/1)
      fused_scores       : fused_score per image
      errors             : filenames that failed to analyze (for the report)
    """
    from engines.image_engine import analyze_image_from_bytes

    per_image_layers: List[Dict[int, Tuple[float, str]]] = []
    labels: List[int] = []
    fused_scores: List[float] = []
    errors: List[str] = []

    for idx, (path, label) in enumerate(items, start=1):
        try:
            data = path.read_bytes()
            ctype = mimetypes.guess_type(str(path))[0] or "image/jpeg"
            t0 = time.monotonic()
            result = analyze_image_from_bytes(data, ctype, job_id=f"calib-{idx}")
            elapsed = time.monotonic() - t0

            if result.get("status") != "success":
                logger.warning("FAILED  %-40s %s", path.name, result.get("error", "unknown error"))
                errors.append(f"{path} :: {result.get('error', 'unknown error')}")
                continue

            layer_map: Dict[int, Tuple[float, str]] = {}
            for lr in result.get("layers", []):
                lnum = lr.get("layer")
                if lnum is None:
                    continue
                layer_map[lnum] = (
                    float(lr.get("layerSuspicionScore", 0.5)),
                    lr.get("status", "unknown"),
                )
            per_image_layers.append(layer_map)
            labels.append(label)
            fused_scores.append(float(result["composite_score"]["fused_score"]))

            print(f"  [{idx:>4}/{len(items)}] {path.name:<40} "
                  f"label={'ai ' if label else 'real'}  "
                  f"fused={result['composite_score']['fused_score']:.3f}  "
                  f"({elapsed:.1f}s)")

        except Exception as e:  # noqa: BLE001 - report and keep going
            logger.warning("ERROR   %-40s %s", path.name, e)
            errors.append(f"{path} :: {e}")

    return per_image_layers, labels, fused_scores, errors


# ── Reporting ────────────────────────────────────────────────────────────

def build_report(
    per_image_layers: List[Dict[int, Tuple[float, str]]],
    labels: List[int],
    fused_scores: List[float],
    layer_filter: Optional[List[int]],
    min_per_class: int,
) -> Dict[str, Any]:
    labels_arr = np.array(labels)
    n_real = int(np.sum(labels_arr == 0))
    n_ai = int(np.sum(labels_arr == 1))

    report: Dict[str, Any] = {
        "dataset_summary": {
            "n_images_analyzed": len(labels),
            "n_real": n_real,
            "n_ai": n_ai,
            "min_per_class_for_reliable_stats": min_per_class,
        },
        "layers": {},
        "flagged": [],  # layers needing attention: low AUC, or too few samples
    }

    # ── fused end-to-end score ──
    fused_auc = roc_auc(np.array(fused_scores), labels_arr)
    fused_best = best_threshold_youden(np.array(fused_scores), labels_arr) if fused_auc is not None else None
    report["fused_score"] = {
        "auc": round(fused_auc, 4) if fused_auc is not None else None,
        "n": len(fused_scores),
        "youden_best": fused_best,
    }

    layer_nums = sorted(layer_filter) if layer_filter else sorted(LAYER_INFO.keys())

    for lnum in layer_nums:
        name, weight = LAYER_INFO.get(lnum, (f"Layer {lnum}", None))
        scores = []
        lbls = []
        n_neutral = 0
        for layer_map, label in zip(per_image_layers, labels):
            entry = layer_map.get(lnum)
            if entry is None:
                continue
            score, status = entry
            if status in NEUTRAL_STATUSES:
                n_neutral += 1
                continue
            scores.append(score)
            lbls.append(label)

        scores_arr = np.array(scores)
        lbls_arr = np.array(lbls)
        n_real_layer = int(np.sum(lbls_arr == 0)) if len(lbls_arr) else 0
        n_ai_layer = int(np.sum(lbls_arr == 1)) if len(lbls_arr) else 0

        entry_report: Dict[str, Any] = {
            "name": name,
            "current_fusion_weight": weight,
            "n_active_votes": len(scores),
            "n_neutral_or_failed": n_neutral,
            "n_real": n_real_layer,
            "n_ai": n_ai_layer,
        }

        reliable = n_real_layer >= min_per_class and n_ai_layer >= min_per_class
        entry_report["reliable_sample_size"] = reliable

        if not reliable:
            entry_report["auc"] = None
            entry_report["note"] = (
                f"Fewer than {min_per_class} samples in one class "
                f"(real={n_real_layer}, ai={n_ai_layer}) — AUC/threshold not computed."
            )
            report["flagged"].append({
                "layer": lnum, "name": name,
                "reason": "insufficient_samples",
                "n_real": n_real_layer, "n_ai": n_ai_layer,
            })
        else:
            auc = roc_auc(scores_arr, lbls_arr)
            best = best_threshold_youden(scores_arr, lbls_arr)
            entry_report["auc"] = round(auc, 4) if auc is not None else None
            entry_report["real_score_mean"] = round(float(np.mean(scores_arr[lbls_arr == 0])), 4)
            entry_report["ai_score_mean"] = round(float(np.mean(scores_arr[lbls_arr == 1])), 4)
            entry_report["real_score_std"] = round(float(np.std(scores_arr[lbls_arr == 0])), 4)
            entry_report["ai_score_std"] = round(float(np.std(scores_arr[lbls_arr == 1])), 4)
            entry_report["suggested_threshold"] = best

            if auc is not None and auc < 0.60:
                report["flagged"].append({
                    "layer": lnum, "name": name,
                    "reason": "low_auc_near_or_below_chance",
                    "auc": round(auc, 4),
                })
            elif auc is not None and entry_report["real_score_mean"] > entry_report["ai_score_mean"]:
                # Direction is inverted vs. what layerSuspicionScore is supposed
                # to mean (higher = more AI-like) — this is exactly the class of
                # bug that hit L20 on real photos.
                report["flagged"].append({
                    "layer": lnum, "name": name,
                    "reason": "inverted_direction_real_scores_higher_than_ai",
                    "real_mean": entry_report["real_score_mean"],
                    "ai_mean": entry_report["ai_score_mean"],
                })

        report["layers"][str(lnum)] = entry_report

    return report


def print_summary_table(report: Dict[str, Any]) -> None:
    print("\n" + "=" * 96)
    print("CALIBRATION SUMMARY")
    print("=" * 96)
    ds = report["dataset_summary"]
    print(f"Images analyzed: {ds['n_images_analyzed']}  (real={ds['n_real']}, ai={ds['n_ai']})")
    fs = report["fused_score"]
    auc_str = f"{fs['auc']:.3f}" if fs["auc"] is not None else "n/a"
    print(f"Fused end-to-end AUC: {auc_str}")
    if fs.get("youden_best"):
        b = fs["youden_best"]
        print(f"  Youden-optimal fused threshold: {b['threshold']:.3f}  "
              f"(precision={b['precision']:.3f}, recall={b['recall']:.3f}, accuracy={b['accuracy']:.3f})")
    print("-" * 96)
    print(f"{'L#':<4}{'Name':<38}{'weight':<8}{'n(real/ai)':<12}{'AUC':<8}{'suggested_thr':<15}{'flag'}")
    print("-" * 96)
    for lnum_str, e in sorted(report["layers"].items(), key=lambda kv: int(kv[0])):
        auc_str = f"{e['auc']:.3f}" if e.get("auc") is not None else "n/a"
        thr_str = f"{e['suggested_threshold']['threshold']:.3f}" if e.get("suggested_threshold") else "n/a"
        flag = ""
        for f in report["flagged"]:
            if f["layer"] == int(lnum_str):
                flag = f["reason"]
        weight_str = f"{e['current_fusion_weight']:.2f}" if e["current_fusion_weight"] is not None else "n/a"
        n_str = f"{e['n_real']}/{e['n_ai']}"
        print(f"{lnum_str:<4}{e['name']:<38}{weight_str:<8}"
              f"{n_str:<12}{auc_str:<8}{thr_str:<15}{flag}")
    print("=" * 96)
    if report["flagged"]:
        print(f"\n{len(report['flagged'])} layer(s) flagged for attention — see 'flagged' in the JSON report.")
    else:
        print("\nNo layers flagged. (Note: this only means nothing crossed the flag "
              "thresholds on THIS dataset — small datasets can still hide problems.)")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Calibrate layer thresholds against a labeled real/ai image dataset."
    )
    parser.add_argument("--dataset", required=True,
                         help="Path to dataset root containing real/ and ai/ subfolders")
    parser.add_argument("--output", default=None,
                         help="Output JSON report path (default: <dataset>/calibration_report.json)")
    parser.add_argument("--layers", default=None,
                         help="Comma-separated layer numbers to calibrate (default: all L1-L21)")
    parser.add_argument("--min-per-class", type=int, default=8,
                         help="Minimum samples per class required before AUC/threshold is trusted (default: 8)")
    args = parser.parse_args()

    dataset_root = Path(args.dataset)
    if not dataset_root.is_dir():
        print(f"[calibrate] ERROR: dataset path does not exist: {dataset_root}")
        return 1

    layer_filter = None
    if args.layers:
        layer_filter = [int(x) for x in args.layers.split(",") if x.strip()]

    items = discover_dataset(dataset_root)
    if not items:
        print(f"[calibrate] ERROR: no images found under {dataset_root}/real or {dataset_root}/ai")
        print("            Expected layout: <dataset>/real/*.jpg, <dataset>/ai/*.jpg")
        return 1

    n_real = sum(1 for _, l in items if l == 0)
    n_ai = sum(1 for _, l in items if l == 1)
    print(f"[calibrate] Found {len(items)} images ({n_real} real, {n_ai} ai). Running pipeline...\n")

    per_image_layers, labels, fused_scores, errors = run_pipeline_on_dataset(items)

    if len(labels) < 2:
        print("[calibrate] ERROR: fewer than 2 images analyzed successfully — cannot calibrate.")
        return 1

    report = build_report(per_image_layers, labels, fused_scores, layer_filter, args.min_per_class)
    report["errors"] = errors
    report["generated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    print_summary_table(report)

    output_path = Path(args.output) if args.output else dataset_root / "calibration_report.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2))
    print(f"\nFull report written to: {output_path}")

    if errors:
        print(f"\n{len(errors)} image(s) failed to analyze — see 'errors' in the JSON report.")

    return 0


if __name__ == "__main__":
    sys.exit(main())

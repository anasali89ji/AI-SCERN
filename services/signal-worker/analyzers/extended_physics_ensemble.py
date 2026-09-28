"""
Aiscern Detection Worker — Extended Physics Layer Ensemble (L20-L21, v4.8.0)
Orchestrates L20 (MISG — Multi-Illuminant & Global Shadow Geometry) and
L21 (LOP — Lens & Optical Physics).

*** CALIBRATION STATUS: PROVISIONAL — DO NOT WEIGHT AS HIGHLY AS L11-L19 ***

Unlike L11-L19, these two layers' threshold constants (in analyzers/misg.py
and analyzers/lop.py) were NOT calibrated against a labeled dataset of real
vs. AI-generated images — there was no such dataset available at
implementation time. They were set from physical reasoning about what
"tight" vs. "scattered" shadow consensus, or "real-lens-like" vs.
"filter-like" chromatic aberration correlation, should plausibly look like.

A quick test against 3 real public-domain photos (OpenCV's sample images:
lena.jpg, fruits.jpg, building.jpg) and one synthetic no-chromatic-
aberration control image showed:
  - L21 (LOP) chromatic-aberration signal behaved correctly: it gave the
    zero-CA synthetic image the maximum suspicion score (1.000) while
    giving real photos a lower, more mixed 0.44-0.88 range. This signal
    appears directionally sound.
  - L20 (MISG) shadow-consensus signal scored REAL photos too high
    (0.70-0.80 on 2 of 3 real test photos) — i.e. its thresholds are
    currently miscalibrated toward false positives on real images. This
    needs a real calibration pass (see scripts/calibrate.py, once a
    labeled dataset exists) before it should be trusted at full weight.

Given this, both layers are wired into the pipeline and DO run (so their
raw evidence is visible in every LayerReport for human review and for
building the calibration dataset itself), but are weighted low
(see _WEIGHTS below) so an uncalibrated false-positive-prone signal cannot
meaningfully move the final fused verdict until it's been properly
calibrated. Raise these weights only after running scripts/calibrate.py
against a real labeled dataset and confirming ROC/threshold behavior.
"""

from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict

import numpy as np

logger = logging.getLogger(__name__)

# ── Layer weights — PROVISIONAL, see module docstring. Deliberately much
#    lower than L11-L19 (which range 0.9-1.3) until calibrated.
_WEIGHTS = {
    "misg": 0.35,  # L20 — known false-positive-prone on real photos, see above
    "lop":  0.45,  # L21 — directionally sound in quick test, still uncalibrated
}

_NEUTRAL_STATUSES = ("failure", "not_applicable", "neutral_scene_type")


def run_extended_physics_analysis(
    img: np.ndarray,
    img_pil: Any = None,
) -> Dict[str, Any]:
    """
    Run L20 (MISG) and L21 (LOP) and return a combined result, in the same
    shape as analyzers.physical_consistency.run_physical_analysis() and
    analyzers.object_physics_ensemble.run_object_physics_analysis().
    """
    t0 = time.monotonic()

    from analyzers.misg import analyze_misg
    from analyzers.lop import analyze_lop
    from utils.evidence_builder import evidence_node, build_layer_report

    with ThreadPoolExecutor(max_workers=2) as pool:
        f_misg = pool.submit(analyze_misg, img, img_pil)
        f_lop  = pool.submit(analyze_lop,  img, img_pil)
        misg_r = f_misg.result()
        lop_r  = f_lop.result()

    def _to_layer_report(layer_num: int, layer_display: str, result: dict) -> dict:
        score = float(result.get("score", 0.5))
        status = result.get("status", "failure")
        elapsed = int(result.get("elapsed_ms", 0))
        raw_evidence = result.get("evidence", [])
        ev_nodes = []
        for ev in raw_evidence:
            ev_score = float(ev.get("score", 0.5))
            if ev_score > 0.55:
                ev_status = "anomalous"
            elif ev_score < 0.45:
                ev_status = "normal"
            else:
                ev_status = "inconclusive"
            ev_nodes.append(evidence_node(
                layer=layer_num,
                category="physics",
                artifact_type=ev.get("name", "unknown"),
                status=ev_status,
                confidence=abs(ev_score - 0.5) * 2.0,
                detail=ev.get("detail", "") + " [PROVISIONAL: uncalibrated threshold]",
                raw_value=ev_score,
            ))
        return build_layer_report(
            layer=layer_num, layer_name=layer_display, evidence=ev_nodes,
            status=status, elapsed_ms=elapsed, score=score,
        )

    misg_report = _to_layer_report(20, "MISG – Multi-Illuminant & Global Shadow Geometry [provisional]", misg_r)
    lop_report  = _to_layer_report(21, "LOP – Lens & Optical Physics [provisional]", lop_r)

    weighted_sum = 0.0
    total_weight = 0.0
    active_signals = 0
    for name, res in (("misg", misg_r), ("lop", lop_r)):
        status = res.get("status", "failure")
        score = float(res.get("score", 0.5))
        w = _WEIGHTS.get(name, 0.3)
        if status not in _NEUTRAL_STATUSES:
            weighted_sum += score * w
            total_weight += w
            active_signals += 1

    composite = float(weighted_sum / total_weight) if total_weight > 0 else 0.5
    composite = float(np.clip(composite, 0.0, 1.0))

    elapsed = int((time.monotonic() - t0) * 1000)

    return {
        "misg":            misg_r,
        "lop":             lop_r,
        "composite_score": round(composite, 4),
        "active_signals":  active_signals,
        "layer_reports":   [misg_report, lop_report],
        "elapsed_ms":      elapsed,
    }

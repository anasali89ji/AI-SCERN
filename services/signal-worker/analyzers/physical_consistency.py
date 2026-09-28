"""
Aiscern Detection Worker — Physical Consistency Layer Ensemble
Orchestrates L11 (PAFRA), L12 (BDIS), L13 (SSWDP), L14 (QESM).

run_physical_analysis() is the single public entry point.
It runs all four analyzers (BDIS is always active; others are scene-dependent)
and returns individual results plus a weighted composite score.

Each analyzer may return score=0.5 (neutral) when its scene conditions aren't
met — these neutrals are excluded from the composite to prevent dilution.
"""

from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, Optional

import numpy as np

from utils.evidence_builder import build_layer_report, evidence_node

logger = logging.getLogger(__name__)

# ── Layer weights (how much each analyzer contributes to composite) ──────────
_WEIGHTS = {
    "bdis":  1.4,  # Always active — most universally applicable
    "pafra": 1.1,  # Scene-dependent: outdoor photos
    "sswdp": 1.0,  # Scene-dependent: portraits / skin
    "qesm":  0.9,  # Scene-dependent: needs gray patches + sensor DB
}


def _to_layer_report(analyzer_name: str, layer_num: int, layer_display: str,
                     result: dict) -> dict:
    """Convert an analyzer result dict to the standard LayerReport schema."""
    score   = float(result.get("score", 0.5))
    status  = result.get("status", "failure")
    elapsed = int(result.get("elapsed_ms", 0))

    raw_evidence = result.get("evidence", [])
    ev_nodes = []
    for ev in raw_evidence:
        ev_score = float(ev.get("score", 0.5))
        # Map score to anomaly status
        if ev_score > 0.55:
            ev_status = "anomalous"    # AI-like signal
        elif ev_score < 0.45:
            ev_status = "normal"       # real-photo signal
        else:
            ev_status = "inconclusive"

        ev_nodes.append(evidence_node(
            layer=layer_num,
            category="physics",
            artifact_type=ev.get("name", "unknown"),
            status=ev_status,
            confidence=abs(ev_score - 0.5) * 2.0,  # 0=neutral, 1=certain
            detail=ev.get("detail", ""),
            raw_value=ev_score,
        ))

    return build_layer_report(
        layer=layer_num,
        layer_name=layer_display,
        evidence=ev_nodes,
        status=status,
        elapsed_ms=elapsed,
        score=score,
    )


def run_physical_analysis(
    img: np.ndarray,
    img_pil: Any,
) -> Dict[str, Any]:
    """
    Run all four physical consistency analyzers and return a combined result.

    Parameters
    ----------
    img     : np.ndarray — H×W×3 uint8 RGB
    img_pil : PIL.Image | None

    Returns
    -------
    dict:
        pafra, bdis, sswdp, qesm : individual analyzer results
        composite_score           : float [0=real, 1=AI]
        active_signals            : int (count of non-neutral analyzers)
        layer_reports             : list of 4 standard LayerReport dicts (L11-L14)
        elapsed_ms                : int
    """
    t0 = time.monotonic()

    # Import inline to avoid circular imports
    from analyzers.pafra import analyze_pafra
    from analyzers.bdis  import analyze_bdis
    from analyzers.sswdp import analyze_sswdp
    from analyzers.qesm  import analyze_qesm

    # Run BDIS + three scene-dependent analyzers concurrently
    with ThreadPoolExecutor(max_workers=4) as pool:
        f_pafra = pool.submit(analyze_pafra, img, img_pil)
        f_bdis  = pool.submit(analyze_bdis,  img, img_pil)
        f_sswdp = pool.submit(analyze_sswdp, img, img_pil)
        f_qesm  = pool.submit(analyze_qesm,  img, img_pil)

        pafra_r = f_pafra.result()
        bdis_r  = f_bdis.result()
        sswdp_r = f_sswdp.result()
        qesm_r  = f_qesm.result()

    results = {
        "pafra": pafra_r,
        "bdis":  bdis_r,
        "sswdp": sswdp_r,
        "qesm":  qesm_r,
    }

    # Composite: only average non-neutral signals
    weighted_sum = 0.0
    total_weight = 0.0
    active_signals = 0

    for name, res in results.items():
        score = float(res.get("score", 0.5))
        w     = _WEIGHTS.get(name, 1.0)
        # BDIS is always included; others only when active (non-neutral)
        if name == "bdis" or score != 0.5:
            weighted_sum += score * w
            total_weight += w
            if score != 0.5:
                active_signals += 1

    composite = float(weighted_sum / total_weight) if total_weight > 0 else 0.5
    composite = float(np.clip(composite, 0.0, 1.0))

    # Build standard layer reports
    layer_reports = [
        _to_layer_report("pafra", 11, "PAFRA – Polarization & Fresnel Analysis", pafra_r),
        _to_layer_report("bdis",  12, "BDIS – Bayer Demosaicing Inconsistency",   bdis_r),
        _to_layer_report("sswdp", 13, "SSWDP – Subsurface Scattering Profile",    sswdp_r),
        _to_layer_report("qesm",  14, "QESM – Quantum Efficiency Spectral Match",  qesm_r),
    ]

    elapsed = int((time.monotonic() - t0) * 1000)

    return {
        "pafra":           pafra_r,
        "bdis":            bdis_r,
        "sswdp":           sswdp_r,
        "qesm":            qesm_r,
        "composite_score": round(composite, 4),
        "active_signals":  active_signals,
        "layer_reports":   layer_reports,
        "elapsed_ms":      elapsed,
    }

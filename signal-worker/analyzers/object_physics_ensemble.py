"""
Aiscern Detection Worker — Object Physics Layer Ensemble (v4.7.0)
Orchestrates L15 (OBP), L16 (MRC), L17 (GPC), L18 (TSAD), L19 (OSIP).

Mirrors analyzers/physical_consistency.py (the L11-L14 orchestrator) so the
two ensembles behave identically from the fusion engine's point of view:
run_object_physics_analysis() is the single public entry point, runs all
five analyzers concurrently, and returns individual results plus a weighted
composite score and standard LayerReport list.

Status semantics (per analyzers/object_physics.py):
  - L15 OBP, L16 MRC, L18 TSAD, L19 OSIP are object-agnostic / always active
    — they only return "failure" on a hard error (bad input, exception).
  - L17 GPC is scene-dependent: on macro shots, close-ups, texture fills, or
    any scene with no reliable straight edges, it returns
    status="neutral_scene_type" (analogous to PAFRA/SSWDP/QESM's
    "not_applicable" for L11-L14) instead of forcing a meaningless
    perspective judgement. That neutral must be excluded from the composite
    the same way "not_applicable" is excluded for L11-L14 — see the
    docstring on _fuse_scores() in engines/image_engine.py, which was
    updated in this same change to treat "neutral_scene_type" identically
    to "not_applicable".
"""

from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict

import numpy as np

logger = logging.getLogger(__name__)

# ── Layer weights (how much each analyzer contributes to this ensemble's
#    own composite_score). These mirror the LAYER_WEIGHTS values used in
#    engines/image_engine.py's global _fuse_scores() — kept in sync there.
_WEIGHTS = {
    "obp":   1.1,  # L15 — strongest universal boundary-physics signal
    "mrc":   1.0,  # L16 — material-specific (metals/glass/skin)
    "gpc":   0.9,  # L17 — scene-dependent (needs straight-line structure)
    "tsad":  1.2,  # L18 — strongest against VAE/latent-grid diffusion output
    "osip":  1.0,  # L19 — object-scene interaction (shadows/reflections)
}

# Statuses that should NOT be treated as an informative vote in the
# composite (either the layer errored, or it deliberately opted out
# because its physical precondition wasn't present in this image).
_NEUTRAL_STATUSES = ("failure", "neutral_scene_type", "not_applicable")


def run_object_physics_analysis(
    img: np.ndarray,
    img_pil: Any = None,
) -> Dict[str, Any]:
    """
    Run all five object-physics analyzers (L15-L19) and return a combined
    result, in the same shape as analyzers.physical_consistency.run_physical_analysis().

    Parameters
    ----------
    img     : np.ndarray — H×W×3 uint8 RGB
    img_pil : PIL.Image | None — unused by the analyzers, kept for API parity

    Returns
    -------
    dict:
        obp, mrc, gpc, tsad, osip : individual analyzer LayerReport dicts
        composite_score            : float [0=real, 1=AI]
        active_signals             : int (count of non-neutral analyzers)
        layer_reports               : list of 5 standard LayerReport dicts (L15-L19)
        elapsed_ms                  : int
    """
    t0 = time.monotonic()

    # Import inline to avoid circular imports / keep import cost off the
    # module load path for callers that never touch object physics.
    from analyzers.object_physics import (
        analyze_obp,
        analyze_mrc,
        analyze_gpc,
        analyze_tsad,
        analyze_osip,
    )

    with ThreadPoolExecutor(max_workers=5) as pool:
        f_obp  = pool.submit(analyze_obp,  img, img_pil)
        f_mrc  = pool.submit(analyze_mrc,  img, img_pil)
        f_gpc  = pool.submit(analyze_gpc,  img, img_pil)
        f_tsad = pool.submit(analyze_tsad, img, img_pil)
        f_osip = pool.submit(analyze_osip, img, img_pil)

        obp_r  = f_obp.result()
        mrc_r  = f_mrc.result()
        gpc_r  = f_gpc.result()
        tsad_r = f_tsad.result()
        osip_r = f_osip.result()

    results = {
        "obp":  obp_r,
        "mrc":  mrc_r,
        "gpc":  gpc_r,
        "tsad": tsad_r,
        "osip": osip_r,
    }

    # Composite: only average signals that weren't a failure/neutral opt-out.
    weighted_sum = 0.0
    total_weight = 0.0
    active_signals = 0

    for name, res in results.items():
        status = res.get("status", "failure")
        score = float(res.get("layerSuspicionScore", 0.5))
        w = _WEIGHTS.get(name, 1.0)
        if status not in _NEUTRAL_STATUSES:
            weighted_sum += score * w
            total_weight += w
            active_signals += 1

    composite = float(weighted_sum / total_weight) if total_weight > 0 else 0.5
    composite = float(np.clip(composite, 0.0, 1.0))

    layer_reports = [obp_r, mrc_r, gpc_r, tsad_r, osip_r]

    elapsed = int((time.monotonic() - t0) * 1000)

    return {
        "obp":              obp_r,
        "mrc":              mrc_r,
        "gpc":              gpc_r,
        "tsad":             tsad_r,
        "osip":             osip_r,
        "composite_score":  round(composite, 4),
        "active_signals":   active_signals,
        "layer_reports":    layer_reports,
        "elapsed_ms":       elapsed,
    }

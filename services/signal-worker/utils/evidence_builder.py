"""
Aiscern Signal Worker — Evidence Builder
Standardized JSON output builder so every layer returns the same schema
that TypeScript types/forensic.ts expects.
"""

from typing import Optional


def evidence_node(
    layer:        int,
    category:     str,
    artifact_type: str,
    status:       str,       # anomalous | normal | inconclusive | not_present
    confidence:   float,
    detail:       str,
    raw_value:    Optional[float] = None,
    region:       Optional[dict]  = None,
) -> dict:
    """Build a single EvidenceNode conforming to TypeScript contract."""
    node = {
        "layer":        layer,
        "category":     category,
        "artifactType": artifact_type,
        "status":       status,
        "confidence":   round(min(max(float(confidence), 0.0), 1.0), 4),
        "detail":       str(detail)[:200],
    }
    if raw_value is not None:
        node["rawValue"] = round(float(raw_value), 6)
    if region is not None:
        node["region"] = region
    return node


def build_layer_report(
    layer:       int,
    layer_name:  str,
    evidence:    list,
    status:      str,
    elapsed_ms:  int,
    score:       Optional[float] = None,
) -> dict:
    """
    Build a LayerReport. Score is computed from evidence if not provided.

    IMPORTANT (fixed v4.6.1): this used to invert `confidence` for
    status=="normal" evidence nodes (`1.0 - c`), assuming confidence meant
    "certainty the stated classification is correct". That doesn't match how
    any analyzer using this default path actually builds evidence:
    pixel_integrity (L1), dct_compression (L2), noise_stats (L3), and
    frequency_domain (L4) all set confidence to an ALREADY suspicion-oriented
    score (0=real, 1=AI-like), with status derived FROM that same score via
    thresholding (anomalous if >0.65, normal if <0.30). So a strongly
    real-looking signal (e.g. confidence=0.15, status="normal") was being
    inverted to 0.85 — exactly backwards — silently dragging every image's
    L1-L4 composite upward regardless of actual content. L9, L10, and L11-14
    all pass an explicit score= and never exercise this default path, so
    nothing relies on the old inversion behavior — this is a single-point fix.
    """
    if score is None and evidence:
        # Direct average of the already suspicion-oriented confidence values.
        # No status-based inversion — status is a label derived from the
        # score, not an independent signal to re-apply on top of it.
        scores = [float(ev.get("confidence", 0.5)) for ev in evidence]
        computed = sum(scores) / len(scores) if scores else 0.5
    else:
        computed = score if score is not None else 0.5

    return {
        "layer":               layer,
        "layerName":           layer_name,
        "processingTimeMs":    int(elapsed_ms),
        "status":              status,
        "evidence":            evidence,
        "layerSuspicionScore": round(min(max(float(computed), 0.0), 1.0), 4),
    }

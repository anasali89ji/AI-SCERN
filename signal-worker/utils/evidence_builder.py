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
    """Build a LayerReport. Score is computed from evidence if not provided."""
    if score is None and evidence:
        # Weighted average: anomalous nodes contribute their confidence as AI signal
        scores = []
        for ev in evidence:
            c = ev.get("confidence", 0.5)
            if ev.get("status") == "anomalous":
                scores.append(c)
            elif ev.get("status") == "normal":
                scores.append(1.0 - c)
            else:
                scores.append(0.5)
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

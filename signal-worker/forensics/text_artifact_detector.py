"""
Aiscern Image v3 — Layer 5: Text-in-Image Artifact Detection
OCR + rendering artifact analysis for AI-generated text failures.
"""
import cv2
import numpy as np
from scipy.signal import find_peaks
from typing import Dict, Any, List

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False


def detect_text_artifacts(image_path: str) -> Dict[str, Any]:
    if not TESSERACT_AVAILABLE:
        return {
            "text_detected": False,
            "text_region_count": 0,
            "artifact_score": 0.0,
            "text_regions": [],
            "garbled_text_detected": False,
            "note": "pytesseract not available"
        }

    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    data = pytesseract.image_to_data(gray, output_type=pytesseract.Output.DICT)

    text_regions = []
    artifact_score = 0.0

    for i in range(len(data["text"])):
        if int(data["conf"][i]) > 30:
            x, y, w, h = data["left"][i], data["top"][i], data["width"][i], data["height"][i]
            text_region = gray[y:y + h, x:x + w]

            if text_region.size == 0:
                continue

            artifacts = analyze_text_region(text_region)
            text_regions.append({
                "text": data["text"][i],
                "bbox": [x, y, w, h],
                "ocr_confidence": data["conf"][i],
                "artifacts": artifacts
            })

            artifact_score += artifacts["artifact_score"]

    avg_score = artifact_score / len(text_regions) if text_regions else 0.0

    return {
        "text_detected": len(text_regions) > 0,
        "text_region_count": len(text_regions),
        "artifact_score": float(min(avg_score, 1.0)),
        "text_regions": text_regions,
        "garbled_text_detected": any(r["artifacts"]["is_garbled"] for r in text_regions)
    }


def analyze_text_region(region: np.ndarray) -> Dict[str, Any]:
    artifacts: Dict[str, Any] = {
        "artifact_score": 0.0,
        "is_garbled": False,
        "blur_inconsistency": 0.0,
        "character_deformation": 0.0,
        "baseline_wobble": 0.0,
        "spacing_irregularity": 0.0
    }

    local_blur = []
    for i in range(0, region.shape[0] - 8, 4):
        for j in range(0, region.shape[1] - 8, 4):
            patch = region[i:i + 8, j:j + 8]
            lap_var = cv2.Laplacian(patch, cv2.CV_64F).var()
            local_blur.append(lap_var)

    if len(local_blur) > 0:
        blur_std = np.std(local_blur) / (np.mean(local_blur) + 1e-8)
        artifacts["blur_inconsistency"] = float(min(blur_std, 1.0))

    row_projections = np.sum(region < 200, axis=1)
    peaks, _ = find_peaks(row_projections, height=np.mean(row_projections))

    if len(peaks) > 1:
        peak_diffs = np.diff(peaks)
        spacing_regularity = np.std(peak_diffs) / (np.mean(peak_diffs) + 1e-8)
        artifacts["baseline_wobble"] = float(min(spacing_regularity, 1.0))

    col_projections = np.sum(region < 200, axis=0)
    gaps = col_projections < np.mean(col_projections) * 0.3

    gap_lengths = []
    current_gap = 0
    for g in gaps:
        if g:
            current_gap += 1
        else:
            if current_gap > 0:
                gap_lengths.append(current_gap)
            current_gap = 0

    if len(gap_lengths) > 2:
        gap_regularity = np.std(gap_lengths) / (np.mean(gap_lengths) + 1e-8)
        artifacts["spacing_irregularity"] = float(min(gap_regularity, 1.0))

    artifacts["artifact_score"] = float(np.mean([
        artifacts["blur_inconsistency"],
        artifacts["baseline_wobble"],
        artifacts["spacing_irregularity"]
    ]))

    artifacts["is_garbled"] = artifacts["artifact_score"] > 0.6

    return artifacts

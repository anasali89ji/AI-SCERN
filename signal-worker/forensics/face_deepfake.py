"""
Aiscern Image v3 — Layer 5: Face-Specific Deepfake Pipeline
Face detection, boundary/eye/mouth/skin/ear anomaly analysis.

DOCK-2: face detection previously used the `face_recognition` package,
which depends on dlib and requires a 2-3 minute C++ compile (cmake,
build-essential, libopenblas-dev, liblapack-dev, libx11-dev) during the
Docker build, plus a 100MB+ shape-predictor model loaded on first use.
Replaced with OpenCV's bundled DNN face detector (Caffe SSD/ResNet10,
~5MB total, no compilation) — only the bounding boxes were ever used
downstream, never face_recognition's 128-d encodings or landmarks, so
this is a drop-in swap for everything this module actually needs.
"""
import os
import cv2
import numpy as np
from typing import Dict, Any, List, Tuple

from utils.model_cache import get_model

_MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")
_PROTOTXT = os.path.join(_MODELS_DIR, "deploy.prototxt")
_CAFFEMODEL = os.path.join(_MODELS_DIR, "res10_300x300_ssd_iter_140000_fp16.caffemodel")

DETECTION_CONFIDENCE_THRESHOLD = 0.5


def _load_face_net():
    if not (os.path.exists(_PROTOTXT) and os.path.exists(_CAFFEMODEL)):
        raise FileNotFoundError(
            f"Face detector model files missing: {_PROTOTXT}, {_CAFFEMODEL}"
        )
    return cv2.dnn.readNetFromCaffe(_PROTOTXT, _CAFFEMODEL)


def _detect_faces(img_rgb: np.ndarray) -> List[Tuple[int, int, int, int]]:
    """
    Run the OpenCV DNN face detector.
    Returns a list of (top, right, bottom, left) tuples — same format
    face_recognition.face_locations() used, so downstream code is unchanged.
    """
    try:
        net = get_model("face_detector_dnn", _load_face_net)
    except Exception:
        return []

    h, w = img_rgb.shape[:2]
    # The model expects BGR (it was trained via Caffe on BGR images)
    img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
    blob = cv2.dnn.blobFromImage(
        cv2.resize(img_bgr, (300, 300)), 1.0, (300, 300), (104.0, 177.0, 123.0)
    )
    net.setInput(blob)
    detections = net.forward()

    boxes = []
    for i in range(detections.shape[2]):
        confidence = float(detections[0, 0, i, 2])
        if confidence < DETECTION_CONFIDENCE_THRESHOLD:
            continue
        x1 = int(detections[0, 0, i, 3] * w)
        y1 = int(detections[0, 0, i, 4] * h)
        x2 = int(detections[0, 0, i, 5] * w)
        y2 = int(detections[0, 0, i, 6] * h)
        # Clamp to image bounds — the model can predict slightly outside the frame
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        if x2 <= x1 or y2 <= y1:
            continue
        # (top, right, bottom, left) — matches face_recognition's convention
        boxes.append((y1, x2, y2, x1))

    return boxes


def face_specific_analysis(image_path: str) -> Dict[str, Any]:
    img_bgr = cv2.imread(image_path)
    if img_bgr is None:
        return {
            "faces_detected": False,
            "deepfake_score": 0.5,
            "face_details": [],
            "note": "could not read image",
        }
    img = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

    face_locations = _detect_faces(img)

    if len(face_locations) == 0:
        return {
            "faces_detected": False,
            "deepfake_score": 0.5,
            "face_details": []
        }

    face_details = []
    deepfake_indicators = []

    for i, (top, right, bottom, left) in enumerate(face_locations):
        face_img = img[top:bottom, left:right]
        if face_img.size == 0:
            continue

        boundary_score = analyze_face_boundary(img, (top, right, bottom, left))
        eye_score = analyze_eye_consistency(face_img)
        mouth_score = analyze_mouth_anomalies(face_img)
        skin_score = analyze_skin_texture(face_img)
        ear_score = analyze_ear_shape(face_img)

        face_score = float(np.mean([boundary_score, eye_score, mouth_score, skin_score, ear_score]))
        deepfake_indicators.append(face_score)

        face_details.append({
            "face_index": i,
            "bounding_box": [left, top, right, bottom],
            "boundary_score": float(boundary_score),
            "eye_score": float(eye_score),
            "mouth_score": float(mouth_score),
            "skin_score": float(skin_score),
            "ear_score": float(ear_score),
            "composite_score": face_score
        })

    if not deepfake_indicators:
        return {
            "faces_detected": False,
            "deepfake_score": 0.5,
            "face_details": []
        }

    overall_score = float(np.mean(deepfake_indicators))

    return {
        "faces_detected": True,
        "face_count": len(deepfake_indicators),
        "deepfake_score": overall_score,
        "face_details": face_details,
        "high_risk_faces": sum(1 for s in deepfake_indicators if s > 0.7)
    }


def analyze_face_boundary(img: np.ndarray, face_loc: tuple) -> float:
    top, right, bottom, left = face_loc
    margin = 20
    boundary_region = img[
        max(0, top - margin):min(img.shape[0], bottom + margin),
        max(0, left - margin):min(img.shape[1], right + margin)
    ]
    gray = cv2.cvtColor(boundary_region, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    edge_density = np.sum(edges > 0) / (edges.shape[0] * edges.shape[1])
    return float(min(edge_density * 10, 1.0))


def analyze_eye_consistency(face_img: np.ndarray) -> float:
    gray = cv2.cvtColor(face_img, cv2.COLOR_RGB2GRAY)
    eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")
    eyes = eye_cascade.detectMultiScale(gray, 1.1, 4)

    if len(eyes) < 2:
        # Haar cascade eye detection is old (Viola-Jones) and frequently fails
        # on completely ordinary real photos: glasses, sunglasses, closed/
        # squinting eyes, side-angle faces, low-resolution crops, makeup.
        # Previously this returned 0.8 (strong AI-suspicion) — treating a
        # detector failure as if it were positive evidence of synthesis. A
        # failed detection means we have no data, not that something is wrong
        # with the image. Returns neutral instead.
        return 0.5

    eye1 = eyes[0]
    eye2 = eyes[1]
    size_diff = abs(eye1[2] * eye1[3] - eye2[2] * eye2[3]) / max(eye1[2] * eye1[3], 1)
    return float(min(size_diff * 2, 1.0))


def analyze_mouth_anomalies(face_img: np.ndarray) -> float:
    gray = cv2.cvtColor(face_img, cv2.COLOR_RGB2GRAY)
    h, w = gray.shape
    mouth_region = gray[h // 2:, :]

    local_vars = []
    for i in range(0, mouth_region.shape[0] - 16, 16):
        for j in range(0, mouth_region.shape[1] - 16, 16):
            patch = mouth_region[i:i + 16, j:j + 16]
            local_vars.append(np.var(patch))

    if len(local_vars) == 0:
        return 0.5

    avg_var = np.mean(local_vars)
    return float(1.0 - min(avg_var / 500, 1.0))


def analyze_skin_texture(face_img: np.ndarray) -> float:
    gray = cv2.cvtColor(face_img, cv2.COLOR_RGB2GRAY)
    high_pass = gray - cv2.GaussianBlur(gray, (15, 15), 0)
    texture_energy = np.var(high_pass)
    return float(1.0 - min(texture_energy / 1000, 1.0))


def analyze_ear_shape(face_img: np.ndarray) -> float:
    # Placeholder: ear shape analysis requires specialized landmarks
    return 0.5

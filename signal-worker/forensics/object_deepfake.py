"""
Aiscern Image v3 — Layer 5: Face & Object Deepfake Pipeline

Fix #3 (v4.5.0): renamed from face_deepfake.py. The previous module returned
deepfake_score=0.5 for EVERY non-face image (products, food, architecture,
landscapes) — completely blind to the majority of real-world uploads. This
version keeps the existing face analysis when faces are detected, and adds
object-level physical-consistency checks (missing contact shadows, impossible
perspective, scale inconsistency, floating objects) when they are not.

Fix #6 (v4.5.0): accepts an already-decoded img_array (RGB, uint8) instead of
re-reading the file from disk — image_engine.py already holds the array.

DOCK-2 (carried over): face detection uses OpenCV's bundled DNN face detector
(Caffe SSD/ResNet10, ~5MB, no compilation) instead of `face_recognition`/dlib
— only bounding boxes were ever used downstream.
"""
import os
import cv2
import numpy as np
from typing import Dict, Any, List, Tuple

from utils.model_cache import get_model
from utils.cv_compat import normalize_hough_lines

_MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")
_PROTOTXT = os.path.join(_MODELS_DIR, "deploy.prototxt")
_CAFFEMODEL = os.path.join(_MODELS_DIR, "res10_300x300_ssd_iter_140000_fp16.caffemodel")

DETECTION_CONFIDENCE_THRESHOLD = 0.5


def _load_face_net():
    if not (os.path.exists(_PROTOTXT) and os.path.exists(_CAFFEMODEL)):
        raise FileNotFoundError(
            f"Face detector model files missing: {_PROTOTXT}, {_CAFFEMODEL}"
        )
    if not hasattr(cv2, "dnn") or not hasattr(cv2.dnn, "readNetFromCaffe"):
        # Diagnostic fix (2026-08-19 calibration run): the calibration
        # environment logged
        #   "Failed to load face_detector_dnn: module 'cv2.dnn' has no
        #    attribute 'readNetFromCaffe'"
        # on every single image. cv2.dnn.readNetFromCaffe has existed in
        # every OpenCV release for years, including the
        # opencv-python-headless==4.10.0.84 pinned in requirements.txt —
        # so a *missing* attribute (as opposed to a load error on a
        # specific model file) almost always means two conflicting cv2
        # packages are installed in the same environment (most commonly
        # `opencv-python` + `opencv-python-headless` together). Both ship
        # into the same `cv2` import path with incompatible compiled
        # binaries; pip does not reconcile them, so parts of `cv2.dnn`
        # silently vanish while the rest of `cv2` keeps working — which is
        # why only this one function broke and everything else in the
        # pipeline (ELA, DCT, noise, etc.) worked fine.
        #
        # This is an environment/dependency-conflict problem, not something
        # this function can work around at runtime, so it fails with a
        # message that says so explicitly instead of the previous generic
        # AttributeError, which sent the last investigation down the wrong
        # path (looking for a code bug where there wasn't one).
        installed = _installed_opencv_packages()
        raise RuntimeError(
            "cv2.dnn.readNetFromCaffe is unavailable in this OpenCV build "
            "even though cv2.dnn is importable. This is almost always "
            "caused by having more than one opencv-python* package "
            "installed in the same environment (e.g. `opencv-python` and "
            "`opencv-python-headless` together), which corrupts the cv2.dnn "
            "namespace. Detected opencv package(s) in this environment: "
            f"{installed or 'unable to detect via pip'}. Fix: `pip uninstall "
            "-y opencv-python opencv-contrib-python opencv-python-headless "
            "opencv-contrib-python-headless` then reinstall only the pinned "
            "version from requirements.txt (opencv-python-headless==4.10.0.84)."
        )
    return cv2.dnn.readNetFromCaffe(_PROTOTXT, _CAFFEMODEL)


def _installed_opencv_packages():
    """Best-effort introspection to name the conflicting package(s) in the
    error message above. Never raises — returns None on any failure so it
    can't itself break face-detector loading."""
    try:
        import importlib.metadata as _md
        names = [
            "opencv-python",
            "opencv-python-headless",
            "opencv-contrib-python",
            "opencv-contrib-python-headless",
        ]
        found = []
        for name in names:
            try:
                found.append(f"{name}=={_md.version(name)}")
            except _md.PackageNotFoundError:
                pass
        return ", ".join(found) if found else None
    except Exception:
        return None


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


# ── FACE ANALYSIS (kept from face_deepfake.py) ───────────────────────────────

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
        # A failed Haar cascade detection means we have no data, not that
        # something is wrong with the image — returns neutral rather than
        # treating detector failure as positive evidence of synthesis.
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


# ── OBJECT ANALYSIS (NEW — Fix #3, v4.5.0) ──────────────────────────────────

def analyze_object_inconsistencies(img_array: np.ndarray) -> Dict[str, Any]:
    """
    Detect physical inconsistencies in non-face images: missing contact
    shadows, impossible perspective, scale inconsistency, floating objects.
    Returns a dict of anomaly scores in [0, 1] (higher = more AI-like).
    """
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY) if img_array.ndim == 3 else img_array
    h, w = gray.shape

    edges = cv2.Canny(gray, 50, 150)

    shadow_score      = _detect_missing_contact_shadows(gray, edges)
    perspective_score = _detect_perspective_anomalies(gray)
    scale_score       = _detect_scale_inconsistencies(img_array)
    floating_score    = _detect_floating_objects(gray, edges)

    composite = float(np.clip(
        shadow_score * 0.35 +
        perspective_score * 0.25 +
        scale_score * 0.20 +
        floating_score * 0.20,
        0, 1
    ))

    return {
        "object_anomaly_score": round(composite, 4),
        "shadow_inconsistency": round(shadow_score, 4),
        "perspective_anomaly":  round(perspective_score, 4),
        "scale_inconsistency":  round(scale_score, 4),
        "floating_object":      round(floating_score, 4),
    }


def _detect_missing_contact_shadows(gray: np.ndarray, edges: np.ndarray) -> float:
    """Check if object edges have plausible contact shadows below them."""
    h, w = gray.shape
    edge_pixels = np.where(edges > 0)
    if len(edge_pixels[0]) < 50:
        return 0.5

    shadow_ratios = []
    for y, x in zip(edge_pixels[0], edge_pixels[1]):
        if y + 5 < h:
            edge_val = float(gray[y, x])
            below_val = float(gray[min(y + 5, h - 1), x])
            # Real: below is darker (shadow). AI: below is same or brighter.
            if below_val < edge_val * 0.85:
                shadow_ratios.append(1.0)
            else:
                shadow_ratios.append(0.0)

    if not shadow_ratios:
        return 0.5

    ratio = np.mean(shadow_ratios)
    # Low ratio = missing shadows = AI
    return float(np.clip(1.0 - ratio * 1.2, 0, 1))


def _detect_perspective_anomalies(gray: np.ndarray) -> float:
    """Check if lines converge to plausible vanishing points."""
    raw_lines = cv2.HoughLinesP(gray, 1, np.pi / 180, threshold=80, minLineLength=50, maxLineGap=10)
    # Fix (2026-08-19 calibration run): `line[0]` assumed cv2.HoughLinesP
    # always returns shape (N,1,4); on some OpenCV builds it returns (N,4)
    # directly, which made `line[0]` a scalar and crashed the unpack with
    # "cannot unpack non-iterable numpy.int32 object" — this took down the
    # whole object_specific_analysis() call for non-face images.
    lines = normalize_hough_lines(raw_lines)
    if len(lines) < 5:
        return 0.5  # Not enough lines to analyze

    angles = []
    for line in lines:
        x1, y1, x2, y2 = line
        angle = np.arctan2(y2 - y1, x2 - x1)
        angles.append(angle)

    # Real photos: angles cluster around dominant directions.
    # AI: angles are more scattered or artificially uniform.
    angles = np.array(angles)
    hist, _ = np.histogram(angles, bins=18, range=(-np.pi, np.pi))
    hist_norm = hist / hist.sum()
    peakiness = float(hist_norm.max() / (hist_norm.mean() + 1e-8))

    # Very high peakiness (>4.5) = artificially uniform = AI
    # Very low peakiness (<1.5) = scattered/no structure = AI
    if peakiness > 4.5:
        return float(np.clip((peakiness - 4.5) / 3.0, 0, 0.7))
    elif peakiness < 1.5:
        return float(np.clip((1.5 - peakiness) / 1.0, 0, 0.6))
    else:
        return 0.25


def _detect_scale_inconsistencies(img_array: np.ndarray) -> float:
    """Detect objects with impossible relative sizes (heuristic — a full
    implementation would need actual object detection, not just blobs)."""
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY) if img_array.ndim == 3 else img_array

    params = cv2.SimpleBlobDetector_Params()
    params.filterByArea = True
    params.minArea = 100
    params.maxArea = 50000
    detector = cv2.SimpleBlobDetector_create(params)
    keypoints = detector.detect(gray)

    if len(keypoints) < 3:
        return 0.5

    sizes = [kp.size for kp in keypoints]
    size_cv = float(np.std(sizes) / (np.mean(sizes) + 1e-8))

    # Very high size variance in a small region = suspicious
    if size_cv > 2.0:
        return float(np.clip((size_cv - 2.0) / 3.0, 0, 0.7))
    return 0.3


def _detect_floating_objects(gray: np.ndarray, edges: np.ndarray) -> float:
    """Detect objects that appear to float without ground contact."""
    h, w = gray.shape

    bottom_third = gray[int(h * 0.67):, :]
    bottom_edges = cv2.Canny(bottom_third, 50, 150)

    horizontal_score = np.sum(bottom_edges > 0) / bottom_edges.size

    # Very few horizontal edges at bottom = no ground plane = floating objects possible
    if horizontal_score < 0.01:
        return 0.65
    elif horizontal_score < 0.03:
        return 0.45
    return 0.2


# ── MAIN ENTRY POINT ─────────────────────────────────────────────────────────

def object_specific_analysis(img_array: np.ndarray) -> Dict[str, Any]:
    """
    Renamed from face_specific_analysis (Fix #3). Runs face analysis when
    faces are detected, object-inconsistency analysis otherwise. Fix #6:
    accepts an already-decoded img_array (RGB, uint8) instead of a file path.
    """
    if img_array is None or img_array.size == 0:
        return {
            "faces_detected": False,
            "deepfake_score": 0.5,
            "face_details": [],
            "objects_detected": False,
            "object_anomaly_score": 0.5,
            "note": "empty or unreadable image array",
        }

    img = img_array  # already RGB

    face_locations = _detect_faces(img)

    if len(face_locations) > 0:
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
                "face_details": [],
                "objects_detected": False,
                "object_anomaly_score": 0.5,
            }

        overall_score = float(np.mean(deepfake_indicators))
        return {
            "faces_detected": True,
            "face_count": len(deepfake_indicators),
            "deepfake_score": overall_score,
            "face_details": face_details,
            "objects_detected": False,
            "object_anomaly_score": 0.5,
            "high_risk_faces": sum(1 for s in deepfake_indicators if s > 0.7)
        }
    else:
        obj_results = analyze_object_inconsistencies(img)
        return {
            "faces_detected": False,
            "deepfake_score": 0.5,
            "face_details": [],
            "objects_detected": True,
            "object_anomaly_score": obj_results["object_anomaly_score"],
            "object_details": obj_results,
        }

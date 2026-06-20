"""
Aiscern Image v3 — Layer 5: Face-Specific Deepfake Pipeline
Face detection, boundary/eye/mouth/skin/ear anomaly analysis.
"""
import cv2
import numpy as np
from typing import Dict, Any, List

try:
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False


def face_specific_analysis(image_path: str) -> Dict[str, Any]:
    if not FACE_RECOGNITION_AVAILABLE:
        return {
            "faces_detected": False,
            "deepfake_score": 0.5,
            "face_details": [],
            "note": "face_recognition library not available"
        }

    img = face_recognition.load_image_file(image_path)
    face_locations = face_recognition.face_locations(img)

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

    overall_score = float(np.mean(deepfake_indicators)) if deepfake_indicators else 0.5

    return {
        "faces_detected": True,
        "face_count": len(face_locations),
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

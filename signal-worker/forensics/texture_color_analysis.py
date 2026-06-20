"""
Aiscern Image v3 — Layer 2: Edge, Texture & Color Analysis
Laplacian variance, LBP, GLCM texture features, illumination consistency.
"""
import cv2
import numpy as np
from skimage.feature import local_binary_pattern, graycomatrix, graycoprops
from typing import Dict, Any, List


def texture_analysis(image_path: str) -> Dict[str, Any]:
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    laplacian_var = laplacian.var()

    lbp = local_binary_pattern(gray, P=8, R=1, method="uniform")
    lbp_hist, _ = np.histogram(lbp, bins=np.arange(0, 10), range=(0, 9))
    lbp_hist = lbp_hist.astype(np.float32) / (np.sum(lbp_hist) + 1e-8)

    glcm = graycomatrix(
        gray, distances=[1],
        angles=[0, np.pi / 4, np.pi / 2, 3 * np.pi / 4],
        levels=256, symmetric=True, normed=True
    )

    contrast = graycoprops(glcm, "contrast")[0, 0]
    dissimilarity = graycoprops(glcm, "dissimilarity")[0, 0]
    homogeneity = graycoprops(glcm, "homogeneity")[0, 0]
    energy = graycoprops(glcm, "energy")[0, 0]
    correlation = graycoprops(glcm, "correlation")[0, 0]

    return {
        "laplacian_variance": float(laplacian_var),
        "lbp_uniformity": float(np.std(lbp_hist)),
        "glcm_contrast": float(contrast),
        "glcm_dissimilarity": float(dissimilarity),
        "glcm_homogeneity": float(homogeneity),
        "glcm_energy": float(energy),
        "glcm_correlation": float(correlation),
        # homogeneity/contrast is an unbounded ratio — confirmed empirically to
        # exceed 1.0 (up to ~1.5x and theoretically unbounded for a literal
        # flat-color region) for very smooth/low-contrast content. It's
        # consumed downstream as a [0,1]-scaled suspicion score with no other
        # clamping in the pipeline, so left unclamped it could contribute more
        # than its intended 10% weight share to the composite. Clamped here.
        "texture_smoothness_score": float(min(homogeneity / (contrast + 1e-8), 1.0))
    }


def color_analysis(image_path: str) -> Dict[str, Any]:
    img = cv2.imread(image_path)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img_hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    return {
        "rgb_mean": [float(np.mean(img_rgb[:, :, i])) for i in range(3)],
        "rgb_std": [float(np.std(img_rgb[:, :, i])) for i in range(3)],
        "hsv_mean": [float(np.mean(img_hsv[:, :, i])) for i in range(3)],
        "hsv_std": [float(np.std(img_hsv[:, :, i])) for i in range(3)],
        "saturation_mean": float(np.mean(img_hsv[:, :, 1])),
        "value_mean": float(np.mean(img_hsv[:, :, 2])),
        "colorfulness": float(
            np.std(img_rgb[:, :, 0]) +
            np.std(img_rgb[:, :, 1]) +
            np.std(img_rgb[:, :, 2])
        )
    }


def illumination_consistency(image_path: str) -> Dict[str, Any]:
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    regions = []

    rows, cols = 3, 3
    rh, rw = h // rows, w // cols

    for i in range(rows):
        for j in range(cols):
            region = gray[i * rh:(i + 1) * rh, j * rw:(j + 1) * rw]
            regions.append(np.mean(region))

    regions_arr = np.array(regions)
    illumination_variance = np.var(regions_arr)

    return {
        "illumination_variance": float(illumination_variance),
        "illumination_uniform": bool(illumination_variance < 100),
        "region_means": [float(r) for r in regions_arr]
    }

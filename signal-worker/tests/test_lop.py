"""
Tests for L21 LOP (Lens & Optical Physics): LoCA, LCA, radial distortion,
and vignetting signals.

No test file existed for this layer before Module 11 (verified against
origin/main prior to this module). These tests cover the analyzer's public
contract (analyze_lop) plus functional correctness of each of the four
signals against synthetic ground-truth fixtures, mirroring the "functional
smoke test" fixtures used during Module 11 development.
"""

from __future__ import annotations

import numpy as np
import cv2
import pytest

from analyzers.lop import (
    analyze_lop,
    measure_chromatic_aberration_radial_profile,
    measure_psf_channel_differential,
    measure_radial_distortion_model,
    measure_vignetting_profile,
)


# ── Fixtures ──────────────────────────────────────────────────────────────

def _grid_scene(h=500, w=500, seed=1):
    rng = np.random.default_rng(seed)
    img = np.full((h, w, 3), 180, dtype=np.uint8)
    for x in range(20, w, 40):
        cv2.line(img, (x, 0), (x, h - 1), (30, 30, 30), 3)
    for y in range(20, h, 40):
        cv2.line(img, (0, y), (w - 1, y), (30, 30, 30), 3)
    noise = rng.normal(0, 3, img.shape).astype(np.int16)
    return np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)


def _apply_barrel_distortion(img, k1=-0.3):
    h, w = img.shape[:2]
    cam = np.array([[w, 0, w / 2], [0, w, h / 2], [0, 0, 1]], dtype=np.float32)
    dist = np.array([k1, 0, 0, 0], dtype=np.float32)
    map1, map2 = cv2.initUndistortRectifyMap(cam, dist, None, cam, (w, h), cv2.CV_32FC1)
    return cv2.remap(img, map1, map2, interpolation=cv2.INTER_LINEAR, borderValue=(180, 180, 180))


def _apply_vignetting(img, strength=0.6):
    h, w = img.shape[:2]
    cx, cy = w / 2, h / 2
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.hypot(xx - cx, yy - cy) / np.hypot(cx, cy)
    falloff = np.clip(1.0 - strength * r ** 2, 0.2, 1.0)
    return (img.astype(np.float32) * falloff[..., None]).clip(0, 255).astype(np.uint8)


def _apply_psf_differential(img, r_blur=2.0):
    out = img.copy()
    out[..., 0] = cv2.GaussianBlur(img[..., 0], (0, 0), r_blur)
    return out


# ── Contract tests ────────────────────────────────────────────────────────

class TestAnalyzeLopContract:
    def test_none_input_returns_failure(self):
        r = analyze_lop(None)
        assert r["status"] == "failure"
        assert r["score"] == 0.5
        assert r["evidence"] == []

    def test_grayscale_2d_input_returns_failure(self):
        r = analyze_lop(np.zeros((100, 100), dtype=np.uint8))
        assert r["status"] == "failure"

    def test_wrong_channel_count_returns_failure(self):
        r = analyze_lop(np.zeros((100, 100, 4), dtype=np.uint8))
        assert r["status"] == "failure"

    def test_tiny_image_does_not_crash(self):
        for shape in [(1, 1, 3), (3, 3, 3), (10, 10, 3)]:
            img = np.random.randint(0, 255, shape, dtype=np.uint8)
            r = analyze_lop(img)
            assert r["status"] == "success"
            assert 0.0 <= r["score"] <= 1.0

    def test_flat_image_returns_neutral_insufficient_evidence(self):
        img = np.full((300, 300, 3), 128, dtype=np.uint8)
        r = analyze_lop(img)
        assert r["status"] == "success"
        assert r["score"] == 0.5
        assert any(e["name"] == "insufficient_edges_or_lines" for e in r["evidence"])

    def test_output_schema(self):
        img = _grid_scene()
        r = analyze_lop(img)
        assert set(["score", "status", "evidence", "elapsed_ms"]) <= set(r.keys())
        assert isinstance(r["evidence"], list)
        for e in r["evidence"]:
            assert "name" in e and "score" in e and "detail" in e
            assert 0.0 <= e["score"] <= 1.0

    def test_timing_budget_768px(self):
        rng = np.random.default_rng(0)
        img = rng.integers(0, 255, (768, 768, 3), dtype=np.uint8)
        r = analyze_lop(img)
        assert r["elapsed_ms"] < 2000  # generous ceiling; typical is ~500-650ms


# ── Functional correctness (synthetic ground truth) ─────────────────────

class TestRadialDistortionSignal:
    def test_no_lines_returns_none(self):
        img = np.random.randint(100, 160, (200, 200, 3), dtype=np.uint8).astype(np.uint8)
        # near-flat noise, no coherent lines
        result = measure_radial_distortion_model(img)
        assert result is None or result["n_lines"] < 4

    def test_barrel_distortion_shows_positive_correlation(self):
        base = _grid_scene()
        distorted = _apply_barrel_distortion(base, k1=-0.3)
        result = measure_radial_distortion_model(distorted)
        assert result is not None
        assert result["r2"] > 0.3, (
            "expected strong barrel distortion to show curvature-radius correlation"
        )

    def test_pincushion_distortion_shows_positive_correlation(self):
        base = _grid_scene()
        distorted = _apply_barrel_distortion(base, k1=0.3)
        result = measure_radial_distortion_model(distorted)
        assert result is not None
        assert result["r2"] > 0.3

    def test_undistorted_scene_shows_weaker_correlation_than_distorted(self):
        base = _grid_scene()
        distorted = _apply_barrel_distortion(base, k1=-0.3)
        r_base = measure_radial_distortion_model(base)
        r_dist = measure_radial_distortion_model(distorted)
        assert r_base is not None and r_dist is not None
        assert r_dist["r2"] > r_base["r2"]


class TestVignettingSignal:
    def test_vignetted_image_fits_positive_falloff(self):
        base = _grid_scene()
        vignetted = _apply_vignetting(base, strength=0.6)
        result = measure_vignetting_profile(vignetted)
        assert result is not None
        assert result["a"] > 0.1
        assert result["monotonic"] is True

    def test_flat_brightness_shows_near_zero_falloff(self):
        base = _grid_scene()
        result = measure_vignetting_profile(base)
        assert result is not None
        assert abs(result["a"]) < 0.05

    def test_near_black_center_returns_none(self):
        img = np.zeros((300, 300, 3), dtype=np.uint8)
        result = measure_vignetting_profile(img)
        assert result is None


class TestPSFDifferentialSignal:
    def test_identical_channels_show_near_zero_differential(self):
        base = _grid_scene()
        result = measure_psf_channel_differential(base)
        if result is not None:
            assert result["mean_psf_diff"] < 0.3

    def test_induced_channel_blur_increases_differential(self):
        base = _grid_scene()
        blurred_r = _apply_psf_differential(base, r_blur=2.0)
        r_base = measure_psf_channel_differential(base)
        r_blur = measure_psf_channel_differential(blurred_r)
        assert r_base is not None and r_blur is not None
        assert r_blur["mean_psf_diff"] > r_base["mean_psf_diff"]


class TestChromaticAberrationSignal:
    def test_too_few_edges_returns_none(self):
        img = np.full((200, 200, 3), 128, dtype=np.uint8)
        result = measure_chromatic_aberration_radial_profile(img)
        assert result is None

    def test_returns_valid_structure_on_edge_rich_image(self):
        img = _grid_scene()
        result = measure_chromatic_aberration_radial_profile(img)
        if result is not None:
            assert "radius_correlation" in result
            assert "radiality" in result
            assert -1.0 <= result["radius_correlation"] <= 1.0
            assert 0.0 <= result["radiality"] <= 1.0


# ── End-to-end composite ─────────────────────────────────────────────────

class TestEndToEndComposite:
    def test_full_synthetic_optics_scores_more_real_than_flat_scene(self):
        """A scene with real barrel distortion + vignetting applied should
        score meaningfully more 'real-like' (lower) than the same scene
        with no optical artifacts at all."""
        base = _grid_scene()
        no_optics = base
        with_optics = _apply_vignetting(_apply_barrel_distortion(base, k1=-0.3), strength=0.5)

        r_none = analyze_lop(no_optics)
        r_full = analyze_lop(with_optics)

        assert r_none["status"] == "success"
        assert r_full["status"] == "success"
        assert r_full["score"] < r_none["score"], (
            "a scene with real lens-like distortion and vignetting should "
            "score lower (more real-like) than an untouched flat control"
        )

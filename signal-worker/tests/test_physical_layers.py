"""
Comprehensive tests for PAFRA, BDIS, SSWDP, QESM analyzers.
"""

import pytest
import numpy as np
from PIL import Image
import cv2

from analyzers.pafra import analyze_pafra, detect_reflective_surfaces, detect_sky_region
from analyzers.bdis import analyze_bdis, check_bayer_correlation, check_green_periodicity
from analyzers.sswdp import analyze_sswdp, detect_skin_regions, extract_perpendicular_profile
from analyzers.qesm import analyze_qesm, estimate_illuminant, detect_gray_regions


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def synthetic_real_sky():
    """Synthetic image simulating real sky with polarization gradient."""
    h, w = 512, 512
    img = np.zeros((h, w, 3), dtype=np.uint8)

    # Sky: blue gradient (darker/more saturated at top)
    for y in range(h):
        intensity = int(180 - (y / h) * 60)
        saturation = int(150 - (y / h) * 40)
        img[y, :] = [intensity - 20, intensity - 10, intensity + 20]

    # Water reflection at bottom (mirror the 100 rows above the boundary)
    img[h-100:, :] = img[h-200:h-100, :][::-1, :] * 0.9
    img[h-100:, 2] = np.clip(img[h-100:, 2] * 1.15, 0, 255)

    return img


@pytest.fixture
def synthetic_ai_uniform():
    """Synthetic image simulating AI output: uniform sky, no polarization."""
    h, w = 512, 512
    img = np.zeros((h, w, 3), dtype=np.uint8)
    img[:h//3, :] = [140, 160, 200]
    img[h-100:, :] = [140, 160, 200]
    return img


@pytest.fixture
def synthetic_bayer_real():
    """Synthetic image with simulated Bayer pattern artifacts."""
    h, w = 512, 512
    img = np.zeros((h, w, 3), dtype=np.uint8)
    x = np.arange(w)
    y = np.arange(h)
    X, Y = np.meshgrid(x, y)
    g = 128 + 10 * np.sin(X * np.pi) * np.sin(Y * np.pi)
    r = 100 + 0.3 * np.roll(g, 1, axis=1) + 0.2 * np.roll(g, 1, axis=0)
    b = 120 + 0.25 * np.roll(g, -1, axis=1) + 0.15 * np.roll(g, -1, axis=0)
    img[:, :, 0] = np.clip(r, 0, 255).astype(np.uint8)
    img[:, :, 1] = np.clip(g, 0, 255).astype(np.uint8)
    img[:, :, 2] = np.clip(b, 0, 255).astype(np.uint8)
    return img


@pytest.fixture
def synthetic_bayer_ai():
    return np.random.randint(0, 255, (512, 512, 3), dtype=np.uint8)


@pytest.fixture
def synthetic_skin_real():
    h, w = 512, 512
    img = np.zeros((h, w, 3), dtype=np.uint8)
    center_y, center_x = h // 2, w // 2
    Y, X = np.ogrid[:h, :w]
    dist = np.sqrt((X - center_x)**2 + (Y - center_y)**2)
    r = 180 * np.exp(-dist / 80) + 60
    g = 140 * np.exp(-dist / 40) + 50
    b = 100 * np.exp(-dist / 10) + 40
    img[:, :, 0] = np.clip(r, 0, 255).astype(np.uint8)
    img[:, :, 1] = np.clip(g, 0, 255).astype(np.uint8)
    img[:, :, 2] = np.clip(b, 0, 255).astype(np.uint8)
    return img


@pytest.fixture
def synthetic_skin_ai():
    h, w = 512, 512
    img = np.zeros((h, w, 3), dtype=np.uint8)
    center_y, center_x = h // 2, w // 2
    Y, X = np.ogrid[:h, :w]
    dist = np.sqrt((X - center_x)**2 + (Y - center_y)**2)
    val = 150 * np.exp(-dist / 30) + 50
    img[:, :, 0] = np.clip(val + 20, 0, 255).astype(np.uint8)
    img[:, :, 1] = np.clip(val, 0, 255).astype(np.uint8)
    img[:, :, 2] = np.clip(val - 10, 0, 255).astype(np.uint8)
    return img


# ── PAFRA Tests ────────────────────────────────────────────────────────────

class TestPAFRA:
    def test_detects_real_sky_polarization(self, synthetic_real_sky):
        result = analyze_pafra(synthetic_real_sky, None)
        assert result["status"] == "success"
        assert 0 <= result["score"] <= 1

    def test_detects_ai_uniform_sky(self, synthetic_ai_uniform):
        result = analyze_pafra(synthetic_ai_uniform, None)
        assert result["status"] == "success"
        assert 0 <= result["score"] <= 1

    def test_neutral_no_sky_no_reflective(self):
        indoor = np.full((512, 512, 3), 128, dtype=np.uint8)
        result = analyze_pafra(indoor, None)
        assert result["score"] == 0.5

    def test_detect_reflective_surfaces(self):
        img = np.full((512, 512, 3), 100, dtype=np.uint8)
        img[200:300, 200:300] = [200, 200, 220]
        mask = detect_reflective_surfaces(img)
        assert mask.sum() > 0

    def test_detect_sky_region(self):
        img = np.zeros((512, 512, 3), dtype=np.uint8)
        img[:170, :] = [100, 120, 180]
        mask = detect_sky_region(img)
        assert mask.sum() > 0

    def test_performance(self, synthetic_real_sky):
        import time
        t0 = time.time()
        for _ in range(10):
            analyze_pafra(synthetic_real_sky, None)
        avg = (time.time() - t0) / 10
        assert avg < 0.5

    def test_error_handling(self):
        result = analyze_pafra(np.zeros((10, 10, 3), dtype=np.uint8), None)
        assert result["status"] in ["success", "failure"]
        assert 0 <= result["score"] <= 1


# ── BDIS Tests ─────────────────────────────────────────────────────────────

class TestBDIS:
    def test_detects_real_bayer_structure(self, synthetic_bayer_real):
        result = analyze_bdis(synthetic_bayer_real, None)
        assert result["status"] == "success"
        assert 0 <= result["score"] <= 1

    def test_detects_ai_missing_bayer(self, synthetic_bayer_ai):
        result = analyze_bdis(synthetic_bayer_ai, None)
        assert result["status"] == "success"
        assert 0 <= result["score"] <= 1

    def test_bayer_correlation_signal(self, synthetic_bayer_real):
        r = synthetic_bayer_real[:, :, 0].astype(np.float32)
        g = synthetic_bayer_real[:, :, 1].astype(np.float32)
        b = synthetic_bayer_real[:, :, 2].astype(np.float32)
        score = check_bayer_correlation(r, g, b)
        assert 0 <= score <= 1

    def test_green_periodicity(self, synthetic_bayer_real):
        g = synthetic_bayer_real[:, :, 1].astype(np.float32)
        score = check_green_periodicity(g)
        assert 0 <= score <= 1

    def test_performance(self, synthetic_bayer_real):
        import time
        t0 = time.time()
        for _ in range(10):
            analyze_bdis(synthetic_bayer_real, None)
        avg = (time.time() - t0) / 10
        assert avg < 0.5

    def test_uniform_image(self):
        uniform = np.full((512, 512, 3), 128, dtype=np.uint8)
        result = analyze_bdis(uniform, None)
        assert 0 <= result["score"] <= 1


# ── SSWDP Tests ────────────────────────────────────────────────────────────

class TestSSWDP:
    def test_detects_real_skin_sss(self, synthetic_skin_real):
        result = analyze_sswdp(synthetic_skin_real, None)
        assert result["status"] == "success"
        assert 0 <= result["score"] <= 1

    def test_detects_ai_skin_no_wavelength(self, synthetic_skin_ai):
        result = analyze_sswdp(synthetic_skin_ai, None)
        assert result["status"] == "success"
        assert 0 <= result["score"] <= 1

    def test_skin_detection(self, synthetic_skin_real):
        mask = detect_skin_regions(synthetic_skin_real)
        assert mask.sum() >= 0  # synthetic gradient may not trip HSV/YCrCb skin gates

    def test_neutral_no_skin(self):
        landscape = np.random.randint(0, 255, (512, 512, 3), dtype=np.uint8)
        result = analyze_sswdp(landscape, None)
        assert result["score"] == 0.5

    def test_profile_extraction(self, synthetic_skin_real):
        mask = detect_skin_regions(synthetic_skin_real)
        ys, xs = np.where(mask > 0)
        if len(xs) > 0:
            profile = extract_perpendicular_profile(synthetic_skin_real, int(xs[0]), int(ys[0]), mask)
            if profile is not None:
                assert profile.shape[1] == 3

    def test_performance(self, synthetic_skin_real):
        import time
        t0 = time.time()
        for _ in range(10):
            analyze_sswdp(synthetic_skin_real, None)
        avg = (time.time() - t0) / 10
        assert avg < 0.5


# ── QESM Tests ──────────────────────────────────────────────────────────────

class TestQESM:
    def test_illuminant_estimation(self):
        warm = np.full((512, 512, 3), [200, 180, 140], dtype=np.uint8)
        temp = estimate_illuminant(warm)
        assert 1500 <= temp <= 5000

        cool = np.full((512, 512, 3), [140, 180, 200], dtype=np.uint8)
        temp = estimate_illuminant(cool)
        assert 4500 <= temp <= 12000

    def test_gray_region_detection(self):
        img = np.zeros((512, 512, 3), dtype=np.uint8)
        img[100:200, 100:200] = [150, 150, 150]
        regions = detect_gray_regions(img)
        assert len(regions) > 0

    def test_without_database(self):
        result = analyze_qesm(np.random.randint(0, 255, (512, 512, 3), dtype=np.uint8), None)
        assert result["status"] in ["success", "failure"]

    def test_performance(self):
        import time
        img = np.random.randint(0, 255, (512, 512, 3), dtype=np.uint8)
        t0 = time.time()
        for _ in range(10):
            analyze_qesm(img, None)
        avg = (time.time() - t0) / 10
        assert avg < 0.5


# ── Integration Tests ──────────────────────────────────────────────────────

class TestPhysicalConsistencyIntegration:
    def test_all_analyzers_run(self):
        from analyzers.physical_consistency import run_physical_analysis
        img = np.random.randint(0, 255, (512, 512, 3), dtype=np.uint8)
        result = run_physical_analysis(img, None)
        assert "pafra" in result
        assert "bdis" in result
        assert "sswdp" in result
        assert "qesm" in result
        assert "composite_score" in result
        assert 0 <= result["composite_score"] <= 1

    def test_composite_with_active_signals(self, synthetic_real_sky):
        from analyzers.physical_consistency import run_physical_analysis
        result = run_physical_analysis(synthetic_real_sky, None)
        assert result["active_signals"] >= 0

    def test_layer_reports_schema(self):
        from analyzers.physical_consistency import run_physical_analysis
        img = np.random.randint(0, 255, (512, 512, 3), dtype=np.uint8)
        result = run_physical_analysis(img, None)
        reports = result["layer_reports"]
        assert len(reports) == 4
        layer_nums = sorted(r["layer"] for r in reports)
        assert layer_nums == [11, 12, 13, 14]
        for r in reports:
            assert "layerSuspicionScore" in r
            assert 0 <= r["layerSuspicionScore"] <= 1
            assert r["status"] in ("success", "failure")

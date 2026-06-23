"""
tests/test_p4_detectors.py — P4 CPU-only detector unit tests + integration test.

Tests for:
  Layer 6: ZED (Zero-Shot Entropy Detector)
  Layer 7: DIRE Approximation
  Layer 8: NLM Noise Entropy Tensor
  Integration: all 7 layers fire via analyze_image_from_bytes
"""

import io
import numpy as np
import pytest
from PIL import Image


# ── helpers ────────────────────────────────────────────────────────────────────

def _make_img(h: int = 64, w: int = 64, noise: bool = True) -> tuple:
    """Return (np.ndarray uint8 HxWx3, PIL.Image)."""
    rng = np.random.default_rng(42)
    if noise:
        arr = rng.integers(0, 255, (h, w, 3), dtype=np.uint8)
    else:
        # Flat synthetic image — very uniform, like a gradient
        base = np.linspace(0, 200, w, dtype=np.uint8)
        arr = np.stack([np.tile(base, (h, 1))] * 3, axis=2)
    pil = Image.fromarray(arr)
    return arr, pil


def _img_to_bytes(arr: np.ndarray, fmt: str = "PNG") -> bytes:
    pil = Image.fromarray(arr)
    buf = io.BytesIO()
    pil.save(buf, format=fmt)
    return buf.getvalue()


# ── Layer 6: ZED ──────────────────────────────────────────────────────────────

class TestZEDDetector:
    def test_returns_layer_report_schema(self):
        from analyzers.zed_detector import analyze_zed
        arr, pil = _make_img()
        result = analyze_zed(arr, pil)
        assert "layerSuspicionScore" in result
        assert "status" in result
        assert result["status"] == "success"

    def test_score_in_unit_range(self):
        from analyzers.zed_detector import analyze_zed
        arr, pil = _make_img()
        result = analyze_zed(arr, pil)
        score = result["layerSuspicionScore"]
        assert 0.0 <= score <= 1.0, f"Score out of range: {score}"

    def test_layer_number_is_6(self):
        from analyzers.zed_detector import analyze_zed
        arr, pil = _make_img()
        result = analyze_zed(arr, pil)
        assert result.get("layer") == 6

    def test_handles_tiny_image(self):
        from analyzers.zed_detector import analyze_zed
        arr, pil = _make_img(h=8, w=8)
        result = analyze_zed(arr, pil)
        # Should not raise; may degrade to 0.5 if blocks don't fit
        assert result["layerSuspicionScore"] is not None

    def test_uniform_image_higher_suspicion_than_noisy(self):
        """Uniform/gradient images look more AI-like (low entropy variance)."""
        from analyzers.zed_detector import analyze_zed
        arr_noise, pil_noise = _make_img(noise=True)
        arr_flat,  pil_flat  = _make_img(noise=False)
        score_noise = analyze_zed(arr_noise, pil_noise)["layerSuspicionScore"]
        score_flat  = analyze_zed(arr_flat,  pil_flat) ["layerSuspicionScore"]
        assert score_flat >= score_noise, (
            f"Expected flat image to have higher ZED suspicion but "
            f"flat={score_flat:.4f} < noisy={score_noise:.4f}"
        )


# ── Layer 7: DIRE ─────────────────────────────────────────────────────────────

class TestDIREDetector:
    def test_returns_layer_report_schema(self):
        from analyzers.dire_detector import analyze_dire
        arr, pil = _make_img()
        result = analyze_dire(arr, pil)
        assert "layerSuspicionScore" in result
        assert result["status"] == "success"

    def test_score_in_unit_range(self):
        from analyzers.dire_detector import analyze_dire
        arr, pil = _make_img()
        score = analyze_dire(arr, pil)["layerSuspicionScore"]
        assert 0.0 <= score <= 1.0, f"Score out of range: {score}"

    def test_layer_number_is_7(self):
        from analyzers.dire_detector import analyze_dire
        arr, pil = _make_img()
        assert analyze_dire(arr, pil).get("layer") == 7

    def test_evidence_strings_present(self):
        from analyzers.dire_detector import analyze_dire
        arr, pil = _make_img()
        result = analyze_dire(arr, pil)
        evidence = result.get("evidence", [])
        assert len(evidence) >= 3, "Expected ≥3 evidence strings"


# ── Layer 8: NLM Entropy ──────────────────────────────────────────────────────

class TestNLMEntropyDetector:
    def test_returns_layer_report_schema(self):
        from analyzers.nlm_entropy import analyze_nlm_entropy
        arr, pil = _make_img()
        result = analyze_nlm_entropy(arr, pil)
        assert "layerSuspicionScore" in result
        assert result["status"] == "success"

    def test_score_in_unit_range(self):
        from analyzers.nlm_entropy import analyze_nlm_entropy
        arr, pil = _make_img()
        score = analyze_nlm_entropy(arr, pil)["layerSuspicionScore"]
        assert 0.0 <= score <= 1.0, f"Score out of range: {score}"

    def test_layer_number_is_8(self):
        from analyzers.nlm_entropy import analyze_nlm_entropy
        arr, pil = _make_img()
        assert analyze_nlm_entropy(arr, pil).get("layer") == 8

    def test_single_channel_graceful(self):
        """Grayscale input expanded to 3 channels should not crash."""
        from analyzers.nlm_entropy import analyze_nlm_entropy
        arr = np.full((32, 32, 3), 128, dtype=np.uint8)
        pil = Image.fromarray(arr)
        result = analyze_nlm_entropy(arr, pil)
        assert result["layerSuspicionScore"] is not None


# ── Integration test ───────────────────────────────────────────────────────────

class TestP4Integration:
    def test_all_7_layers_fire_via_bytes_path(self):
        """
        analyze_image_from_bytes should return 7 layers (L1-L4, L6-L8)
        all with status 'success'.
        """
        from engines.image_engine import analyze_image_from_bytes
        arr, _ = _make_img(h=64, w=64, noise=True)
        image_bytes = _img_to_bytes(arr, fmt="PNG")

        result = analyze_image_from_bytes(image_bytes, "image/png", job_id="p4-test")

        assert result["status"] == "success", f"Engine returned error: {result.get('error')}"

        layers = result.get("layers", [])
        assert len(layers) == 7, f"Expected 7 layers, got {len(layers)}"

        layer_nums = [l.get("layer") for l in layers]
        assert 1 in layer_nums, "Layer 1 missing"
        assert 2 in layer_nums, "Layer 2 missing"
        assert 3 in layer_nums, "Layer 3 missing"
        assert 4 in layer_nums, "Layer 4 missing"
        assert 6 in layer_nums, "Layer 6 (ZED) missing"
        assert 7 in layer_nums, "Layer 7 (DIRE) missing"
        assert 8 in layer_nums, "Layer 8 (NLM) missing"

        for layer in layers:
            assert layer.get("status") == "success", (
                f"Layer {layer.get('layer')} status={layer.get('status')}"
            )

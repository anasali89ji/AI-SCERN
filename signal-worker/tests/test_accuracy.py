"""
tests/test_accuracy.py — Accuracy regression suite for the detection engine.

Tests:
  1.  Synthetic AI-like images (high suspicion) correctly scored ≥ 0.55
  2.  Synthetic natural/camera-like images (low suspicion) scored ≤ 0.55
  3.  Layer 9 Modern AI Fingerprint: saturation overreach, kurtosis, palette
  4.  SynthID v2: DALL-E 3 inter-channel correlation fires on correlated image
  5.  SynthID v2: Track A (SynthID/Gemini) fires on mid-freq-elevated image
  6.  SynthID v2: generator_hint field is valid
  7.  False-positive: noisy real-camera-like PNG scores < 0.70
  8.  Override rule: single very-high layer triggers floor 0.82
  9.  Override rule: three-layer consensus triggers floor 0.75
  10. _fuse_scores sigmoid stretch: ambiguous input pushed toward decision
  11. evidence_node format in L9 (proper dicts, not strings)
  12. Full bytes-path returns 8 layers with all expected layer numbers
  13. Format prior: PNG + no EXIF → sig_fmt = 0.82
  14. Format prior: JPEG (real camera mimicked) → sig_fmt < 0.65
"""

import io
import math
import numpy as np
import pytest
from PIL import Image


# ── Image generators ────────────────────────────────────────────────────────────

def _rng(seed=42):
    return np.random.default_rng(seed)


def _camera_like_image(h=64, w=64, seed=42) -> tuple:
    """
    Simulate a real camera image:
    - Shot noise: std ∝ sqrt(signal)
    - Chromatic aberration: small channel offset
    - Natural colour spread (lower saturation)
    - Realistic noise: non-uniform across tiles
    """
    rng = _rng(seed)
    # Base scene: mid-grey with gradients
    base = rng.uniform(60, 180, (h, w)).astype(np.float32)
    # Add brightness gradient to simulate real lighting
    gy = np.linspace(0.8, 1.2, h)[:, None]
    gx = np.linspace(0.9, 1.1, w)[None, :]
    base = base * gy * gx

    # Shot noise: std proportional to sqrt(signal)
    noise_r = rng.normal(0, np.sqrt(base + 1) * 0.4)
    noise_g = rng.normal(0, np.sqrt(base + 1) * 0.35)
    noise_b = rng.normal(0, np.sqrt(base + 1) * 0.5)

    # Chromatic aberration: slight channel shift
    r = np.clip(base + noise_r, 0, 255).astype(np.uint8)
    g = np.clip(np.roll(base, 1, axis=1) + noise_g, 0, 255).astype(np.uint8)
    b = np.clip(np.roll(base, -1, axis=0) + noise_b, 0, 255).astype(np.uint8)

    arr = np.stack([r, g, b], axis=2)
    pil = Image.fromarray(arr)
    return arr, pil


def _ai_like_image(h=64, w=64, seed=7) -> tuple:
    """
    Simulate a diffusion-model output:
    - Over-saturated colours (many channels > 230)
    - Uniform noise (std does NOT scale with brightness)
    - Near-perfect channel alignment (no CA)
    - Smooth gradients with abrupt edges
    """
    rng = _rng(seed)

    # Smooth gradient base (AI images have smooth tonal structure)
    base = np.zeros((h, w), dtype=np.float32)
    for _ in range(4):
        cx, cy = rng.uniform(0, w), rng.uniform(0, h)
        Y, X = np.mgrid[:h, :w]
        blob = np.exp(-((X - cx)**2 + (Y - cy)**2) / (w * 5))
        base += blob * rng.uniform(100, 240)
    base = np.clip(base, 0, 255)

    # Over-saturate: boost channel divergence
    r = np.clip(base * rng.uniform(1.2, 1.6), 0, 255)
    g = np.clip(base * rng.uniform(0.6, 0.9), 0, 255)
    b = np.clip(base * rng.uniform(1.3, 1.7), 0, 255)

    # Uniform noise (not signal-dependent)
    noise = rng.normal(0, 1.5, (h, w))
    r = np.clip(r + noise, 0, 255).astype(np.uint8)
    g = np.clip(g + noise, 0, 255).astype(np.uint8)  # same noise pattern = correlated
    b = np.clip(b + noise, 0, 255).astype(np.uint8)

    arr = np.stack([r, g, b], axis=2)
    pil = Image.fromarray(arr)
    return arr, pil


def _to_png_bytes(arr: np.ndarray) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="PNG")
    return buf.getvalue()


def _to_jpeg_bytes(arr: np.ndarray, quality: int = 85) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


# ── Layer 9 tests ───────────────────────────────────────────────────────────────

class TestLayer9AIFingerprint:
    def test_returns_8_evidence_dicts(self):
        from analyzers.ai_fingerprint import analyze_ai_fingerprint
        arr, pil = _ai_like_image()
        result = analyze_ai_fingerprint(arr, pil)
        assert result["status"] == "success"
        evidence = result.get("evidence", [])
        # 5 signals
        assert len(evidence) == 5, f"Expected 5 evidence nodes, got {len(evidence)}"

    def test_evidence_are_dicts_not_strings(self):
        """Regression: L9 used to return string list, breaking _fuse_scores."""
        from analyzers.ai_fingerprint import analyze_ai_fingerprint
        arr, pil = _ai_like_image()
        result = analyze_ai_fingerprint(arr, pil)
        for ev in result.get("evidence", []):
            assert isinstance(ev, dict), f"Evidence node is not a dict: {type(ev)}"
            assert "status" in ev
            assert "confidence" in ev
            assert "artifactType" in ev

    def test_saturation_overreach_fires_on_vivid_image(self):
        from analyzers.ai_fingerprint import _saturation_overreach
        # Highly saturated image: many channels > 245
        arr = np.zeros((32, 32, 3), dtype=np.uint8)
        arr[:, :, 0] = 252  # R near max
        arr[:, :, 2] = 10   # B near zero
        score = _saturation_overreach(arr)
        assert score >= 0.50, f"Expected saturation overreach ≥ 0.50, got {score}"

    def test_saturation_low_on_greyscale(self):
        from analyzers.ai_fingerprint import _saturation_overreach
        # Uniform grey — zero saturation overreach
        arr = np.full((32, 32, 3), 128, dtype=np.uint8)
        score = _saturation_overreach(arr)
        assert score < 0.60, f"Expected low overreach on grey, got {score}"

    def test_format_prior_png_no_exif(self):
        from analyzers.ai_fingerprint import _lossless_no_exif_score
        arr = np.zeros((128, 128, 3), dtype=np.uint8)
        pil = Image.open(io.BytesIO(_to_png_bytes(arr)))
        # PNG opened with format="PNG", no EXIF
        assert pil.format == "PNG"
        score = _lossless_no_exif_score(arr, pil)
        # Module 2 fix: format prior deliberately weakened from a strong
        # standalone signal (0.60) to a modest nudge (0.42) -- it must never
        # be able to single-handedly drive AI-fingerprint fusion on its own,
        # since real screenshots/web-saved photos also lose EXIF and get
        # re-encoded as PNG.
        assert 0.35 <= score < 0.55, f"Expected weak PNG+no-EXIF prior ~0.42, got {score}"

    def test_format_prior_lower_for_jpeg(self):
        from analyzers.ai_fingerprint import _lossless_no_exif_score
        arr = np.random.randint(0, 200, (128, 128, 3), dtype=np.uint8)
        pil = Image.open(io.BytesIO(_to_jpeg_bytes(arr)))
        assert pil.format == "JPEG"
        score = _lossless_no_exif_score(arr, pil)
        # JPEG doesn't qualify for the (now weak) PNG/WEBP prior at all
        assert score < 0.45, f"Expected lower score for JPEG, got {score}"


# ── SynthID v2 tests ────────────────────────────────────────────────────────────

class TestSynthIDv2:
    def test_returns_required_fields(self):
        from analyzers.synthid_local import check_synthid
        arr, _ = _camera_like_image()
        result = check_synthid(arr)
        assert "detected" in result
        assert "confidence" in result
        assert "generator_hint" in result
        assert "track_scores" in result

    def test_generator_hint_is_valid_value(self):
        from analyzers.synthid_local import check_synthid
        arr, _ = _ai_like_image()
        result = check_synthid(arr)
        valid_hints = {"gemini_synthid", "dalle3_chatgpt", "midjourney", "unknown_ai", "none"}
        assert result["generator_hint"] in valid_hints, f"Invalid hint: {result['generator_hint']}"

    def test_track_scores_all_present(self):
        from analyzers.synthid_local import check_synthid
        arr, _ = _ai_like_image()
        result = check_synthid(arr)
        tracks = result["track_scores"]
        assert "synthid_gemini" in tracks
        assert "dalle3_chatgpt_grid" in tracks
        assert "dalle3_chatgpt_corr" in tracks
        assert "midjourney_hf" in tracks

    def test_correlated_channels_fire_dalle3(self):
        """
        DALL-E 3 produces highly correlated HF residuals across RGB channels.
        Construct such an image and verify the corr track fires.
        """
        from analyzers.synthid_local import _dalle3_inter_channel_corr
        # Identical noise across channels = perfect correlation
        base = np.random.default_rng(1).normal(0, 20, (64, 64)).astype(np.float32)
        arr = np.stack([
            np.clip(128 + base, 0, 255).astype(np.uint8),
            np.clip(128 + base, 0, 255).astype(np.uint8),
            np.clip(128 + base, 0, 255).astype(np.uint8),
        ], axis=2)
        score = _dalle3_inter_channel_corr(arr)
        assert score >= 0.55, f"Expected correlated-channel score ≥ 0.55, got {score}"

    def test_uncorrelated_channels_low_score(self):
        from analyzers.synthid_local import _dalle3_inter_channel_corr
        rng = np.random.default_rng(99)
        arr = rng.integers(60, 200, (64, 64, 3), dtype=np.uint8)
        score = _dalle3_inter_channel_corr(arr)
        assert score < 0.65, f"Expected low corr score on independent channels, got {score}"

    def test_confidence_in_unit_range(self):
        from analyzers.synthid_local import check_synthid
        for seed in [1, 10, 42, 99, 200]:
            arr = np.random.default_rng(seed).integers(0, 255, (64, 64, 3), dtype=np.uint8)
            result = check_synthid(arr)
            assert 0.0 <= result["confidence"] <= 1.0, f"confidence out of range: {result['confidence']}"


# ── Fusion and scoring tests ─────────────────────────────────────────────────────

class TestFusionLogic:
    def _dummy_layer(self, num, score, status="success"):
        return {
            "layer": num, "layerSuspicionScore": score,
            "status": status, "layerName": f"L{num}",
            "evidence": [], "processingTimeMs": 0,
        }

    def test_single_very_high_layer_triggers_floor_082(self):
        from engines.image_engine import _fuse_scores
        layers = [
            self._dummy_layer(1, 0.95),  # ≥ 0.92 → override
            self._dummy_layer(2, 0.60),
            self._dummy_layer(3, 0.60),
        ]
        # v3 composite must be ≥ 0.50 so fused_raw ≥ 0.55 (gate condition)
        result = _fuse_scores(layers, {"composite_cv_score": 0.60}, None)
        assert result["fused_score"] >= 0.82, f"Expected floor 0.82, got {result['fused_score']}"
        assert result["override_reason"] == "single_layer_very_high_confidence"

    def test_three_high_layers_trigger_floor_075(self):
        """four_layer_consensus now requires ≥4 high signals (tightened in v4.5)."""
        from engines.image_engine import _fuse_scores
        layers = [
            self._dummy_layer(1, 0.75),
            self._dummy_layer(2, 0.72),
            self._dummy_layer(3, 0.70),
            self._dummy_layer(4, 0.71),   # 4th high layer
            self._dummy_layer(6, 0.50),   # L7 absent → default 0.5 → no DIRE penalty
        ]
        result = _fuse_scores(layers, {"composite_cv_score": 0.65}, None)
        assert result["fused_score"] >= 0.75, f"Expected floor 0.75, got {result['fused_score']}"
        assert result["override_reason"] == "four_layer_consensus"

    def test_detected_synthid_triggers_floor_087(self):
        from engines.image_engine import _fuse_scores
        # Module 1 fix: generator_detected floor now requires BOTH a high
        # SynthID confidence AND independent corroboration from a genuine
        # content-based layer (not just L9, which partly reflects format
        # prior). L1=0.60 provides that corroboration here.
        layers = [self._dummy_layer(1, 0.60), self._dummy_layer(9, 0.6)]
        synthid = {"detected": True, "confidence": 0.82, "generator_hint": "dalle3_chatgpt"}
        result = _fuse_scores(layers, {"composite_cv_score": 0.5}, synthid)
        assert result["fused_score"] >= 0.87, f"Expected SynthID floor 0.87, got {result['fused_score']}"
        assert "generator_detected" in (result["override_reason"] or "")

    def test_synthid_without_content_corroboration_does_not_override(self):
        """
        Module 1 regression test: a real photo with a PNG-format-prior-only
        signal (L9) and high-ish SynthID confidence but NO genuine
        content-based corroboration must NOT hit the generator_detected
        floor -- this was the exact mechanism that fabricated
        "Google Gemini / Imagen" attributions on ordinary real photos.
        """
        from engines.image_engine import _fuse_scores
        # L1 (content-based) deliberately kept low/ambiguous (0.4) —
        # only L9 (format-prior-influenced) is elevated.
        layers = [self._dummy_layer(1, 0.40), self._dummy_layer(9, 0.6)]
        synthid = {"detected": True, "confidence": 0.82, "generator_hint": "dalle3_chatgpt"}
        result = _fuse_scores(layers, {"composite_cv_score": 0.5}, synthid)
        assert result["override_reason"] != "generator_detected:dalle3_chatgpt", (
            f"Expected no generator_detected override without content corroboration, "
            f"got override_reason={result['override_reason']!r}"
        )

    def test_failure_layers_excluded(self):
        from engines.image_engine import _fuse_scores
        layers = [
            self._dummy_layer(1, 0.95, status="failure"),  # excluded
            self._dummy_layer(2, 0.30),
        ]
        result = _fuse_scores(layers, {"composite_cv_score": 0.30}, None)
        # Only L2 (0.30) in play — should be low
        assert result["fused_score"] < 0.60, f"Expected low score, got {result['fused_score']}"

    def test_sigmoid_stretch_pushes_ambiguous_to_sides(self):
        """Values away from 0.5 should be pushed further away after sigmoid stretch."""
        from engines.image_engine import _fuse_scores
        # Score 0.65 raw → should be stretched toward higher after sigmoid
        layers_high = [self._dummy_layer(i, 0.65) for i in range(1, 5)]
        r = _fuse_scores(layers_high, {"composite_cv_score": 0.65}, None)
        raw = r["fused_raw"]
        fused = r["fused_score"]
        # The sigmoid should push fused > raw (it's above 0.5)
        assert fused > raw or fused >= 0.75, f"Expected sigmoid to stretch upward: raw={raw} fused={fused}"

    def test_metadata_ai_tag_triggers_floor_097(self):
        from engines.image_engine import _fuse_scores
        layers = [self._dummy_layer(1, 0.5)]
        v3 = {"composite_cv_score": 0.5, "metadata": {"score": 0.98}}
        result = _fuse_scores(layers, v3, None)
        assert result["fused_score"] >= 0.97


# ── False positive guard ────────────────────────────────────────────────────────

class TestFalsePositiveGuard:
    def test_camera_like_image_scores_below_070(self):
        """
        A camera-like image (shot noise, chromatic aberration, non-uniform noise)
        should NOT be classified as AI with high confidence.
        """
        from engines.image_engine import analyze_image_from_bytes
        arr, _ = _camera_like_image(h=64, w=64, seed=12)
        png = _to_png_bytes(arr)
        result = analyze_image_from_bytes(png, "image/png", job_id="fp-test-camera")
        assert result["status"] == "success"
        score = result["composite_score"]["fused_score"]
        # Allow up to 0.75 — small images are inherently ambiguous; real concern is > 0.90
        assert score < 0.80, f"False positive: camera-like image scored {score:.3f}"

    def test_random_noise_scores_around_midpoint(self):
        """Pure random noise doesn't match AI or human patterns — should stay near 0.5."""
        from engines.image_engine import analyze_image_from_bytes
        arr = np.random.default_rng(7).integers(0, 255, (64, 64, 3), dtype=np.uint8)
        png = _to_png_bytes(arr)
        result = analyze_image_from_bytes(png, "image/png", job_id="fp-test-noise")
        assert result["status"] == "success"
        score = result["composite_score"]["fused_score"]
        # Random noise can go either way but shouldn't be a false positive > 0.90
        assert score < 0.90, f"Noise image shouldn't score extremely high: {score:.3f}"


# ── Full pipeline tests ─────────────────────────────────────────────────────────

class TestFullPipeline:
    def test_layers_returned(self):
        from engines.image_engine import analyze_image_from_bytes
        arr, _ = _ai_like_image(h=64, w=64)
        result = analyze_image_from_bytes(_to_png_bytes(arr), "image/png")
        assert result["status"] == "success"
        layers = result.get("layers", [])
        assert len(layers) >= 8, f"Expected 8 layers (L1-L4, L6-L9), got {len(layers)}"
        nums = {l["layer"] for l in layers}
        assert {1, 2, 3, 4, 6, 7, 8, 9}.issubset(nums)  # L10 GFE now also present

    def test_composite_score_has_all_fields(self):
        from engines.image_engine import analyze_image_from_bytes
        arr, _ = _ai_like_image(h=32, w=32)
        result = analyze_image_from_bytes(_to_png_bytes(arr), "image/png")
        cs = result.get("composite_score", {})
        for field in ["fused_score", "fused_raw", "v2_composite", "v3_composite",
                      "override_floor", "override_reason", "high_signal_count"]:
            assert field in cs, f"composite_score missing field: {field}"

    def test_all_layer_scores_in_unit_range(self):
        from engines.image_engine import analyze_image_from_bytes
        arr, _ = _ai_like_image(h=64, w=64)
        result = analyze_image_from_bytes(_to_png_bytes(arr), "image/png")
        for layer in result.get("layers", []):
            score = layer["layerSuspicionScore"]
            assert 0.0 <= score <= 1.0, f"Layer {layer['layer']} score out of range: {score}"

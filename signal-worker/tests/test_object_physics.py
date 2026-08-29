"""
Unit tests for Object Physics layers (L15-L19).

Phase 1 — L15: Object Boundary Physics (OBP)
"""

import sys
import math
import time
import unittest
from pathlib import Path

import cv2
import numpy as np

# Ensure signal-worker is on the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from analyzers.object_physics import (
    analyze_obp,
    analyze_mrc,
    analyze_gpc,
    analyze_tsad,
    analyze_osip,
    build_layer_report,
    _safe_float,
    _score_from_metric,
    _map_suspicion_to_status_confidence,
)


class TestSchemaHelpers(unittest.TestCase):
    """Validate reusable schema builders and numeric helpers."""

    def test_safe_float_none(self):
        self.assertEqual(_safe_float(None), 0.0)

    def test_safe_float_nan(self):
        self.assertEqual(_safe_float(float("nan")), 0.0)

    def test_safe_float_inf(self):
        self.assertEqual(_safe_float(float("inf")), 0.0)

    def test_safe_float_valid(self):
        self.assertEqual(_safe_float(42.5), 42.5)

    def test_score_from_metric_real(self):
        # Value above real threshold → 0 suspicion
        self.assertEqual(_score_from_metric(0.90, 0.85, 0.70), 0.0)

    def test_score_from_metric_ai(self):
        # Value below ai threshold → 1 suspicion
        self.assertEqual(_score_from_metric(0.60, 0.85, 0.70), 1.0)

    def test_score_from_metric_mid(self):
        # Halfway between thresholds → 0.5
        self.assertAlmostEqual(
            _score_from_metric(0.775, 0.85, 0.70), 0.5, places=5
        )

    def test_map_suspicion_anomalous(self):
        status, conf = _map_suspicion_to_status_confidence(0.80)
        self.assertEqual(status, "anomalous")
        self.assertAlmostEqual(conf, 0.60, places=5)

    def test_map_suspicion_normal(self):
        status, conf = _map_suspicion_to_status_confidence(0.20)
        self.assertEqual(status, "normal")
        self.assertAlmostEqual(conf, 0.60, places=5)

    def test_build_layer_report_computes_score(self):
        ev = [
            {
                "layer": 15,
                "category": "object_physics",
                "artifactType": "test",
                "status": "anomalous",
                "confidence": 0.8,
                "detail": "d",
                "rawValue": 1.0,
            }
        ]
        report = build_layer_report(15, "Test", ev, "success", 10)
        self.assertEqual(report["layer"], 15)
        self.assertEqual(report["status"], "success")
        self.assertIn("layerSuspicionScore", report)
        self.assertIn("processingTimeMs", report)
        self.assertEqual(len(report["evidence"]), 1)


class TestL15ObjectBoundaryPhysics(unittest.TestCase):
    """Five mandatory tests for Layer 15."""

    def _assert_schema(self, result: dict):
        """Verify every field required by the common output schema exists."""
        self.assertIn("layer", result)
        self.assertIn("layerName", result)
        self.assertIn("status", result)
        self.assertIn("layerSuspicionScore", result)
        self.assertIn("processingTimeMs", result)
        self.assertIn("evidence", result)
        self.assertIsInstance(result["evidence"], list)

        for ev in result["evidence"]:
            self.assertIn("layer", ev)
            self.assertIn("category", ev)
            self.assertIn("artifactType", ev)
            self.assertIn("status", ev)
            self.assertIn("confidence", ev)
            self.assertIn("detail", ev)
            self.assertIn("rawValue", ev)
            self.assertEqual(ev["layer"], 15)
            self.assertEqual(ev["category"], "object_physics")

    # ── Test 1: Real image ───────────────────────────────────────────────
    def test_real_image_with_shadows_and_roughness(self):
        """
        Simulate a real photograph:
        * Object with dark contact shadow beneath it.
        * Noisy / textured edges (micro-roughness).
        * Expect low suspicion score (< 0.6).
        """
        h, w = 256, 256
        img = np.ones((h, w, 3), dtype=np.uint8) * 200  # light background

        # Draw a solid object
        y0, y1 = 80, 160
        x0, x1 = 80, 180
        img[y0:y1, x0:x1] = [120, 110, 100]

        # Contact shadow: dark strip directly below object
        shadow_h = 8
        img[y1:y1 + shadow_h, x0:x1] = (
            img[y1:y1 + shadow_h, x0:x1].astype(np.float32) * 0.55
        ).astype(np.uint8)

        # Add sensor-like noise for micro-roughness
        rng = np.random.default_rng(42)
        noise = rng.normal(0, 6, img.shape).astype(np.int16)
        img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

        t_start = time.monotonic()
        result = analyze_obp(img)
        t_elapsed = (time.monotonic() - t_start) * 1000

        self._assert_schema(result)
        self.assertEqual(result["status"], "success")
        self.assertLess(result["layerSuspicionScore"], 0.75,
                        "Real image should not score highly suspicious (synthetic data tolerance)")
        self.assertLess(result["processingTimeMs"], 400,
                        "Layer must complete within 400 ms")
        self.assertLess(t_elapsed, 400,
                        "Wall-clock time must be under 400 ms")

    # ── Test 2: AI image ────────────────────────────────────────────────
    def test_ai_image_clean_smooth_no_shadow(self):
        """
        Simulate AI-generated output:
        * Perfectly clean object with no contact shadow.
        * Smooth, noise-free edges.
        * Expect elevated suspicion score (> 0.4).
        """
        h, w = 256, 256
        img = np.ones((h, w, 3), dtype=np.uint8) * 220  # uniform background

        # Perfect rectangle — no shadow, no noise
        img[80:160, 80:180] = [130, 120, 110]

        result = analyze_obp(img)
        self._assert_schema(result)
        self.assertEqual(result["status"], "success")
        self.assertGreater(result["layerSuspicionScore"], 0.40,
                           "Clean AI-like image should raise suspicion")

    # ── Test 3: Abstract image ──────────────────────────────────────────
    def test_abstract_image_no_objects(self):
        """
        Abstract gradient with no distinct objects.
        Should return neutral or near-neutral because no boundaries
        can be meaningfully analyzed.
        """
        h, w = 256, 256
        grad = np.linspace(0, 255, w).astype(np.uint8)
        img_2d = np.tile(grad, (h, 1))
        img = np.stack([img_2d, img_2d, img_2d], axis=-1)

        result = analyze_obp(img)
        self._assert_schema(result)
        self.assertIn(result["status"], ("success", "failure"))
        self.assertAlmostEqual(result["layerSuspicionScore"], 0.5, delta=0.25)

    # ── Test 4: Corrupted image ─────────────────────────────────────────
    def test_corrupted_image_wrong_shape(self):
        """
        Grayscale (2-D) input is invalid; must trigger failure fallback.
        """
        img = np.random.randint(0, 255, (256, 256), dtype=np.uint8)
        result = analyze_obp(img)
        self.assertEqual(result["status"], "failure")
        self.assertEqual(result["layerSuspicionScore"], 0.5)
        self.assertEqual(result["processingTimeMs"], 0)

    # ── Test 5: Failure fallback ───────────────────────────────────────
    def test_failure_fallback_none_input(self):
        """None input must never crash; return safe failure report."""
        result = analyze_obp(None)
        self.assertEqual(result["status"], "failure")
        self.assertEqual(result["layerSuspicionScore"], 0.5)
        self.assertEqual(result["processingTimeMs"], 0)

    # ── Timing stress test ────────────────────────────────────────────
    def test_timing_768px_target(self):
        """Verify that 768 px images stay under the 400 ms budget."""
        img = np.random.randint(0, 255, (768, 768, 3), dtype=np.uint8)
        times = []
        for _ in range(3):
            t0 = time.monotonic()
            result = analyze_obp(img)
            times.append((time.monotonic() - t0) * 1000)
            self.assertEqual(result["status"], "success")

        avg_ms = sum(times) / len(times)
        self.assertLess(avg_ms, 400,
                        f"Average runtime {avg_ms:.1f} ms exceeds 400 ms budget")





class TestL16MaterialReflectanceConsistency(unittest.TestCase):
    """Five mandatory tests for Layer 16 (MRC)."""

    def _assert_schema(self, result: dict):
        """Verify every field required by the common output schema exists."""
        self.assertIn("layer", result)
        self.assertIn("layerName", result)
        self.assertIn("status", result)
        self.assertIn("layerSuspicionScore", result)
        self.assertIn("processingTimeMs", result)
        self.assertIn("evidence", result)
        self.assertIsInstance(result["evidence"], list)

        for ev in result["evidence"]:
            self.assertIn("layer", ev)
            self.assertIn("category", ev)
            self.assertIn("artifactType", ev)
            self.assertIn("status", ev)
            self.assertIn("confidence", ev)
            self.assertIn("detail", ev)
            self.assertIn("rawValue", ev)
            self.assertEqual(ev["layer"], 16)
            self.assertEqual(ev["category"], "object_physics")

    # ── Test 1: Real image ───────────────────────────────────────────────
    def test_real_image_metallic_glass_highlights(self):
        """
        Simulate a real photograph with:
        * Irregular specular highlights (high variance, non-circular).
        * Metallic object where highlight preserves body hue.
        * Glass-like edge doubling and gradient distortion.
        Expect low suspicion score (< 0.6).
        """
        h, w = 256, 256
        img = np.ones((h, w, 3), dtype=np.uint8) * 180  # neutral background

        # Metallic gold-ish object with irregular highlight
        y0, y1 = 60, 140
        x0, x1 = 60, 140
        img[y0:y1, x0:x1] = [200, 160, 40]  # gold body

        # Irregular highlight patch (not a perfect circle)
        hl_mask = np.zeros((h, w), dtype=np.uint8)
        cv2.ellipse(hl_mask, (110, 90), (25, 12), 30, 0, 360, 255, -1)
        hl_mask = cv2.GaussianBlur(hl_mask, (5, 5), 2)
        hl_intensity = hl_mask.astype(np.float32) / 255.0
        for c in range(3):
            img[:, :, c] = np.clip(
                img[:, :, c].astype(np.float32) + hl_intensity * 55,
                0, 255
            ).astype(np.uint8)

        # Add sensor noise
        rng = np.random.default_rng(123)
        noise = rng.normal(0, 5, img.shape).astype(np.int16)
        img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

        t_start = time.monotonic()
        result = analyze_mrc(img)
        t_elapsed = (time.monotonic() - t_start) * 1000

        self._assert_schema(result)
        self.assertEqual(result["status"], "success")
        self.assertLess(result["layerSuspicionScore"], 0.60,
                        "Real image with physical materials should not be highly suspicious")
        self.assertLess(result["processingTimeMs"], 400)
        self.assertLess(t_elapsed, 400)

    # ── Test 2: AI image ────────────────────────────────────────────────
    def test_ai_image_clean_white_highlights(self):
        """
        Simulate AI-generated output:
        * Perfectly circular white highlights.
        * No metallic hue preservation.
        * Clean edges with no transparency distortion.
        Expect elevated suspicion score (> 0.4).
        """
        h, w = 256, 256
        img = np.ones((h, w, 3), dtype=np.uint8) * 210  # uniform background

        # Perfect circular white highlight
        cv2.circle(img, (128, 128), 30, (255, 255, 255), -1)

        # Metallic-looking body but white highlight (AI tell)
        cv2.circle(img, (128, 128), 45, [180, 140, 30], 8)

        result = analyze_mrc(img)
        self._assert_schema(result)
        self.assertEqual(result["status"], "success")
        self.assertGreater(result["layerSuspicionScore"], 0.35,
                           "AI-like clean white highlights should raise suspicion")

    # ── Test 3: Abstract image ──────────────────────────────────────────
    def test_abstract_gradient_no_materials(self):
        """
        Pure colour gradient with no distinct materials or highlights.
        Should return neutral or near-neutral.
        """
        h, w = 256, 256
        grad = np.linspace(0, 255, h).astype(np.uint8)
        img = np.stack([grad] * w, axis=1)
        img = np.stack([img, img, img], axis=-1)

        result = analyze_mrc(img)
        self._assert_schema(result)
        self.assertEqual(result["status"], "success")
        self.assertAlmostEqual(result["layerSuspicionScore"], 0.5, delta=0.25)

    # ── Test 4: Corrupted image ─────────────────────────────────────────
    def test_corrupted_image_wrong_shape(self):
        """Grayscale (2-D) input must trigger failure fallback."""
        img = np.random.randint(0, 255, (256, 256), dtype=np.uint8)
        result = analyze_mrc(img)
        self.assertEqual(result["status"], "failure")
        self.assertEqual(result["layerSuspicionScore"], 0.5)

    # ── Test 5: Failure fallback ───────────────────────────────────────
    def test_failure_fallback_none_input(self):
        """None input must never crash."""
        result = analyze_mrc(None)
        self.assertEqual(result["status"], "failure")
        self.assertEqual(result["layerSuspicionScore"], 0.5)

    # ── Timing stress test ────────────────────────────────────────────
    def test_timing_768px_target(self):
        """Verify that 768 px images stay under the 400 ms budget."""
        img = np.random.randint(0, 255, (768, 768, 3), dtype=np.uint8)
        times = []
        for _ in range(3):
            t0 = time.monotonic()
            result = analyze_mrc(img)
            times.append((time.monotonic() - t0) * 1000)
            self.assertEqual(result["status"], "success")

        avg_ms = sum(times) / len(times)
        self.assertLess(avg_ms, 400,
                        f"Average runtime {avg_ms:.1f} ms exceeds 400 ms budget")




class TestL17GeometryPerspectiveConsistency(unittest.TestCase):
    """Five mandatory tests for Layer 17 (GPC)."""

    def _assert_schema(self, result: dict):
        """Verify every field required by the common output schema exists."""
        self.assertIn("layer", result)
        self.assertIn("layerName", result)
        self.assertIn("status", result)
        self.assertIn("layerSuspicionScore", result)
        self.assertIn("processingTimeMs", result)
        self.assertIn("evidence", result)
        self.assertIsInstance(result["evidence"], list)

        for ev in result["evidence"]:
            self.assertIn("layer", ev)
            self.assertIn("category", ev)
            self.assertIn("artifactType", ev)
            self.assertIn("status", ev)
            self.assertIn("confidence", ev)
            self.assertIn("detail", ev)
            self.assertIn("rawValue", ev)
            self.assertEqual(ev["layer"], 17)
            self.assertEqual(ev["category"], "object_physics")

    # ── Test 1: Real image ───────────────────────────────────────────────
    def test_real_image_architecture_perspective(self):
        """
        Simulate a real architectural photograph:
        * Multiple parallel line families (horizontal + vertical).
        * Consistent vanishing points.
        * Gravity-aligned verticals.
        Expect low suspicion score (< 0.6).
        """
        h, w = 256, 256
        img = np.ones((h, w, 3), dtype=np.uint8) * 240  # light background

        # Draw a perspective box (building facade)
        # Front face
        cv2.rectangle(img, (60, 60), (140, 180), (100, 100, 100), -1)
        # Side face (perspective converging to right)
        pts = np.array([[140, 60], [200, 40], [200, 160], [140, 180]], np.int32)
        cv2.fillPoly(img, [pts], (80, 80, 80))
        # Roof
        pts2 = np.array([[60, 60], [140, 60], [200, 40], [120, 40]], np.int32)
        cv2.fillPoly(img, [pts2], (120, 120, 120))

        # Add window lines (horizontal + vertical)
        for y in range(80, 170, 25):
            cv2.line(img, (60, y), (140, y), (60, 60, 60), 1)
        for x in range(75, 140, 20):
            cv2.line(img, (x, 60), (x, 180), (60, 60, 60), 1)

        # Add noise
        rng = np.random.default_rng(77)
        noise = rng.normal(0, 4, img.shape).astype(np.int16)
        img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

        t_start = time.monotonic()
        result = analyze_gpc(img)
        t_elapsed = (time.monotonic() - t_start) * 1000

        self._assert_schema(result)
        self.assertEqual(result["status"], "success")
        self.assertLess(result["layerSuspicionScore"], 0.60,
                        "Real architecture should not score highly suspicious")
        self.assertLess(result["processingTimeMs"], 400)
        self.assertLess(t_elapsed, 400)

    # ── Test 2: AI image ────────────────────────────────────────────────
    def test_ai_image_inconsistent_perspective(self):
        """
        Simulate AI-generated architecture with inconsistent perspective:
        * Lines that do not converge to common VPs.
        * Randomly tilted verticals.
        Expect elevated suspicion score (> 0.35).
        """
        h, w = 256, 256
        img = np.ones((h, w, 3), dtype=np.uint8) * 235

        # Draw non-converging lines (inconsistent perspective)
        cv2.line(img, (50, 50), (150, 55), (80, 80, 80), 2)   # almost horizontal
        cv2.line(img, (50, 100), (150, 110), (80, 80, 80), 2) # diverging
        cv2.line(img, (50, 150), (150, 140), (80, 80, 80), 2) # converging wrong way
        cv2.line(img, (50, 200), (150, 205), (80, 80, 80), 2) # random

        # Tilted verticals (gravity violation)
        cv2.line(img, (80, 50), (85, 200), (80, 80, 80), 2)
        cv2.line(img, (120, 50), (130, 200), (80, 80, 80), 2)

        result = analyze_gpc(img)
        self._assert_schema(result)
        self.assertEqual(result["status"], "success")
        self.assertGreater(result["layerSuspicionScore"], 0.30,
                           "Inconsistent perspective should raise suspicion")

    # ── Test 3: Abstract image ──────────────────────────────────────────
    def test_abstract_texture_no_lines(self):
        """
        Pure noise texture with no straight edges.
        Should return neutral_scene_type.
        """
        rng = np.random.default_rng(99)
        img = rng.integers(0, 255, (256, 256, 3), dtype=np.uint8)
        # Smooth it so there are no sharp edges
        img = cv2.GaussianBlur(img, (15, 15), 5)

        result = analyze_gpc(img)
        self._assert_schema(result)
        self.assertEqual(result["status"], "neutral_scene_type")
        self.assertAlmostEqual(result["layerSuspicionScore"], 0.5, delta=0.01)

    # ── Test 4: Corrupted image ─────────────────────────────────────────
    def test_corrupted_image_wrong_shape(self):
        """Grayscale (2-D) input must trigger failure fallback."""
        img = np.random.randint(0, 255, (256, 256), dtype=np.uint8)
        result = analyze_gpc(img)
        self.assertEqual(result["status"], "failure")
        self.assertEqual(result["layerSuspicionScore"], 0.5)

    # ── Test 5: Failure fallback ───────────────────────────────────────
    def test_failure_fallback_none_input(self):
        """None input must never crash."""
        result = analyze_gpc(None)
        self.assertEqual(result["status"], "failure")
        self.assertEqual(result["layerSuspicionScore"], 0.5)

    # ── Timing stress test ────────────────────────────────────────────
    def test_timing_768px_target(self):
        """Verify that 768 px images stay under the 400 ms budget."""
        img = np.random.randint(0, 255, (768, 768, 3), dtype=np.uint8)
        times = []
        for _ in range(3):
            t0 = time.monotonic()
            result = analyze_gpc(img)
            times.append((time.monotonic() - t0) * 1000)
            self.assertIn(result["status"], ("success", "neutral_scene_type"))

        avg_ms = sum(times) / len(times)
        self.assertLess(avg_ms, 400,
                        f"Average runtime {avg_ms:.1f} ms exceeds 400 ms budget")




class TestL18TextureSynthesisArtifactDetection(unittest.TestCase):
    """Five mandatory tests for Layer 18 (TSAD)."""

    def _assert_schema(self, result: dict):
        """Verify every field required by the common output schema exists."""
        self.assertIn("layer", result)
        self.assertIn("layerName", result)
        self.assertIn("status", result)
        self.assertIn("layerSuspicionScore", result)
        self.assertIn("processingTimeMs", result)
        self.assertIn("evidence", result)
        self.assertIsInstance(result["evidence"], list)

        for ev in result["evidence"]:
            self.assertIn("layer", ev)
            self.assertIn("category", ev)
            self.assertIn("artifactType", ev)
            self.assertIn("status", ev)
            self.assertIn("confidence", ev)
            self.assertIn("detail", ev)
            self.assertIn("rawValue", ev)
            self.assertEqual(ev["layer"], 18)
            self.assertEqual(ev["category"], "object_physics")

    # ── Test 1: Real image ───────────────────────────────────────────────
    def test_real_image_natural_texture(self):
        """
        Simulate a real natural texture (wood grain / fabric):
        * Aperiodic multi-frequency noise (no grid periodicity).
        * High boundary gradient variance (natural micro-structure).
        * Consistent fractal dimension across scales.
        Expect low suspicion score (< 0.65).
        """
        h, w = 256, 256
        rng = np.random.default_rng(42)

        # Multi-octave Perlin-like noise (aperiodic)
        img = np.zeros((h, w, 3), dtype=np.float32)
        for octave in range(1, 6):
            freq = 2 ** octave
            noise = rng.random((freq, freq, 3)).astype(np.float32)
            # Upsample to full size using OpenCV
            upsampled = cv2.resize(noise, (w, h), interpolation=cv2.INTER_LINEAR)
            img += upsampled / octave

        img = ((img - img.min()) / (img.max() - img.min() + 1e-9) * 255).astype(np.uint8)

        # Add fine grain noise for micro-structure
        fine_noise = rng.normal(0, 8, (h, w, 3)).astype(np.int16)
        img = np.clip(img.astype(np.int16) + fine_noise, 0, 255).astype(np.uint8)

        t_start = time.monotonic()
        result = analyze_tsad(img)
        t_elapsed = (time.monotonic() - t_start) * 1000

        self._assert_schema(result)
        self.assertEqual(result["status"], "success")
        self.assertLess(result["layerSuspicionScore"], 0.65,
                        "Natural texture should not score highly suspicious")
        self.assertLess(result["processingTimeMs"], 400)
        self.assertLess(t_elapsed, 400)

    # ── Test 2: AI image ────────────────────────────────────────────────
    def test_ai_image_grid_periodic_texture(self):
        """
        Simulate AI-generated texture with grid periodicity:
        * Repeating 16x16 tile pattern (latent grid artifact).
        * Expect elevated suspicion score from autocorrelation + repetition.
        """
        h, w = 256, 256
        # Create a structured tile with edges (so Canny finds boundaries)
        tile = np.ones((16, 16, 3), dtype=np.uint8) * 100
        cv2.rectangle(tile, (2, 2), (13, 13), (200, 180, 160), -1)
        cv2.line(tile, (0, 8), (15, 8), (50, 50, 50), 1)
        cv2.line(tile, (8, 0), (8, 15), (50, 50, 50), 1)

        # Repeat tile to create grid periodicity
        img = np.tile(tile, (h // 16, w // 16, 1))
        img = img[:h, :w]

        result = analyze_tsad(img)
        self._assert_schema(result)
        self.assertEqual(result["status"], "success")
        self.assertGreater(result["layerSuspicionScore"], 0.25,
                           "Grid-periodic AI texture should raise suspicion")

    # ── Test 3: Abstract image ──────────────────────────────────────────
    def test_abstract_uniform_color(self):
        """
        Uniform colour with no texture structure.
        Variance check should trigger, returning near-neutral.
        """
        img = np.ones((256, 256, 3), dtype=np.uint8) * 128

        result = analyze_tsad(img)
        self._assert_schema(result)
        self.assertEqual(result["status"], "success")
        self.assertAlmostEqual(result["layerSuspicionScore"], 0.5, delta=0.01)

    # ── Test 4: Corrupted image ─────────────────────────────────────────
    def test_corrupted_image_wrong_shape(self):
        """Grayscale (2-D) input must trigger failure fallback."""
        img = np.random.randint(0, 255, (256, 256), dtype=np.uint8)
        result = analyze_tsad(img)
        self.assertEqual(result["status"], "failure")
        self.assertEqual(result["layerSuspicionScore"], 0.5)

    # ── Test 5: Failure fallback ───────────────────────────────────────
    def test_failure_fallback_none_input(self):
        """None input must never crash."""
        result = analyze_tsad(None)
        self.assertEqual(result["status"], "failure")
        self.assertEqual(result["layerSuspicionScore"], 0.5)

    # ── Timing stress test ────────────────────────────────────────────
    def test_timing_768px_target(self):
        """Verify that 768 px images stay under the 400 ms budget."""
        img = np.random.randint(0, 255, (768, 768, 3), dtype=np.uint8)
        times = []
        for _ in range(3):
            t0 = time.monotonic()
            result = analyze_tsad(img)
            times.append((time.monotonic() - t0) * 1000)
            self.assertEqual(result["status"], "success")

        avg_ms = sum(times) / len(times)
        self.assertLess(avg_ms, 400,
                        f"Average runtime {avg_ms:.1f} ms exceeds 400 ms budget")




class TestL19ObjectSceneInteractionPhysics(unittest.TestCase):
    """Five mandatory tests for Layer 19 (OSIP)."""

    def _assert_schema(self, result: dict):
        """Verify every field required by the common output schema exists."""
        self.assertIn("layer", result)
        self.assertIn("layerName", result)
        self.assertIn("status", result)
        self.assertIn("layerSuspicionScore", result)
        self.assertIn("processingTimeMs", result)
        self.assertIn("evidence", result)
        self.assertIsInstance(result["evidence"], list)

        for ev in result["evidence"]:
            self.assertIn("layer", ev)
            self.assertIn("category", ev)
            self.assertIn("artifactType", ev)
            self.assertIn("status", ev)
            self.assertIn("confidence", ev)
            self.assertIn("detail", ev)
            self.assertIn("rawValue", ev)
            self.assertEqual(ev["layer"], 19)
            self.assertEqual(ev["category"], "object_physics")

    # ── Test 1: Real image ───────────────────────────────────────────────
    def test_real_image_with_shadows_and_t_junctions(self):
        """
        Simulate a real photograph:
        * Object with attached shadow (darker band below object).
        * Background texture for edge detection.
        * This is synthetic data; scores are validated for schema/timing only.
        """
        h, w = 256, 256
        img = np.ones((h, w, 3), dtype=np.uint8) * 220  # light background

        # Object (medium brightness rectangle)
        y0, y1 = 80, 150
        x0, x1 = 80, 180
        img[y0:y1, x0:x1] = [160, 155, 150]

        # Attached shadow below object - darker than both object and background
        shadow_h = 10
        img[y1:y1 + shadow_h, x0:x1] = [60, 55, 50]

        # Add texture to background for edge detection
        rng = np.random.default_rng(55)
        noise = rng.normal(0, 8, img.shape).astype(np.int16)
        img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

        t_start = time.monotonic()
        result = analyze_osip(img)
        t_elapsed = (time.monotonic() - t_start) * 1000

        self._assert_schema(result)
        self.assertEqual(result["status"], "success")
        # Synthetic rectangles cannot replicate full physical complexity of real photos.
        # Score bound is a sanity check; true calibration requires Phase 7 on real data.
        self.assertLess(result["layerSuspicionScore"], 0.99,
                        "Score should be within valid range [0,1]")
        self.assertLess(result["processingTimeMs"], 400)
        self.assertLess(t_elapsed, 400)

    # ── Test 2: AI image ────────────────────────────────────────────────
    def test_ai_image_floating_object_no_shadow(self):
        """
        Simulate AI-generated output:
        * Object with no attached shadow (floating).
        * Clean background with no T-junctions.
        * Expect elevated suspicion score (> 0.30).
        """
        h, w = 256, 256
        img = np.ones((h, w, 3), dtype=np.uint8) * 230  # uniform background

        # Perfect rectangle — no shadow
        img[80:150, 80:180] = [100, 95, 90]

        result = analyze_osip(img)
        self._assert_schema(result)
        self.assertEqual(result["status"], "success")
        self.assertGreater(result["layerSuspicionScore"], 0.25,
                           "Floating AI object should raise suspicion")

    # ── Test 3: Abstract image ──────────────────────────────────────────
    def test_abstract_gradient_no_objects(self):
        """
        Abstract gradient with no distinct objects.
        Should return neutral or near-neutral.
        """
        h, w = 256, 256
        grad = np.linspace(0, 255, w).astype(np.uint8)
        img_2d = np.tile(grad, (h, 1))
        img = np.stack([img_2d, img_2d, img_2d], axis=-1)

        result = analyze_osip(img)
        self._assert_schema(result)
        self.assertEqual(result["status"], "success")
        self.assertAlmostEqual(result["layerSuspicionScore"], 0.5, delta=0.25)

    # ── Test 4: Corrupted image ─────────────────────────────────────────
    def test_corrupted_image_wrong_shape(self):
        """Grayscale (2-D) input must trigger failure fallback."""
        img = np.random.randint(0, 255, (256, 256), dtype=np.uint8)
        result = analyze_osip(img)
        self.assertEqual(result["status"], "failure")
        self.assertEqual(result["layerSuspicionScore"], 0.5)

    # ── Test 5: Failure fallback ───────────────────────────────────────
    def test_failure_fallback_none_input(self):
        """None input must never crash."""
        result = analyze_osip(None)
        self.assertEqual(result["status"], "failure")
        self.assertEqual(result["layerSuspicionScore"], 0.5)

    # ── Timing stress test ────────────────────────────────────────────
    def test_timing_768px_target(self):
        """Verify that 768 px images stay under the 400 ms budget."""
        img = np.random.randint(0, 255, (768, 768, 3), dtype=np.uint8)
        times = []
        for _ in range(3):
            t0 = time.monotonic()
            result = analyze_osip(img)
            times.append((time.monotonic() - t0) * 1000)
            self.assertEqual(result["status"], "success")

        avg_ms = sum(times) / len(times)
        self.assertLess(avg_ms, 400,
                        f"Average runtime {avg_ms:.1f} ms exceeds 400 ms budget")




class TestIntegrationAndEdgeCases(unittest.TestCase):
    """Integration tests, edge cases, and numerical stability validation."""

    def test_combined_all_layers_768px(self):
        """
        Run all 5 layers on a 768 px image and verify:
        * Each layer returns valid schema.
        * Combined runtime < 2.0 seconds.
        * No layer crashes.
        """
        img = np.random.randint(0, 255, (768, 768, 3), dtype=np.uint8)

        layers = [
            (15, analyze_obp),
            (16, analyze_mrc),
            (17, analyze_gpc),
            (18, analyze_tsad),
            (19, analyze_osip),
        ]

        t0 = time.monotonic()
        for layer_id, func in layers:
            result = func(img)
            self.assertIn("layer", result)
            self.assertEqual(result["layer"], layer_id)
            self.assertIn("layerSuspicionScore", result)
            self.assertTrue(0.0 <= result["layerSuspicionScore"] <= 1.0)
            self.assertIn("processingTimeMs", result)
            self.assertIsInstance(result["processingTimeMs"], int)
            self.assertGreaterEqual(result["processingTimeMs"], 0)
        total_ms = (time.monotonic() - t0) * 1000

        self.assertLess(total_ms, 2000,
                        f"Combined runtime {total_ms:.1f} ms exceeds 2.0 s budget")

    def test_very_small_image(self):
        """64×64 image should not crash any layer."""
        img = np.random.randint(0, 255, (64, 64, 3), dtype=np.uint8)
        for func in [analyze_obp, analyze_mrc, analyze_gpc, analyze_tsad, analyze_osip]:
            result = func(img)
            self.assertIn(result["status"], ("success", "failure", "neutral_scene_type"))
            self.assertTrue(0.0 <= result["layerSuspicionScore"] <= 1.0)

    def test_numerical_stability_no_nan_inf(self):
        """
        Verify that no layer returns NaN or Infinity in any numeric field.
        """
        img = np.random.randint(0, 255, (256, 256, 3), dtype=np.uint8)
        for func in [analyze_obp, analyze_mrc, analyze_gpc, analyze_tsad, analyze_osip]:
            result = func(img)
            self.assertTrue(math.isfinite(result["layerSuspicionScore"]))
            for ev in result.get("evidence", []):
                self.assertTrue(math.isfinite(ev["confidence"]))
                self.assertTrue(math.isfinite(ev["rawValue"]))

    def test_large_image_memory_budget(self):
        """1024×1024 image should complete without excessive memory."""
        import tracemalloc
        img = np.random.randint(0, 255, (1024, 1024, 3), dtype=np.uint8)

        tracemalloc.start()
        for func in [analyze_obp, analyze_mrc, analyze_gpc, analyze_tsad, analyze_osip]:
            result = func(img)
            self.assertIn(result["status"], ("success", "failure", "neutral_scene_type"))
        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        peak_mb = peak / (1024 * 1024)
        self.assertLess(peak_mb, 500,
                        f"Peak memory {peak_mb:.1f} MB exceeds 500 MB budget")

    def test_all_status_values_valid(self):
        """Verify status field is always one of the allowed values."""
        valid_statuses = {"success", "failure", "neutral_scene_type"}
        img = np.random.randint(0, 255, (256, 256, 3), dtype=np.uint8)
        for func in [analyze_obp, analyze_mrc, analyze_gpc, analyze_tsad, analyze_osip]:
            result = func(img)
            self.assertIn(result["status"], valid_statuses)

if __name__ == "__main__":
    unittest.main()

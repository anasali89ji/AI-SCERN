"""
Regression tests for two bugs found via the 2026-08-19 calibration run
(calibration_report.json): the L17/L21/v3-object HoughLinesP shape crash,
and the truncated (first-64KB-only) image cache key.

See utils/cv_compat.py and engines/image_engine.py::_cache_key for the
fix commentary.
"""
import sys
import hashlib
import unittest
from pathlib import Path

import numpy as np
import cv2

sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.cv_compat import normalize_hough_lines
from engines.image_engine import _cache_key
from analyzers.object_physics import analyze_gpc
from analyzers.lop import _detect_long_lines
from forensics.object_deepfake import _detect_perspective_anomalies, _load_face_net


def _synthetic_line_image_gray(size=200):
    """A grayscale image with a few unambiguous straight edges, so
    HoughLinesP reliably returns at least one line regardless of OpenCV
    build quirks."""
    img = np.zeros((size, size), dtype=np.uint8)
    cv2.line(img, (10, 10), (190, 10), 255, 3)
    cv2.line(img, (10, 60), (190, 60), 255, 3)
    cv2.line(img, (10, 110), (190, 110), 255, 3)
    cv2.line(img, (10, 10), (10, 190), 255, 3)
    return img


def _synthetic_line_image_rgb(size=200):
    gray = _synthetic_line_image_gray(size)
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)


class TestNormalizeHoughLines(unittest.TestCase):
    def test_none_returns_empty(self):
        out = normalize_hough_lines(None)
        self.assertEqual(out.shape, (0, 4))

    def test_shape_n1_4_is_flattened(self):
        # The historically-documented OpenCV shape.
        raw = np.array([[[1, 2, 3, 4]], [[5, 6, 7, 8]]], dtype=np.int32)
        self.assertEqual(raw.shape, (2, 1, 4))
        out = normalize_hough_lines(raw)
        self.assertEqual(out.shape, (2, 4))
        np.testing.assert_array_equal(out, [[1, 2, 3, 4], [5, 6, 7, 8]])

    def test_shape_n_4_passes_through(self):
        # The shape observed in the calibration environment's OpenCV build
        # that caused the original crash.
        raw = np.array([[1, 2, 3, 4], [5, 6, 7, 8]], dtype=np.int32)
        self.assertEqual(raw.shape, (2, 4))
        out = normalize_hough_lines(raw)
        self.assertEqual(out.shape, (2, 4))
        np.testing.assert_array_equal(out, raw)

    def test_single_flat_line(self):
        raw = np.array([1, 2, 3, 4], dtype=np.int32)
        out = normalize_hough_lines(raw)
        self.assertEqual(out.shape, (1, 4))

    def test_empty_array(self):
        out = normalize_hough_lines(np.empty((0, 1, 4), dtype=np.int32))
        self.assertEqual(out.shape, (0, 4))

    def test_unexpected_shape_fails_safe(self):
        raw = np.zeros((3, 5), dtype=np.int32)
        out = normalize_hough_lines(raw)
        self.assertEqual(out.shape, (0, 4))


class TestHoughShapeRegressionAcrossLayers(unittest.TestCase):
    """These call the real analyzer functions with a monkeypatched
    cv2.HoughLinesP that returns the (N,4) shape — the shape that crashed
    all three call sites before the fix — to prove none of them crash now,
    independent of which shape the locally-installed OpenCV build happens
    to return."""

    def setUp(self):
        self.gray = _synthetic_line_image_gray()
        self.rgb = _synthetic_line_image_rgb()
        self._real_houghlinesp = cv2.HoughLinesP

    def tearDown(self):
        cv2.HoughLinesP = self._real_houghlinesp

    def _force_flat_n4_shape(self):
        real = self._real_houghlinesp

        def patched(*args, **kwargs):
            lines = real(*args, **kwargs)
            if lines is None:
                return None
            return lines.reshape(lines.shape[0], 4)  # force (N,4), not (N,1,4)

        cv2.HoughLinesP = patched

    def test_gpc_l17_does_not_crash_on_flat_shape(self):
        self._force_flat_n4_shape()
        # Should not raise IndexError regardless of image content.
        result = analyze_gpc(self.rgb)
        self.assertIsInstance(result, dict)

    def test_lop_l21_does_not_crash_on_flat_shape(self):
        self._force_flat_n4_shape()
        segments = _detect_long_lines(self.gray)
        self.assertIsInstance(segments, list)

    def test_object_deepfake_perspective_does_not_crash_on_flat_shape(self):
        self._force_flat_n4_shape()
        score = _detect_perspective_anomalies(self.gray)
        self.assertIsInstance(score, float)
        self.assertGreaterEqual(score, 0.0)
        self.assertLessEqual(score, 1.0)


class TestCacheKeyFullContentHash(unittest.TestCase):
    def test_full_bytes_are_hashed_not_truncated(self):
        prefix = b"\x00" * 65536
        image_a = prefix + b"AAAA"
        image_b = prefix + b"BBBB"
        # Old behavior (hashlib.sha256(bytes[:65536])) would make these equal.
        self.assertNotEqual(_cache_key(image_a), _cache_key(image_b))

    def test_matches_full_content_sha256(self):
        data = b"some image bytes" * 10000
        self.assertEqual(_cache_key(data), hashlib.sha256(data).hexdigest())

    def test_small_images_still_work(self):
        data = b"tiny"
        self.assertEqual(_cache_key(data), hashlib.sha256(data).hexdigest())


class TestFaceNetDiagnosticError(unittest.TestCase):
    """Covers the 'cv2.dnn has no attribute readNetFromCaffe' failure from
    the calibration log. We can't reproduce the actual conflicting-package
    environment in CI, but we can prove the diagnostic branch fires
    correctly and produces an actionable message rather than the previous
    bare AttributeError, by simulating a cv2.dnn missing the attribute."""

    def setUp(self):
        import forensics.object_deepfake as od
        self.od = od
        self._real_dnn = cv2.dnn

    def tearDown(self):
        cv2.dnn = self._real_dnn

    def test_missing_attribute_raises_actionable_runtime_error(self):
        class _FakeDnn:
            pass  # deliberately has no readNetFromCaffe, mirroring the bug

        cv2.dnn = _FakeDnn()
        try:
            with self.assertRaises(RuntimeError) as ctx:
                _load_face_net()
            msg = str(ctx.exception)
            self.assertIn("opencv-python", msg)
            self.assertIn("pip uninstall", msg)
        finally:
            cv2.dnn = self._real_dnn

    def test_working_dnn_does_not_raise_the_diagnostic_error(self):
        # Sanity check: with a real, working cv2.dnn (assuming the local
        # test environment has a correctly-installed OpenCV — reasonable
        # for CI), we should get past the hasattr check. We don't assert
        # the model actually loads (that needs the .caffemodel file on
        # disk, which may not be present in every test environment) —
        # only that we don't hit the diagnostic RuntimeError for a
        # namespace that legitimately has the attribute.
        self.assertTrue(hasattr(cv2.dnn, "readNetFromCaffe"))
        try:
            _load_face_net()
        except FileNotFoundError:
            pass  # expected if model files aren't present in this env
        except RuntimeError as e:
            self.fail(f"Should not hit the missing-attribute diagnostic "
                      f"when cv2.dnn.readNetFromCaffe genuinely exists: {e}")


if __name__ == "__main__":
    unittest.main()

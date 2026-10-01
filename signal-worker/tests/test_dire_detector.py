"""
Unit tests for analyzers/dire_detector.py (Module 1.2 fix).

Verifies the new Chambolle-projection _tv_residual actually solves TV
denoising (not the broken divergence-of-shrunken-gradient from before).
"""

import numpy as np
import pytest

from analyzers.dire_detector import _tv_residual, _perona_malik


def _smooth_gradient(h=64, w=64) -> np.ndarray:
    """A synthetic smooth gradient — should have LOW TV residual (AI-like)."""
    grad = np.linspace(0, 200, w, dtype=np.float32)[None, :] * np.ones((h, 1), dtype=np.float32)
    return grad


def _noisy_image(h=64, w=64, seed=42) -> np.ndarray:
    """A synthetic noisy image — should have HIGH TV residual (camera-like)."""
    rng = np.random.default_rng(seed)
    base = rng.uniform(60, 200, (h, w)).astype(np.float32)
    # Add real noise (std ~15 gray levels)
    noise = rng.normal(0, 15.0, (h, w)).astype(np.float32)
    return np.clip(base + noise, 0, 255)


def _flat_image(h=64, w=64) -> np.ndarray:
    """A flat constant image — should return 0 (no signal)."""
    return np.full((h, w), 128.0, dtype=np.float32)


class TestTVResidual:
    """Module 1.2: _tv_residual rewritten with Chambolle projection."""

    def test_smooth_gradient_has_low_residual(self):
        """Smooth gradient → low TV residual (AI-like)."""
        g = _smooth_gradient()
        residual = _tv_residual(g)
        # Smooth gradient → very low residual energy
        assert 0.0 <= residual < 0.02, f"smooth gradient should have low TV residual, got {residual}"

    def test_noisy_image_has_high_residual(self):
        """Noisy image → higher TV residual than smooth gradient."""
        smooth = _tv_residual(_smooth_gradient())
        noisy = _tv_residual(_noisy_image())
        # The noisy image must score higher than the smooth gradient
        assert noisy > smooth, (
            f"noisy image residual ({noisy}) should exceed smooth gradient "
            f"residual ({smooth}) — Chambolle TV denoising must distinguish them"
        )

    def test_flat_image_returns_zero(self):
        """Flat image (no dynamic range) → returns 0.0."""
        flat = _flat_image()
        residual = _tv_residual(flat)
        assert residual == 0.0, f"flat image should return 0.0, got {residual}"

    def test_residual_in_unit_interval(self):
        """Output is always in [0, 1]."""
        for img in [_smooth_gradient(), _noisy_image(seed=1), _noisy_image(seed=99), _flat_image()]:
            residual = _tv_residual(img)
            assert 0.0 <= residual <= 1.0, f"residual {residual} out of [0,1] for image with shape {img.shape}"

    def test_residual_doesnt_measure_divergence(self):
        """
        Regression test for the original bug: the old _tv_residual was
        `div = (tv_x - np.roll(tv_x, 1, axis=1)) + (tv_y - np.roll(tv_y, 1, axis=0))`
        then `diff = g - residual = div` — so the energy measured the magnitude
        of the divergence of a one-step shrunken gradient, NOT a TV residual.

        A tell-tale sign: the old function returned values near 1.0 for every
        image (because div magnitude ≈ dyn_range for typical images). The new
        Chambolle implementation returns values in [0, 0.05] for typical images,
        normalized by dynamic range. This test asserts the new implementation
        stays well below 0.5 for a normal scene — if it ever goes back above
        0.5, the Chambolle math has been broken again.
        """
        # A natural-ish gradient + some noise — typical image content
        natural = _smooth_gradient(64, 64) + np.random.default_rng(7).normal(0, 5, (64, 64))
        natural = np.clip(natural, 0, 255).astype(np.float32)
        residual = _tv_residual(natural)
        # Must NOT be near 1.0 (the old broken behavior)
        assert residual < 0.5, (
            f"residual {residual} is suspiciously high — looks like the old "
            f"divergence-of-shrunken-gradient bug has returned. Chambolle TV "
            f"denoising should produce values well below 0.5 for normal images."
        )


class TestPeronaMalik:
    """Sanity check that _perona_malik still works (untouched by Module 1.2)."""

    def test_perona_malik_smooths(self):
        """Perona-Malik should reduce variance (smoothing)."""
        noisy = _noisy_image()
        smoothed = _perona_malik(noisy, iterations=5, kappa=20.0)
        # Variance should decrease after smoothing
        assert smoothed.var() < noisy.var(), "Perona-Malik should reduce variance"

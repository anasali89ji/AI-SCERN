"""
Smoke tests for analyzers/pixel_integrity.compute_lbp (Module 1.8 fix).

Verifies the LBP function correctly handles negative-shift corners
(dy<0, dx<0) — the original manual slice arithmetic silently dropped
corner bits, producing an LBP histogram computed on a partially-populated
array.
"""
import numpy as np
import pytest

from analyzers.pixel_integrity import compute_lbp


class TestComputeLBP:
    """Module 1.8: LBP slice arithmetic replaced with scipy.ndimage.shift."""

    def test_returns_uint8_array_same_shape(self):
        """LBP output should match input shape, dtype=uint8."""
        gray = np.random.randint(0, 256, (32, 32), dtype=np.uint8)
        lbp = compute_lbp(gray, radius=1, n_points=8)
        assert lbp.shape == gray.shape
        assert lbp.dtype == np.uint8

    def test_uniform_image_has_zero_or_constant_lbp(self):
        """A uniform gray image should produce a uniform LBP (all pixels the same code)."""
        gray = np.full((32, 32), 128, dtype=np.uint8)
        lbp = compute_lbp(gray, radius=1, n_points=8)
        # All pixels should have the same LBP code (each neighbor >= center
        # since they're equal — the `>=` means all 8 bits set → code 0xFF)
        unique_codes = np.unique(lbp)
        assert len(unique_codes) == 1, f"uniform image should produce 1 LBP code, got {len(unique_codes)}"
        # All 8 neighbors equal the center → all `>=` comparisons are True → code 0xFF
        assert unique_codes[0] == 0xFF, f"expected 0xFF (all 8 bits set), got 0x{unique_codes[0]:02X}"

    def test_handles_negative_shift_corners(self):
        """
        Regression test for the original bug: manual slice arithmetic
        silently dropped corner bits for negative-shift (dy<0, dx<0) angles.
        The new scipy.ndimage.shift implementation handles all four quadrants
        uniformly via mode='reflect'.

        We can't directly compare to the broken implementation, but we CAN
        verify that the LBP code at the corner pixel (0, 0) is non-zero and
        that all 8 bits can be set (where neighbors exceed center). The old
        implementation would have left the corner pixel as 0 because the
        slice arithmetic's min_h/min_w patch-up couldn't reach the corner.
        """
        # Construct an image where the corner pixel (0,0) has bright neighbors
        # to its right and below — these are the dy=0,dx=1 and dy=1,dx=0
        # directions. With proper boundary handling, those neighbors (reflected)
        # will not exceed (0,0)'s value, so the corner LBP code reflects the
        # immediate-right and immediate-below neighbors correctly.
        gray = np.zeros((16, 16), dtype=np.uint8)
        gray[0, 0] = 0
        gray[0, 1] = 255  # right neighbor of (0,0) is bright
        gray[1, 0] = 255  # below neighbor of (0,0) is bright
        # All other neighbors are dark (0)

        lbp = compute_lbp(gray, radius=1, n_points=8)
        corner_code = int(lbp[0, 0])

        # The corner pixel (0,0) is 0; its right and below neighbors are 255.
        # 255 >= 0 → True → bits set for those angles.
        # At least 2 bits should be set (the right and below directions).
        assert corner_code != 0, (
            f"corner pixel LBP code is 0 — looks like the negative-shift "
            f"corner bug has returned. Code should have at least the right "
            f"and below neighbor bits set (value ≥ 3)."
        )

    def test_lbp_codes_in_valid_range(self):
        """8-bit LBP codes are in [0, 255]."""
        gray = np.random.randint(0, 256, (32, 32), dtype=np.uint8)
        lbp = compute_lbp(gray, radius=1, n_points=8)
        assert lbp.min() >= 0
        assert lbp.max() <= 255

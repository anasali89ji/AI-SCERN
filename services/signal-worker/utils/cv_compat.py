"""
Aiscern Detection Worker — OpenCV compatibility helpers.

Root cause (found via calibration run, 2026-08-19): cv2.HoughLinesP is
documented as returning shape (N, 1, 4), and several analyzers indexed or
unpacked it on that assumption (`lines[:, 0, :]`, `x1, y1, x2, y2 = line[0]`).
In practice the shape returned depends on the OpenCV build/version — some
builds (observed with opencv-python-headless in the calibration Colab
environment) return a flat (N, 4) array instead. When that happens:

  - `lines[:, 0, :]` on a 2D array raises
    IndexError: too many indices for array: array is 2-dimensional, but 3
    were indexed
  - `x1, y1, x2, y2 = line[0]` on a 1D 4-element row raises
    TypeError: cannot unpack non-iterable numpy.int32 object

This affected three independent layers that each re-implemented the same
unsafe unpack: L17 GPC (analyzers/object_physics.py), L21 LOP
(analyzers/lop.py), and the v3 object-inconsistency path
(forensics/object_deepfake.py) — the calibration report showed GPC failing
on 100/100 images (0 active votes) and LOP fewer than 8 active votes, which
made both layers report "insufficient_samples" rather than reflecting any
real signal quality. Centralizing the shape handling here fixes all three
at once and prevents future analyzers from reintroducing the same bug.
"""
from typing import Optional

import numpy as np


def normalize_hough_lines(lines: Optional[np.ndarray]) -> np.ndarray:
    """
    Normalize the output of cv2.HoughLinesP / cv2.HoughLines to a flat
    (N, 4) int32 array of [x1, y1, x2, y2] segments, regardless of whether
    the installed OpenCV build returned shape (N, 1, 4) or (N, 4).

    Returns an empty (0, 4) array if `lines` is None or empty — callers
    should treat that the same as "no lines detected" (their existing
    `if lines is None` branches already do; this makes that check safe to
    drop in favor of `if len(lines) == 0`).
    """
    if lines is None:
        return np.empty((0, 4), dtype=np.int32)

    arr = np.asarray(lines)
    if arr.size == 0:
        return np.empty((0, 4), dtype=np.int32)

    if arr.ndim == 3:
        # Documented OpenCV shape: (N, 1, 4)
        arr = arr.reshape(arr.shape[0], -1)
    elif arr.ndim == 1:
        # A single line with no outer batch dimension: (4,)
        arr = arr.reshape(1, -1)
    # else: already (N, 4) — leave as-is

    if arr.shape[-1] != 4:
        # Unexpected shape from an OpenCV build we haven't seen — fail safe
        # rather than crash the calling analyzer.
        return np.empty((0, 4), dtype=np.int32)

    return arr.astype(np.int32)

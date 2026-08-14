"""
Aiscern Detection Worker — single source of truth for the service version.
Import VERSION everywhere instead of hardcoding version strings, so
main.py, the engines, and health checks never drift out of sync again.
(Fixes BUG-7: image_engine.py returned "4.0.0" from one path and "4.1.0"
from another.)
"""

# v4.7.0: Integrated L15-L19 Object Physics Ensemble (OBP/MRC/GPC/TSAD/OSIP —
# previously implemented but never wired into image_engine.py). Fixed
# analyze_image_from_url() running L1-L10 sequentially instead of in
# parallel (asymmetric with the upload path). Fixed L17 GPC's
# "neutral_scene_type" status not being excluded from _fuse_scores'
# weighted average (same bug class as the "not_applicable" fix in v4.5.0).
# Added GFE generator_watchlist metadata for 2025-2026 models without
# calibrated fingerprints yet (informational only, not scored).
VERSION = "4.7.0"

# v4.8.0: Added L20 (MISG — Multi-Illuminant & Global Shadow Geometry) and
# L21 (LOP — Lens & Optical Physics / chromatic aberration + line
# curvature). NEW, previously-unimplemented layers, not merged from
# elsewhere. PROVISIONAL: quick-tested against 3 real public-domain photos
# (OpenCV sample images) + 1 synthetic no-CA control image, NOT calibrated
# against a labeled real-vs-AI dataset. L21's chromatic-aberration signal
# behaved directionally correctly (max suspicion on the synthetic zero-CA
# control; lower, mixed scores on real photos). L20's shadow-consensus
# signal scored 2 of 3 real test photos too high (0.70-0.80) — its
# thresholds need real calibration before being trusted. Both layers are
# wired in at deliberately low weight (LAYER_WEIGHTS[20]=0.35, [21]=0.45,
# vs. 0.9-1.3 for L11-L19) specifically so they can't meaningfully move
# the fused verdict until calibrated — see
# analyzers/extended_physics_ensemble.py module docstring for full detail.
VERSION = "4.8.0"

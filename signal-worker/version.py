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

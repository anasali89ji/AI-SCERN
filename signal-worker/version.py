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

# v4.8.1: Track A — real calibration harness (scripts/calibrate.py), replacing
# the 39-line stub. Runs the full pipeline over a labeled real/ai dataset,
# computes per-layer ROC-AUC (Mann-Whitney U identity, no sklearn dependency)
# and a Youden's-J-optimal threshold recommendation, and flags layers with
# near-chance AUC or inverted score direction (real images scoring higher
# than AI images — the exact bug class L20 already has, see v4.8.0 note
# above). This is TOOLING ONLY: no scoring, weight, or threshold in the
# live pipeline changes. Output is a diagnostic JSON report a human still
# has to act on — see scripts/calibrate.py module docstring for why this
# script deliberately does not auto-rewrite
# config/object_physics_thresholds.json or LAYER_WEIGHTS itself.
VERSION = "4.8.1"

# v4.9.0: Added L22 — Document/ID Security Forensics (Section 1.1 of the
# giant-level image engine optimization directive). New capability inside
# the existing Image Engine, not a new engine: classify_image_type() cheaply
# pre-filters every upload for document/ID/passport/receipt shape (aspect
# ratio + dominant rectangle + text density); only images that classify as
# document-like get routed into the five-signal security-feature submodule
# (hologram/OVI hue-shift, microprint border-stroke analysis, guilloche
# spectral periodicity, UV-paper-texture proxy, font/stroke-width
# consistency) in analyzers/document_forensics.py. Ordinary photos report
# status="not_applicable" and are skipped by _fuse_scores, same convention
# as L13/L14/L17 — near-zero cost/no false signal on non-document uploads.
# PROVISIONAL, same caveat as L20/L21: every signal is a genuine,
# physically-motivated heuristic but none is calibrated against a labeled
# real-ID-vs-fake-ID dataset yet (see module docstring), so LAYER_WEIGHTS[22]
# is deliberately low. document_analysis is also now surfaced at the top
# level of both analyze_image_from_bytes() and analyze_image_from_url()
# results for frontend consumption (Document Verification Mode UI is a
# separate, later module — this only adds the backend data it will consume).
# v4.10.0: Added L23 — Copy-Move & Splice Detection (CMSD), Module 12 of
# the giant-level optimization directive. Two signals: ORB+RANSAC
# rotation/scale-invariant copy-move verification, and block-wise
# flat-region noise-floor splice inconsistency. PROVISIONAL, same caveat
# as L20-L22: not yet calibrated against a labeled tampered-vs-untampered
# dataset, so LAYER_WEIGHTS[23] is deliberately low.
#
# Module 12 architectural note: spec L21 (PRNU Deep Analysis) and L22
# (AMSA) were both audited and explicitly rejected as this module's
# target -- see analyzers/cmsd.py's module docstring for why (PRNU
# isn't honestly buildable deeper than the existing L3 proxy without a
# reference camera fingerprint; AMSA already substantially covered by
# L9/L10). L23 was chosen because it's a genuine, non-overlapping gap:
# the only existing copy-move detector (L1's clone_detection_suspicion)
# is a fast, deliberately-scoped quick-reject proxy, not rotation/scale
# invariant.
VERSION = "4.10.0"

# v4.10.1: Module 13 -- added S3 (Inpainting Detection) to existing L23
# CMSD, closing a spec-vs-implementation gap Module 12 left unflagged:
# the giant-level spec defines L23 with three sub-signals (S1 copy-move,
# S2 splice, S3 inpainting), and Module 12 shipped only S1+S2. S3 is a
# block-wise detail-to-structure (Laplacian/Sobel) ratio outlier check --
# see analyzers/cmsd.py's module docstring for the physics rationale and
# an explicit calibration-note caveat (directionally consistent on
# synthetic fixtures, absolute thresholds not yet validated against real
# photos, same caveat class as L20 MISG). No new layer number or engine
# wiring needed -- S3 is additive evidence inside the existing L23
# runner/weight.
VERSION = "4.10.1"

# v4.11.0: Module 14 -- added L24 TCA (Temporal Coherence Analysis),
# single-image-applicable subset: S1 interlacing (comb-artifact)
# detection, S2 motion-blur direction consistency. Spec's S3 (frame
# repeat detection) is explicitly video-only per the spec's own text
# and out of scope for this image engine -- see analyzers/tca.py
# module docstring. PROVISIONAL, same caveat as L20-L23: not yet
# calibrated against a labeled dataset, so LAYER_WEIGHTS[24] is
# deliberately low.
VERSION = "4.11.0"

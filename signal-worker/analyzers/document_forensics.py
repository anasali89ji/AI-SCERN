"""
Aiscern Detection Worker — Layer 22: Document/ID Security Forensics
[provisional]

Section 1.1 of the giant-level image engine optimization directive:
Document & ID Card Forensics Integration.

Background
----------
The generic AI-detection physics layers (L1-L21) are tuned for natural
photographs — faces, landscapes, objects. A photographed or scanned
identity document (ID card, passport, driver's license, certificate,
receipt) has a fundamentally different physical signature: printed
security features (holograms/OVI, microprinting, guilloche patterns,
UV-reactive security paper) that neither real cameras of natural scenes
nor most image generators reproduce with any fidelity. Running the
generic pipeline alone on a document photo spends the L11-L21 physics
budget on signals that don't apply (skin SSS, scene shadow physics,
vanishing-point geometry) while missing the document-specific tells
that actually separate a genuine ID photo from a screenshot, reprint,
or AI-generated fake ID.

This module is a CLASSIFY-THEN-ROUTE addition to the existing Image
Engine — not a new engine (see image_engine.py's _run_document_layer,
wired in as L22). classify_image_type() runs cheaply on every image;
analyze_document_forensics() only does its expensive work when that
pre-filter says the image is document-like, and reports
status="not_applicable" otherwise (skipped by _fuse_scores, same
convention already used by L13/L14/L17) — so this adds ~zero cost and
zero false signal on the large majority of uploads that are ordinary
photos.

PROVISIONAL, like L20/L21 (see extended_physics_ensemble.py): every
signal below is a genuine, physically-motivated heuristic, but none has
been calibrated against a labeled real-ID-vs-fake-ID dataset (Aiscern
does not have one yet — building one raises its own privacy/legal
questions that deserve a deliberate decision, not a side effect of this
patch). Wired in at low LAYER_WEIGHTS[22] in image_engine.py for the
same reason L20/L21 are: evidence flows through for review and future
calibration without being able to swing the fused verdict on its own.

Five signals (Section 1.1 of the directive)
--------------------------------------------
S1 — Hologram / OVI hue-shift proxy
S2 — Microprint border-strip stroke analysis
S3 — Guilloche periodic-pattern spectral analysis
S4 — UV/fluorescence security-paper texture proxy
S5 — Font / stroke-width consistency in detected text blocks

None of these can positively prove "AI-generated" on their own — each
detects the ABSENCE of security-feature fidelity, which is consistent
with (a) a genuine AI-generated fake, (b) a low-quality real reprint or
photocopy, or (c) a genuine document photographed at low resolution
where fine security features are legitimately not resolvable at the
camera's pixel scale. Treated as *suspicion* evidence feeding one layer
among many, exactly like every other layer in this pipeline — never a
standalone verdict.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)


# ── Section 1.1 Step 1: Document Classification Pre-Filter ──────────────────

# Known document aspect ratios (long side / short side).
_KNOWN_RATIOS = {
    "id_card":     1.586,   # ISO/IEC 7810 ID-1 (credit-card-sized ID / driver's license)
    "passport":    1.420,   # passport data page, roughly
    "a4_document": 1.414,   # A4 / scanned document page
    "us_letter":   1.294,   # US Letter page
}
_RATIO_TOLERANCE = 0.12  # +/- fractional tolerance when matching a known ratio


def _aspect_ratio_signal(w: int, h: int) -> Tuple[float, str]:
    """Score + best-guess document type from image aspect ratio alone."""
    long_side, short_side = max(w, h), max(min(w, h), 1)
    ratio = long_side / short_side

    # Very tall/narrow crops (receipts) don't fit the "closest fixed ratio"
    # model well since real receipts range 3x-8x+ — treat separately.
    if ratio > 2.5:
        return 0.65, "receipt_like"

    best_type, best_dist = "unknown", 999.0
    for name, target in _KNOWN_RATIOS.items():
        dist = abs(ratio - target) / target
        if dist < best_dist:
            best_dist, best_type = dist, name

    if best_dist <= _RATIO_TOLERANCE:
        score = 1.0 - (best_dist / _RATIO_TOLERANCE) * 0.4  # 0.6-1.0
        return round(score, 3), best_type

    # Graceful falloff rather than a hard cutoff — ratios near but outside
    # tolerance still get partial credit.
    score = max(0.0, 0.5 - best_dist)
    return round(score, 3), "unknown"


def _rectangular_border_signal(gray: np.ndarray) -> Tuple[float, str]:
    """
    Detect a single large, roughly-axis-aligned quadrilateral filling most of
    the frame — the signature of a photographed card/document held or laid
    against a background (vs. an open scene with no dominant rectangle).
    """
    h, w = gray.shape
    frame_area = float(h * w)
    edges = cv2.Canny(gray, 40, 120)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return 0.0, "no_contours"

    best_frac, best_rectangularity = 0.0, 0.0
    for c in contours:
        area = cv2.contourArea(c)
        if area < frame_area * 0.25:
            continue
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        x, y, cw, ch = cv2.boundingRect(c)
        rect_area = float(cw * ch)
        rectangularity = area / rect_area if rect_area > 0 else 0.0
        if 4 <= len(approx) <= 6 and rectangularity > 0.75:
            frac = area / frame_area
            if frac > best_frac:
                best_frac, best_rectangularity = frac, rectangularity

    if best_frac == 0.0:
        return 0.0, "no_dominant_rectangle"
    score = min(1.0, best_frac * best_rectangularity * 1.3)
    return round(score, 3), f"rect_frac={best_frac:.2f}_reg={best_rectangularity:.2f}"


def _text_density_signal(gray: np.ndarray) -> Tuple[float, str]:
    """MSER-based text-region density — cheap proxy that needs no OCR engine."""
    try:
        mser = cv2.MSER_create()
        regions, _ = mser.detectRegions(gray)
    except Exception:
        return 0.0, "mser_unavailable"

    if regions is None or len(regions) == 0:
        return 0.0, "no_regions"

    h, w = gray.shape
    frame_area = float(h * w)
    letter_like = 0
    for r in regions:
        x0, y0 = r[:, 0].min(), r[:, 1].min()
        x1, y1 = r[:, 0].max(), r[:, 1].max()
        bw, bh = (x1 - x0), (y1 - y0)
        if bh <= 0:
            continue
        aspect = bw / bh
        rel_h = bh / h
        if 0.001 < rel_h < 0.08 and 0.15 < aspect < 6.0:
            letter_like += 1

    density = letter_like / max(frame_area / (100 * 100), 1e-6)  # letter blobs per 100x100px
    score = min(1.0, density / 6.0)
    return round(score, 3), f"letter_blobs={letter_like}_density={density:.2f}"


def classify_image_type(img_array: np.ndarray, img_pil: Any = None) -> Dict[str, Any]:
    """
    Step 1 of Section 1.1: cheap pre-filter deciding whether this image is a
    document/ID/passport/certificate/receipt (route to
    analyze_document_forensics) or an ordinary photo (skip document
    forensics — caller reports status="not_applicable").

    Combines three independent signals per the directive:
      - aspect ratio match to known document formats
      - a single dominant, roughly-axis-aligned rectangle filling most of the frame
      - text-region density (MSER letter-blob proxy; no OCR dependency required)
    """
    t0 = time.monotonic()
    try:
        h, w = img_array.shape[:2]
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY) if img_array.ndim == 3 else img_array

        ratio_score, doc_type_guess = _aspect_ratio_signal(w, h)
        rect_score, rect_detail = _rectangular_border_signal(gray)
        text_score, text_detail = _text_density_signal(gray)

        # Rectangular border + text density are the strongest independent
        # tells; aspect ratio alone is weak (plenty of ordinary photos share
        # common document ratios), so it gets the smallest weight.
        composite = ratio_score * 0.20 + rect_score * 0.40 + text_score * 0.40
        is_document = composite >= 0.50

        elapsed = int((time.monotonic() - t0) * 1000)
        return {
            "is_document": bool(is_document),
            "document_type": doc_type_guess if is_document else "photo",
            "classification_confidence": round(float(composite), 4),
            "signals": {
                "aspect_ratio":       {"score": ratio_score, "detail": doc_type_guess},
                "rectangular_border": {"score": rect_score,  "detail": rect_detail},
                "text_density":       {"score": text_score,  "detail": text_detail},
            },
            "elapsed_ms": elapsed,
        }
    except Exception as exc:
        logger.warning("[DocumentForensics][classify] failed: %s", exc)
        return {
            "is_document": False,
            "document_type": "unknown",
            "classification_confidence": 0.0,
            "signals": {},
            "elapsed_ms": int((time.monotonic() - t0) * 1000),
        }


# ── Section 1.1 Step 2: Document Forensics Submodule (5 signals) ────────────

def _border_strips(img_array: np.ndarray, frac: float = 0.10) -> List[np.ndarray]:
    """Return the four edge strips of the image — typical microprint/guilloche placement."""
    h, w = img_array.shape[:2]
    bh, bw = max(4, int(h * frac)), max(4, int(w * frac))
    return [
        img_array[0:bh, :],       # top
        img_array[h - bh:h, :],   # bottom
        img_array[:, 0:bw],       # left
        img_array[:, w - bw:w],   # right
    ]


def _signal_hologram_ovi(img_array: np.ndarray) -> Tuple[float, str]:
    """
    S1 — Hologram/OVI hue-shift proxy.
    Real optically-variable-ink features show strong local hue variation
    (thin-film interference shifts colour with viewing angle, which even a
    single static photo captures as a spatial hue gradient across the
    foil). Flat printed "hologram-look" graphics — common in cheap
    forgeries and in AI-generated documents, which tend to paint a static
    rainbow gradient instead of true iridescence — show far less genuine
    hue spread once the smooth low-frequency gradient itself is excluded.
    """
    try:
        hsv = cv2.cvtColor(img_array, cv2.COLOR_RGB2HSV)
        hue, sat = hsv[:, :, 0].astype(np.float32), hsv[:, :, 1].astype(np.float32)

        # Candidate OVI cells: small tiles with high saturation AND high
        # local hue gradient (rules out plain saturated-but-uniform colour
        # like a solid blue background field).
        tile = 24
        h, w = hue.shape
        candidates = []
        for y in range(0, max(h - tile, 0), tile):
            for x in range(0, max(w - tile, 0), tile):
                s_block = sat[y:y + tile, x:x + tile]
                if s_block.mean() < 60:
                    continue
                h_block = hue[y:y + tile, x:x + tile]
                gy, gx = np.gradient(h_block)
                grad_mag = float(np.sqrt(gy ** 2 + gx ** 2).mean())
                if grad_mag > 3.0:
                    candidates.append(h_block)

        if not candidates:
            return 0.5, "no_candidate_ovi_region"

        all_hue = np.concatenate([c.flatten() for c in candidates])
        hue_sorted = np.sort(all_hue)
        gaps = np.diff(hue_sorted, append=hue_sorted[0] + 180)
        circular_span = 180.0 - float(gaps.max())
        hue_shift_deg = circular_span * 2.0  # OpenCV hue is 0-179 -> degrees

        score = 1.0 - min(hue_shift_deg / 30.0, 1.0)
        return (
            round(float(np.clip(score, 0.0, 1.0)), 3),
            f"hue_shift_deg={hue_shift_deg:.1f}_candidates={len(candidates)}",
        )
    except Exception as exc:
        return 0.5, f"error:{exc}"


def _signal_microprint(img_array: np.ndarray) -> Tuple[float, str]:
    """
    S2 — Microprint border-strip analysis.
    Genuine microprint is a dense field of tiny, individually-resolved
    strokes at many different local orientations (it's still text, just
    small). A faked/printed line standing in for microprint — or an AI
    generator's approximation of "fine border detail" — tends to collapse
    into either a blank strip or a small number of long, orientation-
    uniform strokes (reads visually as a solid or dashed line, not text).
    Upsampled 4x (Lanczos) before measuring, per the directive, matching
    how a human inspector would zoom in to check.
    """
    try:
        from PIL import Image as PILImage

        strips = _border_strips(img_array, frac=0.08)
        best_score, best_detail = 0.5, "no_strip_signal"
        strongest_edge_density = 0.0

        for strip in strips:
            if strip.size == 0 or min(strip.shape[:2]) < 4:
                continue
            gray = cv2.cvtColor(strip, cv2.COLOR_RGB2GRAY) if strip.ndim == 3 else strip
            pil_strip = PILImage.fromarray(gray)
            up = pil_strip.resize((pil_strip.width * 4, pil_strip.height * 4), PILImage.LANCZOS)
            up_arr = np.array(up)

            edges = cv2.Canny(up_arr, 50, 150)
            edge_density = float(np.mean(edges > 0))
            if edge_density < 0.01 or edge_density <= strongest_edge_density:
                continue
            strongest_edge_density = edge_density

            gx = cv2.Sobel(up_arr, cv2.CV_32F, 1, 0, ksize=3)
            gy = cv2.Sobel(up_arr, cv2.CV_32F, 0, 1, ksize=3)
            mag = np.sqrt(gx ** 2 + gy ** 2)
            mask = mag > (mag.mean() + mag.std())
            if mask.sum() < 20:
                continue
            ang = (np.degrees(np.arctan2(gy[mask], gx[mask])) + 180) % 180
            hist, _ = np.histogram(ang, bins=18, range=(0, 180))
            p = hist / (hist.sum() + 1e-9)
            orientation_entropy = float(-(p[p > 0] * np.log2(p[p > 0])).sum())
            norm_entropy = orientation_entropy / np.log2(18)

            # High edge density + high orientation entropy => text-like
            # microprint (many stroke directions). High edge density + LOW
            # entropy => a solid/dashed printed line standing in for it.
            if norm_entropy > 0.55:
                best_score = round(float(0.5 - norm_entropy * 0.35), 3)
                best_detail = f"text_like: entropy={norm_entropy:.2f} density={edge_density:.3f}"
            else:
                best_score = round(float(0.55 + (0.55 - norm_entropy) * 0.6), 3)
                best_detail = f"line_like: entropy={norm_entropy:.2f} density={edge_density:.3f}"

        return float(np.clip(best_score, 0.0, 1.0)), best_detail
    except Exception as exc:
        return 0.5, f"error:{exc}"


def _signal_guilloche(img_array: np.ndarray) -> Tuple[float, str]:
    """
    S3 — Guilloche pattern spectral analysis.
    Guilloche (spirograph-style fine curved-line engraving) is
    mathematically periodic at a fine spatial scale, which produces a
    concentrated, off-centre peak in the 2D FFT magnitude spectrum of a
    background/border region. Random print noise spreads energy broadly
    (no peak); a flat AI-generated or scanned-flat background has almost
    no high-frequency energy at all. Both "no peak" cases look distinct
    in the spectrum from a genuine peaked guilloche pattern.
    """
    try:
        strips = _border_strips(img_array, frac=0.15)
        best_score, best_detail = 0.5, "no_usable_strip"
        for strip in strips:
            if strip.size == 0 or min(strip.shape[:2]) < 32:
                continue
            gray = cv2.cvtColor(strip, cv2.COLOR_RGB2GRAY) if strip.ndim == 3 else strip
            gray = cv2.resize(gray, (128, 128))
            f = np.fft.fftshift(np.fft.fft2(gray.astype(np.float32)))
            mag = np.abs(f)
            cy, cx = mag.shape[0] // 2, mag.shape[1] // 2

            yy, xx = np.ogrid[:mag.shape[0], :mag.shape[1]]
            r = np.sqrt((yy - cy) ** 2 + (xx - cx) ** 2)
            ac_mask = r > 6  # exclude DC / very-low-frequency disk (flat shading, gradients)
            ac = mag[ac_mask]
            if ac.size == 0 or ac.mean() < 1e-6:
                continue

            peak_ratio = float(ac.max() / (ac.mean() + 1e-9))
            hf_mask = r[ac_mask] > 20
            hf_energy = float(ac[hf_mask].sum() / (ac.sum() + 1e-9)) if hf_mask.any() else 0.0

            if peak_ratio > 15 and hf_energy > 0.05:
                score = max(0.0, 0.35 - min((peak_ratio - 15) / 40, 0.3))
                detail = f"periodic_peak_ratio={peak_ratio:.1f}_hf={hf_energy:.3f}"
            elif hf_energy < 0.01:
                score = 0.62
                detail = f"flat_no_hf_content_hf={hf_energy:.4f}"
            else:
                score = 0.5
                detail = f"ambiguous_peak_ratio={peak_ratio:.1f}_hf={hf_energy:.3f}"

            # Keep the strip whose reading is most informative (furthest from
            # the neutral midpoint) rather than always the first strip.
            if abs(score - 0.5) > abs(best_score - 0.5):
                best_score, best_detail = score, detail

        return float(np.clip(best_score, 0.0, 1.0)), best_detail
    except Exception as exc:
        return 0.5, f"error:{exc}"


def _signal_uv_fluorescence_proxy(img_array: np.ndarray) -> Tuple[float, str]:
    """
    S4 — UV/fluorescence security-paper texture proxy.
    There is no UV light source available here, so genuine fluorescence
    cannot be measured. What CAN be measured: genuine security paper
    carries a subtle printed micro-pattern visible even under ordinary
    white light as fine blue/green-channel texture in otherwise "blank"
    background regions. A flat solid-colour background — common in
    low-effort forgeries and in AI-generated document renders, which tend
    to paint backgrounds as smooth colour fields — shows near-zero local
    B/G channel variance there.
    """
    try:
        h, w = img_array.shape[:2]
        margin = max(4, int(min(h, w) * 0.05))
        # Outer ring, a crude but dependency-free way to bias toward
        # background paper texture over the central photo/text block.
        ring_mask = np.zeros((h, w), dtype=bool)
        ring_mask[:margin, :] = True
        ring_mask[-margin:, :] = True
        ring_mask[:, :margin] = True
        ring_mask[:, -margin:] = True
        if ring_mask.sum() < 200:
            return 0.5, "region_too_small"

        b = img_array[:, :, 2].astype(np.float32)
        g = img_array[:, :, 1].astype(np.float32)

        def local_var(chan: np.ndarray) -> np.ndarray:
            mean = cv2.blur(chan, (5, 5))
            mean_sq = cv2.blur(chan * chan, (5, 5))
            return np.clip(mean_sq - mean * mean, 0, None)

        bv = local_var(b)[ring_mask]
        gv = local_var(g)[ring_mask]
        texture_energy = float(np.median(bv) + np.median(gv))

        # Empirical-scale-only (uncalibrated, see module docstring): real
        # printed background texture typically reads tens-to-low-hundreds
        # here; a flat colour fill reads single digits.
        score = 1.0 - min(texture_energy / 40.0, 1.0)
        return round(float(np.clip(score, 0.0, 1.0)), 3), f"bg_texture_energy={texture_energy:.1f}"
    except Exception as exc:
        return 0.5, f"error:{exc}"


def _signal_font_consistency(gray: np.ndarray) -> Tuple[float, str]:
    """
    S5 — Font / stroke-width consistency.
    Within a single printed or rendered text run, stroke width (measured
    via the distance transform of binarised character blobs) should be
    tightly clustered for a given font/size. Mixed fonts, re-typeset
    fields (a classic tampering tell — one field edited, rest untouched),
    or an AI generator's inconsistent text rendering all widen that
    distribution well past normal font-rendering variance.
    """
    try:
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        n, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
        h_img, w_img = gray.shape

        stroke_widths = []
        for i in range(1, n):
            x, y, bw, bh, area = stats[i]
            if bh <= 0 or bw <= 0:
                continue
            rel_h = bh / h_img
            aspect = bw / bh
            if not (0.005 < rel_h < 0.08 and 0.1 < aspect < 4.0 and area > 4):
                continue
            blob = (labels[y:y + bh, x:x + bw] == i).astype(np.uint8)
            # Pad with a 1px zero border before the distance transform. Without
            # this, a solid/blocky glyph (bold font, low-res text, or a blob
            # that exactly fills its own tight bounding box) has NO zero pixel
            # anywhere in the crop for interior pixels to measure distance to —
            # cv2.distanceTransform then returns FLT_MAX (3.4e38) for those
            # pixels instead of a real distance, which silently poisoned
            # dist.max()*2 into inf and the whole stroke_widths stat into nan.
            # A zero border guarantees every pixel has a finite nearest-zero
            # distance, bounded by the blob's own half-width/height.
            blob_padded = cv2.copyMakeBorder(blob, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
            dist = cv2.distanceTransform(blob_padded, cv2.DIST_L2, 3)
            stroke_width = float(dist.max() * 2)
            if stroke_width <= 0 or stroke_width > max(bw, bh):
                continue  # sanity bound — a stroke can't be wider than its own blob
            stroke_widths.append(stroke_width)

        if len(stroke_widths) < 8:
            return 0.5, f"insufficient_text_blobs={len(stroke_widths)}"

        arr = np.array(stroke_widths)
        lo, hi = np.percentile(arr, [10, 90])
        trimmed = arr[(arr >= lo) & (arr <= hi)]
        if trimmed.size < 5:
            trimmed = arr
        cv_ = float(trimmed.std() / (trimmed.mean() + 1e-9))

        # Real single-font printed text: CV typically well under ~0.35.
        # Mixed fonts / tampering / inconsistent AI rendering: notably higher.
        score = min(1.0, max(0.0, (cv_ - 0.25) / 0.5))
        return round(float(score), 3), f"stroke_width_cv={cv_:.2f}_n={trimmed.size}"
    except Exception as exc:
        return 0.5, f"error:{exc}"


# ── Public API ────────────────────────────────────────────────────────────────

def analyze_document_forensics(img_array: np.ndarray, img_pil: Any = None) -> Dict[str, Any]:
    """
    Layer 22 — Document/ID Security Forensics [provisional].
    Public entry point called by engines/image_engine.py's
    _run_document_layer(). Classifies the image, and only runs the five
    security-feature signals when the classifier says this looks like a
    document/ID/passport/receipt — otherwise returns
    status="not_applicable" so _fuse_scores() skips it for the vast
    majority of ordinary photo uploads, matching the L13/L14/L17
    "scene-dependent, neutral when N/A" convention already used elsewhere
    in this pipeline.
    """
    from utils.evidence_builder import evidence_node, build_layer_report

    t0 = time.monotonic()
    layer_name = "Document/ID Security Forensics [provisional]"

    try:
        classification = classify_image_type(img_array, img_pil)
    except Exception as exc:
        logger.warning("[DocumentForensics] classification failed: %s", exc)
        elapsed = int((time.monotonic() - t0) * 1000)
        return build_layer_report(22, layer_name, [], "failure", elapsed, score=0.5)

    if not classification.get("is_document"):
        elapsed = int((time.monotonic() - t0) * 1000)
        report = build_layer_report(
            22, layer_name,
            [evidence_node(
                22, "document_classification", "not_document", "not_present",
                classification.get("classification_confidence", 0.0),
                "Image classified as an ordinary photo, not a document/ID",
            )],
            "not_applicable", elapsed, score=0.5,
        )
        report["document_classification"] = classification
        return report

    try:
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY) if img_array.ndim == 3 else img_array

        s1_score, s1_detail = _signal_hologram_ovi(img_array)
        s2_score, s2_detail = _signal_microprint(img_array)
        s3_score, s3_detail = _signal_guilloche(img_array)
        s4_score, s4_detail = _signal_uv_fluorescence_proxy(img_array)
        s5_score, s5_detail = _signal_font_consistency(gray)
    except Exception as exc:
        logger.warning("[DocumentForensics] signal computation failed: %s", exc)
        elapsed = int((time.monotonic() - t0) * 1000)
        report = build_layer_report(22, layer_name, [], "failure", elapsed, score=0.5)
        report["document_classification"] = classification
        return report

    def _status_for(score: float) -> str:
        if score >= 0.65:
            return "anomalous"
        if score <= 0.35:
            return "normal"
        return "inconclusive"

    evidence = [
        evidence_node(22, "hologram_ovi", "hue_shift_proxy", _status_for(s1_score), s1_score, s1_detail),
        evidence_node(22, "microprint", "border_stroke_analysis", _status_for(s2_score), s2_score, s2_detail),
        evidence_node(22, "guilloche", "spectral_periodicity", _status_for(s3_score), s3_score, s3_detail),
        evidence_node(22, "uv_fluorescence_proxy", "background_texture", _status_for(s4_score), s4_score, s4_detail),
        evidence_node(22, "font_consistency", "stroke_width_cv", _status_for(s5_score), s5_score, s5_detail),
    ]

    # Weighted composite. Microprint and guilloche are the hardest for both
    # cheap forgeries and current-generation image generators to fake
    # convincingly, so they carry the most weight; the hologram and UV
    # proxies are the noisiest (most likely to land neutral) so they're
    # weighted down.
    weights = {"s1": 0.9, "s2": 1.3, "s3": 1.2, "s4": 0.7, "s5": 0.9}
    scores = {"s1": s1_score, "s2": s2_score, "s3": s3_score, "s4": s4_score, "s5": s5_score}
    total_w = sum(weights.values())
    composite = sum(scores[k] * weights[k] for k in weights) / total_w

    elapsed = int((time.monotonic() - t0) * 1000)
    report = build_layer_report(22, layer_name, evidence, "success", elapsed, score=composite)
    report["document_classification"] = classification
    return report

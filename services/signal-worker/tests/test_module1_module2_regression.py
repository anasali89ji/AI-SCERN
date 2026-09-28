"""
tests/test_module1_module2_regression.py

Regression tests for the two P0 bugs fixed per the detection-fixes directive:

  Module 1 — False generator attribution on ordinary real images.
             A real, unedited photo re-saved as lossless PNG with no EXIF was
             getting a fabricated, specific, versioned generator attribution
             (e.g. "Google Gemini / Imagen", "Gemini 2.0 / ImageFX") purely
             from format priors (PNG-ness, missing EXIF), not genuine
             generator fingerprints.

  Module 2 — Format-prior override doing the work of the whole pipeline.
             Every PNG-without-EXIF image (real or synthetic, regardless of
             visual content) was converging on the same fused score (~0.87)
             because the format-prior signal alone could satisfy the
             override floors.

Per the ground rule in the directive: these tests are intentionally built
with image generators that are NOT shared with, or derived from, the
fixtures/thresholds in tests/test_accuracy.py (_camera_like_image /
_ai_like_image), so they don't just validate the code against inputs it was
tuned on.

Caveat: this sandboxed test environment has no access to a real licensed
photo dataset (network egress here is restricted to package registries).
The "real photo" proxies below are independently-constructed synthetic
scenes (varied gradients, correlated sensor-like noise, natural colour
spread) meant to stand in for Module 6's eventual independent benchmark —
they are NOT a substitute for testing against actual camera photos and
real generator outputs (Midjourney/DALL-E/SDXL/Gemini), which Module 6
calls for separately. If a real held-out set becomes available, these
tests should be extended/replaced with it. Deliberately excludes any
synthetic face/portrait scene: the pipeline's Layer 10 biological-marker
and lighting-physics checks are specifically tuned against real faces, and
a hand-drawn synthetic face is not a meaningful stand-in for validating
(or invalidating) those checks -- that requires real portrait photos,
which is exactly what Module 6 is for.
"""

import io
import numpy as np
import pytest
from PIL import Image


def _multi_octave_noise(rng: np.random.Generator, h: int, w: int, octaves=(4, 8, 16, 32, 64)) -> np.ndarray:
    """
    Broadband ("1/f-like") texture built by summing several low-res random
    fields upsampled (nearest, then box-blurred) to full resolution. Real
    photo textures are broadband; a single sinusoid or perfectly periodic
    tile creates a narrow spectral peak that frequency-domain / latent-grid
    probes are specifically designed to catch -- so we deliberately avoid
    any pure sin/cos or exact periodic tiling here.
    """
    out = np.zeros((h, w), dtype=np.float32)
    for i, o in enumerate(octaves):
        small = rng.normal(0, 1, (max(2, h // o), max(2, w // o))).astype(np.float32)
        big = np.array(Image.fromarray((small * 40 + 128).clip(0, 255).astype(np.uint8))
                        .resize((w, h), Image.BILINEAR), dtype=np.float32) - 128
        out += big / (i + 1)
    return out


def _independent_real_photo_proxy(scene: str, h: int = 600, w: int = 600, seed: int = 0) -> np.ndarray:
    """
    Build a visually distinct, sensor-noise-plausible "real photo" proxy.
    Deliberately uses different scene construction per `scene` name so the
    10 images in the diversity test have genuinely different visual content
    (not just different noise seeds of the same underlying pattern), while
    keeping texture broadband (see _multi_octave_noise) rather than built
    from exact periodic/sinusoidal patterns.
    """
    rng = np.random.default_rng(seed)
    Y, X = np.mgrid[0:h, 0:w].astype(np.float32)
    # Shared LOW-frequency structure only (large-scale scene colour/shape --
    # real photos DO correlate channels at this scale). High-frequency detail
    # is generated independently per channel below (real sensor noise
    # decorrelates channel-to-channel at pixel level; a shared/scaled-copy
    # texture across all frequencies is precisely the cross-channel HF
    # correlation signature the pipeline's DALL-E3 probe looks for).
    texture = _multi_octave_noise(rng, h, w, octaves=(16, 32, 64))
    tex_r = _multi_octave_noise(np.random.default_rng(seed * 3 + 1), h, w, octaves=(6, 12))
    tex_g = _multi_octave_noise(np.random.default_rng(seed * 3 + 2), h, w, octaves=(6, 12))
    tex_b = _multi_octave_noise(np.random.default_rng(seed * 3 + 3), h, w, octaves=(6, 12))
    tex_indep = np.stack([tex_r, tex_g, tex_b], axis=2)

    if scene == "sky_gradient":
        base = (90 + 120 * (Y / h))[:, :, None] * np.array([0.6, 0.75, 1.0]) + texture[:, :, None] * 0.15 + tex_indep * 0.5
    elif scene == "foliage":
        base = 150 + texture[:, :, None] * np.array([0.5, 1.0, 0.4]) * 0.4 + tex_indep * np.array([0.5, 1.0, 0.4])
    elif scene == "brick_wall":
        # Coarse blocky structure via low-res noise (irregular, not a
        # perfectly repeating tile) plus mortar-line brightness jitter.
        coarse = _multi_octave_noise(rng, h, w, octaves=(6, 10))
        base = 130 + coarse[:, :, None] * np.array([0.9, 0.5, 0.35]) * 0.3 + rng.normal(0, 10, (h, w, 1)) + tex_indep * 0.9
    elif scene == "beach_sand":
        base = 170 + texture[:, :, None] * np.array([0.6, 0.55, 0.35]) * 0.4 + tex_indep * np.array([0.6, 0.55, 0.35])
    elif scene == "night_street":
        base = 35 + texture[:, :, None] * np.array([0.5, 0.5, 0.7]) * 0.4 + tex_indep * np.array([0.5, 0.5, 0.7])
        base = np.clip(base, 5, 255)
    elif scene == "wood_grain":
        # Directional grain via elongated low-frequency streaks + independent
        # per-channel high-frequency detail (real wood grain is irregular,
        # not perfectly periodic).
        streak = _multi_octave_noise(rng, h, w, octaves=(3, 5)) * (1 + 0.3 * np.sin(Y / 210.0))
        base = 140 + streak[:, :, None] * np.array([0.9, 0.6, 0.35]) * 0.5 + tex_indep * 0.7
    elif scene == "forest_texture":
        base = 130 + texture[:, :, None] * np.array([0.5, 0.95, 0.4]) * 0.4 + tex_indep * np.array([0.5, 0.95, 0.4])
    elif scene == "snow_field":
        base = 225 + texture[:, :, None] * np.array([0.25, 0.25, 0.28]) * 0.4 + tex_indep * np.array([0.25, 0.25, 0.28])
    elif scene == "city_dusk":
        base = (60 + 100 * (X / w))[:, :, None] * np.array([1.1, 0.7, 0.5]) + texture[:, :, None] * 0.12 + tex_indep * 0.4
    else:  # "checker_room"
        coarse = _multi_octave_noise(rng, h, w, octaves=(8, 14))
        base = 120 + coarse[:, :, None] * np.array([0.8, 0.75, 0.7]) + tex_indep * 0.35

    base = np.clip(base, 0, 255).astype(np.float32)

    # Sensor-plausible shot noise: std grows with sqrt(signal), independent
    # per channel (chromatic-aberration-like decorrelation) -- the opposite
    # of a diffusion decoder's cross-channel-correlated HF noise. Deliberately
    # strong: this is the ONLY genuinely full-spectrum (non-interpolated)
    # component in this fixture, since _multi_octave_noise's bilinear
    # upsampling is itself a smoothing operation that -- like a diffusion
    # decoder's own upsampling -- lacks true pixel-level high-frequency
    # energy. Real camera sensor noise must dominate at that scale for this
    # to look like a real photo instead of smoothly-interpolated synthetic
    # texture.
    for c in range(3):
        chan = base[:, :, c]
        noise = rng.normal(0, np.sqrt(chan + 1) * 2.2, chan.shape)
        base[:, :, c] = np.clip(chan + noise, 0, 255)

    return base.astype(np.uint8)


def _to_png_no_exif(arr: np.ndarray) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="PNG")  # PIL PNG save never writes EXIF
    return buf.getvalue()


SCENES = [
    "sky_gradient", "foliage", "brick_wall", "beach_sand", "night_street",
    "wood_grain", "forest_texture", "snow_field", "city_dusk", "checker_room",
]


class TestModule1FalseAttribution:
    """
    Acceptance test (Module 1): feed real-photo-proxy PNGs (EXIF-stripped)
    through the full pipeline. None should come back with a specific named
    generator (Google Gemini / Imagen, ChatGPT / DALL-E 3, Midjourney, ...).
    """

    def test_no_specific_generator_display_on_real_photo_proxies(self):
        from engines.image_engine import analyze_image_from_bytes

        banned_display_fragments = [
            "gemini", "imagen", "dall-e", "dalle", "chatgpt", "gpt-image",
            "midjourney", "stable diffusion", "sdxl", "firefly",
        ]

        offending = []
        for i, scene in enumerate(SCENES):
            arr = _independent_real_photo_proxy(scene, seed=100 + i)
            result = analyze_image_from_bytes(_to_png_no_exif(arr), "image/png")
            cs = result.get("composite_score", {})
            display = str(cs.get("generator_display", "")).lower()
            reason = str(cs.get("override_reason") or "")
            if any(frag in display for frag in banned_display_fragments):
                offending.append((scene, display, reason))
            # Also: override_reason must never be a specific generator_detected
            # tag driven purely by this synthetic real-photo-proxy content.
            assert not reason.startswith("generator_detected:"), (
                f"scene={scene!r} got a specific generator_detected override "
                f"on a real-photo proxy: {reason!r} / display={display!r}"
            )

        assert not offending, (
            f"Real-photo proxies got specific vendor attribution: {offending}"
        )

    def test_synthid_generator_hint_requires_strong_score(self):
        """
        check_synthid() must not name a specific family unless the winning
        track score is genuinely high (>0.60) -- not merely detected.
        """
        from analyzers.synthid_local import check_synthid

        # Borderline-detected but NOT strongly attributable to one family:
        # construct a gray image whose FFT has no strong structure, so all
        # track scores stay low/ambiguous.
        rng = np.random.default_rng(7)
        arr = rng.integers(0, 255, (256, 256, 3), dtype=np.uint8)
        result = check_synthid(arr, lossless=True)
        if result["detected"]:
            # If it happened to cross the detected threshold on noise, it
            # must still not claim a specific vendor unless truly warranted.
            top_track = max(result["track_scores"].values(), key=lambda v: v or 0)
            if (top_track or 0) <= 0.60:
                assert result["generator_hint"] in ("unknown_ai", "none"), (
                    f"Expected unknown_ai without strong track score, "
                    f"got {result['generator_hint']!r} (track_scores={result['track_scores']})"
                )


class TestModule2FormatPriorVariance:
    """
    Acceptance test (Module 2): fused scores across visually distinct
    PNG-without-EXIF images must show real content-driven variance, not
    all converge near the same value because the format prior dominates.
    """

    def test_score_variance_across_distinct_png_content(self):
        from engines.image_engine import analyze_image_from_bytes

        scores = []
        for i, scene in enumerate(SCENES):
            arr = _independent_real_photo_proxy(scene, seed=200 + i)
            result = analyze_image_from_bytes(_to_png_no_exif(arr), "image/png")
            cs = result.get("composite_score", {})
            scores.append(float(cs.get("fused_score", 0.5)))

        scores_arr = np.array(scores)
        stddev = float(scores_arr.std())
        # Before the fix, this benchmark observed ~0.0 stddev (all PNG/no-EXIF
        # images converged on ~0.87 regardless of content). Require material
        # spread now that the format prior is a minor nudge, not a driver.
        assert stddev > 0.02, (
            f"Expected meaningful score variance across distinct PNG content, "
            f"got stddev={stddev:.4f} (scores={scores})"
        )

    def test_format_prior_alone_cannot_reach_override_floor(self):
        """
        Module 2 fix direct check: _lossless_no_exif_score's own ceiling must
        be low enough, and its fusion weight small enough, that L9's score
        cannot single-handedly clear the 0.58 fused_raw gate that other
        overrides key off of, on an otherwise unremarkable image.
        """
        from analyzers.ai_fingerprint import analyze_ai_fingerprint

        rng = np.random.default_rng(3)
        # Bland, low-saturation, non-adversarial content -- only the format
        # prior (PNG, no EXIF, large) should be elevated.
        arr = np.clip(120 + rng.normal(0, 8, (600, 600, 3)), 0, 255).astype(np.uint8)
        pil = Image.fromarray(arr)  # no EXIF, format defaults to None until saved/reloaded
        pil.format = "PNG"

        report = analyze_ai_fingerprint(arr, pil)
        l9_score = report.get("layerSuspicionScore", 0.5)
        assert l9_score < 0.58, (
            f"Expected format-prior-only L9 score below the override gate, got {l9_score}"
        )

"""
Module 14 smoke tests for analyzers/tca.py (L24 TCA).
Run directly: python -m tests.test_tca_smoke  (from signal-worker/)
"""
import sys
import numpy as np
from PIL import Image, ImageDraw
import cv2

sys.path.insert(0, ".")
from analyzers.tca import analyze_tca, detect_interlacing, detect_motion_blur_consistency


def make_textured_base(h=480, w=480, seed=0):
    rng = np.random.default_rng(seed)
    img = np.zeros((h, w, 3), dtype=np.uint8)
    base = (rng.normal(128, 25, (h, w))).clip(0, 255)
    for c in range(3):
        img[:, :, c] = base.astype(np.uint8)
    pil = Image.fromarray(img)
    draw = ImageDraw.Draw(pil)
    rng2 = np.random.default_rng(seed + 1)
    for _ in range(50):
        x0, y0 = rng2.integers(0, w - 40), rng2.integers(0, h - 40)
        x1, y1 = x0 + rng2.integers(10, 40), y0 + rng2.integers(10, 40)
        color = tuple(int(v) for v in rng2.integers(0, 255, 3))
        draw.rectangle([x0, y0, x1, y1], outline=color, width=2)
        draw.line([x0, y0, x1, y1], fill=color, width=2)
    return np.array(pil)


def make_structured_base(h=480, w=480, seed=0):
    """
    A base with genuine spatially-coherent structure (solid filled
    rectangles + light sensor-like noise), used specifically for the
    interlacing fixtures below. make_textured_base() (used elsewhere in
    this file) is dominated by per-pixel iid noise, which drowns out the
    shift-induced comb signal at the sparse shape-outline edges it does
    have -- the first version of this fixture used make_textured_base
    and comb_ratio came back statistically indistinguishable between
    interlaced (1.08) and progressive (0.98) synthetic images, caught by
    smoke testing. Solid fills + light noise gives the shift something
    coherent to visibly misalign.
    """
    rng = np.random.default_rng(seed)
    pil = Image.new("RGB", (w, h), (120, 120, 120))
    draw = ImageDraw.Draw(pil)
    for _ in range(25):
        x0, y0 = rng.integers(0, w - 60), rng.integers(0, h - 60)
        x1, y1 = x0 + rng.integers(30, 80), y0 + rng.integers(30, 80)
        color = tuple(int(v) for v in rng.integers(50, 220, 3))
        draw.rectangle([x0, y0, x1, y1], fill=color)
    img = np.array(pil).astype(np.float32)
    img += rng.normal(0, 3, img.shape)
    return np.clip(img, 0, 255).astype(np.uint8)


def make_interlaced_image(h=480, w=480, seed=0, shift=8):
    """Simulate real interlaced video: interleave two temporally-offset
    fields (odd rows shifted horizontally, simulating motion between
    fields) into alternating scanlines."""
    base = make_structured_base(h, w, seed)
    pil = Image.fromarray(base)
    shifted = np.array(pil.transform(pil.size, Image.AFFINE, (1, 0, shift, 0, 1, 0)))
    interlaced = base.copy()
    interlaced[1::2, :, :] = shifted[1::2, :, :]
    return interlaced


def make_progressive_image(h=480, w=480, seed=1):
    return make_structured_base(h, w, seed)


def make_consistent_blur_image(h=480, w=480, seed=2, angle_deg=20, length=15):
    img = make_textured_base(h, w, seed)
    # Directional (motion) blur kernel at a single consistent angle,
    # applied globally -- simulates real camera-motion blur (one
    # physical trajectory during the whole exposure).
    kernel = np.zeros((length, length), dtype=np.float32)
    kernel[length // 2, :] = 1.0
    M = cv2.getRotationMatrix2D((length / 2, length / 2), angle_deg, 1.0)
    kernel = cv2.warpAffine(kernel, M, (length, length))
    kernel /= kernel.sum() + 1e-9
    blurred = cv2.filter2D(img, -1, kernel)
    return blurred


def make_inconsistent_blur_image(h=480, w=480, seed=3):
    img = make_textured_base(h, w, seed)
    out = img.copy()
    angles = [10, 100, 190, 280]  # deliberately incoherent quadrant blur directions
    hh, ww = h // 2, w // 2
    length = 15
    idx = 0
    for i in range(2):
        for j in range(2):
            quadrant = img[i*hh:(i+1)*hh, j*ww:(j+1)*ww]
            kernel = np.zeros((length, length), dtype=np.float32)
            kernel[length // 2, :] = 1.0
            M = cv2.getRotationMatrix2D((length / 2, length / 2), angles[idx], 1.0)
            kernel = cv2.warpAffine(kernel, M, (length, length))
            kernel /= kernel.sum() + 1e-9
            out[i*hh:(i+1)*hh, j*ww:(j+1)*ww] = cv2.filter2D(quadrant, -1, kernel)
            idx += 1
    return out


def run_case(name, img, expect_min_score=None, expect_max_score=None):
    result = analyze_tca(img)
    score = result["score"]
    status = result["status"]
    print(f"\n=== {name} ===")
    print(f"status={status} score={score}")
    for ev in result["evidence"]:
        print(f"  - {ev['name']}: score={ev['score']:.3f} | {ev['detail'][:150]}")
    assert status in ("success", "failure"), f"unexpected status {status}"
    if expect_min_score is not None:
        assert score >= expect_min_score, f"{name}: expected score >= {expect_min_score}, got {score}"
    if expect_max_score is not None:
        assert score <= expect_max_score, f"{name}: expected score <= {expect_max_score}, got {score}"
    return result


if __name__ == "__main__":
    failures = []

    try:
        s1 = detect_interlacing(make_interlaced_image())
        print("interlaced raw detect:", s1)
        assert s1 is not None and s1["applicable"]
        assert s1["comb_ratio"] >= 2.2, f"expected strong comb signature, got {s1['comb_ratio']}"
    except AssertionError as e:
        failures.append(("interlaced_raw_detect", str(e)))

    try:
        run_case("interlaced_image (should score real-like/low)", make_interlaced_image(), expect_max_score=0.4)
    except AssertionError as e:
        failures.append(("interlaced_image_full", str(e)))

    try:
        s1p = detect_interlacing(make_progressive_image())
        print("progressive raw detect:", s1p)
        assert s1p is not None and s1p["applicable"]
        assert s1p["comb_ratio"] < 2.2, f"expected no comb signature, got {s1p['comb_ratio']}"
    except AssertionError as e:
        failures.append(("progressive_raw_detect", str(e)))

    try:
        # Progressive (non-interlaced, non-blurred) should be NEUTRAL (0.5-ish),
        # not pushed low or high -- absence of both signals is uninformative.
        r = run_case("progressive_image (should be neutral-ish)", make_progressive_image())
        assert 0.3 <= r["score"] <= 0.7, f"expected neutral score, got {r['score']}"
    except AssertionError as e:
        failures.append(("progressive_image_full", str(e)))

    try:
        s2c = detect_motion_blur_consistency(make_consistent_blur_image())
        print("consistent blur raw detect:", s2c)
        assert s2c is not None and s2c["applicable"], f"expected blur detected, got {s2c}"
        assert s2c["circ_var"] < 0.35, f"expected low circular variance, got {s2c['circ_var']}"
    except AssertionError as e:
        failures.append(("consistent_blur_raw_detect", str(e)))

    try:
        run_case("consistent_blur_image (should score real-like/low)", make_consistent_blur_image(), expect_max_score=0.5)
    except AssertionError as e:
        failures.append(("consistent_blur_image_full", str(e)))

    try:
        s2i = detect_motion_blur_consistency(make_inconsistent_blur_image())
        print("inconsistent blur raw detect:", s2i)
        assert s2i is not None and s2i["applicable"], f"expected blur detected, got {s2i}"
        assert s2i["circ_var"] > 0.06, f"expected higher circular variance, got {s2i['circ_var']}"
    except AssertionError as e:
        failures.append(("inconsistent_blur_raw_detect", str(e)))

    try:
        run_case("inconsistent_blur_image (should score higher/AI-like than consistent)", make_inconsistent_blur_image())
    except AssertionError as e:
        failures.append(("inconsistent_blur_image_full", str(e)))

    try:
        # Relative check: inconsistent blur must score higher (more
        # suspicious) than consistent blur on the SAME underlying texture.
        rc = analyze_tca(make_consistent_blur_image())
        ri = analyze_tca(make_inconsistent_blur_image())
        s2_c = next(e["score"] for e in rc["evidence"] if e["name"] == "motion_blur_direction_consistency")
        s2_i = next(e["score"] for e in ri["evidence"] if e["name"] == "motion_blur_direction_consistency")
        print(f"\nconsistent S2={s2_c} vs inconsistent S2={s2_i}")
        assert s2_i > s2_c, f"expected inconsistent blur to score higher, got consistent={s2_c} inconsistent={s2_i}"
    except AssertionError as e:
        failures.append(("blur_relative_comparison", str(e)))

    try:
        tiny = np.zeros((20, 20, 3), dtype=np.uint8)
        r = analyze_tca(tiny)
        print("\n=== tiny_image (edge case) ===")
        print(r)
        assert r["status"] in ("success", "failure")
    except Exception as e:
        failures.append(("tiny_image_edge_case", str(e)))

    print("\n" + "=" * 60)
    if failures:
        print(f"{len(failures)} FAILURE(S):")
        for name, msg in failures:
            print(f"  [{name}] {msg}")
        sys.exit(1)
    else:
        print("All smoke tests passed.")

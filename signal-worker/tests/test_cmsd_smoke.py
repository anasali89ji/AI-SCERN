"""
Module 12 smoke tests for analyzers/cmsd.py (L23 CMSD).
Run directly: python -m tests.test_cmsd_smoke  (from signal-worker/)
"""
import sys
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, ".")
from analyzers.cmsd import analyze_cmsd, detect_copy_move, detect_splice_noise_inconsistency

_MIN_RANSAC_INLIERS_FOR_TEST = 6  # mirrors analyzers.cmsd._MIN_RANSAC_INLIERS


def make_textured_base(h=480, w=480, seed=0):
    rng = np.random.default_rng(seed)
    img = np.zeros((h, w, 3), dtype=np.uint8)
    # Layered noise + gradient + random shapes for texture (ORB needs corners)
    base = (rng.normal(128, 25, (h, w))).clip(0, 255)
    for c in range(3):
        img[:, :, c] = base.astype(np.uint8)
    pil = Image.fromarray(img)
    draw = ImageDraw.Draw(pil)
    rng2 = np.random.default_rng(seed + 1)
    for _ in range(40):
        x0, y0 = rng2.integers(0, w - 40), rng2.integers(0, h - 40)
        x1, y1 = x0 + rng2.integers(10, 40), y0 + rng2.integers(10, 40)
        color = tuple(int(v) for v in rng2.integers(0, 255, 3))
        draw.rectangle([x0, y0, x1, y1], outline=color, width=2)
        draw.ellipse([x0, y0, x1 - 5, y1 - 5], outline=color, width=1)
    return np.array(pil)


def make_copy_move_image(h=480, w=480, seed=1):
    img = make_textured_base(h, w, seed)
    # Copy a 100x100 patch with lots of structure and paste elsewhere,
    # far enough away to exceed _MIN_SEPARATION_PX.
    patch = img[60:160, 60:160].copy()
    img2 = img.copy()
    img2[300:400, 300:400] = patch
    return img2


def make_rotated_copy_move_image(h=480, w=480, seed=7, angle=25):
    """
    Regression test for a real bug caught during Module 12 smoke testing:
    an earlier version of detect_copy_move() pre-clustered matches by raw
    (dx, dy) translation before RANSAC, which silently missed rotated
    clones entirely (n_candidate_clusters=0) because a rotated patch's
    keypoint pairs each have a different displacement vector. RANSAC now
    runs directly on the full match set instead.
    """
    img = make_textured_base(h, w, seed)
    patch_pil = Image.fromarray(img[60:180, 60:180])
    rotated = patch_pil.rotate(angle, expand=True, resample=Image.BICUBIC)
    rot_arr = np.array(rotated)[:, :, :3]
    img2 = img.copy()
    ph, pw = rot_arr.shape[:2]
    img2[280:280 + ph, 280:280 + pw] = rot_arr
    return img2


def make_no_clone_image(h=480, w=480, seed=2):
    return make_textured_base(h, w, seed)


def make_spliced_noise_image(h=480, w=480, seed=3):
    img = make_textured_base(h, w, seed).astype(np.float32)
    rng = np.random.default_rng(seed + 10)
    # Inject a region with a much higher noise floor (simulating a splice
    # from a noisier/different source image).
    region = img[100:250, 100:250]
    region += rng.normal(0, 40, region.shape)
    img[100:250, 100:250] = region
    return np.clip(img, 0, 255).astype(np.uint8)


def make_clean_image(h=480, w=480, seed=4):
    return make_textured_base(h, w, seed)


def run_case(name, img, expect_min_score=None, expect_max_score=None):
    result = analyze_cmsd(img)
    score = result["score"]
    status = result["status"]
    print(f"\n=== {name} ===")
    print(f"status={status} score={score}")
    for ev in result["evidence"]:
        print(f"  - {ev['name']}: score={ev['score']:.3f} | {ev['detail'][:140]}")
    assert status in ("success", "failure"), f"unexpected status {status}"
    if expect_min_score is not None:
        assert score >= expect_min_score, f"{name}: expected score >= {expect_min_score}, got {score}"
    if expect_max_score is not None:
        assert score <= expect_max_score, f"{name}: expected score <= {expect_max_score}, got {score}"
    return result


if __name__ == "__main__":
    failures = []

    try:
        cm_img = make_copy_move_image()
        r = detect_copy_move(cm_img)
        print("copy-move raw detect result:", r)
        assert r is not None, "copy-move detector returned None on textured image"
        assert r["n_inliers"] >= 6, f"expected copy-move to be verified, got n_inliers={r['n_inliers']}"
    except AssertionError as e:
        failures.append(("copy_move_raw_detect", str(e)))

    try:
        run_case("copy_move_image (should score high)", make_copy_move_image(), expect_min_score=0.4)
    except AssertionError as e:
        failures.append(("copy_move_image_full", str(e)))

    try:
        run_case("no_clone_image (should score low-ish)", make_no_clone_image(), expect_max_score=0.5)
    except AssertionError as e:
        failures.append(("no_clone_image_full", str(e)))

    try:
        r = detect_copy_move(make_rotated_copy_move_image())
        print("rotated copy-move raw detect result:", r)
        assert r is not None
        assert r["n_inliers"] >= _MIN_RANSAC_INLIERS_FOR_TEST, (
            f"rotated clone not detected: n_inliers={r['n_inliers']} "
            f"(regression: pre-RANSAC translation clustering used to drop rotated clones entirely)"
        )
    except AssertionError as e:
        failures.append(("rotated_copy_move_raw_detect", str(e)))

    try:
        run_case("rotated_copy_move_image (should score high)", make_rotated_copy_move_image(), expect_min_score=0.4)
    except AssertionError as e:
        failures.append(("rotated_copy_move_image_full", str(e)))

    try:
        sp = detect_splice_noise_inconsistency(make_spliced_noise_image())
        print("splice raw detect result:", sp)
        assert sp is not None
        assert sp["outlier_frac"] > 0.05, f"expected noticeable outlier fraction, got {sp['outlier_frac']}"
    except AssertionError as e:
        failures.append(("splice_raw_detect", str(e)))

    try:
        run_case("spliced_noise_image (should score high on S2)", make_spliced_noise_image())
    except AssertionError as e:
        failures.append(("spliced_noise_image_full", str(e)))

    try:
        run_case("clean_image (should score low)", make_clean_image(), expect_max_score=0.5)
    except AssertionError as e:
        failures.append(("clean_image_full", str(e)))

    try:
        tiny = np.zeros((20, 20, 3), dtype=np.uint8)
        r = analyze_cmsd(tiny)
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

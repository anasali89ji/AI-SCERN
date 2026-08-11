"""
Aiscern Detection Worker — Layer 2 (DCT compression artifact) tests
"""
import io
import numpy as np
from PIL import Image
from scipy import ndimage

from analyzers.dct_compression import (
    analyze_dct_compression,
    blockiness_suspicion,
    quantization_table_check,
)


def _textured_image(seed=7, h=300, w=400):
    rng = np.random.RandomState(seed)
    base = rng.rand(h, w, 3) * 255
    return ndimage.gaussian_filter(base, sigma=(1.5, 1.5, 0)).astype(np.uint8)


def test_no_blockiness_when_never_jpeg_compressed():
    arr = _textured_image()
    score, detail, ratio = blockiness_suspicion(arr)
    assert ratio < 1.1
    assert score < 0.6


def test_blockiness_detected_on_real_low_quality_jpeg():
    arr = _textured_image()
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="JPEG", quality=15)
    buf.seek(0)
    jpeg_arr = np.array(Image.open(buf).convert("RGB"))

    score, detail, ratio = blockiness_suspicion(jpeg_arr)
    assert ratio > 1.5
    assert "block-grid discontinuity detected" in detail


def test_quantization_table_not_present_for_non_jpeg():
    arr = _textured_image()
    pil_img = Image.fromarray(arr)  # never saved/reloaded as JPEG
    score, detail, raw = quantization_table_check(pil_img)
    assert raw is None


def test_quantization_table_present_for_real_jpeg():
    arr = _textured_image()
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="JPEG", quality=70)
    buf.seek(0)
    pil_jpeg = Image.open(buf)

    score, detail, raw = quantization_table_check(pil_jpeg)
    assert raw is not None
    assert 0.0 <= raw <= 1.0


def test_full_layer_report_schema():
    arr = _textured_image()
    pil_img = Image.fromarray(arr)
    report = analyze_dct_compression(arr, pil_img)

    assert report["layer"] == 2
    assert report["status"] == "success"
    assert len(report["evidence"]) == 3
    assert 0.0 <= report["layerSuspicionScore"] <= 1.0
    artifact_types = {ev["artifactType"] for ev in report["evidence"]}
    assert artifact_types == {"dct_ac_kurtosis", "blocking_grid", "quantization_table"}


def test_degrades_gracefully_on_tiny_image():
    tiny = (np.random.rand(10, 10, 3) * 255).astype(np.uint8)
    pil_img = Image.fromarray(tiny)
    report = analyze_dct_compression(tiny, pil_img)

    assert report["status"] == "success"
    assert len(report["evidence"]) == 3
    for ev in report["evidence"]:
        assert ev["status"] == "inconclusive" or ev["status"] == "not_present"

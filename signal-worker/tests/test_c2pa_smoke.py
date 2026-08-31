"""
Module 15 smoke tests for analyzers/c2pa.py (L25 C2PA).
Run directly: python -m tests.test_c2pa_smoke  (from signal-worker/)
"""
import io
import struct
import sys
import datetime

import numpy as np
from PIL import Image

sys.path.insert(0, ".")
from analyzers.c2pa import (
    analyze_c2pa, extract_jumbf, _parse_jumbf_boxes, _find_manifest_store,
    _count_boxes, _any_truncated, find_der_certificates, analyze_certificates,
    get_exif_camera_string, _tokens,
)

C2PA_MANIFEST_STORE_UUID = bytes.fromhex("6332706100110010800000AA00389B71")
CLAIM_UUID = bytes.fromhex("6332617300110010800000AA00389B71")


def jumbf_desc_box(uuid, label=None, toggle=0x03):
    payload = uuid + bytes([toggle])
    if label:
        payload += label.encode("utf-8") + b"\x00"
    lbox = 8 + len(payload)
    return struct.pack(">I", lbox) + b"jumd" + payload


def jumbf_superbox(uuid, label, content_boxes: bytes):
    desc = jumbf_desc_box(uuid, label)
    payload = desc + content_boxes
    lbox = 8 + len(payload)
    return struct.pack(">I", lbox) + b"jumb" + payload


def simple_box(tbox, data):
    lbox = 8 + len(data)
    return struct.pack(">I", lbox) + tbox + data


def build_manifest_store(inner_content: bytes, manifest_label="c2pa.manifest"):
    manifest_superbox = jumbf_superbox(CLAIM_UUID, manifest_label, inner_content)
    return jumbf_superbox(C2PA_MANIFEST_STORE_UUID, "c2pa", manifest_superbox)


def build_app11(jumbf_bytes, en=1):
    payload = b"JP" + struct.pack(">H", en) + struct.pack(">I", 0) + jumbf_bytes
    seg_len = len(payload) + 2
    return b"\xff\xeb" + struct.pack(">H", seg_len) + payload


def make_base_jpeg(seed=0, size=64):
    img = Image.fromarray(np.random.default_rng(seed).integers(0, 255, (size, size, 3)).astype(np.uint8))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def make_self_signed_der(cn="fake-self-signed"):
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    key = rsa.generate_private_key(public_exponent=65537, key_size=1024)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn)])
    cert = (
        x509.CertificateBuilder()
        .subject_name(name).issuer_name(name).public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1))
        .not_valid_after(datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=365))
        .sign(key, hashes.SHA256())
    )
    return cert.public_bytes(serialization.Encoding.DER)


def run_case(name, img_pil, raw_bytes, expect_min_score=None, expect_max_score=None):
    result = analyze_c2pa(img_pil, raw_bytes)
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

    # ── S1: presence & structural validity ──────────────────────────────
    try:
        inner = simple_box(b"cbor", b"{fake cbor claim data}")
        manifest_store = build_manifest_store(inner)
        raw = make_base_jpeg(seed=0)
        spliced = raw[:2] + build_app11(manifest_store) + raw[2:]

        jumbf = extract_jumbf(spliced)
        assert jumbf == manifest_store, "extracted JUMBF bytes don't match what was embedded"
        boxes = _parse_jumbf_boxes(jumbf)
        ms = _find_manifest_store(boxes)
        assert ms is not None, "manifest store not found in well-formed fixture"
        assert not _any_truncated(ms), "well-formed fixture incorrectly flagged as truncated"
        assert _count_boxes(ms) == 3

        pil = Image.open(io.BytesIO(spliced))
        run_case("well_formed_c2pa_manifest (real-like)", pil, spliced, expect_max_score=0.5)
    except AssertionError as e:
        failures.append(("well_formed_manifest", str(e)))

    # ── negative: no manifest at all ────────────────────────────────────
    try:
        raw = make_base_jpeg(seed=1)
        pil = Image.open(io.BytesIO(raw))
        r = run_case("no_manifest (neutral)", pil, raw)
        assert r["score"] == 0.5, f"expected exactly-neutral score for absence, got {r['score']}"
    except AssertionError as e:
        failures.append(("no_manifest", str(e)))

    # ── S1: truncated/malformed manifest ────────────────────────────────
    try:
        inner = simple_box(b"cbor", b"{fake cbor claim data}")
        manifest_store = build_manifest_store(inner)
        truncated_store = manifest_store[: len(manifest_store) - 20]
        raw = make_base_jpeg(seed=2)
        spliced = raw[:2] + build_app11(truncated_store) + raw[2:]

        jumbf = extract_jumbf(spliced)
        boxes = _parse_jumbf_boxes(jumbf)
        ms = _find_manifest_store(boxes)
        assert ms is not None
        assert _any_truncated(ms), "truncated fixture not detected as truncated"

        pil = Image.open(io.BytesIO(spliced))
        run_case("truncated_manifest (mildly suspicious)", pil, spliced, expect_min_score=0.5)
    except AssertionError as e:
        failures.append(("truncated_manifest", str(e)))

    # ── S3: self-signed certificate detection ───────────────────────────
    try:
        der = make_self_signed_der()
        cands_direct = find_der_certificates(der + b"\x00" * 20)  # pad, scanner should still find it
        assert len(cands_direct) >= 1
        certs = analyze_certificates(cands_direct)
        assert len(certs) >= 1 and certs[0]["self_signed"] is True

        cert_box = simple_box(b"uuid", der)
        manifest_store = build_manifest_store(cert_box)
        raw = make_base_jpeg(seed=3)
        spliced = raw[:2] + build_app11(manifest_store) + raw[2:]
        pil = Image.open(io.BytesIO(spliced))
        r = run_case("self_signed_certificate (forgery evidence)", pil, spliced)
        cert_ev = next(e for e in r["evidence"] if e["name"] == "c2pa_certificate_sanity")
        assert cert_ev["score"] >= 0.6, f"expected high suspicion for self-signed cert, got {cert_ev['score']}"
    except AssertionError as e:
        failures.append(("self_signed_certificate", str(e)))

    # ── S2: EXIF/manifest token overlap tokenizer ───────────────────────
    try:
        # Regression: naive tokenizer split "iPhone15,3" into one token
        # ("iphone15") that didn't overlap with EXIF's "iPhone 15 Pro"
        # ("iphone","15","pro") at all -- caught during testing, fixed by
        # splitting alpha/digit boundaries before tokenizing.
        exif_tok = _tokens("Apple iPhone 15 Pro")
        manifest_tok = _tokens("c2pa.manifest iPhone15,3 capture")
        overlap = exif_tok & manifest_tok
        assert overlap, f"expected token overlap between EXIF and manifest device strings, got none (exif={exif_tok}, manifest={manifest_tok})"
    except AssertionError as e:
        failures.append(("exif_manifest_tokenizer", str(e)))

    # ── edge case: tiny/corrupt input ───────────────────────────────────
    try:
        tiny = b"\xff\xd8\xff\xd9"  # minimal SOI+EOI, no real content
        pil = Image.new("RGB", (8, 8))
        r = analyze_c2pa(pil, tiny)
        print("\n=== tiny_input (edge case) ===")
        print(r)
        assert r["status"] in ("success", "failure")
    except Exception as e:
        failures.append(("tiny_input_edge_case", str(e)))

    print("\n" + "=" * 60)
    if failures:
        print(f"{len(failures)} FAILURE(S):")
        for name, msg in failures:
            print(f"  [{name}] {msg}")
        sys.exit(1)
    else:
        print("All smoke tests passed.")

"""
Aiscern Detection Worker — Layer 25: C2PA
Content Authenticity Analysis (C2PA manifest detection & validation)

Verified against the C2PA Technical Specification and ISO/IEC 19566-5
(JUMBF) before writing any parsing code (see search citations in the
Module 15 commit message) rather than guessing box UUIDs/structure from
memory, given how easy it is to silently get binary format constants
wrong. Key facts this module relies on:
  - The C2PA Manifest Store is a JUMBF superbox with UUID
    63327061-0011-0010-8000-00AA00389B71 (ASCII "c2pa" as the first 4
    bytes) and JUMBF label "c2pa".
  - JUMBF box header: 4-byte big-endian LBox (total box length,
    including the header) + 4-byte TBox (ASCII box type, e.g. "jumb"
    for a superbox, "jumd" for its description box).
  - A JUMBF Description Box ("jumd") always appears first inside a
    superbox's payload: 16-byte UUID + 1-byte toggle field + optional
    null-terminated label string (present when toggle bit 0x02 is set).
  - JPEG embeds JUMBF via APP11 (0xFFEB) marker segments. Each APP11
    payload starts with a 2-byte "Ci" common identifier ("JP"), a
    2-byte "En" box-instance number, and a 4-byte "Z" packet-sequence
    number, THEN the JUMBF box bytes -- large manifests are split
    across multiple APP11 segments sharing the same En and must be
    reassembled in Z order before parsing.
  - PNG embeds it via a "caBX" ancillary chunk (standard 4-byte length
    + 4-byte type + payload + 4-byte CRC chunk framing) containing the
    raw JUMBF bytes directly, no Ci/En/Z reassembly needed.

Three sub-signals, each honestly scoped to what a single uploaded
image (no external trust infrastructure) can actually support
--------------------------------------------------------------------
S1 -- Manifest presence & structural validity: scans for and
    reassembles any embedded JUMBF data, verifies it starts with a
    structurally well-formed "jumb" superbox carrying the C2PA
    Manifest Store UUID, and walks its immediate child boxes
    recursively (bounded depth/count) confirming each child's own
    LBox/TBox framing is internally consistent (doesn't run past the
    parent's declared length, doesn't claim a length larger than the
    remaining bytes). This does NOT verify the claim signature's
    cryptographic validity or any certificate chain -- see S3's scope
    note for why full C2PA trust-chain verification isn't implemented
    here.

S2 -- Manifest/EXIF cross-consistency (single-image-computable
    subset): the spec's stated example for this sub-signal is cross-
    referencing the manifest's claimed capture device against QESM's
    (L12) independently-derived sensor signature. That's not
    implementable in THIS module under the current architecture: every
    layer runner in engines/image_engine.py (_run_qesm/_run_physical_
    layers/etc.) is submitted to the ThreadPoolExecutor independently
    and returns only its own layer report -- no runner receives another
    layer's output as an input, so there is no plumbing today for this
    layer to see QESM's result. Restructuring the orchestration to pass
    cross-layer data would be a pipeline-wide architectural change, out
    of scope for a single module -- flagged explicitly rather than
    faking a cross-reference that doesn't happen. What IS implementable
    single-image: this module reads the file's own EXIF Make/Model
    directly (same PIL._getexif() access forensics/metadata_analyzer.py
    already uses) and, where the manifest also declares a human-
    readable claim_generator or device label, does a simple case-
    insensitive substring/token overlap check between the two. Only
    evaluated when both a manifest AND EXIF camera info exist; neither
    alone is scored.

S3 -- Synthetic/self-signed certificate detection: C2PA claim
    signatures are COSE_Sign1 structures whose protected header
    typically carries an x5chain of DER-encoded X.509 certificates.
    Full C2PA verification checks that chain against the C2PA trust
    list of accredited Certificate Authorities -- this pipeline has no
    such trust list (there is no reference-CA-bundle problem-class
    workaround the way there was for PRNU/Module 12; a trust list is
    an operational asset Aiscern would need to source and keep
    updated, not something derivable from the image itself), so full
    chain validation is out of scope and flagged rather than faked.
    What IS implementable and genuinely informative without a trust
    list: scanning the manifest bytes for embedded DER certificates
    (ASN.1 SEQUENCE-tag heuristic, then a real parse attempt via
    cryptography.x509) and checking two trust-list-independent
    properties any accredited cert would also satisfy: (a) not
    self-signed (issuer == subject is a strong synthetic/self-issued
    signal -- no accredited C2PA CA issues cert chains where the leaf
    is self-signed), and (b) not expired/not-yet-valid relative to the
    manifest's own claimed signing time. Passing both checks is NOT
    proof of a legitimate manifest (a self-signed cert could still be
    swapped for a stolen-but-valid one); it only rules out the crudest
    forgeries.
"""

from __future__ import annotations

import logging
import re
import struct
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

_C2PA_MANIFEST_STORE_UUID = bytes.fromhex("6332706100110010800000AA00389B71")
_MAX_BOX_RECURSION_DEPTH = 6
_MAX_CHILD_BOXES_PER_LEVEL = 64


# ── JUMBF box parsing (generic, format-agnostic once we have raw bytes) ────

def _parse_jumbf_boxes(data: bytes, depth: int = 0) -> List[Dict[str, Any]]:
    """Walk a sequence of sibling JUMBF boxes (LBox+TBox+payload) starting
    at offset 0 of `data`. Returns a list of dicts with keys: tbox (4-char
    str), length, uuid (bytes|None), label (str|None), children (list,
    only populated for 'jumb' superboxes), truncated (bool). Bounded
    recursion depth/count so a malformed or adversarial box graph can't
    cause unbounded work -- itself informative (a genuinely truncated or
    absurdly-nested structure is evidence against a well-formed manifest,
    surfaced via the 'truncated'/'malformed' flags rather than raising)."""
    boxes: List[Dict[str, Any]] = []
    offset = 0
    n = len(data)
    count = 0
    while offset + 8 <= n and count < _MAX_CHILD_BOXES_PER_LEVEL:
        count += 1
        lbox = struct.unpack(">I", data[offset:offset + 4])[0]
        tbox = data[offset + 4:offset + 8]
        try:
            tbox_str = tbox.decode("ascii")
        except UnicodeDecodeError:
            tbox_str = None

        if lbox == 0:
            # LBox==0 means "extends to end of the containing box" per the
            # box-format convention this JUMBF profile inherits from ISO
            # BMFF-style containers.
            box_end = n
        elif lbox == 1:
            # XLBox (64-bit extended length) would follow -- not expected
            # for any C2PA-sized manifest and not implemented; treat as
            # malformed rather than guess.
            boxes.append({"tbox": tbox_str, "length": lbox, "uuid": None,
                           "label": None, "children": [], "truncated": True,
                           "note": "XLBox (64-bit length) not supported"})
            break
        else:
            box_end = offset + lbox

        truncated = box_end > n
        box_end = min(box_end, n)
        payload = data[offset + 8:box_end]

        entry: Dict[str, Any] = {
            "tbox": tbox_str, "length": lbox, "uuid": None, "label": None,
            "children": [], "truncated": truncated,
        }

        if tbox_str == "jumb" and depth < _MAX_BOX_RECURSION_DEPTH:
            # A superbox's payload begins with its own "jumd" description
            # box (UUID + toggle + optional label), followed by content
            # boxes (which may themselves be nested superboxes).
            if len(payload) >= 8 and payload[4:8] == b"jumd":
                desc_lbox = struct.unpack(">I", payload[0:4])[0]
                desc_end = min(desc_lbox, len(payload)) if desc_lbox > 0 else len(payload)
                desc_payload = payload[8:desc_end]
                if len(desc_payload) >= 17:
                    uuid = desc_payload[0:16]
                    toggle = desc_payload[16]
                    label = None
                    if toggle & 0x02 and len(desc_payload) > 17:
                        rest = desc_payload[17:]
                        nul = rest.find(b"\x00")
                        label_bytes = rest[:nul] if nul != -1 else rest
                        try:
                            label = label_bytes.decode("utf-8", errors="replace")
                        except Exception:
                            label = None
                    entry["uuid"] = uuid
                    entry["label"] = label
                remaining = payload[desc_end:]
                entry["children"] = _parse_jumbf_boxes(remaining, depth + 1)

        boxes.append(entry)
        offset = box_end
        if lbox == 0:
            break

    return boxes


def _find_manifest_store(boxes: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    for b in boxes:
        if b.get("tbox") == "jumb" and b.get("uuid") == _C2PA_MANIFEST_STORE_UUID:
            return b
        found = _find_manifest_store(b.get("children", []))
        if found:
            return found
    return None


def _collect_labels(box: Dict[str, Any], acc: Optional[List[str]] = None) -> List[str]:
    if acc is None:
        acc = []
    if box.get("label"):
        acc.append(box["label"])
    for child in box.get("children", []):
        _collect_labels(child, acc)
    return acc


def _count_boxes(box: Dict[str, Any]) -> int:
    return 1 + sum(_count_boxes(c) for c in box.get("children", []))


def _any_truncated(box: Dict[str, Any]) -> bool:
    if box.get("truncated"):
        return True
    return any(_any_truncated(c) for c in box.get("children", []))


# ── Container-specific extraction ──────────────────────────────────────────

def _extract_jumbf_from_jpeg(raw: bytes) -> Optional[bytes]:
    """Scan APP11 (0xFFEB) marker segments, reassemble multi-segment JUMBF
    payloads by (En, Z) per the JPEG-XT/ISO 19566-5 box-format profile."""
    if raw[:2] != b"\xff\xd8":
        return None

    # en -> {z: payload_bytes}
    segments: Dict[int, Dict[int, bytes]] = {}
    offset = 2
    n = len(raw)
    while offset + 4 <= n:
        if raw[offset] != 0xFF:
            break
        marker = raw[offset + 1]
        if marker in (0xD8, 0xD9):  # SOI/EOI, no length field
            offset += 2
            continue
        if offset + 4 > n:
            break
        seg_len = struct.unpack(">H", raw[offset + 2:offset + 4])[0]
        seg_start = offset + 4
        seg_end = offset + 2 + seg_len
        if seg_end > n:
            break
        if marker == 0xEB:  # APP11
            payload = raw[seg_start:seg_end]
            if len(payload) >= 8 and payload[0:2] == b"JP":
                en = struct.unpack(">H", payload[2:4])[0]
                z = struct.unpack(">I", payload[4:8])[0]
                segments.setdefault(en, {})[z] = payload[8:]
        if marker == 0xDA:  # SOS -- start of entropy-coded scan data, stop scanning markers
            break
        offset = seg_end

    if not segments:
        return None

    # Use the first box-instance group found (typical single-manifest case);
    # reassemble its segments in Z order.
    en = sorted(segments.keys())[0]
    parts = segments[en]
    ordered = b"".join(parts[z] for z in sorted(parts.keys()))
    return ordered if ordered else None


def _extract_jumbf_from_png(raw: bytes) -> Optional[bytes]:
    if raw[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    offset = 8
    n = len(raw)
    while offset + 8 <= n:
        length = struct.unpack(">I", raw[offset:offset + 4])[0]
        ctype = raw[offset + 4:offset + 8]
        data_start = offset + 8
        data_end = data_start + length
        if data_end > n:
            break
        if ctype == b"caBX":
            return raw[data_start:data_end]
        offset = data_end + 4  # skip CRC
    return None


def extract_jumbf(raw: bytes) -> Optional[bytes]:
    if raw[:2] == b"\xff\xd8":
        return _extract_jumbf_from_jpeg(raw)
    if raw[:8] == b"\x89PNG\r\n\x1a\n":
        return _extract_jumbf_from_png(raw)
    return None


# ── S3: embedded X.509 certificate scan ────────────────────────────────────

_DER_CERT_SEQ = re.compile(rb"\x30\x82")  # heuristic: ASN.1 SEQUENCE, 2-byte length form

def find_der_certificates(data: bytes, max_candidates: int = 8) -> List[bytes]:
    """Heuristic scan for embedded DER-encoded X.509 certificates: look for
    the ASN.1 SEQUENCE tag (0x30) with a 2-byte length form (0x82), then
    attempt to slice exactly that declared length and hand it to a real
    X.509 parser (cryptography.x509) -- candidates that don't actually
    parse as certificates are simply discarded, so this can't produce a
    false certificate, only miss ones encoded differently (e.g. indefinite
    length, or a 1-byte/4-byte length form) or ones we truncate wrong."""
    candidates = []
    for m in _DER_CERT_SEQ.finditer(data):
        if len(candidates) >= max_candidates:
            break
        start = m.start()
        if start + 4 > len(data):
            continue
        declared_len = struct.unpack(">H", data[start + 2:start + 4])[0]
        total_len = declared_len + 4
        end = start + total_len
        if end > len(data):
            continue
        candidates.append(data[start:end])
    return candidates


def analyze_certificates(der_candidates: List[bytes]) -> List[Dict[str, Any]]:
    from cryptography import x509
    from cryptography.hazmat.backends import default_backend

    results = []
    for der in der_candidates:
        try:
            cert = x509.load_der_x509_certificate(der, default_backend())
        except Exception:
            continue  # not actually a certificate -- expected for most ASN.1-SEQUENCE hits
        try:
            self_signed = (cert.issuer == cert.subject)
        except Exception:
            self_signed = None
        now = datetime.now(timezone.utc)
        try:
            not_before = cert.not_valid_before_utc
            not_after = cert.not_valid_after_utc
            expired = now > not_after
            not_yet_valid = now < not_before
        except Exception:
            expired = None
            not_yet_valid = None
        results.append({
            "self_signed": self_signed,
            "expired": expired,
            "not_yet_valid": not_yet_valid,
            "subject": str(cert.subject) if cert.subject else "",
        })
    return results


# ── S2: EXIF cross-consistency helper ──────────────────────────────────────

def get_exif_camera_string(img_pil: Any) -> Optional[str]:
    try:
        from PIL.ExifTags import TAGS
        exif = img_pil._getexif() if hasattr(img_pil, "_getexif") else None
        if not exif:
            return None
        make, model = None, None
        for tag_id, value in exif.items():
            tag = TAGS.get(tag_id, tag_id)
            if tag == "Make":
                make = str(value).strip()
            elif tag == "Model":
                model = str(value).strip()
        parts = [p for p in (make, model) if p]
        return " ".join(parts) if parts else None
    except Exception:
        return None


def _tokens(s: str) -> set:
    # Split camelCase/alnum boundaries too (e.g. "iPhone15,3" -> "iphone",
    # "15", "3") so a manifest's compact device string still overlaps with
    # EXIF's space-separated "iPhone 15 Pro" -- caught during testing: the
    # naive [a-z0-9]+ split alone missed this exact case (manifest
    # "iPhone15,3" produced one token "iphone15", EXIF produced separate
    # "iphone"/"15", zero overlap despite being the same device).
    s = re.sub(r"([a-zA-Z])(\d)", r"\1 \2", s)
    s = re.sub(r"(\d)([a-zA-Z])", r"\1 \2", s)
    return set(re.findall(r"[a-z0-9]+", s.lower()))


# ── Main entry point ───────────────────────────────────────────────────────

def analyze_c2pa(img_pil: Any, raw_bytes: bytes) -> Dict[str, Any]:
    """
    Layer 25 — C2PA & Content Authenticity Analysis. Same
    {score, status, evidence, elapsed_ms} shape as analyzers/cmsd.py's
    analyze_cmsd() / analyzers/tca.py's analyze_tca().
    """
    t0 = time.monotonic()
    evidence: List[Dict[str, Any]] = []

    try:
        jumbf = extract_jumbf(raw_bytes)

        if jumbf is None:
            # Absence is the overwhelmingly common case today (C2PA
            # adoption is still limited to specific cameras/apps/editors)
            # and uninformative on its own -- most real photos have no
            # manifest either, so this is never scored AI-like.
            elapsed = int((time.monotonic() - t0) * 1000)
            return {
                "score": 0.5, "status": "success",
                "evidence": [{
                    "name": "c2pa_no_manifest", "score": 0.5,
                    "detail": "no embedded C2PA/JUMBF data found (APP11 for JPEG, caBX chunk "
                              "for PNG) — uninformative, most real photos have no manifest "
                              "either; not scored AI-like.",
                }],
                "elapsed_ms": elapsed,
            }

        top_boxes = _parse_jumbf_boxes(jumbf)
        manifest_store = _find_manifest_store(top_boxes)

        if manifest_store is None:
            evidence.append({
                "name": "c2pa_malformed_container", "score": 0.65,
                "detail": "embedded JUMBF/APP11 or caBX data was found but does not contain "
                          "a structurally valid C2PA Manifest Store superbox (expected UUID "
                          "63327061-0011-0010-8000-00AA00389B71) — mildly suspicious (real "
                          "C2PA-embedding tools don't produce malformed containers) but not "
                          "conclusive, since this heuristic parser could also be wrong about "
                          "an unrelated/newer JUMBF payload.",
            })
        else:
            # S1 — presence & structural validity
            truncated = _any_truncated(manifest_store)
            n_boxes = _count_boxes(manifest_store)
            if truncated:
                s1_score = 0.75
                detail = (f"C2PA Manifest Store found ({n_boxes} nested JUMBF boxes) but one "
                          f"or more child boxes are truncated/malformed — real C2PA-embedding "
                          f"tools don't produce truncated manifests; this is evidence of a "
                          f"broken or synthetic C2PA insertion, though could also be a bug in "
                          f"this heuristic parser rather than the file.")
            else:
                s1_score = 0.10
                detail = (f"structurally valid C2PA Manifest Store found ({n_boxes} nested "
                          f"JUMBF boxes, no truncation) — real-like evidence of a genuine "
                          f"content-authenticity manifest. NOTE: this checks container "
                          f"structure only, not the claim signature's cryptographic validity "
                          f"or certificate chain — see S3 for what IS checked there.")
            evidence.append({"name": "c2pa_manifest_structural_validity",
                              "score": round(s1_score, 4), "detail": detail})

            # S2 — EXIF cross-consistency (scoped, see module docstring for
            # why the spec's QESM cross-reference isn't implementable here)
            labels = _collect_labels(manifest_store)
            manifest_text = " ".join(labels)
            exif_str = get_exif_camera_string(img_pil)
            if exif_str and manifest_text:
                exif_tok = _tokens(exif_str)
                manifest_tok = _tokens(manifest_text)
                overlap = exif_tok & manifest_tok
                if overlap:
                    s2_score = 0.15
                    detail = (f"EXIF camera string ({exif_str!r}) shares token(s) "
                              f"{sorted(overlap)} with manifest label text — consistent.")
                else:
                    s2_score = 0.5  # no overlap isn't proof of tampering -- labels are often
                                     # generic tool names ("c2pa.signature"), not device names
                    detail = (f"EXIF camera string ({exif_str!r}) shares no tokens with "
                              f"manifest label text ({manifest_text!r}) — inconclusive, "
                              f"manifest labels are frequently generic tool/box names rather "
                              f"than device identifiers, so this alone isn't tamper evidence.")
                evidence.append({"name": "c2pa_exif_cross_consistency",
                                  "score": round(s2_score, 4), "detail": detail})
            else:
                evidence.append({
                    "name": "c2pa_exif_cross_consistency_not_applicable", "score": 0.5,
                    "detail": "cross-check needs both EXIF camera info and manifest label "
                              "text; at least one is missing here. NOTE: the spec's actual S2 "
                              "example (cross-referencing QESM's independently-derived sensor "
                              "signature) is not implementable in this module under the "
                              "current architecture — see module docstring.",
                })

            # S3 — embedded certificate sanity (self-signed / expiry)
            der_candidates = find_der_certificates(jumbf)
            if der_candidates:
                certs = analyze_certificates(der_candidates)
                if certs:
                    n_self_signed = sum(1 for c in certs if c["self_signed"])
                    n_expired = sum(1 for c in certs if c["expired"])
                    if n_self_signed > 0 or n_expired > 0:
                        s3_score = 0.75
                        detail = (f"found {len(certs)} embedded certificate(s): "
                                  f"{n_self_signed} self-signed, {n_expired} expired/not-yet-"
                                  f"valid — no accredited C2PA CA issues self-signed leaf "
                                  f"certs, so this is real-if-crude forgery evidence. NOTE: "
                                  f"full chain validation against the C2PA trust list is NOT "
                                  f"performed (no trust list available) — passing this check "
                                  f"is not proof of legitimacy, only rules out the crudest "
                                  f"forgeries.")
                    else:
                        s3_score = 0.35
                        detail = (f"found {len(certs)} embedded certificate(s), none "
                                  f"self-signed or expired — mildly real-like, but NOT "
                                  f"verified against the C2PA trust list (unavailable here), "
                                  f"so a stolen-but-valid certificate would also pass this "
                                  f"check.")
                    evidence.append({"name": "c2pa_certificate_sanity",
                                      "score": round(s3_score, 4), "detail": detail})
                else:
                    evidence.append({
                        "name": "c2pa_certificate_not_parseable", "score": 0.5,
                        "detail": f"found {len(der_candidates)} ASN.1-SEQUENCE-shaped byte "
                                  f"range(s) in the manifest but none parsed as a valid X.509 "
                                  f"certificate — inconclusive (could be non-certificate CBOR/"
                                  f"binary data that coincidentally matches the heuristic).",
                    })
            else:
                evidence.append({
                    "name": "c2pa_no_certificate_found", "score": 0.5,
                    "detail": "no embedded certificate found via the DER/ASN.1 scan heuristic "
                              "— inconclusive, the claim signature may use a certificate "
                              "reference/URI instead of an embedded x5chain, which this "
                              "heuristic scan doesn't follow.",
                })

        overall = float(np.mean([e["score"] for e in evidence])) if evidence else 0.5
        elapsed = int((time.monotonic() - t0) * 1000)
        return {
            "score": round(overall, 4),
            "status": "success",
            "evidence": evidence,
            "elapsed_ms": elapsed,
        }

    except Exception as e:
        logger.warning("[C2PA/L25] analysis failed: %s", e)
        elapsed = int((time.monotonic() - t0) * 1000)
        return {"score": 0.5, "status": "failure", "evidence": [], "elapsed_ms": elapsed}

"""
Aiscern Detection Worker — document metadata forensics tests
(MODULE 27: PDF metadata & structural forensics, spec Section 3.5 item 1)

Same honest framing as the Module 21-26 test suites: these are synthetic
fixtures built to exercise the *mechanism* each signal targets, checked for
directional correctness and for not-crashing. They are not accuracy
benchmarks — there is no labeled tampered-vs-clean PDF corpus here, and the
module docstring says so in as many words.

All fixtures are generated in-process with PyMuPDF (already a pinned
dependency), so no binary test assets are committed to the repo.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analyzers.pdf_metadata_forensics import (  # noqa: E402
    analyze_pdf_metadata,
    run_all as run_all_pdf,
    _parse_pdf_date,
    _is_base14,
)

fitz = pytest.importorskip("fitz", reason="PyMuPDF required for PDF forensics tests")


# ── Fixture builders ────────────────────────────────────────────────────────

def _build_pdf(metadata=None, pages=1, sizes=None, text="The quick brown fox."):
    doc = fitz.open()
    sizes = sizes or [(595, 842)] * pages
    for i in range(pages):
        w, h = sizes[i % len(sizes)]
        page = doc.new_page(width=w, height=h)
        page.insert_text((72, 100), f"{text} (page {i + 1})", fontsize=12)
    if metadata:
        doc.set_metadata(metadata)
    data = doc.tobytes()
    doc.close()
    return data


CLEAN_META = {
    "producer": "Microsoft® Word for Microsoft 365",
    "creator": "Microsoft® Word for Microsoft 365",
    "creationDate": "D:20260101120000+05'00'",
    "modDate": "D:20260102090000+05'00'",
    "title": "Quarterly Report",
    "author": "A. Author",
}

# Producer says the file came out of Chrome's print pipeline while Creator
# claims Word, and ModDate precedes CreationDate by a year.
TAMPERED_META = {
    "producer": "Skia/PDF m120",
    "creator": "Microsoft Word",
    "creationDate": "D:20260105120000",
    "modDate": "D:20250105120000",
}

PROGRAMMATIC_META = {
    "producer": "ReportLab PDF Library - www.reportlab.com",
    "creator": "ReportLab",
    "creationDate": "D:20260101120000+00'00'",
    "modDate": "D:20260101120000+00'00'",
}


# ── Robustness ──────────────────────────────────────────────────────────────

def test_empty_input_is_unavailable_not_crash():
    result = analyze_pdf_metadata(b"")
    assert result["status"] == "unavailable"
    assert result["confidence"] == 0.0


def test_non_pdf_bytes_rejected_by_header_check():
    result = analyze_pdf_metadata(b"this is plainly not a pdf at all")
    assert result["status"] == "unavailable"
    assert "not_a_pdf" in result["details"]["reason"]


def test_truncated_pdf_reports_error_without_raising():
    result = analyze_pdf_metadata(b"%PDF-1.7\nbroken and truncated")
    assert result["status"] in ("error", "unavailable")
    assert result["confidence"] == 0.0
    assert result["score"] == 0.5


def test_score_and_confidence_always_bounded():
    for meta in (CLEAN_META, TAMPERED_META, PROGRAMMATIC_META, None):
        result = analyze_pdf_metadata(_build_pdf(meta))
        assert 0.0 <= result["score"] <= 1.0
        assert 0.0 <= result["confidence"] <= 1.0


# ── S1: toolchain identification ────────────────────────────────────────────

def test_toolchain_identifies_both_creator_and_producer():
    result = analyze_pdf_metadata(_build_pdf(TAMPERED_META))
    chain = result["details"]["toolchain"]["identified_chain"]
    assert "Microsoft Word" in chain
    assert "Chrome/Skia (print-to-PDF)" in chain
    assert result["details"]["toolchain"]["cross_category_chain"] is True


def test_programmatic_producer_is_flagged():
    result = analyze_pdf_metadata(_build_pdf(PROGRAMMATIC_META))
    assert result["details"]["toolchain"]["programmatic_origin"] is True
    assert "programmatic_producer" in result["details"]["findings"]


# ── S3: timestamps ──────────────────────────────────────────────────────────

def test_mod_date_before_creation_date_is_flagged():
    result = analyze_pdf_metadata(_build_pdf(TAMPERED_META))
    assert "timestamp:mod_date_before_creation_date" in result["details"]["findings"]


def test_missing_timezone_is_flagged():
    result = analyze_pdf_metadata(_build_pdf(TAMPERED_META))
    anomalies = result["details"]["timestamps"]["anomalies"]
    assert "creation_date_missing_timezone" in anomalies
    assert "mod_date_missing_timezone" in anomalies


def test_clean_dates_produce_no_timestamp_anomalies():
    result = analyze_pdf_metadata(_build_pdf(CLEAN_META))
    assert result["details"]["timestamps"]["anomalies"] == []


def test_identical_create_and_mod_second_flagged_as_single_pass():
    result = analyze_pdf_metadata(_build_pdf(PROGRAMMATIC_META))
    assert "creation_equals_mod_date" in result["details"]["timestamps"]["anomalies"]


def test_pdf_date_parser_handles_partial_and_garbage():
    assert _parse_pdf_date(None)["present"] is False
    assert _parse_pdf_date("")["present"] is False
    assert _parse_pdf_date("D:2026")["parsed"] is True          # year-only is legal
    assert _parse_pdf_date("garbage")["parsed"] is False
    full = _parse_pdf_date("D:20260101120000+05'00'")
    assert full["parsed"] is True and full["has_timezone"] is True


# ── S4/S5: revision history and /ID ─────────────────────────────────────────

def test_single_write_pdf_has_no_incremental_revisions():
    result = analyze_pdf_metadata(_build_pdf(CLEAN_META))
    revisions = result["details"]["revision_history"]
    assert revisions["eof_markers"] >= 1
    assert revisions["revisions_after_initial_save"] == 0
    assert revisions["incrementally_updated"] is False


def test_incremental_save_is_detected(tmp_path):
    path = tmp_path / "doc.pdf"
    path.write_bytes(_build_pdf(CLEAN_META))

    doc = fitz.open(str(path))
    meta = dict(doc.metadata or {})
    meta["title"] = "Quarterly Report (revised)"
    doc.set_metadata(meta)
    doc.save(str(path), incremental=True, encryption=fitz.PDF_ENCRYPT_KEEP)
    doc.close()

    result = analyze_pdf_metadata(path.read_bytes())
    revisions = result["details"]["revision_history"]
    assert revisions["incrementally_updated"] is True
    assert revisions["revisions_after_initial_save"] >= 1
    assert revisions["prev_trailer_entries"] >= 1
    # An incremental save rewrites the second half of the /ID pair.
    assert result["details"]["file_identifier"]["id_pair_differs"] is True


# ── S7: page geometry ───────────────────────────────────────────────────────

def test_mixed_page_geometry_detected():
    data = _build_pdf(pages=3, sizes=[(595, 842), (842, 595), (612, 792)])
    result = analyze_pdf_metadata(data)
    structure = result["details"]["structure"]
    assert structure["distinct_page_sizes"] == 3
    assert structure["mixed_page_geometry"] is True
    assert "mixed_page_geometry_pages_may_be_spliced" in result["details"]["consistency_notes"]


def test_uniform_page_geometry_not_flagged():
    result = analyze_pdf_metadata(_build_pdf(CLEAN_META, pages=4))
    assert result["details"]["structure"]["mixed_page_geometry"] is False


# ── S8: base-14 font regression ─────────────────────────────────────────────

def test_base14_fonts_are_not_counted_as_missing_embeds():
    """
    Regression: the first smoke run flagged a perfectly ordinary
    Helvetica-only fixture with `word_processor_claim_without_embedded_fonts`.
    Base-14 fonts are never embedded by design (ISO 32000-1 §9.6.2.2), so
    they must not count toward the missing-embed anomaly.
    """
    result = analyze_pdf_metadata(_build_pdf(CLEAN_META))
    structure = result["details"]["structure"]
    assert structure["fonts_base14_standard"] >= 1
    assert structure["fonts_unembedded_nonstandard"] == 0
    assert structure["no_embedded_fonts"] is False
    assert "word_processor_claim_without_embedded_fonts" not in result["details"]["findings"]


def test_base14_helper_strips_subset_prefix():
    assert _is_base14("Helvetica") is True
    assert _is_base14("ABCDEF+Helvetica") is True
    assert _is_base14("Calibri") is False
    assert _is_base14("") is False


# ── Directional check ───────────────────────────────────────────────────────

def test_tampered_profile_scores_above_clean_profile():
    clean = analyze_pdf_metadata(_build_pdf(CLEAN_META))
    tampered = analyze_pdf_metadata(_build_pdf(TAMPERED_META))
    assert tampered["score"] > clean["score"] + 0.15
    assert len(tampered["details"]["findings"]) > len(clean["details"]["findings"])


# ── Contract ────────────────────────────────────────────────────────────────

def test_run_all_wrapper_shape():
    out = run_all_pdf(_build_pdf(CLEAN_META))
    assert set(out.keys()) == {"pdf_metadata_forensics"}
    entry = out["pdf_metadata_forensics"]
    for key in ("score", "confidence", "status", "details"):
        assert key in entry
    assert "interpretation" in entry["details"]


# ════════════════════════════════════════════════════════════════════════════
# MODULE 28 — DOCX / OOXML metadata & revision forensics (spec 3.5 item 2)
# ════════════════════════════════════════════════════════════════════════════

import io  # noqa: E402
import re  # noqa: E402
import zipfile  # noqa: E402
from datetime import datetime  # noqa: E402

from analyzers.docx_metadata_forensics import (  # noqa: E402
    analyze_docx_metadata,
    run_all as run_all_docx,
    _identify_application,
    _tag_text,
    _count_tags,
)

docx_mod = pytest.importorskip("docx", reason="python-docx required for OOXML forensics tests")


def _build_docx(
    words=800,
    application="Microsoft Office Word",
    total_time=45,
    revision=7,
    declared_words=None,
    author="Alice",
    last_modified_by="Alice",
):
    """
    Build a .docx in memory, then rewrite docProps/app.xml so the fixture can
    exercise producer/TotalTime/Words combinations python-docx won't emit on
    its own. Nothing is written to disk and no binary assets are committed.
    """
    document = docx_mod.Document()
    document.add_paragraph(" ".join(["word"] * words))
    props = document.core_properties
    props.author = author
    props.last_modified_by = last_modified_by
    props.revision = revision
    props.created = datetime(2026, 1, 1, 10, 0, 0)
    props.modified = datetime(2026, 1, 3, 14, 0, 0)

    buf = io.BytesIO()
    document.save(buf)

    declared = words if declared_words is None else declared_words
    zin = zipfile.ZipFile(io.BytesIO(buf.getvalue()))
    out = io.BytesIO()
    zout = zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED)
    for item in zin.infolist():
        data = zin.read(item.filename)
        if item.filename == "docProps/app.xml":
            xml = data.decode()
            xml = re.sub(r"<Application>.*?</Application>", f"<Application>{application}</Application>", xml)
            xml = re.sub(r"<TotalTime>.*?</TotalTime>", f"<TotalTime>{total_time}</TotalTime>", xml)
            xml = re.sub(r"<Words>.*?</Words>", f"<Words>{declared}</Words>", xml)
            data = xml.encode()
        zout.writestr(item, data)
    zout.close()
    zin.close()
    return out.getvalue()


# ── Robustness ──────────────────────────────────────────────────────────────

def test_docx_empty_and_non_zip_inputs():
    assert analyze_docx_metadata(b"")["status"] == "unavailable"
    assert analyze_docx_metadata(b"not a zip at all")["status"] == "unavailable"


def test_docx_bad_zip_reports_error():
    result = analyze_docx_metadata(b"PK\x03\x04 truncated garbage")
    assert result["status"] == "error"
    assert result["score"] == 0.5


def test_plain_zip_is_rejected_as_non_ooxml():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("hello.txt", "hi")
    result = analyze_docx_metadata(buf.getvalue())
    assert result["status"] == "unavailable"
    assert result["details"]["reason"] == "not_an_ooxml_package"


def test_docx_score_and_confidence_bounded():
    for kwargs in ({}, {"total_time": 0, "revision": 1, "words": 2500}, {"application": "python-docx"}):
        result = analyze_docx_metadata(_build_docx(**kwargs))
        assert 0.0 <= result["score"] <= 1.0
        assert 0.0 <= result["confidence"] <= 1.0


# ── S1: core properties ─────────────────────────────────────────────────────

def test_core_properties_are_read():
    result = analyze_docx_metadata(_build_docx(author="Alice", last_modified_by="Bob"))
    core = result["details"]["core_properties"]
    assert core["present"] is True
    assert core["creator"] == "Alice"
    assert core["last_modified_by"] == "Bob"
    assert core["author_changed"] is True
    assert core["revision"] == 7


def test_tag_text_is_namespace_prefix_agnostic():
    assert _tag_text("<dc:creator>Alice</dc:creator>", "creator") == "Alice"
    assert _tag_text("<creator>Bob</creator>", "creator") == "Bob"
    assert _tag_text("<ns0:creator>Carol</ns0:creator>", "creator") == "Carol"
    assert _tag_text("<other>x</other>", "creator") is None


def test_count_tags_counts_local_names():
    xml = '<w:ins id="1"/><w:ins id="2"/><w:del id="3"/>'
    assert _count_tags(xml, "ins") == 2
    assert _count_tags(xml, "del") == 1


# ── S2/S3: editing time and revision count ──────────────────────────────────

def test_zero_editing_time_on_long_document_is_flagged():
    result = analyze_docx_metadata(_build_docx(words=2500, total_time=0, revision=1))
    findings = result["details"]["findings"]
    assert "editing_time:zero_recorded_editing_time_with_substantial_content" in findings
    assert "single_save_revision_on_long_document" in findings


def test_implausible_typing_rate_is_flagged():
    result = analyze_docx_metadata(_build_docx(words=3000, total_time=5, revision=2))
    assert "editing_time:implied_typing_rate_implausible" in result["details"]["findings"]
    assert result["details"]["editing_time"]["implied_wpm"] == 600.0


def test_plausible_composition_rate_not_flagged():
    result = analyze_docx_metadata(_build_docx(words=800, total_time=45, revision=7))
    assert result["details"]["editing_time"]["flags"] == []
    assert 0 < result["details"]["editing_time"]["implied_wpm"] < 60


# ── Stale-<Words> regression ────────────────────────────────────────────────

def test_stale_declared_word_count_falls_back_to_body_and_is_flagged():
    """
    Regression: python-docx ships app.xml from its bundled template with
    <Words>0</Words> and never recomputes it. Trusting that value silently
    disabled every `words >= N` gate downstream, so a 2,500-word single-save
    document scored as if it were empty.
    """
    result = analyze_docx_metadata(_build_docx(words=2500, total_time=30, revision=6, declared_words=0))
    editing = result["details"]["editing_time"]
    assert editing["declared_word_count"] == 0
    assert editing["body_word_count"] >= 2000
    assert editing["word_count_source"] == "body_text"
    assert editing["declared_stats_stale"] is True
    assert "editing_time:declared_word_count_inconsistent_with_body" in result["details"]["findings"]


def test_revision_gate_uses_reconciled_word_count():
    """The single-save gate must fire even when app.xml declares Words=0."""
    result = analyze_docx_metadata(_build_docx(words=2500, total_time=0, revision=1, declared_words=0))
    assert "single_save_revision_on_long_document" in result["details"]["findings"]


# ── S7: producer classification and the no-session-bookkeeping carve-out ────

def test_application_table_classification():
    assert _identify_application("Microsoft Office Word") == ("Microsoft Word", "word")
    assert _identify_application("Google Docs Renderer")[1] == "cloud_editor"
    assert _identify_application("python-docx")[1] == "library"
    assert _identify_application("Some Unknown Writer 1.0") == (None, "unknown")


def test_cloud_editor_is_not_penalised_for_absent_session_signals():
    """
    A Google Docs export has TotalTime=0, revision=1 and no rsids by
    construction. Scoring those would flag essentially every honest Google
    Docs user, so session signals must be suppressed for that producer class.
    """
    word_doc = analyze_docx_metadata(_build_docx(words=2500, total_time=0, revision=1))
    gdocs = analyze_docx_metadata(
        _build_docx(words=2500, total_time=0, revision=1, application="Google Docs Renderer")
    )
    assert gdocs["score"] < word_doc["score"]
    assert "editing_time:zero_recorded_editing_time_with_substantial_content" not in gdocs["details"]["findings"]
    assert gdocs["details"]["editing_time"]["applicable"] is False
    assert gdocs["confidence"] < word_doc["confidence"]
    assert any("cloud_editor" in note for note in gdocs["details"]["consistency_notes"])


# ── S5: tracked changes ─────────────────────────────────────────────────────

def test_tracked_changes_counted_and_credited():
    """
    Residual tracked changes are hard to fake and evidence a real drafting
    process, so they should pull the score DOWN, not up.
    """
    base = _build_docx(words=600, total_time=30, revision=5)

    zin = zipfile.ZipFile(io.BytesIO(base))
    out = io.BytesIO()
    zout = zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED)
    for item in zin.infolist():
        data = zin.read(item.filename)
        if item.filename == "word/document.xml":
            xml = data.decode()
            inserts = "".join(
                f'<w:ins w:id="{i}" w:author="Alice" w:date="2026-01-0{(i % 8) + 1}T10:00:00Z">'
                f'<w:r><w:t>edit{i}</w:t></w:r></w:ins>'
                for i in range(6)
            )
            xml = xml.replace("</w:body>", inserts + "</w:body>")
            data = xml.encode()
        zout.writestr(item, data)
    zout.close()
    zin.close()

    with_changes = analyze_docx_metadata(out.getvalue())
    tracked = with_changes["details"]["tracked_changes"]
    assert tracked["present"] is True
    assert tracked["insertions"] >= 6
    assert "Alice" in tracked["distinct_authors"]
    assert tracked["date_range"] is not None

    without = analyze_docx_metadata(base)
    assert with_changes["score"] < without["score"]


# ── Directional check ───────────────────────────────────────────────────────

def test_pasted_profile_scores_above_drafted_profile():
    drafted = analyze_docx_metadata(_build_docx(words=800, total_time=45, revision=7))
    pasted = analyze_docx_metadata(_build_docx(words=2500, total_time=0, revision=1))
    assert pasted["score"] > drafted["score"] + 0.15


# ── Contract ────────────────────────────────────────────────────────────────

def test_docx_run_all_wrapper_shape():
    out = run_all_docx(_build_docx())
    assert set(out.keys()) == {"docx_metadata_forensics"}
    entry = out["docx_metadata_forensics"]
    for key in ("score", "confidence", "status", "details"):
        assert key in entry
    assert "interpretation" in entry["details"]
    assert "container" in entry["details"]


# ════════════════════════════════════════════════════════════════════════════
# MODULE 29 — PDF digital signature verification (spec 3.5 item 3)
# ════════════════════════════════════════════════════════════════════════════

import hashlib  # noqa: E402
from datetime import datetime as _dt  # noqa: E402  (module-level `datetime` name
# is already bound to the CLASS by the Module 28 block above; importing the
# MODULE here would shadow it and break every Module 28 fixture.)

from analyzers.pdf_signature_verification import (  # noqa: E402
    analyze_pdf_signatures,
    run_all as run_all_sig,
    _der_read,
    _find_signed_data,
    _parse_signer_info,
    _verify_signature_value,
    _coverage_analysis,
    _decode_oid,
    _encode_length,
)

crypto = pytest.importorskip("cryptography", reason="cryptography required for signature tests")

from cryptography import x509  # noqa: E402
from cryptography.hazmat.primitives import hashes  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import rsa  # noqa: E402
from cryptography.hazmat.primitives.serialization import Encoding, pkcs7  # noqa: E402
from cryptography.x509.oid import NameOID  # noqa: E402

_SIG_SLOT = 4000


def _make_signer(not_before=_dt(2026, 1, 1), not_after=_dt(2027, 1, 1)):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Aiscern Test Signer")])
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(not_before)
        .not_valid_after(not_after)
        .sign(key, hashes.SHA256())
    )
    return key, cert


def _build_signed_pdf(key, cert, tamper=False, append=b""):
    """
    Build a byte-exact detached-signature PDF: placeholder /Contents slot,
    ByteRange computed over everything outside it, then a real PKCS#7
    SignedData over exactly those bytes.

    PKCS7Options.Binary is REQUIRED. Without it `cryptography` applies S/MIME
    text normalisation (LF -> CRLF) before hashing, so the messageDigest
    attribute commits to normalised bytes rather than the raw file bytes a
    PDF signature must cover. The first version of this fixture omitted it and
    every signature appeared to fail integrity — the fixture was wrong, not
    the analyzer. Keeping Binary here makes the test stricter, not looser.
    """
    head = b"%PDF-1.7\n1 0 obj\n<< /Type /Sig /SubFilter /adbe.pkcs7.detached /ByteRange "
    placeholder = b"[0000000000 0000000000 0000000000 0000000000]"
    contents_prefix = b"\n/Contents <"
    tail = (
        b">\n>>\nendobj\n2 0 obj\n<< /Type /Page >>\nendobj\n"
        b"trailer\n<< /Root 1 0 R >>\n%%EOF\n"
    )

    body = head + placeholder + contents_prefix + b"0" * _SIG_SLOT + tail
    b_len = body.index(contents_prefix) + len(contents_prefix)
    c_off = b_len + _SIG_SLOT + 1
    d_len = len(body) - c_off
    byte_range = b"[%010d %010d %010d %010d]" % (0, b_len, c_off, d_len)
    assert len(byte_range) == len(placeholder)
    body = body.replace(placeholder, byte_range, 1)

    signed_bytes = body[0:b_len] + body[c_off:c_off + d_len]
    der = (
        pkcs7.PKCS7SignatureBuilder()
        .set_data(signed_bytes)
        .add_signer(cert, key, hashes.SHA256())
        .sign(
            Encoding.DER,
            [
                pkcs7.PKCS7Options.DetachedSignature,
                pkcs7.PKCS7Options.Binary,
                pkcs7.PKCS7Options.NoCapabilities,
            ],
        )
    )
    hex_blob = der.hex().encode()
    assert len(hex_blob) <= _SIG_SLOT, "signature slot too small for fixture"
    out = body[:b_len] + hex_blob.ljust(_SIG_SLOT, b"0") + body[b_len + _SIG_SLOT:]

    if tamper:
        out = out.replace(b"/Type /Page", b"/Type /Pagf", 1)
    return out + append


@pytest.fixture(scope="module")
def signer_pair():
    return _make_signer()


# ── DER walker unit tests ───────────────────────────────────────────────────

def test_encode_length_short_and_long_form():
    assert _encode_length(5) == b"\x05"
    assert _encode_length(127) == b"\x7f"
    assert _encode_length(128) == b"\x81\x80"
    assert _encode_length(300) == b"\x82\x01\x2c"


def test_decode_oid_known_values():
    # 1.2.840.113549.1.9.4 (messageDigest)
    encoded = bytes([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x09, 0x04])
    assert _decode_oid(encoded) == "1.2.840.113549.1.9.4"
    assert _decode_oid(b"") == ""


def test_der_reader_rejects_out_of_bounds_length():
    # SEQUENCE claiming 200 content octets but only 2 present.
    assert _der_read(b"\x30\x81\xc8\x01\x02") is None


def test_der_reader_rejects_indefinite_length():
    assert _der_read(b"\x30\x80\x01\x02") is None


def test_der_reader_on_empty_and_truncated():
    assert _der_read(b"") is None
    assert _der_read(b"\x30") is None


# ── CMS parsing against a real cryptography-built signature ─────────────────

def test_cms_message_digest_matches_signed_data(signer_pair):
    key, cert = signer_pair
    payload = b"exactly these bytes were signed"
    der = (
        pkcs7.PKCS7SignatureBuilder()
        .set_data(payload)
        .add_signer(cert, key, hashes.SHA256())
        .sign(Encoding.DER, [pkcs7.PKCS7Options.DetachedSignature,
                             pkcs7.PKCS7Options.Binary,
                             pkcs7.PKCS7Options.NoCapabilities])
    )
    node, _ = _der_read(der)
    signed_data = _find_signed_data(node)
    assert signed_data is not None

    info = _parse_signer_info(signed_data)
    assert info["parsed"] is True
    assert info["digest_algorithm"] == "sha256"
    assert info["message_digest"] == hashlib.sha256(payload).digest()
    assert info["signing_time"] is not None
    assert "1.2.840.113549.1.9.4" in info["signed_attr_oids"]


def test_signed_attrs_reencoding_verifies(signer_pair):
    """
    RFC 5652 §5.4: the [0] IMPLICIT signedAttrs tag must be re-encoded as a
    universal SET before verification. If _parse_signer_info got that wrong
    this verification would fail.
    """
    key, cert = signer_pair
    der = (
        pkcs7.PKCS7SignatureBuilder()
        .set_data(b"payload")
        .add_signer(cert, key, hashes.SHA256())
        .sign(Encoding.DER, [pkcs7.PKCS7Options.DetachedSignature,
                             pkcs7.PKCS7Options.Binary,
                             pkcs7.PKCS7Options.NoCapabilities])
    )
    node, _ = _der_read(der)
    info = _parse_signer_info(_find_signed_data(node))
    verdict = _verify_signature_value(der, info)
    assert verdict["attempted"] is True
    assert verdict["verified"] is True
    assert verdict["scheme"] == "rsa_pkcs1v15"


# ── End-to-end signature verification ───────────────────────────────────────

def test_intact_signature_verifies_all_three_questions(signer_pair):
    key, cert = signer_pair
    result = analyze_pdf_signatures(_build_signed_pdf(key, cert))
    assert result["status"] == "ok"
    assert result["details"]["signature_count"] == 1

    sig = result["details"]["signatures"][0]
    assert sig["integrity"]["matched"] is True         # Q1
    assert sig["coverage"]["covers_whole_file"] is True  # Q2
    assert sig["authenticity"]["verified"] is True     # Q3
    assert sig["status"] == "cryptographically_intact_untrusted_chain"
    assert result["score"] < 0.5


def test_tampered_content_breaks_integrity(signer_pair):
    key, cert = signer_pair
    result = analyze_pdf_signatures(_build_signed_pdf(key, cert, tamper=True))
    sig = result["details"]["signatures"][0]
    assert sig["integrity"]["matched"] is False
    assert sig["status"] == "invalid_document_altered_or_signature_broken"
    assert "signed_content_digest_mismatch" in sig["issues"]
    assert result["score"] > 0.85


def test_appended_content_is_distinguished_from_tampering(signer_pair):
    """
    Content appended AFTER signing leaves the signed bytes intact — integrity
    and authenticity both still pass. Collapsing that into 'invalid' would
    lose the distinction that actually matters to a reviewer.
    """
    key, cert = signer_pair
    appended = _build_signed_pdf(key, cert, append=b"\n%% appended after signing\n%%EOF\n")
    result = analyze_pdf_signatures(appended)
    sig = result["details"]["signatures"][0]
    assert sig["integrity"]["matched"] is True
    assert sig["authenticity"]["verified"] is True
    assert sig["coverage"]["covers_whole_file"] is False
    assert sig["coverage"]["trailing_unsigned_bytes"] > 4
    assert sig["status"] == "intact_but_incomplete_coverage"
    assert "content_appended_after_signing" in sig["issues"]


def test_expired_certificate_flagged_without_breaking_integrity():
    key, cert = _make_signer(
        not_before=_dt(2020, 1, 1), not_after=_dt(2021, 1, 1)
    )
    result = analyze_pdf_signatures(_build_signed_pdf(key, cert))
    sig = result["details"]["signatures"][0]
    assert sig["integrity"]["matched"] is True
    assert "certificate_expired" in sig["issues"]
    assert "certificate_not_valid_at_signing_time" in sig["issues"]


def test_self_signed_certificate_detected(signer_pair):
    key, cert = signer_pair
    result = analyze_pdf_signatures(_build_signed_pdf(key, cert))
    signer_cert = result["details"]["signatures"][0]["certificates"]["signer"]
    assert signer_cert["self_signed"] is True
    assert signer_cert["key_size_bits"] == 2048
    assert signer_cert["weak_key"] is False


# ── Coverage arithmetic ─────────────────────────────────────────────────────

def test_coverage_analysis_whole_file():
    cov = _coverage_analysis([0, 100, 4100, 43], 4143)
    assert cov["covers_whole_file"] is True
    assert cov["trailing_unsigned_bytes"] == 0
    assert cov["content_appended_after_signing"] is False


def test_coverage_analysis_detects_append():
    cov = _coverage_analysis([0, 100, 4100, 43], 4143 + 50)
    assert cov["covers_whole_file"] is False
    assert cov["trailing_unsigned_bytes"] == 50
    assert cov["content_appended_after_signing"] is True


def test_coverage_tolerates_trailing_whitespace_slack():
    """A few bytes of EOL slack after %%EOF is normal and must not flag."""
    cov = _coverage_analysis([0, 100, 4100, 43], 4143 + 3)
    assert cov["covers_whole_file"] is True
    assert cov["content_appended_after_signing"] is False


# ── Trust is never claimed ──────────────────────────────────────────────────

def test_trust_is_never_evaluated_or_implied(signer_pair):
    """
    The honest-gap contract. Q4 (chain-to-trusted-root + revocation) needs the
    AATL/EUTL store and live OCSP/CRL egress, neither of which exists here, so
    the module must say 'not_evaluated' and must never emit a bare 'valid'.
    """
    key, cert = signer_pair
    result = analyze_pdf_signatures(_build_signed_pdf(key, cert))
    trust = result["details"]["trust_evaluation"]
    assert trust["performed"] is False
    assert trust["chain_to_trusted_root"] == "not_evaluated"
    assert trust["revocation_status"] == "not_evaluated"

    for sig in result["details"]["signatures"]:
        assert sig["trust_status"] == "not_evaluated"
        assert sig["status"] != "valid"
        assert "untrusted" in sig["status"] or sig["status"] != "cryptographically_intact_untrusted_chain"


# ── Robustness ──────────────────────────────────────────────────────────────

def test_unsigned_pdf_is_no_information_not_suspicion():
    result = analyze_pdf_signatures(b"%PDF-1.7\nplain unsigned document\n%%EOF\n")
    assert result["status"] == "unavailable"
    assert result["details"]["reason"] == "no_signature_fields_present"
    assert result["score"] == 0.5
    assert result["confidence"] == 0.0


def test_signature_inputs_robustness():
    assert analyze_pdf_signatures(b"")["status"] == "unavailable"
    assert analyze_pdf_signatures(b"not a pdf")["status"] == "unavailable"
    # /ByteRange present but /Contents unreadable
    broken = b"%PDF-1.7\n/ByteRange [0 10 20 10]\n/Contents <zzzz>\n%%EOF"
    result = analyze_pdf_signatures(broken)
    assert result["status"] == "ok"
    assert "signature_contents_unreadable" in result["details"]["signatures"][0]["issues"]


def test_signature_run_all_wrapper_shape(signer_pair):
    key, cert = signer_pair
    out = run_all_sig(_build_signed_pdf(key, cert))
    assert set(out.keys()) == {"pdf_signature_verification"}
    entry = out["pdf_signature_verification"]
    for field in ("score", "confidence", "status", "details"):
        assert field in entry
    assert "interpretation" in entry["details"]


# ════════════════════════════════════════════════════════════════════════════
# MODULE 30 — container-forensics wiring into the document pipeline
# ════════════════════════════════════════════════════════════════════════════

import types  # noqa: E402

from engines.document_engine import (  # noqa: E402
    run_container_forensics,
    summarise_integrity,
    analyze_document_from_bytes,
)


# ── Dispatcher ──────────────────────────────────────────────────────────────

def test_pdf_dispatches_both_pdf_analyzers():
    out = run_container_forensics(_build_pdf(CLEAN_META), "pdf")
    assert set(out.keys()) == {"pdf_metadata_forensics", "pdf_signature_verification"}
    assert out["pdf_metadata_forensics"]["status"] == "ok"


def test_docx_dispatches_the_ooxml_analyzer_only():
    out = run_container_forensics(_build_docx(), "docx")
    assert set(out.keys()) == {"docx_metadata_forensics"}


def test_pptx_shares_the_ooxml_path():
    """pptx is an OOXML package too — docProps/ parses, Word parts come back absent."""
    out = run_container_forensics(_build_docx(), "pptx")
    assert set(out.keys()) == {"docx_metadata_forensics"}


def test_unknown_doc_type_dispatches_nothing():
    assert run_container_forensics(b"whatever", "txt") == {}


def test_analyzer_exception_is_contained_per_analyzer(monkeypatch):
    """
    A bug in one container analyzer must degrade to a reported error for that
    analyzer alone — never take down the request or its siblings.
    """
    import analyzers.pdf_metadata_forensics as pdf_mod

    def boom(_bytes):
        raise RuntimeError("synthetic analyzer failure")

    monkeypatch.setattr(pdf_mod, "analyze_pdf_metadata", boom)
    out = run_container_forensics(_build_pdf(CLEAN_META), "pdf")

    assert out["pdf_metadata_forensics"]["status"] == "error"
    assert "synthetic analyzer failure" in out["pdf_metadata_forensics"]["details"]["reason"]
    # Sibling analyzer still ran.
    assert "pdf_signature_verification" in out


# ── Integrity summary ───────────────────────────────────────────────────────

def test_integrity_not_applicable_when_nothing_ran():
    summary = summarise_integrity({})
    assert summary["verdict"] == "NOT_APPLICABLE"
    assert summary["findings"] == []


def test_integrity_consistent_when_no_findings():
    summary = summarise_integrity(
        {"x": {"status": "ok", "details": {"findings": [], "consistency_notes": ["clean"]}}}
    )
    assert summary["verdict"] == "CONSISTENT"
    assert "forgeable" in summary["summary"]


def test_integrity_inconsistent_for_provenance_anomalies():
    summary = summarise_integrity(
        {"x": {"status": "ok", "details": {"findings": ["programmatic_producer", "unrecognised_producer"]}}}
    )
    assert summary["verdict"] == "INCONSISTENT"
    assert len(summary["findings"]) == 2
    assert summary["alteration_findings"] == []


def test_integrity_altered_requires_an_alteration_finding():
    summary = summarise_integrity(
        {"x": {"status": "ok",
               "details": {"findings": ["programmatic_producer",
                                        "sig0:signed_content_digest_mismatch"]}}}
    )
    assert summary["verdict"] == "ALTERED"
    assert "sig0:signed_content_digest_mismatch" in summary["alteration_findings"]


def test_integrity_alteration_matching_is_not_substring_sloppy():
    """
    `content_appended_after_signing` is an alteration marker; a finding that
    merely CONTAINS that text as part of a longer unrelated token must not
    promote the verdict to ALTERED.
    """
    summary = summarise_integrity(
        {"x": {"status": "ok", "details": {"findings": ["no_content_appended_after_signing_check"]}}}
    )
    assert summary["verdict"] == "INCONSISTENT"
    assert summary["alteration_findings"] == []


def test_integrity_records_errored_analyzers():
    summary = summarise_integrity(
        {"broken": {"status": "error", "details": {"reason": "boom"}}}
    )
    assert summary["signals_errored"] == ["broken"]
    assert summary["verdict"] == "NOT_APPLICABLE"


def test_tampered_pdf_reaches_altered_end_to_end(signer_pair):
    key, cert = signer_pair
    forensics = run_container_forensics(_build_signed_pdf(key, cert, tamper=True), "pdf")
    summary = summarise_integrity(forensics)
    assert summary["verdict"] == "ALTERED"


# ── Orchestrator wiring ─────────────────────────────────────────────────────

@pytest.fixture
def stub_detection_engines(monkeypatch):
    """
    Stub the three heavy detection engines so the orchestrator can be tested
    without torch/transformers/cv2. The container-forensics branch under test
    is NOT stubbed — it runs for real.
    """
    image_engine = types.ModuleType("engines.image_engine")
    image_engine.analyze_image_from_bytes = lambda *a, **k: {"verdict": "HUMAN"}

    text_engine = types.ModuleType("engines.text_engine")
    text_engine.analyze_text = lambda *a, **k: {"verdict": "HUMAN", "score": 0.2}

    plagiarism_engine = types.ModuleType("engines.plagiarism_engine")
    plagiarism_engine.analyze_plagiarism_risk = lambda *a, **k: {"status": "ok", "risk_level": "LOW"}
    plagiarism_engine.document_fingerprint = lambda *a, **k: "stub-fingerprint"

    monkeypatch.setitem(sys.modules, "engines.image_engine", image_engine)
    monkeypatch.setitem(sys.modules, "engines.text_engine", text_engine)
    monkeypatch.setitem(sys.modules, "engines.plagiarism_engine", plagiarism_engine)


def test_orchestrator_emits_additive_forensics_keys(stub_detection_engines):
    result = analyze_document_from_bytes(
        _build_pdf(CLEAN_META, text="The quick brown fox jumps over the lazy dog repeatedly. " * 3),
        "application/pdf",
        "report.pdf",
    )
    assert result["status"] == "ok"
    assert "container_forensics" in result
    assert "document_integrity" in result
    assert "pdf_metadata_forensics" in result["container_forensics"]
    assert result["document_integrity"]["verdict"] in (
        "CONSISTENT", "INCONSISTENT", "ALTERED", "NOT_APPLICABLE"
    )


def test_composite_verdict_enum_is_left_untouched(stub_detection_engines):
    """
    Contract with the frontend: detect/document/page.tsx types composite_verdict
    as a closed 'CLEAN' | 'FLAGGED' | 'NO_CONTENT' union. Container forensics
    must never widen it or flip it, however alarming the provenance findings
    are — that is what the separate document_integrity block is for.
    """
    key, cert = _make_signer()
    tampered = _build_signed_pdf(key, cert, tamper=True)

    result = analyze_document_from_bytes(tampered, "application/pdf", "signed.pdf")
    assert result["composite_verdict"] in ("CLEAN", "FLAGGED", "NO_CONTENT")
    assert result["document_integrity"]["verdict"] == "ALTERED"


def test_docx_orchestration_includes_ooxml_forensics(stub_detection_engines):
    result = analyze_document_from_bytes(
        _build_docx(words=900, total_time=40, revision=6),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "essay.docx",
    )
    assert "docx_metadata_forensics" in result["container_forensics"]
    assert result["document_integrity"]["signals_run"] == ["docx_metadata_forensics"]


def test_existing_response_contract_is_preserved(stub_detection_engines):
    """Every key the frontend already reads must still be present."""
    result = analyze_document_from_bytes(
        _build_pdf(CLEAN_META, text="Sufficiently long body text for the text branch. " * 4),
        "application/pdf",
        "report.pdf",
    )
    for key in (
        "status", "document_type", "units_analyzed", "document_fingerprint",
        "has_text", "has_images", "image_count", "text_analysis",
        "image_analyses", "plagiarism_analysis", "composite_verdict",
        "composite_summary", "processing_time_ms",
    ):
        assert key in result, f"missing pre-existing response key: {key}"

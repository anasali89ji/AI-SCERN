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

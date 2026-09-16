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

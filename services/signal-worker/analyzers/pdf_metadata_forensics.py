"""
Aiscern Detection Worker — PDF Metadata & Structural Forensics
(MODULE 27)

Giant-Level Optimization Spec, Section 3.5 item 1: "Document Verification —
metadata forensics on PDF (producer chain, timestamps, revision history)".

Audit note (spec vs. real code, done before writing anything)
------------------------------------------------------------
engines/document_engine.py already opens PDFs with PyMuPDF, but *only* to
pull text and embedded images out (`_extract_pdf`). It never looks at the
document catalog, the trailer, the XMP packet, or the raw byte layout. So
the spec is accurate here: none of this existed. PyMuPDF (`PyMuPDF==1.24.10`)
and `cryptography>=42.0.0` are both already pinned in requirements.txt, so
this module adds ZERO new dependencies.

Re-implementation note
----------------------
An earlier pass at this module was written but never actually landed on
main (verified with `git rev-list --all` + `git ls-tree` across every ref —
no such file ever existed in the repo's history). It was most likely lost
in the terminology-bundle merge that commit 27b6cee had to partially undo.
This is a clean rebuild, not a revert.

What this module does
---------------------
A PDF is a container with a *forensic paper trail* that is largely
independent of its rendered content. Nine signals, all read from real
structure, no heuristic hand-waving about pixels:

  S1  Producer / Creator toolchain identification
      /Producer and /Creator DocInfo strings map to the actual software
      that emitted the file. A "Microsoft Word" document whose Producer is
      `Skia/PDF` was printed from Chrome, not exported from Word. A
      Producer of `ReportLab`/`iText`/`FPDF`/`wkhtmltopdf` means the file
      was generated programmatically — which is not by itself bad, but is
      strongly inconsistent with a document presented as a human-authored
      Word/LaTeX export.

  S2  DocInfo vs. XMP disagreement
      PDFs carry metadata twice: the legacy /Info dictionary and an XMP
      packet. Editors that rewrite one and not the other leave a
      detectable mismatch. This is the single most reliable tell of
      post-hoc metadata editing.

  S3  Timestamp coherence
      ModDate earlier than CreationDate is physically impossible and means
      one of them was forged. Dates in the future, missing timezone
      offsets (a `D:YYYYMMDDHHmmSS` with no `Z`/`+`/`-` suffix, typical of
      hand-written metadata), and CreationDate == ModDate to the exact
      second (single-pass programmatic emit, never a human editing
      session) are all recorded.

  S4  Incremental-update / revision history
      Every save-after-the-fact appends a new xref section and another
      `%%EOF`. Counting `%%EOF` markers and `/Prev` trailer entries
      recovers how many times the file was revised after its initial
      write — a real revision history, recoverable even when DocInfo has
      been scrubbed.

  S5  /ID array divergence
      The trailer /ID holds two strings: the original file identifier and
      the current one. Identical => never modified since creation.
      Different => modified. A *missing* /ID on a file claiming a
      mainstream producer is itself anomalous.

  S6  Active-content and attachment surface
      /JavaScript, /OpenAction, /Launch, /EmbeddedFile, /AA. Reported as a
      handling-risk flag, kept strictly separate from the AI-generation
      signal — a document can be perfectly human-authored and still
      carry a malicious payload.

  S7  Page-geometry heterogeneity
      Mixed page sizes / rotations inside one PDF indicate pages spliced
      in from different sources. Common in genuinely assembled documents
      (scan + cover page), so this is evidence, not a verdict.

  S8  Font-embedding profile
      A document with NO embedded fonts at all was almost certainly
      emitted by a minimal programmatic writer; a document where every
      font is subsetted is consistent with a real word-processor export.

  S9  Producer-vs-structure consistency
      Cross-checks S1 against S8/S5/S4: e.g. a file claiming
      `Adobe InDesign` with zero embedded fonts and no /ID is internally
      inconsistent regardless of which individual field was forged.

Honest limitations (read before trusting any output of this module)
-------------------------------------------------------------------
  * NONE of these signals detect "AI-generated" directly. They detect
    *provenance inconsistency*. An LLM-authored essay exported from Word
    by a human has a completely clean PDF metadata profile, and this
    module will correctly say so. Conversely a scanned, re-OCR'd, entirely
    human document can trip S2/S3/S4 hard. Metadata forensics answers
    "was this file's stated origin story consistent?", not "did a human
    write the words?".
  * All metadata fields here are trivially forgeable by anyone who wants
    to. Absence of anomalies is therefore weak evidence; *presence* of
    anomalies is the informative direction. The scoring below is
    deliberately asymmetric to reflect that.
  * Not calibrated against a labeled corpus of known-tampered vs.
    known-clean PDFs (Aiscern does not have one). Thresholds are derived
    from the PDF 1.7 / ISO 32000-1 spec and from producer-string
    behaviour that can be checked by inspection, not from ROC curves.
    Treated as one evidence layer among many, never a standalone verdict.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ── Producer / creator toolchain table ──────────────────────────────────────
# Maps a lowercase substring of /Producer or /Creator to
# (canonical_name, category). Categories:
#   "word_processor" — interactive authoring app export
#   "browser_print"  — printed to PDF from a browser engine
#   "library"        — programmatic generation from code
#   "converter"      — format conversion / post-processing pass
#   "scanner"        — scan/capture device or driver
#   "typesetter"     — TeX-family typesetting
_PRODUCER_TABLE: List[Tuple[str, str, str]] = [
    ("microsoft® word", "Microsoft Word", "word_processor"),
    ("microsoft word", "Microsoft Word", "word_processor"),
    ("microsoft® powerpoint", "Microsoft PowerPoint", "word_processor"),
    ("microsoft® excel", "Microsoft Excel", "word_processor"),
    ("libreoffice", "LibreOffice", "word_processor"),
    ("openoffice", "OpenOffice", "word_processor"),
    ("pages", "Apple Pages", "word_processor"),
    ("quartz pdfcontext", "macOS Quartz", "word_processor"),
    ("skia/pdf", "Chrome/Skia (print-to-PDF)", "browser_print"),
    ("chromium", "Chromium (print-to-PDF)", "browser_print"),
    ("wkhtmltopdf", "wkhtmltopdf", "browser_print"),
    ("puppeteer", "Puppeteer", "browser_print"),
    ("headless chrome", "Headless Chrome", "browser_print"),
    ("reportlab", "ReportLab", "library"),
    ("itext", "iText", "library"),
    ("pdfkit", "PDFKit", "library"),
    ("fpdf", "FPDF", "library"),
    ("tcpdf", "TCPDF", "library"),
    ("dompdf", "dompdf", "library"),
    ("pypdf", "pypdf", "library"),
    ("pikepdf", "pikepdf", "library"),
    ("pymupdf", "PyMuPDF", "library"),
    ("weasyprint", "WeasyPrint", "library"),
    ("ghostscript", "Ghostscript", "converter"),
    ("gpl ghostscript", "Ghostscript", "converter"),
    ("acrobat distiller", "Acrobat Distiller", "converter"),
    ("adobe pdf library", "Adobe PDF Library", "converter"),
    ("pdftk", "pdftk", "converter"),
    ("qpdf", "qpdf", "converter"),
    ("pandoc", "Pandoc", "converter"),
    ("canva", "Canva", "converter"),
    ("pdf24", "PDF24", "converter"),
    ("ilovepdf", "iLovePDF", "converter"),
    ("smallpdf", "Smallpdf", "converter"),
    ("pdfsharp", "PDFsharp", "library"),
    ("pdflatex", "pdfTeX", "typesetter"),
    ("pdftex", "pdfTeX", "typesetter"),
    ("xetex", "XeTeX", "typesetter"),
    ("luatex", "LuaTeX", "typesetter"),
    ("dvips", "dvips", "typesetter"),
    ("adobe indesign", "Adobe InDesign", "word_processor"),
    ("adobe illustrator", "Adobe Illustrator", "word_processor"),
    ("adobe photoshop", "Adobe Photoshop", "word_processor"),
    ("scansnap", "ScanSnap", "scanner"),
    ("epson scan", "Epson Scan", "scanner"),
    ("canon", "Canon device", "scanner"),
    ("xerox", "Xerox device", "scanner"),
    ("hp scan", "HP Scan", "scanner"),
    ("paperport", "PaperPort", "scanner"),
    ("abbyy", "ABBYY FineReader", "scanner"),
    ("tesseract", "Tesseract OCR", "scanner"),
]

# Active-content keys worth surfacing, as raw byte patterns (we scan the raw
# file rather than walking the object graph so that content hidden behind an
# object stream or a broken xref is still found).
_ACTIVE_CONTENT_PATTERNS: List[Tuple[bytes, str]] = [
    (b"/JavaScript", "javascript"),
    (b"/JS", "javascript_short"),
    (b"/OpenAction", "open_action"),
    (b"/Launch", "launch_action"),
    (b"/EmbeddedFile", "embedded_file"),
    (b"/RichMedia", "rich_media"),
    (b"/AA", "additional_actions"),
]

# The PDF base-14 standard fonts (ISO 32000-1 §9.6.2.2) are NEVER embedded —
# every conforming viewer is required to supply them. Counting them as
# "missing embedded fonts" produced a false positive on the very first clean
# smoke fixture, so they are excluded from the S8 embedding check.
_BASE_14_FONTS = {
    "courier", "courier-bold", "courier-oblique", "courier-boldoblique",
    "helvetica", "helvetica-bold", "helvetica-oblique", "helvetica-boldoblique",
    "times-roman", "times-bold", "times-italic", "times-bolditalic",
    "symbol", "zapfdingbats",
    # Viewer-side aliases that resolve to the base-14 metrics rather than to
    # an embedded program.
    "arial", "arialmt", "arial-boldmt", "arial-italicmt", "arial-bolditalicmt",
    "timesnewromanpsmt", "timesnewromanps-boldmt", "timesnewromanps-italicmt",
    "couriernew", "couriernewpsmt",
}


def _is_base14(basefont: str) -> bool:
    name = re.sub(r"^[A-Z]{6}\+", "", (basefont or "")).strip().lower()
    return name in _BASE_14_FONTS


_PDF_DATE_RE = re.compile(
    r"D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([Zz+\-])?(\d{2})?'?(\d{2})?"
)

# Max bytes we will scan raw. PDFs larger than this still get the PyMuPDF
# structural pass; only the byte-level scans (S4/S6) are capped so a
# pathological 500MB upload can't stall a worker thread.
_MAX_RAW_SCAN_BYTES = 64 * 1024 * 1024


# ── Result helpers (match the convention used by Modules 21-26) ─────────────

def _unavailable(reason: str) -> Dict[str, Any]:
    return {
        "score": 0.5,
        "confidence": 0.0,
        "status": "unavailable",
        "details": {"reason": reason},
    }


def _result(score: float, confidence: float, **details: Any) -> Dict[str, Any]:
    return {
        "score": round(max(0.0, min(1.0, score)), 4),
        "confidence": round(max(0.0, min(1.0, confidence)), 4),
        "status": "ok",
        "details": details,
    }


# ── Date parsing ────────────────────────────────────────────────────────────

def _parse_pdf_date(raw: Optional[str]) -> Dict[str, Any]:
    """
    Parse a PDF date string (ISO 32000-1 §7.9.4: `D:YYYYMMDDHHmmSSOHH'mm`).

    Returns a dict with the parsed datetime (UTC-normalised where a zone is
    given), plus the forensically interesting flag `has_timezone` — hand-
    written/forged metadata very often omits the zone designator that every
    mainstream producer writes.
    """
    if not raw or not isinstance(raw, str):
        return {"present": False}

    m = _PDF_DATE_RE.search(raw)
    if not m:
        return {"present": True, "parsed": False, "raw": raw[:64]}

    year = int(m.group(1))
    month = int(m.group(2) or 1)
    day = int(m.group(3) or 1)
    hour = int(m.group(4) or 0)
    minute = int(m.group(5) or 0)
    second = int(m.group(6) or 0)
    zone_sign = m.group(7)
    zone_h = int(m.group(8) or 0)
    zone_m = int(m.group(9) or 0)

    # Clamp obviously malformed components rather than throwing — a malformed
    # date is itself a finding, and we want to report it, not 500.
    month = max(1, min(12, month))
    day = max(1, min(28 if month == 2 else 30 if month in (4, 6, 9, 11) else 31, day))
    hour = max(0, min(23, hour))
    minute = max(0, min(59, minute))
    second = max(0, min(59, second))

    try:
        dt = datetime(year, month, day, hour, minute, second, tzinfo=timezone.utc)
    except ValueError:
        return {"present": True, "parsed": False, "raw": raw[:64]}

    has_tz = zone_sign in ("+", "-", "Z", "z")
    if zone_sign in ("+", "-"):
        offset_minutes = zone_h * 60 + zone_m
        if zone_sign == "+":
            dt = dt.replace(tzinfo=timezone.utc)
            dt = datetime.fromtimestamp(dt.timestamp() - offset_minutes * 60, tz=timezone.utc)
        else:
            dt = datetime.fromtimestamp(dt.timestamp() + offset_minutes * 60, tz=timezone.utc)

    return {
        "present": True,
        "parsed": True,
        "iso": dt.isoformat(),
        "epoch": dt.timestamp(),
        "has_timezone": has_tz,
        "raw": raw[:64],
    }


# ── S1: producer / creator identification ───────────────────────────────────

def _identify_toolchain(producer: str, creator: str) -> Dict[str, Any]:
    def match(value: str) -> Optional[Tuple[str, str]]:
        low = (value or "").lower()
        if not low.strip():
            return None
        for needle, name, category in _PRODUCER_TABLE:
            if needle in low:
                return name, category
        return None

    prod_hit = match(producer)
    creat_hit = match(creator)

    chain: List[str] = []
    categories: List[str] = []
    if creat_hit:
        chain.append(creat_hit[0])
        categories.append(creat_hit[1])
    if prod_hit and (not creat_hit or prod_hit[0] != creat_hit[0]):
        chain.append(prod_hit[0])
        categories.append(prod_hit[1])

    # A creator/producer pair that crosses an implausible category boundary is
    # the interesting case: "Microsoft Word" (word_processor) + "Skia/PDF"
    # (browser_print) means the .docx was opened in a browser preview and
    # printed, NOT exported from Word — a common tell in submitted work that
    # is claimed to be an original Word document.
    cross_category = bool(
        creat_hit and prod_hit and creat_hit[1] != prod_hit[1]
    )

    return {
        "producer_raw": (producer or "")[:120],
        "creator_raw": (creator or "")[:120],
        "identified_chain": chain,
        "categories": sorted(set(categories)),
        "cross_category_chain": cross_category,
        "producer_recognised": prod_hit is not None,
        "creator_recognised": creat_hit is not None,
        "programmatic_origin": any(c in ("library",) for c in categories),
        "browser_printed": any(c == "browser_print" for c in categories),
        "post_processed": any(c == "converter" for c in categories),
        "scanned_origin": any(c == "scanner" for c in categories),
    }


# ── S2: DocInfo vs XMP ──────────────────────────────────────────────────────

def _xmp_field(xmp: str, *paths: str) -> Optional[str]:
    """Pull a value out of a raw XMP packet without an XML dependency."""
    for path in paths:
        # Element form: <xmp:CreatorTool>value</xmp:CreatorTool>
        m = re.search(
            rf"<{re.escape(path)}[^>]*>(.*?)</{re.escape(path)}>", xmp, re.S | re.I
        )
        if m:
            inner = m.group(1)
            # rdf:Alt / rdf:Seq wrapper
            li = re.search(r"<rdf:li[^>]*>(.*?)</rdf:li>", inner, re.S | re.I)
            value = (li.group(1) if li else inner).strip()
            value = re.sub(r"<[^>]+>", "", value).strip()
            if value:
                return value
        # Attribute form: xmp:CreatorTool="value"
        m = re.search(rf'{re.escape(path)}\s*=\s*"([^"]*)"', xmp, re.I)
        if m and m.group(1).strip():
            return m.group(1).strip()
    return None


def _docinfo_xmp_consistency(info: Dict[str, Any], xmp: str) -> Dict[str, Any]:
    if not xmp:
        return {"xmp_present": False, "mismatches": [], "checked": 0}

    pairs = [
        ("producer", info.get("producer", ""), ("pdf:Producer",)),
        ("creator", info.get("creator", ""), ("xmp:CreatorTool", "dc:creator")),
        ("title", info.get("title", ""), ("dc:title",)),
    ]

    mismatches: List[Dict[str, str]] = []
    checked = 0
    for label, docinfo_value, xmp_paths in pairs:
        xmp_value = _xmp_field(xmp, *xmp_paths)
        if not docinfo_value or not xmp_value:
            continue
        checked += 1
        a = re.sub(r"\s+", " ", str(docinfo_value)).strip().lower()
        b = re.sub(r"\s+", " ", str(xmp_value)).strip().lower()
        # Substring tolerance: producers legitimately write a longer string
        # into one slot than the other (version suffixes etc.).
        if a and b and a not in b and b not in a:
            mismatches.append(
                {"field": label, "docinfo": str(docinfo_value)[:80], "xmp": str(xmp_value)[:80]}
            )

    # XMP carries its own modify/create pair too; disagreement with DocInfo
    # dates is an independent tamper signal.
    xmp_modify = _xmp_field(xmp, "xmp:ModifyDate")
    xmp_create = _xmp_field(xmp, "xmp:CreateDate")

    return {
        "xmp_present": True,
        "xmp_bytes": len(xmp),
        "mismatches": mismatches,
        "checked": checked,
        "xmp_create_date": xmp_create,
        "xmp_modify_date": xmp_modify,
    }


# ── S3: timestamp coherence ─────────────────────────────────────────────────

def _timestamp_analysis(created: Dict[str, Any], modified: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "creation_date": created.get("iso"),
        "mod_date": modified.get("iso"),
        "creation_present": created.get("present", False),
        "mod_present": modified.get("present", False),
        "anomalies": [],
    }

    now = datetime.now(timezone.utc).timestamp()
    c_epoch = created.get("epoch")
    m_epoch = modified.get("epoch")

    if created.get("present") and not created.get("parsed", False):
        out["anomalies"].append("creation_date_unparseable")
    if modified.get("present") and not modified.get("parsed", False):
        out["anomalies"].append("mod_date_unparseable")

    if created.get("parsed") and not created.get("has_timezone", False):
        out["anomalies"].append("creation_date_missing_timezone")
    if modified.get("parsed") and not modified.get("has_timezone", False):
        out["anomalies"].append("mod_date_missing_timezone")

    if c_epoch and c_epoch > now + 86400:
        out["anomalies"].append("creation_date_in_future")
    if m_epoch and m_epoch > now + 86400:
        out["anomalies"].append("mod_date_in_future")

    if c_epoch and m_epoch:
        delta = m_epoch - c_epoch
        out["created_to_modified_seconds"] = round(delta, 1)
        if delta < -60:
            # >1min of backwards travel. Small negatives happen from timezone
            # rounding in sloppy producers, so we don't flag those.
            out["anomalies"].append("mod_date_before_creation_date")
        elif abs(delta) < 1.0:
            out["anomalies"].append("creation_equals_mod_date")
        elif delta > 5 * 365 * 86400:
            out["anomalies"].append("mod_date_years_after_creation")

    if not created.get("present") and not modified.get("present"):
        out["anomalies"].append("no_dates_present")

    return out


# ── S4: incremental updates / revision history ──────────────────────────────

def _revision_analysis(raw: bytes) -> Dict[str, Any]:
    eof_count = raw.count(b"%%EOF")
    prev_count = len(re.findall(rb"/Prev\s+\d+", raw))
    xref_count = raw.count(b"\nxref") + raw.count(b"\rxref")
    startxref_count = raw.count(b"startxref")

    # An original single-write PDF has exactly one %%EOF. Each incremental
    # save appends another body + xref + trailer + %%EOF, and the new trailer
    # points at the previous xref via /Prev. So revisions_after_initial_save
    # is (eof_count - 1), corroborated by prev_count.
    revisions = max(0, eof_count - 1)

    return {
        "eof_markers": eof_count,
        "prev_trailer_entries": prev_count,
        "xref_sections": xref_count,
        "startxref_markers": startxref_count,
        "revisions_after_initial_save": revisions,
        "incrementally_updated": revisions > 0 or prev_count > 0,
        # Disagreement between the two independent counters means the file was
        # rewritten by a tool that rebuilt the xref (linearisation, qpdf,
        # Ghostscript) — which destroys the original revision history.
        "history_counters_disagree": (revisions > 0) != (prev_count > 0),
    }


# ── S5: /ID array ───────────────────────────────────────────────────────────

def _id_array_analysis(raw: bytes) -> Dict[str, Any]:
    # /ID [<hex1><hex2>] — take the LAST occurrence, which belongs to the most
    # recent trailer in an incrementally-updated file.
    matches = re.findall(rb"/ID\s*\[\s*<([0-9A-Fa-f]*)>\s*<([0-9A-Fa-f]*)>\s*\]", raw)
    if not matches:
        return {"id_present": False, "id_pair_differs": None}

    original, current = matches[-1]
    return {
        "id_present": True,
        "id_occurrences": len(matches),
        "id_pair_differs": original != current,
        "original_id_prefix": original[:16].decode("ascii", "replace"),
        "current_id_prefix": current[:16].decode("ascii", "replace"),
    }


# ── S6: active content ──────────────────────────────────────────────────────

def _active_content_analysis(raw: bytes) -> Dict[str, Any]:
    found: Dict[str, int] = {}
    for pattern, label in _ACTIVE_CONTENT_PATTERNS:
        count = raw.count(pattern)
        if count:
            found[label] = count

    # /JS alone is noisy (it appears inside other tokens); only report it when
    # /JavaScript corroborates, so we don't hand the UI a false scare.
    if "javascript_short" in found and "javascript" not in found:
        found.pop("javascript_short")

    high_risk = [k for k in ("javascript", "launch_action", "embedded_file") if k in found]

    return {
        "active_content_keys": found,
        "high_risk_keys": high_risk,
        "has_active_content": bool(found),
    }


# ── S7/S8: page geometry + font embedding ───────────────────────────────────

def _structure_analysis(doc: Any) -> Dict[str, Any]:
    sizes: Dict[Tuple[int, int], int] = {}
    rotations: Dict[int, int] = {}
    fonts_total = 0
    fonts_embedded = 0
    fonts_subset = 0
    fonts_base14 = 0
    fonts_unembedded_nonstandard = 0
    font_names: List[str] = []

    page_cap = min(doc.page_count, 200)  # cap the per-page walk on huge PDFs
    for pno in range(page_cap):
        try:
            page = doc.load_page(pno)
        except Exception:
            continue
        rect = page.rect
        key = (int(round(rect.width)), int(round(rect.height)))
        sizes[key] = sizes.get(key, 0) + 1
        rot = int(getattr(page, "rotation", 0) or 0)
        rotations[rot] = rotations.get(rot, 0) + 1

        try:
            for font in page.get_fonts(full=True):
                # (xref, ext, type, basefont, name, encoding, referencer)
                fonts_total += 1
                basefont = str(font[3]) if len(font) > 3 else ""
                ext = str(font[1]) if len(font) > 1 else ""
                embedded = bool(ext) and ext not in ("n/a", "none", "")
                if embedded:
                    fonts_embedded += 1
                elif _is_base14(basefont):
                    fonts_base14 += 1
                else:
                    fonts_unembedded_nonstandard += 1
                # Subset fonts are prefixed with six uppercase letters + '+'
                if re.match(r"^[A-Z]{6}\+", basefont):
                    fonts_subset += 1
                if basefont and len(font_names) < 40:
                    font_names.append(basefont)
        except Exception:
            continue

    unique_fonts = sorted(set(font_names))

    return {
        "pages_inspected": page_cap,
        "page_count": doc.page_count,
        "distinct_page_sizes": len(sizes),
        "page_size_histogram": {f"{w}x{h}": n for (w, h), n in sorted(sizes.items())},
        "distinct_rotations": len(rotations),
        "rotation_histogram": {str(k): v for k, v in sorted(rotations.items())},
        "mixed_page_geometry": len(sizes) > 1 or len(rotations) > 1,
        "font_references": fonts_total,
        "fonts_embedded": fonts_embedded,
        "fonts_base14_standard": fonts_base14,
        "fonts_unembedded_nonstandard": fonts_unembedded_nonstandard,
        "fonts_subset": fonts_subset,
        "unique_font_names": unique_fonts[:40],
        # Only non-standard fonts left unembedded are anomalous. A file that
        # uses nothing but the base-14 fonts is spec-conformant and common in
        # minimal/programmatic output — reported separately below.
        "no_embedded_fonts": fonts_unembedded_nonstandard > 0 and fonts_embedded == 0,
        "base14_only": fonts_total > 0 and fonts_base14 == fonts_total,
        "all_fonts_subset": fonts_total > 0 and fonts_subset == fonts_total,
    }


# ── S9 + scoring ────────────────────────────────────────────────────────────

def _score(
    toolchain: Dict[str, Any],
    xmp: Dict[str, Any],
    timestamps: Dict[str, Any],
    revisions: Dict[str, Any],
    ids: Dict[str, Any],
    active: Dict[str, Any],
    structure: Dict[str, Any],
) -> Tuple[float, float, List[str], List[str]]:
    """
    Asymmetric scoring. 0.5 is "no information". We push UP on positive
    evidence of provenance inconsistency and only mildly DOWN on a clean,
    internally-coherent profile, because a clean profile is cheap to forge
    while an anomalous one is rarely produced on purpose.
    """
    score = 0.5
    findings: List[str] = []
    consistency_notes: List[str] = []

    # S2 — DocInfo/XMP mismatch is the strongest single tamper signal.
    mismatches = xmp.get("mismatches") or []
    if mismatches:
        score += 0.12 * min(len(mismatches), 3)
        findings.append(
            "docinfo_xmp_mismatch:" + ",".join(m["field"] for m in mismatches)
        )

    # S3 — timestamps.
    anomalies = timestamps.get("anomalies") or []
    weights = {
        "mod_date_before_creation_date": 0.18,
        "creation_date_in_future": 0.15,
        "mod_date_in_future": 0.15,
        "creation_date_unparseable": 0.08,
        "mod_date_unparseable": 0.08,
        "creation_date_missing_timezone": 0.05,
        "mod_date_missing_timezone": 0.05,
        "creation_equals_mod_date": 0.04,
        "no_dates_present": 0.06,
        "mod_date_years_after_creation": 0.02,
    }
    for a in anomalies:
        score += weights.get(a, 0.0)
        findings.append(f"timestamp:{a}")

    # S1 — toolchain.
    if toolchain.get("cross_category_chain"):
        score += 0.07
        findings.append("toolchain_cross_category")
    if toolchain.get("programmatic_origin"):
        score += 0.05
        findings.append("programmatic_producer")
    if toolchain.get("post_processed"):
        score += 0.03
        findings.append("post_processing_pass")
    if not toolchain.get("producer_recognised") and not toolchain.get("creator_recognised"):
        # An empty or unknown producer is mildly suspicious: every mainstream
        # authoring path writes something recognisable.
        score += 0.04
        findings.append("unrecognised_producer")

    # S4/S5 — revision history.
    if revisions.get("history_counters_disagree"):
        score += 0.06
        findings.append("revision_counters_disagree")
    if revisions.get("revisions_after_initial_save", 0) >= 3:
        score += 0.04
        findings.append("many_incremental_revisions")
    if ids.get("id_pair_differs") is True:
        consistency_notes.append("file_modified_since_creation")
    if ids.get("id_present") is False and toolchain.get("producer_recognised"):
        score += 0.04
        findings.append("missing_id_with_known_producer")

    # S9 — cross-consistency: a claimed interactive authoring app that
    # embedded no fonts at all is internally inconsistent.
    claims_word_processor = "word_processor" in (toolchain.get("categories") or [])
    if structure.get("no_embedded_fonts") and claims_word_processor:
        score += 0.08
        findings.append("word_processor_claim_without_embedded_fonts")
    elif structure.get("base14_only") and claims_word_processor:
        # Word/Pages/InDesign exports embed their UI fonts (Calibri, Aptos,
        # Cambria...). A file claiming one of them but referencing ONLY the
        # base-14 set is more consistent with a synthesised PDF wearing a
        # word-processor producer string. Weaker than the above because a
        # Times-New-Roman-only document can legitimately land here.
        score += 0.05
        findings.append("word_processor_claim_with_base14_fonts_only")
    if structure.get("mixed_page_geometry"):
        consistency_notes.append("mixed_page_geometry_pages_may_be_spliced")

    # Clean-profile credit (small, deliberately).
    if not findings:
        score -= 0.08
        consistency_notes.append("internally_consistent_metadata_profile")

    # Confidence scales with how much metadata there actually was to check.
    evidence_units = 0
    evidence_units += 1 if toolchain.get("producer_recognised") else 0
    evidence_units += 1 if xmp.get("xmp_present") else 0
    evidence_units += 1 if timestamps.get("creation_present") else 0
    evidence_units += 1 if timestamps.get("mod_present") else 0
    evidence_units += 1 if ids.get("id_present") else 0
    evidence_units += 1 if structure.get("font_references", 0) > 0 else 0
    confidence = min(0.75, 0.10 + 0.11 * evidence_units)

    # Active content never moves the AI score — it is a separate risk axis.
    if active.get("high_risk_keys"):
        findings.append("active_content:" + ",".join(active["high_risk_keys"]))

    return score, confidence, findings, consistency_notes


# ── Public entry point ──────────────────────────────────────────────────────

def analyze_pdf_metadata(file_bytes: bytes) -> Dict[str, Any]:
    """
    Run the full PDF metadata/structure forensic pass over raw PDF bytes.

    Never raises: any failure is reported as status="unavailable"/"error" with
    a reason, because this runs inside the document pipeline alongside the
    text and image branches and must not be able to take a request down.
    """
    if not file_bytes:
        return _unavailable("empty_input")
    if not file_bytes.lstrip()[:5].startswith(b"%PDF-"):
        return _unavailable("not_a_pdf_header")

    try:
        import fitz  # PyMuPDF
    except ImportError as e:  # pragma: no cover - dependency is pinned
        return _unavailable(f"pymupdf_unavailable: {e}")

    raw = file_bytes[:_MAX_RAW_SCAN_BYTES]
    raw_truncated = len(file_bytes) > _MAX_RAW_SCAN_BYTES

    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as e:
        return {
            "score": 0.5,
            "confidence": 0.0,
            "status": "error",
            "details": {"reason": f"pdf_open_failed: {e}"},
        }

    try:
        info = dict(doc.metadata or {})
        try:
            xmp = doc.get_xml_metadata() or ""
        except Exception:
            xmp = ""

        header_version = file_bytes[:9].decode("ascii", "replace").strip()

        toolchain = _identify_toolchain(info.get("producer", ""), info.get("creator", ""))
        xmp_check = _docinfo_xmp_consistency(info, xmp)
        created = _parse_pdf_date(info.get("creationDate"))
        modified = _parse_pdf_date(info.get("modDate"))
        timestamps = _timestamp_analysis(created, modified)
        revisions = _revision_analysis(raw)
        ids = _id_array_analysis(raw)
        active = _active_content_analysis(raw)
        structure = _structure_analysis(doc)

        encryption = {
            "is_encrypted": bool(doc.is_encrypted),
            "needs_password": bool(doc.needs_pass),
            "permissions": int(getattr(doc, "permissions", 0) or 0),
        }

        score, confidence, findings, notes = _score(
            toolchain, xmp_check, timestamps, revisions, ids, active, structure
        )

        return _result(
            score,
            confidence,
            pdf_version=header_version,
            raw_scan_truncated=raw_truncated,
            file_bytes=len(file_bytes),
            docinfo={
                k: (str(v)[:160] if v is not None else None)
                for k, v in info.items()
                if k in ("title", "author", "subject", "keywords", "creator", "producer", "format")
            },
            toolchain=toolchain,
            xmp_consistency=xmp_check,
            timestamps=timestamps,
            revision_history=revisions,
            file_identifier=ids,
            active_content=active,
            structure=structure,
            encryption=encryption,
            findings=findings,
            consistency_notes=notes,
            interpretation=(
                "Provenance-consistency evidence only. A high score means the "
                "file's stated origin story is internally inconsistent, NOT "
                "that its content was AI-generated. Metadata is forgeable: a "
                "clean profile is weak exculpatory evidence."
            ),
        )
    except Exception as e:  # pragma: no cover - defensive
        logger.error("[PDFMetadataForensics] unexpected failure: %s", e, exc_info=True)
        return {
            "score": 0.5,
            "confidence": 0.0,
            "status": "error",
            "details": {"reason": f"unexpected_error: {e}"},
        }
    finally:
        try:
            doc.close()
        except Exception:
            pass


def run_all(file_bytes: bytes) -> Dict[str, Dict[str, Any]]:
    """Uniform entry point, matching analyzers/*.run_all in Modules 21-26."""
    return {"pdf_metadata_forensics": analyze_pdf_metadata(file_bytes)}

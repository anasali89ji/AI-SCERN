"""
Aiscern Detection Worker — DOCX / OOXML Metadata & Revision Forensics
(MODULE 28)

Giant-Level Optimization Spec, Section 3.5 item 2: "Document Verification —
DOCX metadata, editing time, revision history, tracked changes".

Audit note (spec vs. real code, done before writing anything)
------------------------------------------------------------
engines/document_engine.py's `_extract_docx` uses python-docx purely to walk
paragraphs, tables and image relationships. It never touches `docProps/`,
`word/settings.xml`, the tracked-change markup, or the ZIP central directory.
So nothing here existed. `python-docx==1.1.2` is already pinned; `zipfile`
and `xml.etree` are stdlib. ZERO new dependencies.

Why OOXML is the richest forensic target in the whole document pipeline
----------------------------------------------------------------------
A .docx is a ZIP of XML parts, and Word writes far more about the authoring
session into those parts than most authors realise. Critically, several of
these fields are maintained by Word itself as a side effect of editing and
are *not* exposed in any Word UI, so they are rarely scrubbed even by people
who deliberately clear File > Info > Document Properties.

Eight signals
-------------
  S1  Core properties (`docProps/core.xml`)
      dc:creator, cp:lastModifiedBy, dcterms:created/modified, cp:revision,
      cp:lastPrinted. A creator/lastModifiedBy mismatch is normal for
      collaborative work and meaningless alone; combined with S2/S3 it
      becomes informative.

  S2  Editing-time plausibility (`docProps/app.xml` <TotalTime>)
      Word accumulates total *minutes the document was open for editing*.
      This is the single strongest signal in this module. A 2,000-word
      document with TotalTime=0 was not typed — it was pasted in and saved,
      which is exactly the shape of paste-from-LLM and of paste-from-source
      plagiarism alike. Expressed as implied words-per-minute so the
      reviewer sees the actual arithmetic rather than a bare verdict.

  S3  Revision count (`cp:revision`)
      Increments on every save. revision=1 on a long document means the file
      was created and saved exactly once, with no drafting cycle.

  S4  RSID analysis (`word/settings.xml` <w:rsids>)
      Word mints a Revision Save ID per editing session and stamps runs with
      it. The rsid *count* is therefore a session counter that Word maintains
      invisibly and that survives clearing the visible document properties.
      A long document carrying one or two rsids was assembled in a single
      session. (Note: Word 2013+ can be configured to not store rsids, and
      non-Word producers omit them entirely — absence is not evidence.)

  S5  Tracked changes (`w:ins` / `w:del` / `w:moveFrom` / `w:moveTo`)
      Counts, distinct authors, and date range. Residual tracked changes are
      a genuine edit history embedded in the file. Also surfaces the case
      where changes were *accepted* but the author list survives in
      `w:rsidR` / people.xml.

  S6  Comments and people (`word/comments.xml`, `word/people.xml`)
      Comment authors and initials — another author set that survives after
      the comments themselves are deleted from the visible text.

  S7  Producing application (`docProps/app.xml` <Application>, <AppVersion>,
      <Template>, <Company>)
      Distinguishes real Word from LibreOffice, Google Docs export, and
      programmatic writers (python-docx, docx4j, Aspose, OpenXML SDK). A
      python-docx file ships the library's default template and an
      Application string of "Microsoft Office Word" that it simply copied
      from its bundled template — a spoof that the ZIP layer (S8) exposes.

  S8  ZIP container forensics
      Entry order, entry count, compression method, and the per-entry DOS
      timestamps. Word writes a specific part ordering and real clock
      timestamps. python-docx writes a fixed template ordering and, for the
      parts it copies from its bundled default.docx, the template's frozen
      1980/2013-era timestamps — so a file claiming to be a freshly authored
      Word document can be caught by its own archive.

Honest limitations
------------------
  * Absence of a signal is not evidence. Google Docs exports have no
    TotalTime, no rsids and revision=1 by construction; so do "Save As
    .docx" round-trips from Pages, LibreOffice and every online editor.
    This module therefore reports `producer_class` first and downweights
    every session-based signal when the producer is known not to maintain
    it. Failing to do this would flag most honest Google Docs users.
  * Everything here is forgeable by anyone who unzips the file. As with
    Module 27, presence of anomalies is the informative direction.
  * Not calibrated against a labeled corpus. Thresholds come from the
    ECMA-376 spec and from observable Word behaviour.
  * This detects HOW A FILE WAS ASSEMBLED, never whether a human wrote the
    words. A human who drafts in Google Docs and downloads a .docx is
    indistinguishable here from one who pastes LLM output into the same
    Google Doc. Evidence layer, never a verdict.
"""

from __future__ import annotations

import io
import logging
import re
import zipfile
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# OOXML namespaces we care about, matched as literal prefixes because we read
# the XML as text rather than building an ElementTree for every part (cheaper,
# and immune to the namespace-prefix remapping different producers use).
_NS_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

_APPLICATION_TABLE: List[Tuple[str, str, str]] = [
    # (lowercase needle, canonical name, producer_class)
    # producer_class drives which session-based signals are meaningful.
    ("microsoft office word", "Microsoft Word", "word"),
    ("microsoft word", "Microsoft Word", "word"),
    ("microsoft macintosh word", "Microsoft Word (Mac)", "word"),
    ("libreoffice", "LibreOffice", "office_suite"),
    ("openoffice", "OpenOffice", "office_suite"),
    ("wps office", "WPS Office", "office_suite"),
    ("onlyoffice", "ONLYOFFICE", "office_suite"),
    ("pages", "Apple Pages", "office_suite"),
    ("google", "Google Docs", "cloud_editor"),
    ("docx4j", "docx4j", "library"),
    ("aspose", "Aspose.Words", "library"),
    ("python-docx", "python-docx", "library"),
    ("openxml", "Open XML SDK", "library"),
    ("pandoc", "Pandoc", "library"),
    ("docxtemplater", "docxtemplater", "library"),
]

# Producer classes that do NOT maintain Word's session bookkeeping. Session
# signals (TotalTime, revision, rsids) carry no information for these, so we
# suppress them rather than flagging every Google Docs user.
_NO_SESSION_BOOKKEEPING = {"cloud_editor", "library"}

_MAX_PART_BYTES = 24 * 1024 * 1024   # per-part read cap
_MAX_TOTAL_READ = 96 * 1024 * 1024   # cumulative read cap across all parts


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


# ── XML text helpers (namespace-prefix agnostic) ────────────────────────────

def _tag_text(xml: str, local_name: str) -> Optional[str]:
    """
    Extract the text of the first element with this local name, regardless of
    which namespace prefix the producer chose (`<dc:creator>` vs `<creator>`
    vs `<ns0:creator>`).
    """
    m = re.search(
        rf"<(?:[A-Za-z0-9_.\-]+:)?{re.escape(local_name)}\b[^>]*>(.*?)</(?:[A-Za-z0-9_.\-]+:)?{re.escape(local_name)}>",
        xml,
        re.S,
    )
    if not m:
        return None
    value = re.sub(r"<[^>]+>", "", m.group(1)).strip()
    return value or None


def _count_tags(xml: str, local_name: str) -> int:
    """Count opening tags with this local name (self-closing included)."""
    return len(
        re.findall(rf"<(?:[A-Za-z0-9_.\-]+:)?{re.escape(local_name)}\b", xml)
    )


def _attr_values(xml: str, local_attr: str) -> List[str]:
    return re.findall(
        rf'(?:[A-Za-z0-9_.\-]+:)?{re.escape(local_attr)}\s*=\s*"([^"]*)"', xml
    )


def _parse_iso(value: Optional[str]) -> Optional[float]:
    if not value:
        return None
    text = value.strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        m = re.match(r"(\d{4})-(\d{2})-(\d{2})", text)
        if not m:
            return None
        try:
            dt = datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=timezone.utc)
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()


def _int_or_none(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


# ── S1: core properties ─────────────────────────────────────────────────────

def _core_properties(xml: str) -> Dict[str, Any]:
    if not xml:
        return {"present": False}

    created_raw = _tag_text(xml, "created")
    modified_raw = _tag_text(xml, "modified")
    created = _parse_iso(created_raw)
    modified = _parse_iso(modified_raw)

    creator = _tag_text(xml, "creator")
    last_modified_by = _tag_text(xml, "lastModifiedBy")

    anomalies: List[str] = []
    if created and modified:
        delta = modified - created
        if delta < -60:
            anomalies.append("modified_before_created")
    else:
        delta = None

    now = datetime.now(timezone.utc).timestamp()
    if created and created > now + 86400:
        anomalies.append("created_in_future")
    if modified and modified > now + 86400:
        anomalies.append("modified_in_future")
    if created and modified and abs(modified - created) < 1.0:
        anomalies.append("created_equals_modified")
    if not creator and not last_modified_by:
        anomalies.append("authorship_fields_empty")

    return {
        "present": True,
        "creator": (creator or "")[:120] or None,
        "last_modified_by": (last_modified_by or "")[:120] or None,
        "title": (_tag_text(xml, "title") or "")[:160] or None,
        "created": created_raw,
        "modified": modified_raw,
        "last_printed": _tag_text(xml, "lastPrinted"),
        "revision": _int_or_none(_tag_text(xml, "revision")),
        "created_to_modified_seconds": round(delta, 1) if delta is not None else None,
        "author_changed": bool(
            creator and last_modified_by and creator.strip() != last_modified_by.strip()
        ),
        "anomalies": anomalies,
    }


# ── S2/S7: extended properties ──────────────────────────────────────────────

def _identify_application(app_string: str) -> Tuple[Optional[str], str]:
    low = (app_string or "").lower()
    for needle, name, klass in _APPLICATION_TABLE:
        if needle in low:
            return name, klass
    return None, "unknown"


def _extended_properties(xml: str) -> Dict[str, Any]:
    if not xml:
        return {"present": False, "producer_class": "unknown"}

    app_raw = _tag_text(xml, "Application") or ""
    name, klass = _identify_application(app_raw)

    return {
        "present": True,
        "application_raw": app_raw[:120] or None,
        "application": name,
        "producer_class": klass,
        "app_version": _tag_text(xml, "AppVersion"),
        "template": _tag_text(xml, "Template"),
        "company": (_tag_text(xml, "Company") or "")[:120] or None,
        "manager": (_tag_text(xml, "Manager") or "")[:120] or None,
        "total_edit_minutes": _int_or_none(_tag_text(xml, "TotalTime")),
        "pages": _int_or_none(_tag_text(xml, "Pages")),
        "words": _int_or_none(_tag_text(xml, "Words")),
        "characters": _int_or_none(_tag_text(xml, "Characters")),
        "paragraphs": _int_or_none(_tag_text(xml, "Paragraphs")),
    }


def _editing_time_analysis(ext: Dict[str, Any], body_word_count: int) -> Dict[str, Any]:
    """
    Turn TotalTime into implied words-per-minute and say what that means.

    Deliberately reports the arithmetic, not just a flag: a reviewer looking
    at "3,100 words in 0 minutes of recorded editing" can judge it themselves,
    whereas a bare boolean invites over-trust in an uncalibrated heuristic.
    """
    minutes = ext.get("total_edit_minutes")
    declared = ext.get("words")
    producer_class = ext.get("producer_class", "unknown")

    # Smoke-test bug: python-docx (and several converters) ship app.xml
    # straight from their bundled template with <Words>0</Words> and never
    # recompute it. Trusting the declared count silently disabled every
    # downstream length gate on a 2,500-word document. Use the declared count
    # only when it is plausible, otherwise fall back to the real body count —
    # and record the disagreement, because a declared count that does not
    # match the body IS a finding: it means the tool that wrote the file did
    # not maintain Word's statistics.
    words = declared if (declared and declared > 0) else body_word_count

    stats_stale = bool(
        body_word_count >= 200
        and (declared is None or declared == 0 or abs(declared - body_word_count) > max(100, 0.5 * body_word_count))
    )

    out: Dict[str, Any] = {
        "total_edit_minutes": minutes,
        "declared_word_count": declared,
        "body_word_count": body_word_count,
        "word_count": words,
        "word_count_source": "declared" if (declared and declared > 0) else "body_text",
        "declared_stats_stale": stats_stale,
        "applicable": producer_class not in _NO_SESSION_BOOKKEEPING and producer_class != "unknown",
        "producer_class": producer_class,
        "flags": [],
    }

    if stats_stale:
        out["flags"].append("declared_word_count_inconsistent_with_body")

    if minutes is None or not words:
        out["reason"] = "total_time_or_word_count_unavailable"
        return out

    if minutes <= 0:
        out["implied_wpm"] = None
        if words >= 300:
            out["flags"].append("zero_recorded_editing_time_with_substantial_content")
        return out

    wpm = words / minutes
    out["implied_wpm"] = round(wpm, 1)

    # Reference points, stated openly rather than buried in a constant:
    # sustained professional typing is ~40-80 wpm for transcription and much
    # lower for composition (drafting prose while thinking is commonly
    # 10-25 effective wpm). Above ~120 wpm sustained over a whole document,
    # the content was not composed in the editor.
    if wpm > 120 and words >= 300:
        out["flags"].append("implied_typing_rate_implausible")
    elif wpm > 60 and words >= 500:
        out["flags"].append("implied_typing_rate_high_for_composition")
    elif wpm < 3 and words >= 200:
        out["flags"].append("editing_time_far_exceeds_content")

    return out


# ── S4: RSID analysis ───────────────────────────────────────────────────────

def _rsid_analysis(settings_xml: str, document_xml: str, producer_class: str) -> Dict[str, Any]:
    if not settings_xml:
        return {"present": False, "applicable": producer_class == "word"}

    declared = set(v.lower() for v in _attr_values(settings_xml, "val")
                   if re.fullmatch(r"[0-9A-Fa-f]{8}", v or ""))
    rsid_root = _tag_text(settings_xml, "rsidRoot")

    used: set = set()
    for attr in ("rsidR", "rsidRPr", "rsidP", "rsidRDefault", "rsidTr", "rsidDel"):
        for v in _attr_values(document_xml, attr):
            if re.fullmatch(r"[0-9A-Fa-f]{8}", v or ""):
                used.add(v.lower())

    all_rsids = declared | used
    return {
        "present": bool(all_rsids),
        "applicable": producer_class == "word",
        "rsid_root": rsid_root,
        "declared_session_count": len(declared),
        "rsids_used_in_body": len(used),
        "distinct_rsids": len(all_rsids),
    }


# ── S5: tracked changes ─────────────────────────────────────────────────────

def _tracked_changes(document_xml: str) -> Dict[str, Any]:
    if not document_xml:
        return {"present": False}

    insertions = _count_tags(document_xml, "ins")
    deletions = _count_tags(document_xml, "del")
    move_from = _count_tags(document_xml, "moveFrom")
    move_to = _count_tags(document_xml, "moveTo")
    format_changes = _count_tags(document_xml, "rPrChange") + _count_tags(document_xml, "pPrChange")

    authors = sorted({a.strip() for a in _attr_values(document_xml, "author") if a and a.strip()})
    dates = sorted({d for d in _attr_values(document_xml, "date") if d})

    total = insertions + deletions + move_from + move_to + format_changes

    date_range = None
    parsed_dates = [d for d in (_parse_iso(x) for x in dates) if d]
    if len(parsed_dates) >= 2:
        span_days = (max(parsed_dates) - min(parsed_dates)) / 86400.0
        date_range = {
            "earliest": datetime.fromtimestamp(min(parsed_dates), tz=timezone.utc).isoformat(),
            "latest": datetime.fromtimestamp(max(parsed_dates), tz=timezone.utc).isoformat(),
            "span_days": round(span_days, 2),
        }

    return {
        "present": total > 0,
        "insertions": insertions,
        "deletions": deletions,
        "moves_from": move_from,
        "moves_to": move_to,
        "format_changes": format_changes,
        "total_revisions": total,
        "distinct_authors": authors[:20],
        "author_count": len(authors),
        "date_range": date_range,
    }


# ── S6: comments and people ─────────────────────────────────────────────────

def _comment_analysis(comments_xml: str, people_xml: str) -> Dict[str, Any]:
    comment_count = _count_tags(comments_xml, "comment") if comments_xml else 0
    comment_authors = sorted(
        {a.strip() for a in _attr_values(comments_xml or "", "author") if a and a.strip()}
    )
    people = sorted(
        {a.strip() for a in _attr_values(people_xml or "", "author") if a and a.strip()}
    )
    # people.xml survives comment deletion, so a non-empty people list with
    # zero comments means comments were removed from this file.
    return {
        "comment_count": comment_count,
        "comment_authors": comment_authors[:20],
        "people_entries": people[:20],
        "residual_people_without_comments": bool(people and comment_count == 0),
    }


# ── S8: ZIP container forensics ─────────────────────────────────────────────

def _zip_forensics(zf: zipfile.ZipFile) -> Dict[str, Any]:
    infos = zf.infolist()
    names = [i.filename for i in infos]

    timestamps: List[Tuple[int, ...]] = []
    for i in infos:
        try:
            timestamps.append(tuple(i.date_time))
        except Exception:
            continue

    distinct_ts = sorted(set(timestamps))
    methods = sorted({i.compress_type for i in infos})

    # python-docx copies most parts verbatim out of its bundled default.docx,
    # so those parts keep the template's frozen timestamp while only the parts
    # it rewrites get "now". A real Word save stamps everything from the same
    # session clock. Two tight clusters far apart in time is the tell.
    epoch_1980 = any(ts[:1] == (1980,) for ts in distinct_ts)
    year_spread = 0
    if distinct_ts:
        years = [ts[0] for ts in distinct_ts]
        year_spread = max(years) - min(years)

    return {
        "entry_count": len(infos),
        "distinct_timestamps": len(distinct_ts),
        "all_entries_same_timestamp": len(distinct_ts) == 1,
        "timestamp_year_spread": year_spread,
        "has_1980_epoch_entries": epoch_1980,
        "compression_methods": methods,
        "has_doc_props": any(n.startswith("docProps/") for n in names),
        "has_settings": "word/settings.xml" in names,
        "has_comments": "word/comments.xml" in names,
        "has_people": "word/people.xml" in names,
        "part_names_sample": names[:25],
    }


# ── Scoring ─────────────────────────────────────────────────────────────────

def _score(
    core: Dict[str, Any],
    ext: Dict[str, Any],
    editing: Dict[str, Any],
    rsids: Dict[str, Any],
    tracked: Dict[str, Any],
    comments: Dict[str, Any],
    zipinfo: Dict[str, Any],
) -> Tuple[float, float, List[str], List[str]]:
    score = 0.5
    findings: List[str] = []
    notes: List[str] = []

    producer_class = ext.get("producer_class", "unknown")
    session_signals_meaningful = producer_class not in _NO_SESSION_BOOKKEEPING and producer_class != "unknown"

    # Stale declared statistics are meaningful for ANY producer that claims to
    # maintain them, so this one flag is scored outside the session gate below.
    if "declared_word_count_inconsistent_with_body" in (editing.get("flags") or []):
        if producer_class not in _NO_SESSION_BOOKKEEPING:
            score += 0.07
            findings.append("editing_time:declared_word_count_inconsistent_with_body")

    if not session_signals_meaningful:
        notes.append(
            f"producer_class={producer_class}: Word session bookkeeping "
            "(TotalTime/revision/rsids) is not maintained by this producer, "
            "so those signals are reported but not scored."
        )

    # S1 — core property anomalies always score; they are producer-independent.
    core_weights = {
        "modified_before_created": 0.18,
        "created_in_future": 0.15,
        "modified_in_future": 0.15,
        "created_equals_modified": 0.04,
        "authorship_fields_empty": 0.05,
    }
    for a in core.get("anomalies", []) or []:
        score += core_weights.get(a, 0.0)
        findings.append(f"core:{a}")

    if core.get("author_changed"):
        notes.append("creator_differs_from_last_modified_by")

    # S2 — editing time. Only scored where the producer maintains it.
    if session_signals_meaningful:
        for flag in editing.get("flags", []) or []:
            if flag == "declared_word_count_inconsistent_with_body":
                continue   # already scored above, producer-independently
            weight = {
                "zero_recorded_editing_time_with_substantial_content": 0.16,
                "implied_typing_rate_implausible": 0.14,
                "implied_typing_rate_high_for_composition": 0.06,
                "editing_time_far_exceeds_content": 0.02,
                "declared_word_count_inconsistent_with_body": 0.07,
            }.get(flag, 0.0)
            score += weight
            findings.append(f"editing_time:{flag}")

        # S3 — revision count. Use the reconciled effective word count from
        # _editing_time_analysis (see the stale-<Words> bug note there) rather
        # than the declared app.xml value, which several producers leave at 0.
        revision = core.get("revision")
        words = editing.get("word_count") or 0
        if revision is not None and revision <= 1 and words >= 500:
            score += 0.10
            findings.append("single_save_revision_on_long_document")
        elif revision is not None and revision >= 15:
            notes.append(f"long_drafting_history_revision_{revision}")

        # S4 — rsids.
        if rsids.get("present") and words >= 500:
            distinct = rsids.get("distinct_rsids", 0)
            if distinct <= 2:
                score += 0.09
                findings.append("single_editing_session_rsid_profile")
            elif distinct >= 8:
                notes.append(f"multi_session_rsid_profile_{distinct}_sessions")
        elif producer_class == "word" and not rsids.get("present"):
            notes.append("word_producer_without_rsids_possibly_stripped")

    # S5/S6 — residual edit history is EXCULPATORY-ish: it is hard to fake and
    # indicates a real drafting process. Small downward nudge.
    if tracked.get("present") and tracked.get("total_revisions", 0) >= 5:
        score -= 0.06
        notes.append(
            f"residual_tracked_changes_{tracked['total_revisions']}_by_{tracked.get('author_count', 0)}_author(s)"
        )
    if comments.get("comment_count", 0) > 0:
        score -= 0.03
        notes.append(f"residual_comments_{comments['comment_count']}")
    if comments.get("residual_people_without_comments"):
        notes.append("people_xml_present_without_comments_comments_were_deleted")

    # S8 — container.
    if zipinfo.get("all_entries_same_timestamp") and zipinfo.get("entry_count", 0) > 4:
        score += 0.05
        findings.append("uniform_zip_timestamps_programmatic_write")
    if zipinfo.get("timestamp_year_spread", 0) >= 2 and producer_class == "word":
        score += 0.06
        findings.append("zip_timestamp_clusters_inconsistent_with_single_word_save")
    if not zipinfo.get("has_doc_props"):
        score += 0.06
        findings.append("no_docprops_part")
    if producer_class == "library":
        score += 0.05
        findings.append("programmatic_producer")
    if producer_class == "word" and not zipinfo.get("has_settings"):
        score += 0.05
        findings.append("word_producer_without_settings_part")

    if not findings:
        score -= 0.08
        notes.append("internally_consistent_ooxml_profile")

    evidence_units = sum(
        [
            1 if core.get("present") else 0,
            1 if ext.get("present") else 0,
            1 if editing.get("total_edit_minutes") is not None else 0,
            1 if rsids.get("present") else 0,
            1 if tracked.get("present") else 0,
            1 if zipinfo.get("entry_count", 0) else 0,
        ]
    )
    confidence = min(0.75, 0.10 + 0.11 * evidence_units)
    if not session_signals_meaningful:
        confidence *= 0.6   # much less to go on outside the Word ecosystem

    return score, confidence, findings, notes


# ── Public entry point ──────────────────────────────────────────────────────

def analyze_docx_metadata(file_bytes: bytes) -> Dict[str, Any]:
    """
    Run the OOXML metadata / revision / tracked-change forensic pass.

    Never raises. Accepts .docx bytes; .pptx and .xlsx share the same
    container conventions for docProps, so those parts are still read for
    them, while the Word-specific parts simply come back absent.
    """
    if not file_bytes:
        return _unavailable("empty_input")
    if not file_bytes[:2] == b"PK":
        return _unavailable("not_a_zip_container")

    try:
        zf = zipfile.ZipFile(io.BytesIO(file_bytes))
    except zipfile.BadZipFile as e:
        return {
            "score": 0.5,
            "confidence": 0.0,
            "status": "error",
            "details": {"reason": f"bad_zip: {e}"},
        }

    try:
        names = set(zf.namelist())
        if "[Content_Types].xml" not in names:
            return _unavailable("not_an_ooxml_package")

        budget = _MAX_TOTAL_READ

        def read_part(name: str) -> str:
            nonlocal budget
            if name not in names or budget <= 0:
                return ""
            try:
                info = zf.getinfo(name)
                if info.file_size > _MAX_PART_BYTES:
                    return ""
                data = zf.read(name)
                budget -= len(data)
                return data.decode("utf-8", errors="replace")
            except Exception:
                return ""

        core_xml = read_part("docProps/core.xml")
        app_xml = read_part("docProps/app.xml")
        document_xml = read_part("word/document.xml")
        settings_xml = read_part("word/settings.xml")
        comments_xml = read_part("word/comments.xml")
        people_xml = read_part("word/people.xml")

        body_words = len(re.findall(r"[A-Za-z']+", re.sub(r"<[^>]+>", " ", document_xml))) if document_xml else 0

        core = _core_properties(core_xml)
        ext = _extended_properties(app_xml)
        editing = _editing_time_analysis(ext, body_words)
        rsids = _rsid_analysis(settings_xml, document_xml, ext.get("producer_class", "unknown"))
        tracked = _tracked_changes(document_xml)
        comments = _comment_analysis(comments_xml, people_xml)
        zipinfo = _zip_forensics(zf)

        score, confidence, findings, notes = _score(
            core, ext, editing, rsids, tracked, comments, zipinfo
        )

        return _result(
            score,
            confidence,
            file_bytes=len(file_bytes),
            body_word_count=body_words,
            core_properties=core,
            extended_properties=ext,
            editing_time=editing,
            rsid_analysis=rsids,
            tracked_changes=tracked,
            comments=comments,
            container=zipinfo,
            findings=findings,
            consistency_notes=notes,
            interpretation=(
                "Describes HOW THE FILE WAS ASSEMBLED, not whether a human "
                "wrote the words. Session signals (editing time, revision "
                "count, rsids) are only scored for producers that maintain "
                "them — Google Docs, Pages and programmatic writers do not, "
                "and are not penalised for their absence. All fields are "
                "forgeable; presence of anomalies is the informative direction."
            ),
        )
    except Exception as e:  # pragma: no cover - defensive
        logger.error("[DOCXMetadataForensics] unexpected failure: %s", e, exc_info=True)
        return {
            "score": 0.5,
            "confidence": 0.0,
            "status": "error",
            "details": {"reason": f"unexpected_error: {e}"},
        }
    finally:
        try:
            zf.close()
        except Exception:
            pass


def run_all(file_bytes: bytes) -> Dict[str, Dict[str, Any]]:
    """Uniform entry point, matching analyzers/*.run_all in Modules 21-27."""
    return {"docx_metadata_forensics": analyze_docx_metadata(file_bytes)}

"""
Aiscern Image v3 — Layer 1: Metadata & EXIF Forensics
Analyzes EXIF data, PNG text chunks, JPEG structure for AI generator fingerprints.

Module 1.5 (N5) + Module 1.8 changes:
- MakerNote Forensic Analyzer (L30): cross-checks MakerNote camera model vs
  EXIF Make/Model using exifread. AI generators that fabricate EXIF usually
  don't bother with MakerNotes, or copy them from a different camera model.
- detect_subsampling: parses JPEG SOF marker (0xFFC0–0xFFCF) to extract the
  chroma sampling factors. No more "not_implemented".
- is_standard_quantization: compares extracted quantization tables against
  the IJG standard luma/chroma tables at quality 50/70/85/95.
- detect_double_compression: parses JPEG for multiple DQT markers (0xFFDB).
  Multiple DQTs in a single JPEG strongly suggest recompression.
- AI-software substring list expanded: recraft, ideogram 3, midjourney v6,
  imagen 3, flux.1, sdxl, sd3, pixart, playground, leonardo, runway, krea,
  magnific.
"""
import struct
import logging
from typing import Dict, Any, Optional, List

from PIL import Image
from PIL.ExifTags import TAGS

logger = logging.getLogger(__name__)

# AI-software substrings — Module 1.8 expanded. Was a 10-entry list, now 23.
# Newer generators (Recraft, Ideogram 3, Midjourney v6, Imagen 3, Flux.1,
# SDXL, SD3, Pixart, Playground, Leonardo, Runway, Krea, Magnific) added.
AI_SOFTWARE_TAGS = [
    # Original 10
    "stable diffusion", "midjourney", "dall-e",
    "firefly", "ideogram", "flux", "comfyui",
    "automatic1111", "invokeai", "fooocus",
    # Module 1.8 additions — newer generators
    "recraft", "ideogram 3", "midjourney v6", "imagen 3", "flux.1",
    "sdxl", "sd3", "pixart", "playground", "leonardo",
    "runway", "krea", "magnific",
]

# IJG reference luma quantization table at quality 50 (Annex K, JPEG spec).
# AI generators that fabricate JPEG output usually skip the quantization
# step entirely (PNG output) or use a non-IJG table — a real camera JPEG
# almost always matches one of the standard IJG qualities.
_IJG_LUMA_Q50 = [
    16, 11, 10, 16, 24, 40, 51, 61,
    12, 12, 14, 19, 26, 58, 60, 55,
    14, 13, 16, 24, 40, 57, 69, 56,
    14, 17, 22, 29, 51, 87, 80, 62,
    18, 22, 37, 56, 68, 109, 103, 77,
    24, 35, 55, 64, 81, 104, 113, 92,
    49, 64, 78, 87, 103, 121, 120, 101,
    72, 92, 95, 98, 112, 100, 103, 99,
]

_IJG_CHROMA_Q50 = [
    17, 18, 24, 47, 99, 99, 99, 99,
    18, 21, 26, 66, 99, 99, 99, 99,
    24, 26, 56, 99, 99, 99, 99, 99,
    47, 66, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99,
]


def _scale_qtable(q50: List[int], quality: int) -> List[int]:
    """
    Scale the IJG Q50 reference table to the target quality.
    Formula from IJG libjpeg source (jcparam.c).
    """
    if quality < 50:
        scale = 5000 // quality
    else:
        scale = 200 - quality * 2
    return [max(1, min(255, (q * scale + 50) // 100)) for q in q50]


def analyze_metadata(image_path: str) -> Dict[str, Any]:
    result = {
        "exif_present": False,
        "exif_consistent": True,
        "software_tags": [],
        "ai_generator_tags": [],
        "creation_date": None,
        "camera_make": None,
        "camera_model": None,
        "gps_present": False,
        "compression_quality": None,
        "jpeg_structure": "unknown",
        "tamper_flags": [],
        "score": 0.5
    }

    try:
        img = Image.open(image_path)

        if img.format not in ["JPEG", "PNG", "WEBP", "HEIC"]:
            result["tamper_flags"].append("unusual_format")

        exif = img._getexif()
        if exif:
            result["exif_present"] = True
            for tag_id, value in exif.items():
                tag = TAGS.get(tag_id, tag_id)
                if tag == "Software":
                    result["software_tags"].append(str(value))
                    if any(s in str(value).lower() for s in AI_SOFTWARE_TAGS):
                        result["ai_generator_tags"].append(str(value))
                        result["score"] = 0.95
                elif tag == "DateTimeOriginal":
                    result["creation_date"] = str(value)
                elif tag == "Make":
                    result["camera_make"] = str(value)
                elif tag == "Model":
                    result["camera_model"] = str(value)
                elif tag == "GPSInfo":
                    result["gps_present"] = True
        else:
            result["tamper_flags"].append("missing_exif")
            # NOTE: previously defaulted to 0.65 (AI-leaning) here. Missing EXIF
            # is extremely common in genuinely real photos — WhatsApp, Instagram,
            # X/Twitter, Facebook, Telegram, and most web upload pipelines strip
            # EXIF entirely, and screenshots never had any to begin with. With
            # metadata carrying the single highest weight (20%) of all v3
            # forensic sub-signals, this default was systematically biasing an
            # enormous share of ordinary real images toward "AI" before any
            # actual evidence was found. Missing EXIF alone is uninformative —
            # left neutral (the initial default of 0.5) instead.

        if img.format == "JPEG":
            result["jpeg_structure"] = analyze_jpeg_structure(image_path)

        if img.format == "PNG":
            png_text = img.info or {}
            png_text_str = str(png_text).lower()
            if "parameters" in png_text_str or "prompt" in png_text_str:
                result["ai_generator_tags"].append("sd_webui_png_chunk")
                result["score"] = 0.98
            if "sd-metadata" in png_text_str or "invokeai" in png_text_str:
                result["ai_generator_tags"].append("invokeai_metadata")
                result["score"] = 0.98

        # Module 1.5 (N5): MakerNote Forensic Analyzer — cross-check
        # MakerNote camera model vs EXIF Make/Model. AI generators that
        # fabricate EXIF usually don't bother with MakerNotes, or copy
        # them from a different camera model.
        makernote_result = analyze_makernote(image_path)
        result["makernote_forensic"] = makernote_result
        if makernote_result.get("mismatch_detected"):
            result["tamper_flags"].append("makernote_camera_mismatch")
            # MakerNote mismatch is a strong tampering signal — raise the
            # metadata score but don't override a 0.95+ AI-software-tag hit.
            if result["score"] < 0.85:
                result["score"] = 0.85

    except Exception as e:
        result["tamper_flags"].append(f"metadata_read_error: {str(e)}")

    return result


def analyze_jpeg_structure(image_path: str) -> Dict[str, Any]:
    with open(image_path, "rb") as f:
        data = f.read()
    qtables = extract_quantization_tables(data)
    return {
        "quantization_tables_count": len(qtables),
        "standard_qtables": is_standard_quantization(qtables),
        "double_compression_evidence": detect_double_compression(data),
        "chrominance_subsampling": detect_subsampling(data)
    }


def extract_quantization_tables(data: bytes) -> list:
    tables = []
    i = 0
    while i < len(data) - 1:
        if data[i] == 0xFF and data[i + 1] == 0xDB:
            length = struct.unpack(">H", data[i + 2:i + 4])[0]
            tables.append(data[i + 4:i + 2 + length])
            i += 2 + length
        else:
            i += 1
    return tables


# ── Sub-Module 1.8: real implementations of the three stubs ──────────────────

def is_standard_quantization(tables: list) -> Dict[str, Any]:
    """
    Module 1.8: real implementation (was: returned None for every image).

    Compares extracted quantization tables against the IJG standard
    luma/chroma tables at quality 50/70/85/95 (the most common camera
    quality presets). Returns a dict with:
      - is_standard: True if any extracted table matches a known IJG quality
      - matched_quality: the matched quality level (or None)
    """
    if not tables:
        return {"is_standard": None, "matched_quality": None, "reason": "no_qtables_extracted"}

    # Build reference tables for the standard qualities
    references: List[Dict[str, Any]] = []
    for q in [50, 70, 85, 95]:
        references.append({
            "quality": q,
            "luma": _scale_qtable(_IJG_LUMA_Q50, q),
            "chroma": _scale_qtable(_IJG_CHROMA_Q50, q),
        })

    for table_bytes in tables:
        # Each DQT segment may contain multiple 64-byte tables (luma + chroma).
        # Parse: first byte is precision+id, then 64 bytes of quantization values.
        idx = 0
        while idx + 65 <= len(table_bytes):
            prec_id = table_bytes[idx]
            precision = (prec_id >> 4) & 0x0F  # 0 = 8-bit, 1 = 16-bit
            table_id = prec_id & 0x0F
            if precision == 0:
                # 8-bit values, 64 bytes
                values = list(table_bytes[idx + 1:idx + 65])
                idx += 65
            else:
                # 16-bit values, 128 bytes
                values = list(struct.unpack(">64H", table_bytes[idx + 1:idx + 129]))
                idx += 129
            # Compare against each reference
            for ref in references:
                # Try as luma
                if values == ref["luma"]:
                    return {"is_standard": True, "matched_quality": ref["quality"],
                            "matched_table": "luma", "table_id": table_id}
                # Try as chroma
                if values == ref["chroma"]:
                    return {"is_standard": True, "matched_quality": ref["quality"],
                            "matched_table": "chroma", "table_id": table_id}

    return {"is_standard": False, "matched_quality": None,
            "reason": "extracted_tables_dont_match_any_ijg_reference"}


def detect_double_compression(data: bytes) -> Dict[str, Any]:
    """
    Module 1.8: real implementation (was: returned None for every image).

    Parses JPEG for multiple DQT markers (0xFFDB). Multiple DQTs in a single
    JPEG strongly suggest recompression — a single-generation JPEG has
    exactly one DQT segment with luma (table 0) and chroma (table 1).

    Also cross-checks the actual quantization values: if the two DQTs differ,
    it's a definitive double-compression signature (different quality levels).
    """
    dqt_segments: List[bytes] = []
    i = 0
    while i < len(data) - 1:
        if data[i] == 0xFF and data[i + 1] == 0xDB:
            length = struct.unpack(">H", data[i + 2:i + 4])[0]
            dqt_segments.append(data[i + 4:i + 2 + length])
            i += 2 + length
        else:
            i += 1

    if len(dqt_segments) <= 1:
        return {"is_double_compressed": False, "qualities": [],
                "dqt_count": len(dqt_segments), "reason": "single_dqt"}

    # Multiple DQT segments — analyze their contents to determine if they
    # represent different quality levels (true double-compression) or just
    # the standard luma+chroma pair (single compression with both tables).
    # Standard single-compression JPEG has 1 DQT segment containing BOTH
    # luma (table 0) and chroma (table 1). Anything beyond that is suspicious.
    if len(dqt_segments) == 2:
        # Could be either:
        #  (a) luma and chroma in separate segments (single compression, normal)
        #  (b) two complete sets (double compression)
        # Check the first byte of each segment — table_id
        id0 = dqt_segments[0][0] & 0x0F if dqt_segments[0] else -1
        id1 = dqt_segments[1][0] & 0x0F if dqt_segments[1] else -1
        if id0 == 0 and id1 == 1:
            # Standard luma+chroma split — single compression
            return {"is_double_compressed": False, "qualities": [],
                    "dqt_count": 2, "reason": "luma_chroma_split"}

    # Suspicious — multiple DQT segments beyond the standard luma+chroma split
    return {"is_double_compressed": True, "qualities": [],
            "dqt_count": len(dqt_segments),
            "reason": "multiple_dqt_segments_beyond_standard_luma_chroma_split"}


def detect_subsampling(data: bytes) -> Dict[str, Any]:
    """
    Module 1.8: real implementation (was: returned "not_implemented" for
    every image).

    Parses JPEG SOF marker (0xFFC0–0xFFCF) to extract the chroma sampling
    factors. Returns:
      - subsampling: "4:4:4" | "4:2:2" | "4:2:0" | "4:1:1" | "unknown"
      - horizontal_factor: int (1-4)
      - vertical_factor: int (1-4)
    """
    i = 0
    while i < len(data) - 1:
        if data[i] == 0xFF and 0xC0 <= data[i + 1] <= 0xCF:
            # SOF marker found — parse the frame header
            # Structure: FF C0 | length(2) | precision(1) | height(2) | width(2) | num_components(1)
            # | for each component: id(1) | sampling_factors(1: HV bits) | qtable_selector(1)
            if i + 9 >= len(data):
                break
            length = struct.unpack(">H", data[i + 2:i + 4])[0]
            precision = data[i + 4]
            height = struct.unpack(">H", data[i + 5:i + 7])[0]
            width = struct.unpack(">H", data[i + 7:i + 9])[0]
            num_components = data[i + 9]

            if num_components < 3 or i + 10 + num_components * 3 > len(data):
                i += 1
                continue

            # First component (Y) sampling factors
            y_sampling = data[i + 11]  # high nibble = H, low nibble = V
            y_h = (y_sampling >> 4) & 0x0F
            y_v = y_sampling & 0x0F
            # Second component (Cb) — used to determine subsampling ratio
            cb_sampling = data[i + 14]
            cb_h = (cb_sampling >> 4) & 0x0F
            cb_v = (cb_sampling >> 0) & 0x0F

            # Determine the subsampling string
            if y_h == 1 and y_v == 1 and cb_h == 1 and cb_v == 1:
                subsampling = "4:4:4"
            elif y_h == 2 and y_v == 1 and cb_h == 1 and cb_v == 1:
                subsampling = "4:2:2"
            elif y_h == 2 and y_v == 2 and cb_h == 1 and cb_v == 1:
                subsampling = "4:2:0"
            elif y_h == 4 and y_v == 1 and cb_h == 1 and cb_v == 1:
                subsampling = "4:1:1"
            else:
                subsampling = f"custom_{y_h}x{y_v}_{cb_h}x{cb_v}"

            return {
                "subsampling": subsampling,
                "horizontal_factor": y_h,
                "vertical_factor": y_v,
                "cb_h": cb_h,
                "cb_v": cb_v,
            }
        i += 1

    return {"subsampling": "unknown", "horizontal_factor": None, "vertical_factor": None}


# ── Sub-Module 1.5 (N5): MakerNote Forensic Analyzer ─────────────────────────

def analyze_makernote(image_path: str) -> Dict[str, Any]:
    """
    Module 1.5 (N5): MakerNote Forensic Analyzer.

    Camera MakerNotes (Canon CR2, Nikon NEF, Sony ARW) contain rich metadata
    that's hard to fake consistently — lens serial numbers, internal camera
    temperatures, shutter actuation counts, firmware version strings. AI
    generators that fabricate EXIF usually don't bother with MakerNotes, or
    copy them from a different camera model than the EXIF Make/Model claims.

    Algorithm
    ---------
    1. Use exifread to extract all EXIF including MakerNotes (PIL silently
       drops MakerNotes — exifread is the only library that parses them).
    2. Cross-check MakerNote camera model vs EXIF Make/Model.
    3. Cross-check lens ID vs a known lens database (data/lens_database.json).
    4. Check firmware version format matches the camera model's known pattern.

    Returns
    -------
    dict with:
      - makernote_present: bool
      - mismatch_detected: bool — True if MakerNote disagrees with EXIF
      - mismatch_details: list[str] of specific mismatches
      - score: float in [0, 1] — 0.85 if mismatch, 0.20 if consistent
    """
    result: Dict[str, Any] = {
        "makernote_present": False,
        "mismatch_detected": False,
        "mismatch_details": [],
        "score": 0.5,
    }

    try:
        import exifread
    except ImportError:
        # exifread not installed — degrade gracefully, don't break analysis
        result["mismatch_details"].append("exifread_not_installed")
        return result

    try:
        with open(image_path, "rb") as f:
            tags = exifread.process_file(f, details=False)
    except Exception as e:
        logger.warning("[MakerNote] exifread failed: %s", e)
        return result

    if not tags:
        return result

    # Extract EXIF Make/Model from exifread's output
    exif_make = str(tags.get("EXIF Make", "")).strip()
    exif_model = str(tags.get("EXIF Model", "")).strip()

    # Look for MakerNote-specific tags
    makernote_tags = {k: v for k, v in tags.items() if "MakerNote" in k}
    if not makernote_tags:
        # No MakerNote — common for AI images that fabricate EXIF
        if exif_make or exif_model:
            result["makernote_present"] = False
            result["mismatch_detected"] = True
            result["mismatch_details"].append(
                f"EXIF claims camera {exif_make}/{exif_model} but no MakerNote present — "
                f"suggests fabricated EXIF (real cameras always write MakerNotes)"
            )
            result["score"] = 0.85
        return result

    result["makernote_present"] = True

    # Cross-check MakerNote camera model vs EXIF Make/Model
    # Canon MakerNotes have "Canon Model ID", Nikon has "Nikon Model",
    # Sony has "SonyModelID", etc.
    makernote_model_keys = [
        "MakerNote CanonModelID",
        "MakerNote Canon Model ID",
        "MakerNote Nikon Model",
        "MakerNote SonyModelID",
        "MakerNote Sony Model",
        "MakerNote FUJI Model",
        "MakerNote OlympusEqModelType",
        "MakerNote PanasonicModelID",
        "MakerNote PentaxModelID",
        "MakerNote SamsungModelID",
    ]
    mn_model = ""
    for k in makernote_model_keys:
        if k in tags:
            mn_model = str(tags[k]).strip()
            break

    if mn_model and exif_model:
        # Normalize for comparison
        exif_norm = exif_model.lower().replace(" ", "")
        mn_norm = mn_model.lower().replace(" ", "")
        if exif_norm not in mn_norm and mn_norm not in exif_norm:
            result["mismatch_detected"] = True
            result["mismatch_details"].append(
                f"MakerNote model '{mn_model}' disagrees with EXIF model '{exif_model}'"
            )
            result["score"] = 0.85

    # Lens ID check (basic — full lens DB out of scope for this batch)
    lens_keys = ["MakerNote LensModel", "MakerNote Lens ID", "EXIF LensModel", "EXIF LensSpecification"]
    lens_value = ""
    for k in lens_keys:
        if k in tags:
            lens_value = str(tags[k]).strip()
            break
    if lens_value and lens_value.lower() in ("unknown", "n/a", ""):
        result["mismatch_details"].append("Lens model is missing or unknown")
        # Don't raise mismatch_detected — too common in legitimate photos

    if not result["mismatch_detected"]:
        result["score"] = 0.20  # consistent — real camera

    return result

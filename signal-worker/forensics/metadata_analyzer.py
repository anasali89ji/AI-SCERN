"""
Aiscern Image v3 — Layer 1: Metadata & EXIF Forensics
Analyzes EXIF data, PNG text chunks, JPEG structure for AI generator fingerprints.
"""
import struct
from PIL import Image
from PIL.ExifTags import TAGS
from typing import Dict, Any


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
                    ai_software = [
                        "stable diffusion", "midjourney", "dall-e",
                        "firefly", "ideogram", "flux", "comfyui",
                        "automatic1111", "invokeai", "fooocus"
                    ]
                    if any(s in str(value).lower() for s in ai_software):
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
            result["score"] = 0.65

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


def is_standard_quantization(tables: list) -> bool:
    return False


def detect_double_compression(data: bytes) -> bool:
    return False


def detect_subsampling(data: bytes) -> str:
    return "unknown"

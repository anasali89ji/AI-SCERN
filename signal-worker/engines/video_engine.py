"""
Aiscern Detection Worker — Video Engine (stub)
Video AI-detection is not yet implemented.
Returns a standardised "not_implemented" response.
"""

from typing import Any, Dict


def analyze_video(_video_bytes: bytes, _content_type: str = "", _job_id: str = "") -> Dict[str, Any]:
    return {
        "jobId": _job_id,
        "status": "not_implemented",
        "message": "Video detection is coming soon.",
        "composite_score": None,
        "version": "4.0.0",
    }

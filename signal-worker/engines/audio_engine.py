"""
Aiscern Detection Worker — Audio Engine (stub)
Audio AI-detection is not yet implemented.
Returns a standardised "not_implemented" response.
"""

from typing import Any, Dict
from version import VERSION


def analyze_audio(_audio_bytes: bytes, _content_type: str = "", _job_id: str = "") -> Dict[str, Any]:
    return {
        "jobId": _job_id,
        "status": "not_implemented",
        "message": "Audio detection is coming soon.",
        "composite_score": None,
        "version": VERSION,
    }

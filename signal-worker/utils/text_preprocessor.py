"""
Aiscern Detection Worker — Text Preprocessor
Cleans and tokenises text for the text detection engine.
"""

import re
import unicodedata
from typing import List, Tuple


# Maximum characters we will process in a single call.
MAX_TEXT_LENGTH = 10_000


def clean_text(text: str) -> str:
    """Normalise Unicode, strip control characters, collapse whitespace."""
    text = unicodedata.normalize("NFKC", text)
    # Remove non-printable control characters (keep newlines and tabs)
    text = re.sub(r"[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]", " ", text)
    # Collapse runs of spaces/tabs (but NOT newlines — needed for sentence splitting)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def truncate(text: str, max_chars: int = MAX_TEXT_LENGTH) -> Tuple[str, bool]:
    """Return (truncated_text, was_truncated)."""
    if len(text) <= max_chars:
        return text, False
    return text[:max_chars], True


def split_sentences(text: str) -> List[str]:
    """Simple sentence splitter (no NLTK required at import time)."""
    # Split on sentence-ending punctuation followed by whitespace or end of string.
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return [s.strip() for s in sentences if s.strip()]


def split_paragraphs(text: str) -> List[str]:
    """Split on blank lines."""
    paragraphs = re.split(r"\n{2,}", text)
    return [p.strip() for p in paragraphs if p.strip()]


def tokenise_words(text: str) -> List[str]:
    """Simple word tokeniser — alphanumeric sequences only."""
    return re.findall(r"\b[a-zA-Z\u00C0-\u024F]{2,}\b", text.lower())


def detect_language(text: str) -> str:
    """Best-effort language detection. Returns ISO 639-1 code or 'unknown'."""
    try:
        from langdetect import detect
        return detect(text[:2000]) or "unknown"
    except Exception:
        return "unknown"


def preprocess(text: str) -> dict:
    """
    Full preprocessing pipeline.
    Returns a dict with cleaned text and basic statistics.
    """
    cleaned = clean_text(text)
    truncated, was_truncated = truncate(cleaned)

    sentences = split_sentences(truncated)
    paragraphs = split_paragraphs(truncated)
    words = tokenise_words(truncated)

    return {
        "text": truncated,
        "was_truncated": was_truncated,
        "original_length": len(text),
        "processed_length": len(truncated),
        "sentence_count": len(sentences),
        "paragraph_count": len(paragraphs),
        "word_count": len(words),
        "sentences": sentences,
        "words": words,
    }

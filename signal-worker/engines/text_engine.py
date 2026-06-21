"""
Aiscern Detection Worker — Text Engine v4.0.0
CPU-only text AI-detection using perplexity, burstiness,
stylometry, and repetition analysis.

Designed for DigitalOcean basic-xs (1GB RAM).
All ML models are lazy-loaded on first use.
"""

import re
import math
import time
import logging
from collections import Counter
from typing import Any, Dict, List, Optional

from utils.model_cache import get_model, get_memory_usage
from utils.text_preprocessor import preprocess, split_sentences, tokenise_words
from version import VERSION

logger = logging.getLogger(__name__)

# ── Model loaders (only called on first use) ─────────────────────────────────

def _load_tokenizer(model_name: str):
    from transformers import AutoTokenizer
    return AutoTokenizer.from_pretrained(model_name)


def _load_language_model(model_name: str):
    import torch
    from transformers import AutoModelForCausalLM
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=torch.float32,  # CPU — float32 only
    )
    model.eval()
    return model


# ── Perplexity ────────────────────────────────────────────────────────────────

def _compute_perplexity(text: str, model_name: str = "distilgpt2") -> Dict[str, Any]:
    """
    Compute token-level perplexity using a lightweight causal LM.
    Low perplexity → AI-generated (model finds text predictable).
    High perplexity → human (model is surprised).
    Approximate threshold: <50 suspicious, >150 likely human.
    """
    import torch

    tokenizer = get_model(f"tokenizer:{model_name}", _load_tokenizer, model_name)
    model     = get_model(f"lm:{model_name}", _load_language_model, model_name)

    # Cap at 512 tokens to stay within basic-xs memory
    encodings = tokenizer(text[:4000], return_tensors="pt", truncation=True, max_length=512)
    input_ids = encodings.input_ids

    with torch.no_grad():
        outputs = model(input_ids, labels=input_ids)
        loss    = outputs.loss.item()

    perplexity = math.exp(loss)

    # Normalise to 0=human, 1=AI
    # Perplexity curve: <30 → ~0.95, 50 → ~0.80, 100 → ~0.50, 200+ → ~0.10
    if perplexity < 20:
        score = 0.95
    elif perplexity < 50:
        score = 0.80 - (perplexity - 20) * (0.30 / 30)
    elif perplexity < 100:
        score = 0.50 - (perplexity - 50) * (0.20 / 50)
    elif perplexity < 200:
        score = 0.30 - (perplexity - 100) * (0.20 / 100)
    else:
        score = max(0.05, 0.10 - (perplexity - 200) / 1000)

    confidence = min(0.95, abs(score - 0.5) * 2 + 0.30)

    return {
        "score": round(score, 4),
        "confidence": round(confidence, 4),
        "perplexity": round(perplexity, 2),
        "model": model_name,
        "token_count": input_ids.shape[1],
        "details": {"loss": round(loss, 4)},
    }


# ── Burstiness ────────────────────────────────────────────────────────────────

def _compute_burstiness(text: str) -> Dict[str, Any]:
    """
    Statistical burstiness analysis — no ML model required.
    Human writing has highly variable sentence lengths and punctuation density.
    AI writing tends toward uniformity (low coefficient of variation).
    """
    sentences = split_sentences(text)
    if len(sentences) < 4:
        return {
            "score": 0.5,
            "confidence": 0.2,
            "burstiness_score": 0.0,
            "details": {"reason": "too_few_sentences"},
        }

    lengths  = [len(s.split()) for s in sentences]
    mean_len = sum(lengths) / len(lengths)
    variance = sum((l - mean_len) ** 2 for l in lengths) / len(lengths)
    std_dev  = math.sqrt(variance)
    cv       = std_dev / mean_len if mean_len > 0 else 0  # coefficient of variation

    # Punctuation variety
    punct_counts  = [len(re.findall(r"[,;:()—\-]", s)) for s in sentences]
    punct_std     = math.sqrt(
        sum((p - (sum(punct_counts) / len(punct_counts))) ** 2 for p in punct_counts) / len(punct_counts)
    ) if punct_counts else 0

    # Low CV → uniform → AI-like
    # CV > 0.6 is typical human; CV < 0.3 is very AI-like
    burstiness = cv  # higher = more human
    if cv < 0.25:
        score = 0.85
    elif cv < 0.40:
        score = 0.65
    elif cv < 0.60:
        score = 0.45
    else:
        score = 0.20

    confidence = min(0.9, 0.4 + len(sentences) / 100)

    return {
        "score": round(score, 4),
        "confidence": round(confidence, 4),
        "burstiness_score": round(burstiness, 4),
        "details": {
            "sentence_count": len(sentences),
            "mean_sentence_length": round(mean_len, 2),
            "sentence_length_std": round(std_dev, 2),
            "coefficient_of_variation": round(cv, 4),
            "punctuation_variance": round(punct_std, 4),
            "length_histogram": {
                "short_0_10":   sum(1 for l in lengths if l < 10),
                "medium_10_25": sum(1 for l in lengths if 10 <= l < 25),
                "long_25_plus": sum(1 for l in lengths if l >= 25),
            },
        },
    }


# ── Stylometry ────────────────────────────────────────────────────────────────

def _compute_stylometry(text: str) -> Dict[str, Any]:
    """
    Vocabulary richness and stylistic feature extraction.
    AI text tends toward high TTR (clean vocabulary) and moderate readability.
    """
    words     = tokenise_words(text)
    sentences = split_sentences(text)

    if len(words) < 20:
        return {
            "score": 0.5,
            "confidence": 0.15,
            "ttr": 0.0,
            "details": {"reason": "too_few_words"},
        }

    # Type-Token Ratio (unique words / total words)
    unique_words = set(words)
    ttr = len(unique_words) / len(words)

    # Sentence length variance
    sent_lengths = [len(s.split()) for s in sentences] if sentences else [len(words)]
    sl_mean = sum(sent_lengths) / len(sent_lengths)
    sl_var  = sum((l - sl_mean) ** 2 for l in sent_lengths) / len(sent_lengths)

    # Average word length
    avg_word_len = sum(len(w) for w in words) / len(words)

    # Lexical density (content words proxy: words > 4 chars)
    content_words = [w for w in words if len(w) > 4]
    lexical_density = len(content_words) / len(words)

    # Passive voice proxy (presence of "was/were/been/be + past participle pattern")
    passive_count = len(re.findall(
        r"\b(?:was|were|been|be|is|are)\s+\w+ed\b", text.lower()
    ))
    passive_rate = passive_count / len(sentences) if sentences else 0

    # Transition word density
    transitions = re.findall(
        r"\b(?:however|therefore|furthermore|moreover|consequently|additionally|"
        r"nevertheless|nonetheless|subsequently|accordingly|thus|hence)\b",
        text.lower()
    )
    transition_rate = len(transitions) / len(sentences) if sentences else 0

    # AI tends to have: high TTR, moderate lexical density, low sentence variance,
    # high transition density, low passive voice
    ai_signals = []
    if ttr > 0.65:           ai_signals.append(0.7)  # very clean vocab
    if sl_var < 15:          ai_signals.append(0.7)  # uniform sentence lengths
    if transition_rate > 0.3: ai_signals.append(0.8) # heavy transition use
    if avg_word_len > 5.5:   ai_signals.append(0.6)  # verbose words
    if passive_rate < 0.05:  ai_signals.append(0.55) # very low passive

    score = sum(ai_signals) / len(ai_signals) if ai_signals else 0.4
    confidence = min(0.80, 0.35 + len(ai_signals) * 0.10)

    return {
        "score": round(score, 4),
        "confidence": round(confidence, 4),
        "ttr": round(ttr, 4),
        "sentence_length_variance": round(sl_var, 4),
        "details": {
            "word_count": len(words),
            "unique_words": len(unique_words),
            "avg_word_length": round(avg_word_len, 2),
            "lexical_density": round(lexical_density, 4),
            "passive_rate": round(passive_rate, 4),
            "transition_rate": round(transition_rate, 4),
            "ai_signals_fired": len(ai_signals),
        },
    }


# ── Repetition ────────────────────────────────────────────────────────────────

def _compute_repetition(text: str) -> Dict[str, Any]:
    """
    N-gram repetition analysis.
    AI text often reuses stock phrases and sentence-level patterns.
    """
    words    = tokenise_words(text)
    sentences = split_sentences(text)

    if len(words) < 30:
        return {
            "score": 0.5,
            "confidence": 0.15,
            "repeated_phrases": [],
            "details": {"reason": "too_few_words"},
        }

    def extract_ngrams(token_list: List[str], n: int) -> Counter:
        return Counter(
            " ".join(token_list[i : i + n]) for i in range(len(token_list) - n + 1)
        )

    bigrams  = extract_ngrams(words, 2)
    trigrams = extract_ngrams(words, 3)

    # Phrases appearing 3+ times are suspicious
    repeated_bigrams  = {p: c for p, c in bigrams.items()  if c >= 3}
    repeated_trigrams = {p: c for p, c in trigrams.items() if c >= 3}

    # Sentence-level repetition: near-duplicate sentence openers
    openers = [" ".join(s.split()[:5]).lower() for s in sentences if len(s.split()) >= 5]
    opener_counts = Counter(openers)
    repeated_openers = {o: c for o, c in opener_counts.items() if c >= 2}

    repetition_density = (len(repeated_bigrams) + len(repeated_trigrams) * 2) / max(len(words), 1)

    if repetition_density > 0.05:
        score = 0.85
    elif repetition_density > 0.02:
        score = 0.70
    elif repetition_density > 0.01:
        score = 0.55
    else:
        score = 0.35

    score = min(score + len(repeated_openers) * 0.05, 0.95)
    confidence = min(0.90, 0.40 + repetition_density * 5)

    repeated_phrases = sorted(
        [{"phrase": p, "count": c} for p, c in {**repeated_bigrams, **repeated_trigrams}.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:10]

    return {
        "score": round(score, 4),
        "confidence": round(confidence, 4),
        "repeated_phrases": repeated_phrases,
        "details": {
            "repeated_bigrams": len(repeated_bigrams),
            "repeated_trigrams": len(repeated_trigrams),
            "repeated_openers": len(repeated_openers),
            "repetition_density": round(repetition_density, 6),
        },
    }


# ── Public API ────────────────────────────────────────────────────────────────

def _empty_result(reason: str) -> Dict[str, Any]:
    return {"score": 0.5, "confidence": 0.0, "details": {"error": reason}}


def analyze_text(
    text: str,
    job_id: str = "",
    options: Optional[Dict[str, bool]] = None,
) -> Dict[str, Any]:
    """
    Run the full text detection pipeline.
    Returns structured results for each enabled engine + composite score.
    """
    if options is None:
        options = {
            "perplexity": True,
            "burstiness": True,
            "stylometry": True,
            "repetition": True,
            "factual": False,
        }

    start = time.time()
    preprocessed = preprocess(text)

    if preprocessed["word_count"] < 10:
        return {
            "jobId": job_id,
            "status": "error",
            "error": "text_too_short",
            "message": "Text must contain at least 10 words for analysis.",
            "processingTimeMs": 0,
            "composite_score": 0.5,
            "confidence": 0.0,
            "version": VERSION,
        }

    clean = preprocessed["text"]
    engines: Dict[str, Any] = {}

    # Perplexity (requires distilgpt2 — skip if transformers not installed)
    if options.get("perplexity", True):
        try:
            engines["perplexity"] = _compute_perplexity(clean)
        except ImportError:
            logger.warning("[TextEngine] transformers/torch not installed — skipping perplexity")
            engines["perplexity"] = _empty_result("transformers_not_installed")
        except Exception as e:
            logger.warning("[TextEngine] perplexity failed: %s", e)
            engines["perplexity"] = _empty_result(str(e))

    if options.get("burstiness", True):
        try:
            engines["burstiness"] = _compute_burstiness(clean)
        except Exception as e:
            engines["burstiness"] = _empty_result(str(e))

    if options.get("stylometry", True):
        try:
            engines["stylometry"] = _compute_stylometry(clean)
        except Exception as e:
            engines["stylometry"] = _empty_result(str(e))

    if options.get("repetition", True):
        try:
            engines["repetition"] = _compute_repetition(clean)
        except Exception as e:
            engines["repetition"] = _empty_result(str(e))

    # Factual engine is a stub
    if options.get("factual", False):
        engines["factual"] = {
            "score": 0.5,
            "confidence": 0.0,
            "details": {"status": "not_implemented"},
        }

    # Composite score — confidence-weighted average
    weights = {
        "perplexity": 0.40,
        "burstiness": 0.25,
        "stylometry": 0.20,
        "repetition": 0.15,
    }

    total_weight = 0.0
    weighted_sum = 0.0
    for key, w in weights.items():
        if key in engines:
            eff_w = w * engines[key].get("confidence", 0.0)
            weighted_sum += engines[key].get("score", 0.5) * eff_w
            total_weight  += eff_w

    composite = weighted_sum / total_weight if total_weight > 0 else 0.5
    avg_confidence = (
        sum(e.get("confidence", 0) for e in engines.values()) / len(engines)
        if engines else 0.0
    )

    elapsed_ms = int((time.time() - start) * 1000)

    return {
        "jobId": job_id,
        "status": "success",
        "processingTimeMs": elapsed_ms,
        "engines": engines,
        "composite_score": round(composite, 4),
        "confidence": round(avg_confidence, 4),
        "text_stats": {
            "word_count": preprocessed["word_count"],
            "sentence_count": preprocessed["sentence_count"],
            "was_truncated": preprocessed["was_truncated"],
            "original_length": preprocessed["original_length"],
        },
        "memory": get_memory_usage(),
        "version": VERSION,
    }

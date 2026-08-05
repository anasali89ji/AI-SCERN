"""
Aiscern Detection Worker — Text Engine v4.3.0
CPU-only text AI-detection using perplexity, burstiness, stylometry,
repetition, AI phrase fingerprinting, and informality-marker analysis.

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
    try:
        # Module 3 fix: prefer the baked-in local cache (see Dockerfile) —
        # avoids depending on a live huggingface.co fetch at request time,
        # which could silently degrade detection on a network blip, cold
        # start, or offline deployment.
        return AutoTokenizer.from_pretrained(model_name, local_files_only=True)
    except Exception:
        logger.info("[TextEngine] %s tokenizer not in local cache — fetching from network", model_name)
        return AutoTokenizer.from_pretrained(model_name)


def _load_language_model(model_name: str):
    import torch
    from transformers import AutoModelForCausalLM
    try:
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float32,  # CPU — float32 only
            local_files_only=True,
        )
    except Exception:
        logger.info("[TextEngine] %s model not in local cache — fetching from network", model_name)
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float32,
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


# ── AI Phrase Fingerprint ────────────────────────────────────────────────────

def _compute_ai_phrase_fingerprint(text: str) -> Dict[str, Any]:
    """
    Lexicon-based detector for stock phrases and constructions strongly
    associated with instruction-tuned LLM output (ChatGPT/Claude/Gemini-era
    "AI-isms"). Distinct from stylometry's narrow logical-connector rate
    (however/therefore/etc.) -- this targets the broader vocabulary and
    hedging/framing constructions that show up disproportionately in LLM
    output regardless of topic: stock openers ("in today's world", "in the
    realm of"), stock closers ("in conclusion", "overall,"), hedge-framing
    ("it's important to note/consider that"), and a set of individual words
    that are heavily over-represented in LLM output relative to general
    human corpora ("delve", "tapestry", "boundaries", "navigate",
    "landscape", "underscore", "holistic", "robust", "seamless",
    "cutting-edge", "paradigm", "foster", "leverage", "multifaceted").

    Density-based scoring (occurrences per 1000 words), same pattern as
    _compute_repetition's repetition_density. Thresholds are reasoned
    estimates from known community/practitioner consensus on LLM phrase
    over-representation, not fit against a labeled corpus in this sandbox --
    same caveat as the image-side calibration work: revisit once real
    labeled human/AI text samples are available to validate the exact
    density cutoffs.
    """
    words = tokenise_words(text)
    if len(words) < 30:
        return {
            "score": 0.5,
            "confidence": 0.15,
            "details": {"reason": "too_few_words"},
        }

    lower = text.lower()
    word_count = len(words)

    # Multi-word stock constructions (phrase-level, checked first so their
    # constituent words aren't double-counted by the single-word lexicon).
    STOCK_PHRASES = [
        r"it'?s important to note", r"it'?s important to consider",
        r"it is important to note", r"it is worth noting",
        r"in today'?s (?:world|society|fast-paced|digital)",
        r"in the realm of", r"in the world of",
        r"navigate the (?:complex|complexities|world|landscape)",
        r"plays a crucial role", r"plays a vital role", r"plays a significant role",
        r"underscore(?:s)? the importance", r"highlight(?:s)? the importance",
        r"a testament to", r"stands as a testament",
        r"paradigm shift", r"game[- ]chang(?:er|ing)",
        r"unlock(?:s|ing)? the (?:potential|power)",
        r"delve (?:into|deeper)", r"let'?s dive into",
        r"foster(?:s|ing)? a (?:culture|sense|deeper)",
        r"in (?:conclusion|summary)", r"to sum(?:marize| up)",
        r"on the other hand,", r"that being said,",
        r"as an ai (?:language model|assistant)",
        r"i hope this helps", r"i'?d be happy to",
        r"holistic approach", r"multifaceted (?:issue|nature|approach)",
        r"rich tapestry", r"tapestry of",
    ]
    # Single suspicious words (weighted lower individually -- these are only
    # mildly suspicious on their own, phrases above carry more signal).
    SIGNATURE_WORDS = [
        "delve", "tapestry", "boundaries", "landscape", "underscore",
        "underscores", "holistic", "seamless", "cutting-edge", "paradigm",
        "leverage", "leveraging", "multifaceted", "robust", "myriad",
        "intricate", "invaluable", "pivotal", "bolster", "bolstering",
        "showcasing", "showcase", "elevate", "elevating", "embark",
        "embarking", "meticulous", "meticulously",
    ]

    phrase_hits = 0
    for pat in STOCK_PHRASES:
        phrase_hits += len(re.findall(pat, lower))

    word_hits = 0
    for w in SIGNATURE_WORDS:
        word_hits += len(re.findall(r"\b" + re.escape(w) + r"\b", lower))

    # Phrases weighted 3x a bare word hit -- multi-word constructions are
    # much less likely to occur incidentally in ordinary human writing.
    weighted_hits = phrase_hits * 3 + word_hits
    density_per_1k = (weighted_hits / word_count) * 1000

    if density_per_1k > 12:
        score = 0.90
    elif density_per_1k > 7:
        score = 0.75
    elif density_per_1k > 3:
        score = 0.60
    elif density_per_1k > 1:
        score = 0.50
    else:
        score = 0.30

    confidence = min(0.85, 0.35 + word_count / 800)

    return {
        "score": round(score, 4),
        "confidence": round(confidence, 4),
        "details": {
            "phrase_hits": phrase_hits,
            "signature_word_hits": word_hits,
            "density_per_1000_words": round(density_per_1k, 2),
        },
    }


# ── Human Informality Markers ────────────────────────────────────────────────

def _compute_informality_markers(text: str) -> Dict[str, Any]:
    """
    Inverse signal: measures density of markers strongly associated with
    unedited human writing that instruction-tuned LLM output systematically
    under-produces -- contractions ("don't", "it's", "I'm"), first-person
    casual register ("I think", "honestly", "tbh", "imo"), sentence
    fragments/conjunction-led sentences ("And ...", "But ...", "So ..." at
    sentence start), and informal interjections/emphasis ("really", "just",
    "actually", "literally", ellipses, exclamation marks outside quotes).

    Low informality density -> higher AI suspicion. This is deliberately the
    mirror image of _compute_ai_phrase_fingerprint rather than a duplicate:
    that layer looks for presence of LLM-favored constructions, this one
    looks for ABSENCE of human-favored ones -- a genuinely different failure
    mode (heavily edited/formal human writing can dodge the phrase
    fingerprint but still won't fake informal register if it's actually
    AI-generated, and vice versa).
    """
    words = tokenise_words(text)
    sentences = split_sentences(text)
    if len(words) < 30:
        return {
            "score": 0.5,
            "confidence": 0.15,
            "details": {"reason": "too_few_words"},
        }

    lower = text.lower()
    word_count = len(words)

    # Restricted to 're/'ve/'ll/'d/'m -- 's and 't (it's, don't, that's) are
    # common in formal/AI writing too and were producing false informality
    # signal when they happened to fall inside an AI-signature phrase itself
    # (e.g. "it's important to note" -- an AI-phrase-lexicon hit that also
    # contains a bare contraction). The remaining set is more distinctly
    # conversational ("I'm", "we've", "they'll", "I'd").
    contractions = len(re.findall(
        r"\b\w+'(?:re|ve|ll|d|m)\b", lower
    ))
    casual_markers = len(re.findall(
        r"\b(?:honestly|tbh|imo|imho|gonna|wanna|kinda|sorta|yeah|"
        r"literally|actually|basically|like i said|i guess|i mean)\b",
        lower
    ))
    conjunction_starts = sum(
        1 for s in sentences
        if re.match(r"^(?:and|but|so|because|plus)\b", s.strip().lower())
    )
    exclamations = lower.count("!")
    ellipses = len(re.findall(r"\.\.\.|\u2026", text))

    total_informal = contractions + casual_markers + conjunction_starts + exclamations + ellipses
    density_per_1k = (total_informal / word_count) * 1000

    # Low density -> AI-like (formal/edited); high density -> human-like.
    if density_per_1k < 2:
        score = 0.75
    elif density_per_1k < 5:
        score = 0.60
    elif density_per_1k < 12:
        score = 0.45
    elif density_per_1k < 25:
        score = 0.30
    else:
        score = 0.20

    confidence = min(0.75, 0.30 + len(sentences) / 120)

    return {
        "score": round(score, 4),
        "confidence": round(confidence, 4),
        "details": {
            "contractions": contractions,
            "casual_markers": casual_markers,
            "conjunction_led_sentences": conjunction_starts,
            "exclamations": exclamations,
            "ellipses": ellipses,
            "density_per_1000_words": round(density_per_1k, 2),
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
            "ai_phrase_fingerprint": True,
            "informality_markers": True,
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

    # Module 3 fix: track when the pipeline is running in a degraded state
    # (perplexity unavailable) so this is surfaced to the caller explicitly,
    # instead of silently returning a score computed only from the weaker
    # heuristic engines (burstiness/stylometry/repetition) as if nothing
    # were missing.
    degraded = False
    degraded_reason: Optional[str] = None

    # Perplexity (requires distilgpt2 — skip if transformers not installed)
    if options.get("perplexity", True):
        try:
            engines["perplexity"] = _compute_perplexity(clean)
        except ImportError:
            logger.warning("[TextEngine] transformers/torch not installed — skipping perplexity")
            engines["perplexity"] = _empty_result("transformers_not_installed")
            degraded = True
            degraded_reason = "perplexity_unavailable_not_installed"
        except Exception as e:
            logger.warning("[TextEngine] perplexity failed: %s", e)
            engines["perplexity"] = _empty_result(str(e))
            degraded = True
            degraded_reason = "perplexity_unavailable"

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

    if options.get("ai_phrase_fingerprint", True):
        try:
            engines["ai_phrase_fingerprint"] = _compute_ai_phrase_fingerprint(clean)
        except Exception as e:
            engines["ai_phrase_fingerprint"] = _empty_result(str(e))

    if options.get("informality_markers", True):
        try:
            engines["informality_markers"] = _compute_informality_markers(clean)
        except Exception as e:
            engines["informality_markers"] = _empty_result(str(e))

    # Factual engine is a stub
    if options.get("factual", False):
        engines["factual"] = {
            "score": 0.5,
            "confidence": 0.0,
            "details": {"status": "not_implemented"},
        }

    # Composite score — confidence-weighted average
    # Rebalanced (v4.3) to accommodate the two new layers below. Perplexity
    # stays dominant when available (it's the only layer with genuine
    # model-based signal); the two new layers get meaningful but modest
    # weight pending real-corpus validation of their density thresholds.
    weights = {
        "perplexity": 0.32,
        "burstiness": 0.18,
        "stylometry": 0.15,
        "repetition": 0.12,
        "ai_phrase_fingerprint": 0.13,
        "informality_markers": 0.10,
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

    # Module 3 fix: perplexity carries the most real detection signal (40%
    # of composite weight) and, per the accuracy benchmark, casual/technical/
    # terse-register AI text is materially under-detected by the heuristic
    # engines alone (burstiness/stylometry/repetition). Don't let
    # avg_confidence be reported as if every engine ran normally when the
    # single most informative one didn't -- apply an explicit penalty on
    # top of whatever the (now perplexity-confidence-0) average already
    # reflects, so degraded responses are visibly less confident, not just
    # silently narrower.
    if degraded:
        avg_confidence = round(avg_confidence * 0.55, 4)

    elapsed_ms = int((time.time() - start) * 1000)

    result = {
        "jobId": job_id,
        "status": "success",
        "processingTimeMs": elapsed_ms,
        "engines": engines,
        "composite_score": round(composite, 4),
        "confidence": round(avg_confidence, 4),
        "degraded": degraded,
        "degraded_reason": degraded_reason,
        "text_stats": {
            "word_count": preprocessed["word_count"],
            "sentence_count": preprocessed["sentence_count"],
            "was_truncated": preprocessed["was_truncated"],
            "original_length": preprocessed["original_length"],
        },
        "memory": get_memory_usage(),
        "version": VERSION,
    }
    if degraded:
        result["message"] = (
            "Perplexity model was unavailable for this request — this result "
            "relies on burstiness/stylometry/repetition heuristics only, "
            "which are less reliable (especially for short, technical, or "
            "casual-register text). Confidence has been reduced accordingly."
        )
    return result

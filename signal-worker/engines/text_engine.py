"""
Aiscern Detection Worker — Text Engine v4.4.0
CPU-only text AI-detection using perplexity, burstiness, stylometry,
repetition, AI phrase fingerprinting, informality-marker analysis,
Unicode/homoglyph forensics, humanizer-artifact detection, and
plagiarism-risk signal.

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


# ── Unicode Forensics (humanizer/evasion-tool detection) ────────────────────

# Zero-width / invisible characters that never appear from normal human
# typing -- their presence in submitted text is essentially always the
# product of deliberate injection. Some AI-detector-evasion ("humanizer")
# tools use exactly this trick: scattering zero-width characters through
# text to break the tokenization patterns some detectors rely on, without
# changing how the text visibly reads. This check is a genuinely novel
# signal for this pipeline -- none of the existing engines look at the raw
# character stream, only at word/sentence-level statistics.
_INVISIBLE_CHARS = {
    "\u200b": "zero_width_space",
    "\u200c": "zero_width_non_joiner",
    "\u200d": "zero_width_joiner",
    "\u2060": "word_joiner",
    "\ufeff": "zero_width_no_break_space",
    "\u00ad": "soft_hyphen",
    "\u180e": "mongolian_vowel_separator",
}
# Unicode Tag block (U+E0000-U+E007F) -- normally used for regional
# language subtags but has been documented as an ASCII-steganography
# channel (each tag character maps to an invisible copy of a printable
# ASCII character). Any presence at all is essentially certain to be
# deliberate; this text never appears in ordinary writing.
_TAG_BLOCK_RANGE = (0xE0000, 0xE007F)

# Cyrillic/Greek characters that are visually near-identical to Latin
# letters ("confusables") -- a classic homoglyph-substitution trick used to
# defeat exact-string and tokenization-based filters/detectors while the
# text still *looks* like normal English to a human reader.
_HOMOGLYPH_MAP = {
    "\u0430": "a", "\u0435": "e", "\u043e": "o", "\u0440": "p",
    "\u0441": "c", "\u0445": "x", "\u0443": "y", "\u0456": "i",
    "\u0455": "s", "\u0458": "j", "\u04bb": "h", "\u0501": "d",
    "\u03bf": "o", "\u03b1": "a", "\u03b9": "i", "\u0399": "I",
    "\u0410": "A", "\u0412": "B", "\u0415": "E", "\u041a": "K",
    "\u041c": "M", "\u041d": "H", "\u041e": "O", "\u0420": "P",
    "\u0421": "C", "\u0422": "T", "\u0425": "X",
}


def _compute_unicode_forensics(text: str) -> Dict[str, Any]:
    """
    Scans the raw character stream (not tokenized words) for two classes of
    artifact that indicate deliberate manipulation rather than natural
    typing or plain AI generation: (1) invisible/zero-width characters, and
    (2) homoglyph substitution -- non-Latin characters that are visually
    indistinguishable from Latin letters, mixed into otherwise-ASCII words.

    Both are near-zero-false-positive signals: legitimate human writing
    essentially never contains zero-width characters, and a genuinely
    multilingual document uses non-Latin scripts as whole words, not single
    characters spliced into an otherwise-ASCII word. Presence of either is
    strong evidence of deliberate evasion tooling; absence says nothing
    either way (most AI text and most human text are equally "clean" on
    this axis), so this layer is scored asymmetrically -- it only pushes
    the composite when it finds something.
    """
    if not text:
        return {"score": 0.5, "confidence": 0.0, "details": {"reason": "empty_text"}}

    invisible_hits: Dict[str, int] = {}
    for ch, name in _INVISIBLE_CHARS.items():
        c = text.count(ch)
        if c:
            invisible_hits[name] = c

    tag_block_hits = sum(
        1 for ch in text if _TAG_BLOCK_RANGE[0] <= ord(ch) <= _TAG_BLOCK_RANGE[1]
    )

    # Homoglyph words: split on whitespace (not tokenise_words, which would
    # already discard non-Latin characters) and flag any "word" that mixes
    # ASCII Latin letters with one of the confusable non-Latin characters.
    homoglyph_words = []
    for raw_word in text.split():
        stripped = raw_word.strip(".,!?;:\"'()[]")
        if not stripped:
            continue
        has_ascii_letter = any(c.isascii() and c.isalpha() for c in stripped)
        confusables_in_word = [c for c in stripped if c in _HOMOGLYPH_MAP]
        if has_ascii_letter and confusables_in_word:
            homoglyph_words.append(stripped)

    total_invisible = sum(invisible_hits.values()) + tag_block_hits
    total_homoglyph = len(homoglyph_words)

    if total_invisible > 0 or total_homoglyph > 0:
        # Any presence at all is a strong tell -- scale mildly with volume
        # but even a single hit is already highly suspicious.
        severity = total_invisible * 2 + total_homoglyph
        score = min(0.90 + min(severity, 10) * 0.01, 0.98)
        confidence = 0.90
    else:
        score = 0.5
        confidence = 0.15

    return {
        "score": round(score, 4),
        "confidence": round(confidence, 4),
        "details": {
            "invisible_chars_found": invisible_hits,
            "unicode_tag_block_chars": tag_block_hits,
            "homoglyph_word_count": total_homoglyph,
            "homoglyph_word_examples": homoglyph_words[:5],
        },
    }


# ── Humanizer Artifact Detection ─────────────────────────────────────────────

# A short list of very common English words used as a rarity baseline below.
# Deliberately small (function words + the most frequent content words) --
# this is a coarse proxy, not a real frequency dictionary; good enough to
# flag words that clearly stand out, not to rank subtle differences.
_COMMON_WORDS = frozenset("""
the be to of and a in that have i it for not on with he as you do at this
but his by from they we say her she or an will my one all would there
their what so up out if about who get which go me when make can like time
no just him know take people into year your good some could them see other
than then now look only come its over think also back after use two how
our work first well way even new want because any these give day most us
""".split())


def _compute_humanizer_artifacts(text: str) -> Dict[str, Any]:
    """
    Targets two specific mechanical artifacts left by paraphrase/"humanizer"
    tools that try to spoof AI-detector-friendly statistics rather than
    genuinely rewrite content:

    1. Burstiness-spoofing via mechanical sentence-length alternation.
       Humanizers often try to fake human-like sentence-length variance by
       mechanically alternating short and long sentences (short-long-short-
       long...). Genuine human variance is irregular -- bursty and largely
       unpredictable sentence-to-sentence. A mechanical zigzag shows up as
       STRONG NEGATIVE lag-1 autocorrelation in the sentence-length
       sequence, which natural writing essentially never produces this
       cleanly. This is a different failure mode from _compute_burstiness
       (which only measures overall variance/CV, blind to whether that
       variance is randomly distributed or artificially patterned).

    2. Lexical incongruity from thesaurus-swap substitution. Word-level
       paraphrase tools often swap a common word for a rare/elevated
       synonym without adjusting for register, producing a sentence that's
       otherwise plain (short common words) but contains one conspicuously
       long/uncommon word. Flagged via: words >=9 characters not in the
       common-word baseline, specifically counted when they appear in an
       otherwise-simple sentence (average word length of the rest of the
       sentence <5 chars) -- the incongruity, not just rare-word presence
       alone, is the signal.
    """
    sentences = split_sentences(text)
    words = tokenise_words(text)

    if len(sentences) < 5 or len(words) < 40:
        return {
            "score": 0.5,
            "confidence": 0.15,
            "details": {"reason": "too_short_for_reliable_signal"},
        }

    # --- Signal 1: sentence-length autocorrelation ---
    lengths = [len(s.split()) for s in sentences]
    mean_len = sum(lengths) / len(lengths)
    var = sum((l - mean_len) ** 2 for l in lengths) / len(lengths)
    if var > 0:
        numerator = sum(
            (lengths[i] - mean_len) * (lengths[i + 1] - mean_len)
            for i in range(len(lengths) - 1)
        )
        denominator = sum((l - mean_len) ** 2 for l in lengths[:-1])
        autocorr = numerator / denominator if denominator > 0 else 0.0
    else:
        autocorr = 0.0

    # Strong negative autocorrelation (mechanical zigzag) is the tell.
    if autocorr < -0.55:
        autocorr_score = 0.85
    elif autocorr < -0.35:
        autocorr_score = 0.65
    else:
        autocorr_score = 0.35

    # --- Signal 2: lexical incongruity (thesaurus-swap artifact) ---
    incongruous_hits = 0
    for s in sentences:
        s_words = re.findall(r"\b[a-zA-Z']{2,}\b", s.lower())
        if len(s_words) < 4:
            continue
        rare = [w for w in s_words if len(w) >= 9 and w not in _COMMON_WORDS]
        if not rare:
            continue
        others = [w for w in s_words if w not in rare]
        if not others:
            continue
        other_avg_len = sum(len(w) for w in others) / len(others)
        # The rest of the sentence reads plain/simple, but it contains a
        # conspicuously long word -- classic swap-artifact shape.
        if other_avg_len < 5.0 and max(len(w) for w in rare) >= 9:
            incongruous_hits += 1

    incongruity_rate = incongruous_hits / len(sentences)
    if incongruity_rate > 0.25:
        incongruity_score = 0.80
    elif incongruity_rate > 0.12:
        incongruity_score = 0.60
    elif incongruity_rate > 0.05:
        incongruity_score = 0.50
    else:
        incongruity_score = 0.35

    score = round(autocorr_score * 0.55 + incongruity_score * 0.45, 4)
    confidence = min(0.75, 0.30 + len(sentences) / 100)

    return {
        "score": round(score, 4),
        "confidence": round(confidence, 4),
        "details": {
            "sentence_length_autocorrelation": round(autocorr, 4),
            "autocorr_subscore": autocorr_score,
            "incongruous_sentence_count": incongruous_hits,
            "incongruity_rate": round(incongruity_rate, 4),
            "incongruity_subscore": incongruity_score,
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
            "unicode_forensics": True,
            "humanizer_artifacts": True,
            "plagiarism_risk": True,
            "factual": False,
        }

    start = time.time()
    preprocessed = preprocess(text)

    if preprocessed["word_count"] < 10:
        # Bug fix (v4.4): tokenise_words() requires 2+ CONSECUTIVE letters,
        # which zero-width-character injection defeats by design (a
        # zero-width space between every letter means no token is ever 2
        # letters long, so word_count reads ~0 regardless of actual visible
        # content length). Without this check, text deliberately obfuscated
        # with invisible characters -- exactly what unicode_forensics exists
        # to catch -- was silently swallowed by this gate before any engine,
        # including unicode_forensics itself, ever ran on it. Run a raw-text
        # Unicode check before accepting the short-circuit; if it fires,
        # this isn't actually short text, it's evasion-obfuscated text, and
        # deserves a real (if necessarily partial) result instead of a
        # generic "too short" bounce.
        try:
            uf_precheck = _compute_unicode_forensics(text)
        except Exception:
            uf_precheck = None

        if uf_precheck and uf_precheck["score"] > 0.5:
            elapsed_ms = int((time.time() - start) * 1000)
            return {
                "jobId": job_id,
                "status": "success",
                "processingTimeMs": elapsed_ms,
                "engines": {"unicode_forensics": uf_precheck},
                "composite_score": uf_precheck["score"],
                "confidence": uf_precheck["confidence"],
                "degraded": True,
                "degraded_reason": "obfuscated_text_only_unicode_forensics_ran",
                "message": (
                    "This text contains invisible/homoglyph characters that "
                    "defeat normal word tokenization, so most detection "
                    "engines could not run meaningfully on it. The character-"
                    "level obfuscation itself is a strong signal, surfaced "
                    "here directly."
                ),
                "text_stats": preprocessed and {
                    "word_count": preprocessed["word_count"],
                    "original_length": preprocessed["original_length"],
                },
                "version": VERSION,
            }

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

    if options.get("unicode_forensics", True):
        try:
            # Deliberately runs on the RAW input `text`, not `clean` --
            # clean_text()'s printable-character filter strips characters
            # above U+FFFF (including the Unicode Tag block used for ASCII
            # steganography), which would hide exactly the artifact this
            # layer is designed to catch if it ran on the preprocessed copy.
            engines["unicode_forensics"] = _compute_unicode_forensics(text)
        except Exception as e:
            engines["unicode_forensics"] = _empty_result(str(e))

    if options.get("humanizer_artifacts", True):
        try:
            engines["humanizer_artifacts"] = _compute_humanizer_artifacts(clean)
        except Exception as e:
            engines["humanizer_artifacts"] = _empty_result(str(e))

    if options.get("plagiarism_risk", True):
        try:
            from engines.plagiarism_engine import analyze_plagiarism_risk
            plag = analyze_plagiarism_risk(clean)
            # Map plagiarism_engine's 0-100 risk_score onto this pipeline's
            # 0-1 score/confidence convention so it can sit alongside the
            # other engines in the weighted composite. Originality risk
            # isn't the same axis as "AI-generated" -- a plagiarized human
            # essay isn't AI-written -- so this is deliberately kept at
            # modest weight below; it's included because a text that trips
            # BOTH high plagiarism risk AND high AI-signal is a materially
            # different (and worse) finding than either alone, and the
            # platform had zero visibility into plagiarism risk for plain
            # text submissions before this (previously wired to document
            # uploads only).
            engines["plagiarism_risk"] = {
                "score": round(plag.get("risk_score", 0) / 100.0, 4) if plag.get("status") == "ok" else 0.5,
                "confidence": 0.5 if plag.get("status") == "ok" else 0.0,
                "risk_level": plag.get("risk_level"),
                "simhash_fingerprint": plag.get("simhash_fingerprint"),
                "details": plag.get("signals", {}),
            }
        except Exception as e:
            engines["plagiarism_risk"] = _empty_result(str(e))

    # Factual engine is a stub
    if options.get("factual", False):
        engines["factual"] = {
            "score": 0.5,
            "confidence": 0.0,
            "details": {"status": "not_implemented"},
        }

    # Composite score — confidence-weighted average
    # Rebalanced (v4.4) for the three new forensic layers below. perplexity
    # stays the dominant single signal when available. unicode_forensics
    # and humanizer_artifacts are new, more specialized signals -- given
    # meaningful weight since when they DO fire (especially
    # unicode_forensics) they're extremely high-precision, and their
    # confidence-weighting naturally keeps them quiet the rest of the time.
    # plagiarism_risk is measuring a related-but-different axis (originality,
    # not AI-generation) so it's deliberately kept low-weight -- included
    # for correlation value, not as a primary AI-detection signal.
    weights = {
        "perplexity": 0.25,
        "burstiness": 0.14,
        "stylometry": 0.115,
        "repetition": 0.09,
        "ai_phrase_fingerprint": 0.10,
        "informality_markers": 0.075,
        "unicode_forensics": 0.08,
        "humanizer_artifacts": 0.10,
        "plagiarism_risk": 0.05,
    }

    total_weight = 0.0
    weighted_sum = 0.0
    # Cross-layer gate (v4.4): humanizer_artifacts' autocorrelation check
    # specifically detects mechanical short/long sentence-length alternation
    # -- a pattern that _compute_burstiness's own coefficient-of-variation
    # metric cannot distinguish from genuine human variance (a high CV is a
    # high CV whether it's randomly bursty or artificially zigzagged). A
    # humanizer tool exploiting exactly this blind spot will make burstiness
    # score confidently WRONG (reads as "very human") at the same time
    # humanizer_artifacts is correctly flagging it. When that specific
    # conflict is detected, burstiness's vote is discounted rather than
    # left to cancel out a signal that has direct evidence it's being
    # gamed. Same architectural pattern as image_engine.py's DIRE gate
    # overriding other layers when it has strong contradicting evidence.
    burstiness_discount = 1.0
    ha = engines.get("humanizer_artifacts", {})
    ha_autocorr = ha.get("details", {}).get("sentence_length_autocorrelation")
    if isinstance(ha_autocorr, (int, float)) and ha_autocorr < -0.55:
        burstiness_discount = 0.35

    for key, w in weights.items():
        if key in engines:
            if key == "burstiness":
                w = w * burstiness_discount
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

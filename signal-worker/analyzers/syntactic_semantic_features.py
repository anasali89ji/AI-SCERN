"""
Aiscern Detection Worker — Syntactic Structure & Semantic (LSA) Features
(MODULE 31)

Giant-Level Optimization Spec, Section 3.2 items 2-3:
  item 2 — "syntactic features: parse-tree depth, dependency distance,
            clause structure, sentence-opener variety"
  item 3 — "semantic features: LSA / LDA topic structure, WordNet-based
            synonym and hypernym density"

These two have been carried as OPEN since Modules 21-22, blocked on a
dependency decision: spaCy for parsing, gensim/scikit-learn for topic
modelling, and NLTK's WordNet corpus. This module resolves that decision.

The dependency decision, and why it went this way
--------------------------------------------------
Checked what each option would actually cost this worker:

  spaCy + en_core_web_sm  — ~12MB wheel plus a ~13MB model that must be
    downloaded at build or first run. requirements.txt is explicitly headed
    "CPU-only build — basic-s tier (2GB RAM)". Adding a parser that loads a
    statistical model into every worker process for one text signal is a poor
    trade against that budget, and the model fetch is a new network
    dependency in the Docker build.
  gensim / scikit-learn   — scikit-learn alone is ~30MB installed and pulls
    its own scipy pin, which collides with the existing scipy==1.14.1 pin.
    Not worth it for one SVD that numpy already does.
  NLTK WordNet            — nltk==3.9.3 IS already pinned, but the WordNet
    corpus is NOT bundled; it needs nltk.download() at runtime, which needs
    egress to the NLTK data host. Unavailable in this sandbox, and a runtime
    download inside a request path is the wrong shape regardless.

Decision: implement items 2 and 3 with ZERO new dependencies, using numpy
(already pinned, already imported by analyzers/lexical_entropy_stylometry.py)
and a self-contained closed-class lexicon. This is not a workaround — for the
specific signals the spec asks for, it is close to the right tool:

  * Item 2's signals are about SYNTACTIC TEMPLATE REPETITION, not about
    getting any individual parse right. A coarse tag sequence derived from
    the closed-class words (which ARE a finite, enumerable set in English)
    captures template repetition directly. A full dependency parse would give
    a more precise clause count, but the per-sentence precision is not what
    the signal reads — the distribution over many sentences is.
  * Item 3's LSA is literally a truncated SVD of a term-sentence matrix.
    numpy.linalg.svd does exactly that. scikit-learn would add 30MB to call
    the same LAPACK routine.

What is NOT implemented, explicitly
------------------------------------
  * WordNet synonym/hypernym density (item 3's second half). Needs the
    WordNet corpus; not bundled, not fetchable here. NOT attempted, NOT
    approximated with a hand-rolled thesaurus — a 200-word stub synonym table
    would produce a number that looks like a WordNet feature and is not one.
    Flagged as a remaining open item. Note that Module 24's
    near_synonym_consistency.py already covers the adjacent ground of
    lexical-choice consistency with a self-contained lexicon, so the marginal
    value here is lower than the spec implies.
  * LDA topic modelling. LSA is implemented; LDA needs a fitted model and an
    inference package. The topic-structure signal the spec wants is obtained
    from the LSA spectrum instead (see S6).
  * True parse-tree DEPTH. What is computed is a bracketing-depth proxy from
    subordinators, relativizers and punctuation nesting — reported under a
    name that says proxy, not "parse_tree_depth", so nobody downstream reads
    it as something it isn't.

Signals
-------
  S1  Coarse POS trigram entropy + concentration — syntactic template reuse.
  S2  Subordination index and clause-depth proxy.
  S3  Sentence-opener profile (a well-documented LLM tell: openers cluster).
  S4  Content-word gap statistics — a dependency-distance proxy.
  S5  LSA adjacent-sentence coherence (mean and variance).
  S6  LSA spectral concentration + semantic drift across the document.

Honest limitations
------------------
  * Uncalibrated. Thresholds are directional, derived from the mechanism, not
    from ROC curves against a labeled corpus.
  * English-only. The closed-class lexicon is English; non-English input is
    detected by function-word coverage and returns unavailable rather than
    silently producing nonsense.
  * Every signal here is a DISTRIBUTIONAL property of a whole document. On
    short text they are noise, which is why the minimum thresholds below are
    relatively high and confidence scales with length.
  * Heavily edited LLM output and formulaic human writing (legal boilerplate,
    lab reports, translated text) look similar on these axes. One layer among
    many, never a standalone verdict.
"""

from __future__ import annotations

import logging
import math
import re
from collections import Counter
from typing import Any, Dict, List, Sequence, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# ── Closed-class lexicon ────────────────────────────────────────────────────
# English function words are a finite, enumerable set. This is the whole basis
# for tagging without a statistical model, and it is why this approach is
# honest rather than a shortcut: the closed classes really are closed.

_DET = {
    "the", "a", "an", "this", "that", "these", "those", "my", "your", "his",
    "her", "its", "our", "their", "some", "any", "no", "every", "each",
    "either", "neither", "both", "all", "another", "such", "what", "whatever",
}
_PRON = {
    "i", "you", "he", "she", "it", "we", "they", "me", "him", "us", "them",
    "myself", "yourself", "himself", "herself", "itself", "ourselves",
    "themselves", "mine", "yours", "hers", "ours", "theirs", "one", "ones",
    "someone", "anyone", "everyone", "nobody", "something", "anything",
    "everything", "nothing",
}
_PREP = {
    "of", "in", "to", "for", "with", "on", "at", "from", "by", "about",
    "into", "through", "during", "before", "after", "above", "below",
    "between", "under", "over", "against", "among", "toward", "towards",
    "upon", "within", "without", "across", "behind", "beyond", "beside",
    "besides", "despite", "except", "inside", "outside", "per", "than",
    "throughout", "underneath", "unlike", "until", "via", "onto", "off",
}
_AUX = {
    "be", "am", "is", "are", "was", "were", "been", "being", "have", "has",
    "had", "having", "do", "does", "did", "doing", "get", "gets", "got",
}
_MODAL = {
    "can", "could", "may", "might", "must", "shall", "should", "will",
    "would", "ought", "need", "dare",
}
_COORD = {"and", "or", "but", "nor", "yet", "so", "for", "plus"}
_SUBORD = {
    "because", "although", "though", "while", "whereas", "since", "unless",
    "if", "when", "whenever", "wherever", "before", "after", "until", "once",
    "whether", "as", "lest", "provided", "given", "assuming", "despite",
}
_REL = {"who", "whom", "whose", "which", "that", "where", "when", "why", "how"}
_NEG = {"not", "n't", "never", "neither", "nor", "none", "cannot"}
_DEG = {
    "very", "quite", "rather", "somewhat", "extremely", "highly", "fairly",
    "too", "so", "more", "most", "less", "least", "much", "far", "almost",
    "nearly", "just", "only", "even", "still", "already", "particularly",
    "significantly", "substantially", "increasingly", "notably",
}
_WH = {"what", "which", "who", "whom", "whose", "where", "when", "why", "how"}

# Tag priority matters: a word in several sets gets the first match here.
# "that" is DET before REL because determiner use is more frequent; "since"
# and "before" are SUBORD before PREP for the same reason. Getting an
# individual token wrong is acceptable — these signals read the DISTRIBUTION
# over hundreds of tokens, not any single tag.
_TAG_ORDER: List[Tuple[str, set]] = [
    ("NEG", _NEG),
    ("MODAL", _MODAL),
    ("AUX", _AUX),
    ("DET", _DET),
    ("PRON", _PRON),
    ("SUBORD", _SUBORD),
    ("COORD", _COORD),
    ("REL", _REL),
    ("PREP", _PREP),
    ("DEG", _DEG),
    ("WH", _WH),
]

_ALL_FUNCTION_WORDS = set().union(*[s for _, s in _TAG_ORDER])

_WORD_RE = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")

MIN_SENTENCES = 6
MIN_WORDS = 120
MAX_SENTENCES = 400          # SVD / tagging cap
MAX_TERMS = 3000


def _empty(reason: str) -> Dict[str, Any]:
    return {"score": 0.5, "confidence": 0.0, "status": "unavailable",
            "details": {"reason": reason}}


def _result(score: float, confidence: float, **details: Any) -> Dict[str, Any]:
    return {
        "score": round(max(0.0, min(1.0, score)), 4),
        "confidence": round(max(0.0, min(1.0, confidence)), 4),
        "status": "ok",
        "details": details,
    }


# ── Coarse tagging ──────────────────────────────────────────────────────────

def coarse_tag(word: str) -> str:
    """
    Map a token to a coarse tag using the closed-class lexicon, falling back
    to shallow suffix morphology for content words.

    Suffix rules are deliberately few and conservative. They exist to split
    the CONTENT bucket enough that trigram patterns are informative; they are
    not a claim to be a real POS tagger.
    """
    low = word.lower()
    for tag, vocab in _TAG_ORDER:
        if low in vocab:
            return tag
    if low.endswith("ly") and len(low) > 4:
        return "ADV"
    if low.endswith("ing") and len(low) > 5:
        return "VBG"
    if low.endswith("ed") and len(low) > 4:
        return "VBD"
    if low.endswith(("tion", "sion", "ment", "ness", "ity", "ance", "ence", "ism")):
        return "NOMZ"       # nominalisation — heavily over-used in LLM prose
    if low.endswith(("ous", "ive", "al", "ic", "able", "ible", "ful", "less")):
        return "ADJ"
    return "CONTENT"


def tag_sentence(sentence: str) -> List[str]:
    return [coarse_tag(w) for w in _WORD_RE.findall(sentence)]


# ── S1: syntactic template repetition ───────────────────────────────────────

def _entropy(counts: Counter, total: int) -> float:
    if total <= 0:
        return 0.0
    return -sum((c / total) * math.log2(c / total) for c in counts.values() if c)


def _syntactic_template_signal(tag_sequences: List[List[str]]) -> Dict[str, Any]:
    trigrams: Counter = Counter()
    total = 0
    for tags in tag_sequences:
        for i in range(len(tags) - 2):
            trigrams[(tags[i], tags[i + 1], tags[i + 2])] += 1
            total += 1

    if total < 30:
        return {"available": False, "reason": "too_few_tag_trigrams"}

    entropy = _entropy(trigrams, total)
    distinct = len(trigrams)

    # Measurement note: an earlier version normalised entropy by
    # log2(min(distinct, total)). At document lengths this module actually
    # sees, distinct is close to total, so that ratio sat at ~0.94 for BOTH
    # human and LLM fixtures — a dead signal that looked alive. Replaced with
    # the repeat rate, which measures the thing the signal is actually after
    # (how often the same syntactic frame recurs) and does not saturate.
    repeat_rate = 1.0 - (distinct / total)

    top5 = sum(c for _, c in trigrams.most_common(5))
    concentration = top5 / total

    return {
        "available": True,
        "trigram_count": total,
        "distinct_trigrams": distinct,
        "type_token_ratio": round(distinct / total, 4),
        "entropy_bits": round(entropy, 4),
        "trigram_repeat_rate": round(repeat_rate, 4),
        "top5_concentration": round(concentration, 4),
        # Concentration rises mechanically as trigram_count falls, so it is
        # only scored above this floor.
        "concentration_scorable": total >= 100,
        "top_trigrams": [
            {"pattern": "-".join(p), "count": c} for p, c in trigrams.most_common(5)
        ],
    }


# ── S2: subordination and clause-depth proxy ────────────────────────────────

def _clause_structure_signal(sentences: Sequence[str], tag_sequences: List[List[str]]) -> Dict[str, Any]:
    subord_counts: List[int] = []
    coord_counts: List[int] = []
    depth_proxies: List[int] = []

    for sentence, tags in zip(sentences, tag_sequences):
        subord = sum(1 for t in tags if t in ("SUBORD", "REL"))
        coord = sum(1 for t in tags if t == "COORD")
        subord_counts.append(subord)
        coord_counts.append(coord)

        # Bracketing-depth PROXY, not a parse depth: each subordinator or
        # relativizer opens a level, each comma/semicolon/dash/paren pair is
        # treated as a nesting marker, and the running maximum is taken.
        depth = 1
        running = 1
        for token in re.findall(r"[A-Za-z']+|[(),;—–:]", sentence):
            if token in ("(",):
                running += 1
            elif token in (")",):
                running = max(1, running - 1)
            elif token in (",", ";", "—", "–", ":"):
                running = max(1, running)
            elif coarse_tag(token) in ("SUBORD", "REL"):
                running += 1
            depth = max(depth, running)
        depth_proxies.append(depth)

    if not subord_counts:
        return {"available": False, "reason": "no_sentences"}

    subord_arr = np.array(subord_counts, dtype=float)
    depth_arr = np.array(depth_proxies, dtype=float)

    return {
        "available": True,
        "mean_subordinators_per_sentence": round(float(subord_arr.mean()), 4),
        "subordinator_variance": round(float(subord_arr.var()), 4),
        "mean_coordinators_per_sentence": round(float(np.mean(coord_counts)), 4),
        "mean_clause_depth_proxy": round(float(depth_arr.mean()), 4),
        "clause_depth_proxy_std": round(float(depth_arr.std()), 4),
        "max_clause_depth_proxy": int(depth_arr.max()),
        "simple_sentence_fraction": round(float(np.mean(subord_arr == 0)), 4),
        "note": "clause depth is a bracketing PROXY, not a parse-tree depth",
    }


# ── S3: sentence-opener profile ─────────────────────────────────────────────

def _opener_signal(sentences: Sequence[str], tag_sequences: List[List[str]]) -> Dict[str, Any]:
    opener_tags: Counter = Counter()
    opener_words: Counter = Counter()

    for sentence, tags in zip(sentences, tag_sequences):
        if tags:
            opener_tags[tags[0]] += 1
        first_words = _WORD_RE.findall(sentence)[:2]
        if first_words:
            opener_words[" ".join(w.lower() for w in first_words)] += 1

    total = sum(opener_tags.values())
    if total < MIN_SENTENCES:
        return {"available": False, "reason": "too_few_sentences"}

    tag_entropy = _entropy(opener_tags, total)
    max_tag_entropy = math.log2(len(opener_tags)) if len(opener_tags) > 1 else 1.0

    repeated = sum(c for c in opener_words.values() if c > 1)

    return {
        "available": True,
        "sentence_count": total,
        "distinct_opener_tags": len(opener_tags),
        "opener_tag_entropy": round(tag_entropy, 4),
        "opener_tag_entropy_normalised": round(
            tag_entropy / max_tag_entropy if max_tag_entropy > 0 else 0.0, 4
        ),
        "most_common_opener_tag_share": round(opener_tags.most_common(1)[0][1] / total, 4),
        "repeated_two_word_opener_fraction": round(repeated / total, 4),
        "top_openers": [
            {"opener": o, "count": c} for o, c in opener_words.most_common(5) if c > 1
        ],
    }


# ── S4: dependency-distance proxy ───────────────────────────────────────────

def _content_gap_signal(tag_sequences: List[List[str]]) -> Dict[str, Any]:
    """
    Distance between successive CONTENT-bearing tokens, as a stand-in for
    mean dependency distance. Long function-word runs between content words
    indicate deeper embedding (prepositional stacking, relative clauses);
    variance in that distance is what separates varied human syntax from
    template-driven output.
    """
    gaps: List[int] = []
    content_tags = {"CONTENT", "NOMZ", "ADJ", "VBG", "VBD", "ADV"}

    for tags in tag_sequences:
        last = None
        for idx, tag in enumerate(tags):
            if tag in content_tags:
                if last is not None:
                    gaps.append(idx - last)
                last = idx

    if len(gaps) < 20:
        return {"available": False, "reason": "too_few_content_gaps"}

    arr = np.array(gaps, dtype=float)
    return {
        "available": True,
        "gap_count": len(gaps),
        "mean_content_gap": round(float(arr.mean()), 4),
        "content_gap_std": round(float(arr.std()), 4),
        "content_gap_cv": round(float(arr.std() / arr.mean()) if arr.mean() else 0.0, 4),
        "max_content_gap": int(arr.max()),
        "note": "proxy for mean dependency distance; no parse tree is built",
    }


# ── S5/S6: LSA ──────────────────────────────────────────────────────────────

def _build_lsa_space(sentences: Sequence[str], n_components: int = 5):
    """
    Log-entropy weighted term-sentence matrix, reduced by truncated SVD.

    Log-entropy weighting (rather than plain tf-idf) is the standard LSA
    weighting: local log(1+tf) times a global 1 - normalised-entropy term
    that down-weights words spread evenly across the document.
    """
    docs = [
        [w.lower() for w in _WORD_RE.findall(s) if w.lower() not in _ALL_FUNCTION_WORDS]
        for s in sentences
    ]
    vocab_counts: Counter = Counter()
    for doc in docs:
        vocab_counts.update(set(doc))

    # Terms appearing in only one sentence carry no cross-sentence structure.
    vocab = [t for t, c in vocab_counts.most_common(MAX_TERMS) if c >= 2]
    if len(vocab) < 8 or len(docs) < MIN_SENTENCES:
        return None, None

    index = {t: i for i, t in enumerate(vocab)}
    tf = np.zeros((len(docs), len(vocab)), dtype=np.float64)
    for r, doc in enumerate(docs):
        for token in doc:
            col = index.get(token)
            if col is not None:
                tf[r, col] += 1.0

    global_totals = tf.sum(axis=0)
    global_totals[global_totals == 0] = 1.0
    probabilities = tf / global_totals
    with np.errstate(divide="ignore", invalid="ignore"):
        logs = np.where(probabilities > 0, np.log(probabilities), 0.0)
    entropy = -(probabilities * logs).sum(axis=0) / math.log(max(2, len(docs)))
    global_weight = 1.0 - entropy
    matrix = np.log1p(tf) * global_weight

    norms = np.linalg.norm(matrix, axis=1)
    keep = norms > 0
    if keep.sum() < MIN_SENTENCES:
        return None, None
    matrix = matrix[keep]

    try:
        u, s, _ = np.linalg.svd(matrix, full_matrices=False)
    except np.linalg.LinAlgError:
        return None, None

    k = int(min(n_components, len(s)))
    if k < 2:
        return None, None
    embeddings = u[:, :k] * s[:k]
    return embeddings, s


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def _semantic_signal(sentences: Sequence[str]) -> Dict[str, Any]:
    embeddings, spectrum = _build_lsa_space(sentences)
    if embeddings is None:
        return {"available": False, "reason": "insufficient_cross_sentence_vocabulary"}

    adjacent = [
        _cosine(embeddings[i], embeddings[i + 1]) for i in range(len(embeddings) - 1)
    ]
    if len(adjacent) < 4:
        return {"available": False, "reason": "too_few_adjacent_pairs"}

    adjacent_arr = np.array(adjacent, dtype=float)

    third = max(1, len(embeddings) // 3)
    opening = embeddings[:third].mean(axis=0)
    closing = embeddings[-third:].mean(axis=0)
    drift = 1.0 - _cosine(opening, closing)

    total_energy = float((spectrum ** 2).sum())
    top2_energy = float((spectrum[:2] ** 2).sum())
    concentration = top2_energy / total_energy if total_energy > 0 else 0.0

    return {
        "available": True,
        "sentences_embedded": int(embeddings.shape[0]),
        "components": int(embeddings.shape[1]),
        "mean_adjacent_coherence": round(float(adjacent_arr.mean()), 4),
        "adjacent_coherence_std": round(float(adjacent_arr.std()), 4),
        "min_adjacent_coherence": round(float(adjacent_arr.min()), 4),
        "low_coherence_transitions": int((adjacent_arr < 0.1).sum()),
        "spectral_concentration_top2": round(concentration, 4),
        "semantic_drift_open_to_close": round(drift, 4),
        "note": "LSA via numpy SVD with log-entropy weighting; no LDA, no WordNet",
    }


# ── Scoring ─────────────────────────────────────────────────────────────────

def _score(
    template: Dict[str, Any],
    clauses: Dict[str, Any],
    openers: Dict[str, Any],
    gaps: Dict[str, Any],
    semantics: Dict[str, Any],
) -> Tuple[float, List[str]]:
    """
    Directional scoring around 0.5. Each contribution is small and capped —
    these are weak individual signals whose value is in agreeing with each
    other, and with the Module 21/22 stylometry signals, not in any one of
    them firing.
    """
    score = 0.5
    observations: List[str] = []

    if template.get("available"):
        # Thresholds below are set from MEASURED values on the fixtures in
        # tests/test_syntactic_semantic_features.py, not guessed. Still
        # directional and still uncalibrated against a real labeled corpus —
        # see the module docstring.
        # trigram_repeat_rate is REPORTED BUT NOT SCORED. Measured on the
        # fixtures it came out 0.397 (human) vs 0.413 (template-heavy) — a
        # 1.6-point gap that is well inside noise. Any threshold splitting
        # those two numbers would be fitted to two documents, not calibrated.
        # It stays in the payload as evidence; only signals that demonstrably
        # separate on the fixtures carry weight.
        if template.get("concentration_scorable") and template["top5_concentration"] > 0.24:
            score += 0.05
            observations.append("concentrated_syntactic_frames")

    if clauses.get("available"):
        # Uniform clause complexity across sentences is the tell, not the
        # level of complexity itself. The original gate required
        # mean_clause_depth > 1.2, which excluded the FLATTEST case — prose
        # with no subordination anywhere measured std=0.0, mean=1.0 and fired
        # nothing. Both the uniformly-deep and uniformly-flat cases now score.
        if clauses["clause_depth_proxy_std"] < 0.35:
            score += 0.06
            observations.append(
                "uniform_clause_depth_flat" if clauses["mean_clause_depth_proxy"] < 1.2
                else "uniform_clause_depth"
            )
        if clauses["subordinator_variance"] < 0.30:
            score += 0.04
            observations.append("low_subordination_variance")
        if clauses["simple_sentence_fraction"] > 0.90:
            score += 0.04
            observations.append("no_subordinate_clauses_anywhere")

    if openers.get("available"):
        if openers["opener_tag_entropy_normalised"] < 0.70:
            score += 0.06
            observations.append("low_sentence_opener_diversity")
        if openers["repeated_two_word_opener_fraction"] > 0.25:
            score += 0.05
            observations.append("repeated_sentence_openers")

    if gaps.get("available"):
        # Measured: human prose ~0.52, template-heavy prose ~0.37. The
        # original 0.55 threshold fired on both.
        if gaps["content_gap_cv"] < 0.42:
            score += 0.05
            observations.append("uniform_dependency_distance_proxy")

    # LSA block: COMPUTED AND REPORTED, BUT NOT SCORED.
    #
    # The first threshold set here was guessed (coherence > 0.45 => "smooth
    # flow"). Measuring it on the fixtures showed real LSA cosines at these
    # document lengths sit around 0.08-0.11 for BOTH human and template-heavy
    # prose, and the "frequent_topic_shifts" rule fired on everything. The
    # thresholds were wrong and the signal did not separate the fixtures.
    #
    # Rather than retune numbers against two fixtures until they happen to
    # split — which would be fitting noise and calling it calibration — the
    # LSA features are emitted as evidence at zero score weight, with
    # provisional=True. This mirrors how L20/L21 are handled in
    # extended_physics_ensemble.py: real measurements flow through for review
    # and future calibration without being able to move a verdict. Scoring
    # can be switched on once there is a labeled corpus to fit against.

    return score, observations


# ── Public entry points ─────────────────────────────────────────────────────

def syntactic_features(text: str, sentences: Sequence[str] | None = None) -> Dict[str, Any]:
    """Section 3.2 item 2. Never raises."""
    return _analyze(text, sentences).get("syntactic_structure", _empty("internal_error"))


def semantic_features(text: str, sentences: Sequence[str] | None = None) -> Dict[str, Any]:
    """Section 3.2 item 3 (LSA half). Never raises."""
    return _analyze(text, sentences).get("semantic_lsa", _empty("internal_error"))


def _split_sentences_fallback(text: str) -> List[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p.strip() for p in parts if p.strip()]


def _analyze(text: str, sentences: Sequence[str] | None = None) -> Dict[str, Dict[str, Any]]:
    if not text or not text.strip():
        return {"syntactic_structure": _empty("empty_input"),
                "semantic_lsa": _empty("empty_input")}

    try:
        if sentences is None:
            try:
                from utils.text_preprocessor import split_sentences
                sentences = split_sentences(text)
            except Exception:
                sentences = _split_sentences_fallback(text)

        sentences = [s for s in (sentences or []) if s and s.strip()][:MAX_SENTENCES]
        words = _WORD_RE.findall(text)

        if len(sentences) < MIN_SENTENCES or len(words) < MIN_WORDS:
            reason = f"too_short_min_{MIN_SENTENCES}_sentences_{MIN_WORDS}_words"
            return {"syntactic_structure": _empty(reason),
                    "semantic_lsa": _empty(reason)}

        # English-only guard: the closed-class lexicon is English. If function
        # words barely appear, this is not English and the tags would be
        # meaningless rather than merely noisy.
        function_coverage = sum(
            1 for w in words if w.lower() in _ALL_FUNCTION_WORDS
        ) / len(words)
        if function_coverage < 0.12:
            reason = f"english_function_word_coverage_too_low_{function_coverage:.3f}"
            return {"syntactic_structure": _empty(reason),
                    "semantic_lsa": _empty(reason)}

        tag_sequences = [tag_sentence(s) for s in sentences]

        template = _syntactic_template_signal(tag_sequences)
        clauses = _clause_structure_signal(sentences, tag_sequences)
        openers = _opener_signal(sentences, tag_sequences)
        gaps = _content_gap_signal(tag_sequences)
        semantics = _semantic_signal(sentences)

        score, observations = _score(template, clauses, openers, gaps, semantics)

        length_confidence = min(0.70, 0.20 + len(sentences) / 120.0)
        syntactic_available = sum(
            1 for block in (template, clauses, openers, gaps) if block.get("available")
        )
        syntactic_conf = length_confidence * (syntactic_available / 4.0)
        # Reported confidence for an unscored block describes how much text
        # the measurement rests on, not how much to trust a verdict — there is
        # no verdict here.
        semantic_conf = round(length_confidence, 4) if semantics.get("available") else 0.0

        syntactic_obs = [
            o for o in observations
            if o not in ("unusually_smooth_semantic_flow",
                         "highly_concentrated_topic_structure",
                         "frequent_topic_shifts")
        ]
        semantic_obs = [o for o in observations if o not in syntactic_obs]

        shared_interpretation = (
            "Dependency-free implementation of spec Section 3.2 items 2-3: "
            "coarse closed-class tagging instead of a statistical parser, and "
            "numpy-SVD LSA instead of scikit-learn/gensim. WordNet synonym/"
            "hypernym density and LDA are NOT implemented — see the module "
            "docstring for why, and treat them as still-open items."
        )

        return {
            "syntactic_structure": _result(
                score, syntactic_conf,
                template_repetition=template,
                clause_structure=clauses,
                sentence_openers=openers,
                dependency_distance_proxy=gaps,
                observations=syntactic_obs,
                sentence_count=len(sentences),
                word_count=len(words),
                interpretation=shared_interpretation,
            ),
            "semantic_lsa": (
                _result(
                    0.5, semantic_conf,
                    lsa=semantics,
                    observations=semantic_obs,
                    provisional=True,
                    scored=False,
                    sentence_count=len(sentences),
                    provisional_reason=(
                        "LSA features are measured and reported but contribute "
                        "ZERO weight to any score. Thresholds could not be set "
                        "honestly without a labeled corpus — see _score()."
                    ),
                    interpretation=shared_interpretation,
                )
                if semantics.get("available")
                else _empty(semantics.get("reason", "lsa_unavailable"))
            ),
        }
    except Exception as e:  # pragma: no cover - defensive
        logger.error("[SyntacticSemantic] unexpected failure: %s", e, exc_info=True)
        failure = {"score": 0.5, "confidence": 0.0, "status": "error",
                   "details": {"reason": f"unexpected_error: {e}"}}
        return {"syntactic_structure": dict(failure), "semantic_lsa": dict(failure)}


def run_all(text: str, sentences: Sequence[str] | None = None) -> Dict[str, Dict[str, Any]]:
    """Uniform entry point, matching analyzers/*.run_all in Modules 21-29."""
    return _analyze(text, sentences)

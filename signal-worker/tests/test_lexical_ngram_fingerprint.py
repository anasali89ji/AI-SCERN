"""
Aiscern Detection Worker — lexical/entropy stylometry (MODULE 21) and
n-gram/punctuation fingerprint (MODULE 22) tests, spec Section 3.2.

Same honest-limitation framing as tests/test_audio.py and its audio-
module successors: synthetic proxies built from the mechanism each
detector targets, checked for directional correctness only.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analyzers.lexical_entropy_stylometry import (
    lexical_richness,
    entropy_fingerprint,
    run_all as run_all_lexical,
)
from analyzers.ngram_punctuation_fingerprint import (
    ngram_fingerprint,
    punctuation_formatting_fingerprint,
    run_all as run_all_ngram,
)
from utils.text_preprocessor import tokenise_words


# A small, deliberately repeated core vocabulary reused across many
# sentences via a template -- proxy for heavily templated/low-diversity
# generation. Repetition is the mechanism entropy/lexical-richness and
# n-gram-concentration are checking for, so this is a fair proxy
# regardless of whether the source is actually an LLM.
TEMPLATED_TEXT = (
    "Artificial intelligence has fundamentally transformed numerous industries. "
    "Furthermore, machine learning algorithms have demonstrated remarkable capabilities. "
    "Moreover, artificial intelligence has fundamentally transformed numerous businesses. "
    "Furthermore, machine learning algorithms have demonstrated remarkable results. "
    "Additionally, artificial intelligence has fundamentally transformed numerous sectors. "
    "Furthermore, machine learning algorithms have demonstrated remarkable outcomes. "
) * 4

# Wide, varied vocabulary with few exact repeated multi-word phrases --
# proxy for naturally diverse human writing.
VARIED_TEXT = (
    "I wasn't sure about the wiring at first, honestly. My neighbor mentioned "
    "a raccoon had chewed through the insulation sometime last spring, which "
    "would explain the flickering porch light. We climbed into the crawlspace "
    "with a flashlight and found exactly that -- frayed copper, a nest of "
    "shredded newspaper, and one very unimpressed possum. Fixing it took "
    "longer than expected because the breaker panel dated back to the "
    "seventies and none of the labels matched anything. Eventually my uncle, "
    "who used to do this professionally decades ago, walked us through "
    "tracing each circuit by hand. Tedious, but it worked. The lights stayed "
    "on through the storm that hit two weeks later, so I suppose it held."
)


def test_lexical_richness_templated_scores_higher_than_varied():
    words_templated = tokenise_words(TEMPLATED_TEXT)
    words_varied = tokenise_words(VARIED_TEXT)
    r_templated = lexical_richness(words_templated)
    r_varied = lexical_richness(words_varied)
    assert r_templated["confidence"] > 0 and r_varied["confidence"] > 0
    assert r_templated["hapax_legomena_ratio"] < r_varied["hapax_legomena_ratio"]
    assert r_templated["score"] > r_varied["score"]


def test_lexical_richness_too_few_words():
    res = lexical_richness(["only", "a", "few", "words", "here"])
    assert res["confidence"] == 0.0
    assert res["details"]["reason"] == "too_few_words"


def test_entropy_fingerprint_templated_scores_higher_than_varied():
    words_templated = tokenise_words(TEMPLATED_TEXT)
    words_varied = tokenise_words(VARIED_TEXT)
    r_templated = entropy_fingerprint(TEMPLATED_TEXT, words_templated)
    r_varied = entropy_fingerprint(VARIED_TEXT, words_varied)
    assert r_templated["confidence"] > 0 and r_varied["confidence"] > 0
    assert r_templated["word_entropy_normalized"] < r_varied["word_entropy_normalized"]
    assert r_templated["score"] > r_varied["score"]


def test_entropy_fingerprint_too_short():
    res = entropy_fingerprint("short text", ["short", "text"])
    assert res["confidence"] == 0.0


def test_lexical_run_all_returns_both_keys():
    words = tokenise_words(VARIED_TEXT)
    out = run_all_lexical(VARIED_TEXT, words)
    assert set(out.keys()) == {"lexical_richness", "entropy_fingerprint"}


def test_lexical_run_all_never_raises_on_empty_input():
    out = run_all_lexical("", [])
    assert set(out.keys()) == {"lexical_richness", "entropy_fingerprint"}
    for v in out.values():
        assert v["confidence"] == 0.0


# ── n-gram fingerprint ──────────────────────────────────────────────────────

def test_ngram_fingerprint_templated_scores_higher_than_varied():
    words_templated = tokenise_words(TEMPLATED_TEXT)
    words_varied = tokenise_words(VARIED_TEXT)
    r_templated = ngram_fingerprint(TEMPLATED_TEXT, words_templated)
    r_varied = ngram_fingerprint(VARIED_TEXT, words_varied)
    assert r_templated["confidence"] > 0 and r_varied["confidence"] > 0
    assert r_templated["trigram_concentration_top5"] > r_varied["trigram_concentration_top5"]
    assert r_templated["score"] > r_varied["score"]


def test_ngram_fingerprint_too_few_words():
    res = ngram_fingerprint("a b c", ["a", "b", "c"])
    assert res["confidence"] == 0.0


# ── punctuation & formatting fingerprint ────────────────────────────────────

def test_punctuation_fingerprint_flags_mixed_dash_and_quote_styles():
    mixed = (
        "The results were surprising\u2014truly remarkable, in fact. "
        "She said \u201cwe need more data\u201d before the meeting ended. "
        'He replied "that\'s fair" and left the room - a bit abruptly, honestly. '
        "Later, the team regrouped\u2013reluctantly\u2014to finish the report."
    ) * 3
    consistent = (
        "The results were surprising, truly remarkable, in fact. "
        "She said we need more data before the meeting ended. "
        "He replied that is fair and left the room, a bit abruptly, honestly. "
        "Later, the team regrouped, reluctantly, to finish the report."
    ) * 3

    r_mixed = punctuation_formatting_fingerprint(mixed)
    r_consistent = punctuation_formatting_fingerprint(consistent)
    assert r_mixed["confidence"] > 0 and r_consistent["confidence"] > 0
    assert r_mixed["dash_styles_used"] >= 2
    assert r_mixed["score"] >= r_consistent["score"]


def test_punctuation_fingerprint_flags_uniform_paragraph_lengths():
    uniform_paras = "\n\n".join(
        ["This is exactly eight words long right here now."] * 6
    )
    varied_paras = "\n\n".join([
        "Short one.",
        "This paragraph runs quite a bit longer than the previous short one did, by design.",
        "Medium length paragraph goes here with a handful of extra words in it.",
        "One more very short bit.",
        "And here is another considerably longer paragraph meant to vary the rhythm of the piece on purpose.",
        "Done.",
    ])
    r_uniform = punctuation_formatting_fingerprint(uniform_paras)
    r_varied = punctuation_formatting_fingerprint(varied_paras)
    assert r_uniform["paragraph_length_cov"] is not None
    assert r_varied["paragraph_length_cov"] is not None
    assert r_uniform["paragraph_length_cov"] < r_varied["paragraph_length_cov"]
    assert r_uniform["score"] >= r_varied["score"]


def test_punctuation_fingerprint_too_short():
    res = punctuation_formatting_fingerprint("Too short.")
    assert res["confidence"] == 0.0


def test_ngram_run_all_returns_both_keys():
    words = tokenise_words(VARIED_TEXT)
    out = run_all_ngram(VARIED_TEXT, words)
    assert set(out.keys()) == {"ngram_fingerprint", "punctuation_formatting_fingerprint"}


def test_ngram_run_all_never_raises_on_empty_input():
    out = run_all_ngram("", [])
    assert set(out.keys()) == {"ngram_fingerprint", "punctuation_formatting_fingerprint"}
    for v in out.values():
        assert v["confidence"] == 0.0

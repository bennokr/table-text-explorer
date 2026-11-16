"""Canonical lexical matching for phrase counts, word-vector tokens and queries."""

import re
import unicodedata

TOKEN = re.compile(r"[^\W_]+(?:['\u2019][^\W_]+)*|[^\w\s]|_|[\r\n]", re.UNICODE)


def tokenize_text(text):
    text = "" if text is None or text == "\\N" else str(text)
    return [
        match.group() for match in TOKEN.finditer(unicodedata.normalize("NFC", text).casefold())
    ]


def usable_edge(word, stopwords):
    """A phrase may not start or end with a stopword or a single character such as "c" or "1"."""
    return word not in stopwords and len(word) > 1


def allowed_phrase(words, stopwords, leadwords):
    """Lead words (zonder, heel) may start a phrase but never end it, so they never stand alone."""
    return (
        usable_edge(words[0], stopwords)
        and usable_edge(words[-1], stopwords)
        and words[-1] not in leadwords
    )


def analyze_tokens(tokens, stopwords, sizes, leadwords=frozenset()):
    window = []
    for word in tokens:
        if not word[0].isalnum():
            window.clear()
            continue
        window = [*window, word][-sizes[1] :]
        for size in range(sizes[0], min(sizes[1], len(window)) + 1):
            words = window[-size:]
            if allowed_phrase(words, stopwords, leadwords):
                yield " ".join(words)


def analyze_terms(text, stopwords, sizes):
    yield from analyze_tokens(tokenize_text(text), stopwords, sizes)

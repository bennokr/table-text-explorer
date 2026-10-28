"""Canonical lexical matching for phrase counts, word-vector tokens and queries."""

import re
import unicodedata

TOKEN = re.compile(r"[^\W_]+(?:['\u2019][^\W_]+)*|[^\w\s]|_|[\r\n]", re.UNICODE)


def tokenize_text(text):
    text = "" if text is None or text == "\\N" else str(text)
    return [
        match.group() for match in TOKEN.finditer(unicodedata.normalize("NFC", text).casefold())
    ]


def analyze_tokens(tokens, stopwords, sizes):
    window = []
    for word in tokens:
        if not word[0].isalnum():
            window.clear()
            continue
        window = [*window, word][-sizes[1] :]
        for size in range(sizes[0], min(sizes[1], len(window)) + 1):
            words = window[-size:]
            if words[0] not in stopwords and words[-1] not in stopwords:
                yield " ".join(words)


def analyze_terms(text, stopwords, sizes):
    yield from analyze_tokens(tokenize_text(text), stopwords, sizes)

"""Reads src/lexicon/<code>/*.txt the way src/lexicon-parse.js does, for the Python checks."""

import re
from pathlib import Path

LEXICON = Path(__file__).parents[1] / "src/lexicon"


def read_lines(code, kind):
    text = (LEXICON / code / f"{kind}.txt").read_text()
    return [line for line in (re.sub(r"#.*", "", raw).strip() for raw in text.split("\n")) if line]


def read_words(code, kind):
    return [line.lower() for line in read_lines(code, kind)]


def read_fold(code):
    spec = {"collapse": False, "undouble": False, "dropE": False, "rules": []}
    for line in read_lines(code, "fold"):
        if line.startswith("@"):
            spec["dropE" if line == "@drop-e" else line[1:]] = True
        else:
            suffix, replacement, minimum = line.split()
            spec["rules"].append([suffix, "" if replacement == "-" else replacement, int(minimum)])
    return spec


def payload(code):
    """The lexical part of a text index request for one language."""
    return {
        "stopwords": read_words(code, "stop"),
        "leadwords": read_words(code, "lead"),
        "negations": read_words(code, "negation"),
        "fold": read_fold(code),
    }

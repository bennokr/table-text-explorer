"""Exact query predicates share counting semantics, independent of term pruning/settings."""

import json

from lexical import analyze_tokens, tokenize_text
from text_indexes import index_registry, token_indexes


def indexed_ids(revision, name, target):
    for entry in index_registry.values():
        field = entry["fields"].get(name)
        compatible = any(key[:2] == (revision, name) for key in entry["keys"])
        if field is None or not compatible:
            continue
        column = field["lookup"].get(target)
        if column is not None:
            matrix = field["columns"]
            start, end = matrix.indptr[column : column + 2]
            return matrix.indices[start:end].tolist()
    return None


def match_phrase(data, columns, request):
    field, phrase = request["field"], request["phrase"]
    words = tokenize_text(phrase)
    target = " ".join(words)
    ids = indexed_ids(data["revision"], field, target)
    if ids is None:
        tokens = token_indexes.get((data["revision"], field))
        if tokens is None:
            tokens = columns[field]
        ids = [
            index
            for index, document in enumerate(tokens)
            if words and target in analyze_tokens(document, set(), [len(words)] * 2)
        ]
    return {"field": field, "phrase": phrase, "ids": ids}


def match_phrases(payload):
    data = json.loads(payload)
    columns = {
        column["name"]: [tokenize_text(text) for text in column["texts"]]
        for column in data["columns"]
    }
    return json.dumps(
        {"matches": [match_phrase(data, columns, request) for request in data["requests"]]}
    )

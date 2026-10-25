"""Sparse per-field n-gram indexes and subset descriptions, independent of projections."""

import json
import re
import unicodedata
from functools import partial

import numpy as np
from sklearn.feature_extraction.text import CountVectorizer

TOKEN = re.compile(r"[^\W_]+(?:['\u2019][^\W_]+)*|[^\w\s]|_|[\r\n]", re.UNICODE)
term_indexes = {}
term_index_id = None
term_record_count = 0
terms_progress = None  # Set by the worker bridge; native tests need no callback.


def analyze_terms(text, stopwords, sizes):
    window = []
    for match in TOKEN.finditer(unicodedata.normalize("NFC", text).casefold()):
        word = match.group()
        if not word[0].isalnum():
            window.clear()
            continue
        window = [*window, word][-sizes[1] :]
        for size in range(sizes[0], min(sizes[1], len(window)) + 1):
            words = window[-size:]
            if words[0] not in stopwords and words[-1] not in stopwords:
                yield " ".join(words)


def index_field(column, data):
    if len(column["texts"]) != data["rows"]:
        raise ValueError("Every text field must contain one value per record.")
    texts = ["" if value is None or value == "\\N" else str(value) for value in column["texts"]]
    analyzer = partial(analyze_terms, stopwords=set(data["stopwords"]), sizes=data["sizes"])
    vectorizer = CountVectorizer(analyzer=analyzer, max_features=20000, dtype=np.int32)
    try:
        matrix = vectorizer.fit_transform(texts)
    except ValueError as error:
        if "empty vocabulary" not in str(error):
            raise
        return None
    return {
        "matrix": matrix,
        "columns": matrix.tocsc(),
        "terms": vectorizer.get_feature_names_out(),
        "lookup": vectorizer.vocabulary_,
    }


def build_term_index(payload):
    global term_indexes, term_index_id, term_record_count
    data = json.loads(payload)
    if not 1 <= data["sizes"][0] <= data["sizes"][1] <= 3:
        raise ValueError("Choose n-gram lengths between one and three.")
    fresh = {}
    for index, column in enumerate(data["columns"]):
        if terms_progress is not None:
            terms_progress(f"Indexing {column['name']}", index, len(data["columns"]))
        fresh[column["name"]] = index_field(column, data)
    term_indexes, term_index_id, term_record_count = fresh, data["indexId"], data["rows"]
    return json.dumps(
        {
            "fields": [
                {"name": name, "vocabulary": len(field["terms"]) if field else 0}
                for name, field in fresh.items()
            ]
        }
    )


def class_weights(counts):
    counts = np.asarray(counts, dtype=float)
    lengths = counts.sum(axis=1, keepdims=True)
    total = counts.sum(axis=0)
    average = float(lengths.mean())
    frequency = np.divide(counts, lengths, out=np.zeros_like(counts), where=lengths != 0)
    inverse = np.log1p(np.divide(average, total, out=np.zeros_like(total), where=total != 0))
    return frequency * inverse


def describe_counts(matrix, subset, comparison):
    selected, background = matrix[subset], matrix[comparison]
    counts = np.vstack(
        [np.asarray(selected.sum(axis=0)), np.asarray(background.sum(axis=0))]
    ).astype(float)
    weights = class_weights(counts)
    support = np.asarray((selected > 0).sum(axis=0)).ravel()
    rest = np.asarray((background > 0).sum(axis=0)).ravel()
    lift = np.log2(((support + 0.5) / (len(subset) + 1)) / ((rest + 0.5) / (len(comparison) + 1)))
    return {
        "ctfidf": weights[0],
        "contrast": weights[0] - weights[1],
        "lift": lift,
        "support": support,
        "rest": rest,
    }


def representatives(matrix, subset, scores):
    weights = np.maximum(scores["contrast"], 0)
    if not weights.any():
        weights = scores["ctfidf"]
    selected = matrix[subset]
    lengths = np.asarray(selected.sum(axis=1)).ravel()
    values = np.asarray(selected @ weights).ravel() / np.maximum(lengths, 1)
    order = np.argsort(-values, kind="stable")
    return subset[order[lengths[order] > 0]]


def membership(field, term, mask):
    column = field["lookup"].get(term)
    if column is None:
        return np.array([], dtype=int)
    matrix = field["columns"]
    ids = matrix.indices[matrix.indptr[column] : matrix.indptr[column + 1]]
    return ids[mask[ids]]


def term_row(field, column, scores, ranked, sizes):
    phrase = str(field["terms"][column])
    mask = np.zeros(term_record_count, dtype=bool)
    mask[ranked] = True
    ids = membership(field, phrase, mask)
    positions = np.full(term_record_count, term_record_count)
    positions[ranked] = np.arange(len(ranked))
    examples = ids[np.argsort(positions[ids], kind="stable")[:3]]
    return {
        "phrase": phrase,
        "support": int(scores["support"][column]),
        "rest": int(scores["rest"][column]),
        "subsetSize": sizes[0],
        "restSize": sizes[1],
        "ctfidf": float(scores["ctfidf"][column]),
        "contrast": float(scores["contrast"][column]),
        "lift": float(scores["lift"][column]),
        "examples": examples.tolist(),
    }


def describe_field(name, field, data, subset, comparison):
    if field is None:
        return {"name": name, "vocabulary": 0, "terms": [], "representatives": []}
    scores = describe_counts(field["matrix"], subset, comparison)
    eligible = np.flatnonzero(scores["support"] >= data["support"])
    if data["ranking"] != "ctfidf" and len(comparison):
        eligible = eligible[scores[data["ranking"]][eligible] > 0]
    order = eligible[np.argsort(-scores[data["ranking"]][eligible], kind="stable")[:15]]
    ranked = representatives(field["matrix"], subset, scores)
    sizes = (len(subset), len(comparison))
    return {
        "name": name,
        "vocabulary": len(field["terms"]),
        "representatives": ranked[:3].tolist(),
        "terms": [term_row(field, column, scores, ranked, sizes) for column in order],
    }


def description_request(payload):
    data = json.loads(payload)
    if data["indexId"] != term_index_id:
        raise ValueError("Build the n-gram index again.")
    subset, comparison = [np.unique(data[key]).astype(int) for key in ("subset", "comparison")]
    for ids in (subset, comparison):
        if (ids < 0).any() or (ids >= term_record_count).any():
            raise ValueError("Invalid record IDs.")
    if np.intersect1d(subset, comparison).size:
        raise ValueError("Subset and comparison must be disjoint.")
    return data, subset, comparison


def describe_terms(payload):
    data, subset, comparison = description_request(payload)
    if data["ranking"] not in {"ctfidf", "contrast", "lift"} or data["support"] < 1:
        raise ValueError("Choose a ranking and positive record support.")
    result = [
        describe_field(name, field, data, subset, comparison)
        for name, field in term_indexes.items()
    ]
    return json.dumps(
        {"subset": len(subset), "comparison": len(comparison), "fields": result}, allow_nan=False
    )


def matching_terms(payload):
    data, subset, _ = description_request(payload)
    field = term_indexes.get(data["field"])
    mask = np.zeros(term_record_count, dtype=bool)
    mask[subset] = True
    ids = membership(field, data["phrase"], mask) if field else np.array([], dtype=int)
    return json.dumps({"ids": ids.tolist()})

"""Sparse per-field n-gram indexes and subset descriptions, independent of projections."""

import json
from functools import partial

import bridge
import numpy as np
from lexical import analyze_terms as analyze_terms
from lexical import analyze_tokens, tokenize_text
from sklearn.feature_extraction.text import CountVectorizer
from term_ranking import (
    POPULATION_RANKINGS,
    distinct_splits,
    embedding_population,
    population_scores,
)
from text_indexes import (
    STEP_ROWS,
    get_text_index,
    ignore_step,
    register_text_index,
    tokenize_column,
)


class ActiveIndex:
    """The text index the last request used: its fields, its identity and its record count."""

    def __init__(self):
        self.indexes = {}
        self.index_id = None
        self.record_count = 0

    def use(self, entry, index_id):
        self.indexes, self.index_id, self.record_count = entry["fields"], index_id, entry["rows"]


active = ActiveIndex()


def counting_analyzer(analyzer, step):
    """Wrap an n-gram analyzer so the vectorizing pass reports progress per document."""
    seen = 0

    def count(tokens):
        nonlocal seen
        seen += 1
        if seen % STEP_ROWS == 0:
            step(STEP_ROWS)
        return analyzer(tokens)

    return count


def index_field(column, data):
    if len(column["texts"]) != data["rows"]:
        raise ValueError("Every text field must contain one value per record.")
    texts = tokenize_column(column, data, tokenize_text)
    analyzer = partial(analyze_tokens, stopwords=set(data["stopwords"]), sizes=data["sizes"])
    analyzer = counting_analyzer(analyzer, data.get("_step", ignore_step))
    vectorizer = CountVectorizer(analyzer=analyzer, max_features=20000, dtype=np.int32)
    try:
        matrix = vectorizer.fit_transform(texts)
    except ValueError as error:
        if "empty vocabulary" not in str(error):
            raise
        return None
    return {
        "name": column["name"],
        "matrix": matrix,
        "columns": matrix.tocsc(),
        "terms": vectorizer.get_feature_names_out(),
        "lookup": vectorizer.vocabulary_,
        "present": np.array([any(token[0].isalnum() for token in row) for row in texts]),
        "words": np.array([sum(token[0].isalnum() for token in row) for row in texts]),
    }


def build_term_index(payload):
    data = json.loads(payload)
    if not 1 <= data["sizes"][0] <= data["sizes"][1] <= 5:
        raise ValueError("Choose n-gram lengths between one and five.")
    entry = register_text_index(data, index_field, bridge.progress_callback)
    active.use(entry, data["indexId"])
    return json.dumps(
        {
            "indexId": data["indexId"],
            "reused": entry["reused"],
            "fields": [
                {"name": name, "vocabulary": len(field["terms"]) if field else 0}
                for name, field in active.indexes.items()
            ],
        }
    )


def index_tokens(payload):
    entry = get_text_index(json.loads(payload)["indexId"])
    return json.dumps(
        {
            name: [
                [word for word in tokens if word[0].isalnum() and word not in entry["stopwords"]]
                for tokens in documents
            ]
            for name, documents in entry["documents"].items()
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
    mask = np.zeros(active.record_count, dtype=bool)
    mask[ranked] = True
    ids = membership(field, phrase, mask)
    positions = np.full(active.record_count, active.record_count)
    positions[ranked] = np.arange(len(ranked))
    examples = ids[np.argsort(positions[ids], kind="stable")[:3]]
    return {
        "phrase": phrase,
        "label": phrase,
        "predicate": {"kind": "term", "field": field["name"], "op": "~", "value": phrase},
        "ids": membership(field, phrase, np.ones(active.record_count, dtype=bool)).tolist(),
        "support": int(scores["support"][column]),
        "rest": int(scores["rest"][column]),
        "subsetSize": sizes[0],
        "restSize": sizes[1],
        "precision": int(scores["support"][column])
        / max(1, int(scores["support"][column] + scores["rest"][column])),
        "recall": int(scores["support"][column]) / max(1, sizes[0]),
        "ctfidf": float(scores["ctfidf"][column]),
        "contrast": float(scores["contrast"][column]),
        "lift": float(scores["lift"][column]),
        "examples": examples.tolist(),
        **{key: float(scores[key][column]) for key in POPULATION_RANKINGS},
        "partitionSupport": int(scores["partitionSupport"][column]),
        "population": scores["population"],
    }


def redundant_phrase(short, long, members, values):
    if short == long or f" {short} " not in f" {long} ":
        return False
    if values[long] < values[short] - 0.1 * abs(values[short]):
        return False
    overlap = len(members[short] & members[long]) / len(members[short] | members[long])
    return overlap >= 0.9


def distinct_terms(field, order, values, records):
    # A bounded ranking pool keeps repeated brushing cheap; scores/index stay intact.
    phrases = {str(field["terms"][column]): column for column in order[:150]}
    mask = np.zeros(active.record_count, dtype=bool)
    mask[records] = True
    members = {phrase: set(membership(field, phrase, mask)) for phrase in phrases}
    scores = {phrase: values[column] for phrase, column in phrases.items()}
    kept = []
    for phrase in sorted(phrases, key=lambda phrase: -len(phrase.split())):
        if not any(redundant_phrase(phrase, long, members, scores) for long in kept):
            kept.append(phrase)
    columns = {phrases[phrase] for phrase in kept}
    return [column for column in order if column in columns][:15]


def eligible_columns(data, scores, compared):
    eligible = np.flatnonzero(scores["support"] >= data["support"])
    if data["ranking"] in {"balanced", "semantic"}:
        support = scores["partitionSupport"]
        eligible = eligible[
            (support[eligible] >= data["support"])
            & (scores["population"] - support[eligible] >= data["support"])
        ]
    if data["ranking"] in {"balanced", "semantic"} or (data["ranking"] != "ctfidf" and compared):
        eligible = eligible[scores[data["ranking"]][eligible] > 0]
    return eligible


def ranked_columns(field, data, scores, eligible, records):
    """The columns to show, best first. Semantic splits are chosen one after another."""
    if data["ranking"] == "semantic":
        if scores["vectors"] is None or not len(eligible):
            return eligible[:0]
        order, gains = distinct_splits(scores["presence"], scores["vectors"], eligible)
        scores["semantic"][order] = gains  # What each split adds beyond the earlier ones.
        return order
    values = scores[data["ranking"]]
    order = eligible[np.argsort(-values[eligible], kind="stable")]
    if data.get("deduplicate", True):
        return np.asarray(distinct_terms(field, order, values, records), dtype=int)
    return order[:15]


def describe_field(name, field, data, subset, comparison):
    if field is None:
        return {"name": name, "vocabulary": 0, "terms": [], "representatives": []}
    scores = describe_counts(field["matrix"], subset, comparison)
    scores.update(population_scores(field, subset, data.get("_embeddings")))
    eligible = eligible_columns(data, scores, len(comparison))
    order = ranked_columns(field, data, scores, eligible, np.concatenate([subset, comparison]))
    ranked = representatives(field["matrix"], subset, scores)
    sizes = (len(subset), len(comparison))
    return {
        "name": name,
        "vocabulary": len(field["terms"]),
        "representatives": ranked[:3].tolist(),
        "textRecords": int(field["present"][subset].sum()),
        "population": scores["population"],
        "terms": [term_row(field, column, scores, ranked, sizes) for column in order],
    }


def description_request(payload):
    data = json.loads(payload)
    entry = get_text_index(data["indexId"])
    active.use(entry, data["indexId"])
    subset, comparison = [np.unique(data[key]).astype(int) for key in ("subset", "comparison")]
    for ids in (subset, comparison):
        if (ids < 0).any() or (ids >= active.record_count).any():
            raise ValueError("Invalid record IDs.")
    if np.intersect1d(subset, comparison).size:
        raise ValueError("Subset and comparison must be disjoint.")
    return data, subset, comparison


def describe_terms(payload):
    data, subset, comparison = description_request(payload)
    if (
        data["ranking"] not in {"ctfidf", "contrast", "lift"} | POPULATION_RANKINGS
        or data["support"] < 1
    ):
        raise ValueError("Choose a ranking and positive record support.")
    data["_embeddings"] = embedding_population(data, bridge.values())
    result = [
        describe_field(name, field, data, subset, comparison)
        for name, field in active.indexes.items()
    ]
    return json.dumps(
        {
            "subset": len(subset),
            "comparison": len(comparison),
            "ranking": data["ranking"],
            "fields": result,
        },
        allow_nan=False,
    )


def matching_terms(payload):
    data, subset, _ = description_request(payload)
    field = active.indexes.get(data["field"])
    mask = np.zeros(active.record_count, dtype=bool)
    mask[subset] = True
    ids = membership(field, data["phrase"], mask) if field else np.array([], dtype=int)
    return json.dumps({"ids": ids.tolist()})

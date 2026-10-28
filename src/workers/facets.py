"""Sparse metadata predicates; no phrase vocabulary or fitted model is needed."""

import numpy as np
from scipy.sparse import csc_matrix
from term_ranking import population_scores

facet_index = None


def prepare_facets(data):
    global facet_index
    if data is None:
        return None
    if facet_index is not None and facet_index["key"] == data["key"]:
        return facet_index
    if "fields" not in data:
        raise ValueError("Metadata predicates must be prepared again.")
    fields = []
    for field in data["fields"]:
        columns = field["predicates"]
        indices = [record for column in columns for record in column["ids"]]
        pointers = np.cumsum([0] + [len(column["ids"]) for column in columns])
        if any(record < 0 or record >= data["rows"] for record in indices):
            raise ValueError("Invalid predicate record IDs.")
        matrix = csc_matrix(
            (np.ones(len(indices)), indices, pointers), shape=(data["rows"], len(columns))
        )
        definitions = [
            {key: value for key, value in column.items() if key != "ids"} for column in columns
        ]
        fields.append(
            {
                **field,
                "predicates": definitions,
                "matrix": matrix,
                "present": np.ones(data["rows"], dtype=bool),
            }
        )
    facet_index = {**data, "fields": fields}
    return facet_index


def facet_scores(field, subset, comparison, embeddings):
    matrix = field["matrix"]
    support = np.asarray(matrix[subset].sum(axis=0)).ravel()
    rest = np.asarray(matrix[comparison].sum(axis=0)).ravel()
    frequency = support / max(1, len(subset))
    contrast = frequency - rest / max(1, len(comparison))
    lift = np.log2(((support + 0.5) / (len(subset) + 1)) / ((rest + 0.5) / (len(comparison) + 1)))
    return {
        **population_scores(field, subset, embeddings),
        "support": support,
        "rest": rest,
        "contrast": contrast,
        "lift": lift,
        "ctfidf": frequency,
    }


def facet_order(scores, data, compared):
    ranking = data["ranking"]
    order = np.flatnonzero(scores["support"] >= data["support"])
    if ranking in {"balanced", "semantic"}:
        support = scores["partitionSupport"]
        order = order[
            (support[order] >= data["support"])
            & (scores["population"] - support[order] >= data["support"])
        ]
    if ranking in {"balanced", "semantic"} or (compared and ranking != "ctfidf"):
        order = order[scores[ranking][order] > 0]
    return order[np.argsort(-scores[ranking][order], kind="stable")][:15]


def facet_row(field, column, scores, subset, comparison):
    support, rest = int(scores["support"][column]), int(scores["rest"][column])
    ids = field["matrix"].indices[
        field["matrix"].indptr[column] : field["matrix"].indptr[column + 1]
    ]
    return {
        **field["predicates"][column],
        "kind": "facet",
        "phrase": field["predicates"][column]["label"],
        "ids": ids.tolist(),
        "support": support,
        "rest": rest,
        "subsetSize": len(subset),
        "restSize": len(comparison),
        "precision": support / max(1, support + rest),
        "recall": support / max(1, len(subset)),
        **{
            key: float(scores[key][column])
            for key in (
                "frequency",
                "balanced",
                "semantic",
                "contrast",
                "lift",
                "ctfidf",
                "partitionSupport",
            )
        },
        "population": scores["population"],
    }


def describe_facets(index, data, embeddings):
    subset, comparison = [np.unique(data[key]).astype(int) for key in ("subset", "comparison")]
    if any((ids < 0).any() or (ids >= index["rows"]).any() for ids in (subset, comparison)):
        raise ValueError("Invalid record IDs.")
    if np.intersect1d(subset, comparison).size:
        raise ValueError("Subset and comparison must be disjoint.")
    result = []
    for field in index["fields"]:
        scores = facet_scores(field, subset, comparison, embeddings)
        order = facet_order(scores, data, len(comparison))
        result.append(
            {
                "name": field["name"],
                "label": field["label"],
                "kind": "facets",
                "vocabulary": len(field["predicates"]),
                "population": scores["population"],
                "terms": [facet_row(field, column, scores, subset, comparison) for column in order],
            }
        )
    return result

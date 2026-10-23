"""Prepare all-record features and projections without a server or pandas."""

import json

import numpy as np
from sklearn.decomposition import PCA, TruncatedSVD
from sklearn.feature_extraction import DictVectorizer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import StandardScaler

embedding_values = None  # Replaced by the worker bridge for each request.


def table_features(data):
    records = [{} for _ in data["rows"]]
    for field in data["fields"]:
        name = field["name"]
        if field["kind"] in {"number", "date"}:
            values = np.array([row.get(name) for row in data["rows"]], dtype=float)
            finite = np.isfinite(values)
            median = float(np.median(values[finite])) if finite.any() else 0.0
            for record, value in zip(records, values, strict=True):
                record[name] = float(value) if np.isfinite(value) else median
        else:
            for record, row in zip(records, data["rows"], strict=True):
                record[name] = str(row.get(name, "(missing)"))
    matrix = DictVectorizer().fit_transform(records)
    return StandardScaler(with_mean=False).fit_transform(matrix)


def text_features(data):
    names = [field["name"] for field in data["fields"]]
    texts = [" ".join(str(row.get(name) or "") for name in names) for row in data["rows"]]
    vectorizer = TfidfVectorizer(
        stop_words=data["stopwords"] or None,
        ngram_range=(1, 2),
        max_features=5000,
        sublinear_tf=True,
    )
    return vectorizer.fit_transform(texts)


def project(data):
    if data["mode"] == "prepared":
        return coordinates(np.asarray(embedding_values.to_py(), dtype=np.float32), data["method"])
    if len(data["rows"]) < 2 or not data["fields"]:
        raise ValueError("Choose at least one feature and import at least two records.")
    if data["mode"] == "words":
        matrix = np.asarray(embedding_values.to_py(), dtype=np.float32).reshape(
            -1, data["dimensions"]
        )
    else:
        matrix = text_features(data) if data["mode"] == "text" else table_features(data)
    if matrix.shape[1] == 0:
        raise ValueError("No usable features. Choose other columns or stopwords.")
    components = min(32, matrix.shape[0] - 1, matrix.shape[1])
    reduced = (
        np.asarray(matrix.toarray() if hasattr(matrix, "toarray") else matrix)
        if matrix.shape[1] == 1
        else TruncatedSVD(n_components=components, random_state=42).fit_transform(matrix)
    )
    if data["method"] in {"umap", "prepare"}:
        return {"features": reduced.tolist(), "dimensions": matrix.shape[1]}
    return coordinates(reduced, data["method"])


def coordinates(reduced, method):
    if method == "pca" and reduced.shape[1] > 1:
        reduced = PCA(n_components=min(2, *reduced.shape), random_state=42).fit_transform(reduced)
    coordinates = reduced[:, :2]
    if coordinates.shape[1] == 1:
        coordinates = np.column_stack((coordinates[:, 0], np.zeros(len(coordinates))))
    return {"coordinates": coordinates.tolist()}


def run_projection(payload):
    return json.dumps(project(json.loads(payload)), allow_nan=False)

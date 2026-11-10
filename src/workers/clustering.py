"""Explicit all-record clustering of a supplied, immutable representation."""

import json
import time

import numpy as np
from sklearn.cluster import HDBSCAN, AgglomerativeClustering, KMeans, MiniBatchKMeans
from sklearn.preprocessing import normalize

# Density helpers are loaded into this worker namespace before clustering.
embedding_values = None  # Set by the local worker bridge for each request.


def integer(data, name, default, lower, upper):
    value = data.get(name, default)
    if isinstance(value, bool) or not isinstance(value, int) or not lower <= value <= upper:
        raise ValueError(f"{name} must be an integer from {lower} to {upper}.")
    return value


# Exact K-means with restarts is far more stable than MiniBatch (k=3 ARI spread +-0.10 against
# +-0.02 on 2,360 summaries) and is cheap up to the agglomerative limit.
EXACT_KMEANS_LIMIT = 5000
KMEANS_RESTARTS = 10


def estimator(data, count):
    method = data["method"]
    if method == "kmeans" and count <= EXACT_KMEANS_LIMIT:
        return KMeans(
            n_clusters=integer(data, "clusters", 8, 2, count),
            n_init=KMEANS_RESTARTS,
            random_state=42,
        )
    if method in {"kmeans", "minibatch"}:
        return MiniBatchKMeans(
            n_clusters=integer(data, "clusters", 8, 2, count),
            batch_size=integer(data, "batchSize", 1024, 16, 65536),
            max_iter=integer(data, "iterations", 100, 1, 1000),
            n_init=3,
            random_state=42,
        )
    if method == "agglomerative":
        if count > 5000:
            raise ValueError("Agglomerative clustering is limited to 5,000 records. Use K-means.")
        linkage = data.get("linkage", "ward")
        if linkage not in {"ward", "average", "complete", "single"}:
            raise ValueError("Unknown linkage.")
        return AgglomerativeClustering(
            n_clusters=integer(data, "clusters", 8, 2, count),
            linkage=linkage,
            compute_full_tree=True,
            compute_distances=True,
        )
    if method == "hdbscan":
        return HDBSCAN(
            min_cluster_size=integer(data, "minClusterSize", 15, 2, count),
            min_samples=integer(data, "minSamples", 5, 1, count),
            n_jobs=1,
        )
    raise ValueError("Unknown clustering method.")


def cluster(data, features):
    matrix = np.asarray(features, dtype=np.float32)
    if matrix.ndim != 2 or min(matrix.shape) < 1 or len(matrix) < 2:
        raise ValueError("Clustering needs at least two records with usable features.")
    if not np.isfinite(matrix).all():
        raise ValueError("Clustering features must be finite.")
    if data.get("normalize", True):
        matrix = normalize(matrix)
    started = time.perf_counter()
    fitted = estimator(data, len(matrix))
    labels = fitted.fit_predict(matrix)
    result = {"labels": labels.tolist(), "seconds": time.perf_counter() - started}
    if data["method"] == "agglomerative":
        result["tree"] = {
            "children": fitted.children_.tolist(),
            "distances": fitted.distances_.tolist(),
        }
    if data["method"] == "hdbscan":
        result.update(globals()["density_result"](fitted))
    return result


def run_clustering(payload):
    return json.dumps(cluster(json.loads(payload), embedding_values.to_py()), allow_nan=False)

"""Browser feasibility probe. Only aggregate diagnostics cross the worker boundary."""

import json
from time import perf_counter

import numpy as np
from sklearn.cluster import DBSCAN, HDBSCAN
from sklearn.decomposition import NMF, PCA, LatentDirichletAllocation, TruncatedSVD
from sklearn.feature_extraction.text import CountVectorizer, TfidfTransformer


def check_analysis(texts, stopwords):
    started = perf_counter()
    counts = CountVectorizer(ngram_range=(1, 2), stop_words=stopwords).fit_transform(texts)
    tfidf = TfidfTransformer().fit_transform(counts)
    dimensions = min(8, counts.shape[0] - 1, counts.shape[1] - 1)
    reduced = TruncatedSVD(n_components=dimensions, random_state=42).fit_transform(tfidf)
    topics = NMF(n_components=3, init="nndsvda", random_state=42, max_iter=500)
    topic_weights = topics.fit_transform(tfidf)
    lda = LatentDirichletAllocation(n_components=3, random_state=42, max_iter=10)
    lda_weights = lda.fit_transform(counts)
    labels = DBSCAN(eps=0.5, min_samples=2).fit_predict(reduced)
    hierarchy = HDBSCAN(min_cluster_size=2).fit_predict(reduced)
    projection = PCA(n_components=2, random_state=42).fit_transform(reduced)
    return {
        "rows": len(texts),
        "features": counts.shape[1],
        "svd_shape": list(reduced.shape),
        "nmf_shape": list(topic_weights.shape),
        "lda_shape": list(lda_weights.shape),
        "dbscan_groups": len(set(labels.tolist()) - {-1}),
        "hdbscan_groups": len(set(hierarchy.tolist()) - {-1}),
        "pca_shape": list(projection.shape),
        "finite": bool(np.isfinite(projection).all()),
        "seconds": round(perf_counter() - started, 3),
    }


def run_probe(payload):
    data = json.loads(payload)
    result = check_analysis(data["texts"], data["stopwords"])
    result["scale"] = check_scale()
    return json.dumps(result)


def check_scale():
    started = perf_counter()
    texts = [f"zorg patiënt klacht{i % 500} behandeling{i % 50}" for i in range(20000)]
    counts = CountVectorizer(ngram_range=(1, 2)).fit_transform(texts)
    tfidf = TfidfTransformer().fit_transform(counts)
    reduced = TruncatedSVD(n_components=16, random_state=42).fit_transform(tfidf)
    return {
        "rows": len(texts),
        "features": counts.shape[1],
        "nonzero": counts.nnz,
        "finite": bool(np.isfinite(reduced).all()),
        "seconds": round(perf_counter() - started, 3),
    }

"""Population phrase scores, using sparse presence and optional saved embeddings."""

import numpy as np

POPULATION_RANKINGS = {"frequency", "balanced", "semantic"}


def embedding_population(data, values):
    if data["ranking"] != "semantic":
        return None
    if values is None:
        raise ValueError("Choose an existing embedding result for semantic splits.")
    raw = values.to_py() if hasattr(values, "to_py") else values
    matrix = np.asarray(raw, dtype=np.float32).reshape(-1, data["embeddingDimensions"])
    ids = np.asarray(data["embeddingRowIds"], dtype=int)
    if len(ids) != len(matrix) or not np.isfinite(matrix).all():
        raise ValueError("Invalid saved embeddings.")
    return ids, matrix


def semantic_scores(presence, vectors):
    # Fraction of embedding variation explained by each binary partition. Evaluate
    # bounded blocks: never materialize a vocabulary-by-embedding dense matrix.
    total = np.square(vectors - vectors.mean(axis=0)).sum()
    result = np.zeros(presence.shape[1])
    if total <= 0:
        return result
    centered = vectors - vectors.mean(axis=0)
    support = np.asarray(presence.sum(axis=0)).ravel()
    denominator = support * (1 - support / len(vectors))
    for start in range(0, presence.shape[1], 256):
        stop = start + 256
        sums = presence[:, start:stop].T @ centered
        squared = np.square(sums).sum(axis=1)
        result[start:stop] = np.divide(
            squared,
            denominator[start:stop] * total,
            out=np.zeros_like(squared),
            where=denominator[start:stop] > 0,
        )
    return np.clip(result, 0, 1)


def population_scores(field, subset, embeddings):
    ids = subset[field["present"][subset]]
    vectors = None
    if embeddings is not None:
        available, matrix = embeddings
        ids, _, positions = np.intersect1d(ids, available, return_indices=True)
        vectors = matrix[positions]
    presence = field["matrix"][ids].astype(bool).astype(float)
    support = np.asarray(presence.sum(axis=0)).ravel()
    frequency = support / max(1, len(ids))
    balanced = np.zeros_like(frequency)
    interior = (frequency > 0) & (frequency < 1)
    p = frequency[interior]
    balanced[interior] = -p * np.log2(p) - (1 - p) * np.log2(1 - p)
    semantic = (
        semantic_scores(presence, vectors)
        if len(ids) and vectors is not None
        else np.zeros_like(frequency)
    )
    return {
        "frequency": frequency,
        "balanced": balanced,
        "semantic": semantic,
        "partitionSupport": support,
        "population": len(ids),
    }

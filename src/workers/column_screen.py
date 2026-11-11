"""Closed-form column screen: which columns does the text vary with, beyond its length?

No model is fitted. The prepared text vectors (the 32-d TF-IDF/SVD ones the maps use) have text
length regressed out. Each candidate column is then scored by the share of the remaining variance
its groups explain (adjusted R-squared; ordinary regression R-squared for numbers). The p-value
comes from the spread of the score under shuffled labels, so it can be small enough for Holm
correction across columns. Every column is scored on the records where it has a value, and
missingness itself is tested too.
"""

import json
from math import erfc, sqrt

import numpy as np
from scipy.sparse import hstack
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfTransformer
from text_indexes import get_text_index

COMPONENTS = 32
STRATA = 8
MIN_GROUP = 10  # Smaller groups join one "(other)" group.
MAX_GROUPS = 50
MIN_COVERAGE = 0.5  # Columns with fewer values than this are not offered.
MIN_POPULATION = 30
EFFECT_FLOOR = 0.01  # Provisional: a trivial effect of 0.003 was "significant" in testing.
PERMUTATIONS = 99
SIGNIFICANCE = 0.05
MISSING_SIGNIFICANCE = 0.01
AXES = 3

prepared_cache = {}


def prepared(index_id):
    """Text vectors, a length proxy and a has-text mask for every record, cached per text index."""
    if index_id not in prepared_cache:
        fields = [f for f in get_text_index(index_id)["fields"].values() if f is not None]
        counts = hstack([field["matrix"] for field in fields], format="csr")
        tfidf = TfidfTransformer(sublinear_tf=True).fit_transform(counts)
        components = min(COMPONENTS, tfidf.shape[0] - 1, tfidf.shape[1])
        vectors = TruncatedSVD(n_components=components, random_state=42).fit_transform(tfidf)
        usable = np.any([field["present"] for field in fields], axis=0)
        prepared_cache.clear()  # Only the latest index is kept.
        prepared_cache[index_id] = (vectors, np.asarray(counts.sum(axis=1)).ravel(), usable)
    return prepared_cache[index_id]


def residual_vectors(vectors, lengths):
    """Vectors with text length regressed out (strata plus smooth log terms), standardised."""
    edges = np.unique(np.quantile(lengths, np.linspace(0, 1, STRATA + 1)[1:-1]))
    strata = np.eye(len(edges) + 1)[np.digitize(lengths, edges)]
    logs = np.log1p(lengths)
    logs = (logs - logs.mean()) / (logs.std() or 1.0)
    design = np.column_stack([strata, logs, logs**2])
    residual = vectors - design @ np.linalg.lstsq(design, vectors, rcond=None)[0]
    spread = residual.std(axis=0)
    return residual / np.where(spread > 0, spread, 1.0)


def merged_codes(codes):
    """Dense group codes for observed records (-1 stays missing); small groups join one group."""
    codes = np.asarray(codes, dtype=int)
    observed = codes >= 0
    result = np.full(len(codes), -1)
    if not observed.any():
        return result, 0
    counts = np.bincount(codes[observed])
    relabeled = np.where(counts[codes[observed]] < MIN_GROUP, len(counts), codes[observed])
    _, dense = np.unique(relabeled, return_inverse=True)
    result[observed] = dense
    return result, int(dense.max()) + 1


def group_test(vectors, groups):
    """Statistic for a grouping: adjusted share of variance explained by the group means."""
    centered = vectors - vectors.mean(axis=0)
    total, count = (centered**2).sum(), len(vectors)

    def statistic(codes):
        onehot = np.eye(groups)[codes]
        between = ((onehot.T @ centered) ** 2).sum(axis=1) / onehot.sum(axis=0)
        return 1 - (1 - between.sum() / total) * (count - 1) / (count - groups)

    return statistic


def regression_test(vectors):
    """Statistic for a number: adjusted R-squared of regressing it on the vectors."""
    basis = np.linalg.qr(vectors - vectors.mean(axis=0))[0]
    count, predictors = basis.shape

    def statistic(target):
        centered = target - target.mean()
        total = (centered**2).sum()
        r2 = ((basis.T @ centered) ** 2).sum() / total if total else 0.0
        return 1 - (1 - r2) * (count - 1) / (count - predictors - 1)

    return statistic


def permutation_score(statistic, labels, rng):
    """Observed statistic and a one-sided p-value from the spread of its shuffled values."""
    observed = statistic(labels)
    null = np.array([statistic(rng.permutation(labels)) for _ in range(PERMUTATIONS)])
    spread = null.std()
    z = (observed - null.mean()) / spread if spread > 0 else 0.0
    return float(observed), 0.5 * erfc(z / sqrt(2))


def holm(pvalues):
    pvalues = np.asarray(pvalues, dtype=float)
    order = np.argsort(pvalues)
    adjusted = np.minimum(1.0, (len(pvalues) - np.arange(len(pvalues))) * pvalues[order])
    result = np.empty(len(pvalues))
    result[order] = np.maximum.accumulate(adjusted)
    return result


def missing_effect(vectors, observed, rng):
    """Does the text differ between records with and without a value? None when untestable."""
    if min(observed.sum(), (~observed).sum()) < MIN_GROUP:
        return None
    effect, p = permutation_score(group_test(vectors, 2), observed.astype(int), rng)
    return {
        "effect": effect,
        "p": p,
        "differs": bool(p <= MISSING_SIGNIFICANCE and effect >= EFFECT_FLOOR),
    }


def numeric_codes(values):
    numbers = np.array([np.nan if value is None else value for value in values], dtype=float)
    return numbers, np.isfinite(numbers)


def screen_column(vectors, column, rng):
    """Score one column on the records where it has a value."""
    numeric = column["kind"] == "numeric"
    if numeric:
        labels, observed = numeric_codes(column["values"])
        groups = 0
    else:
        labels, groups = merged_codes(column["codes"])
        observed = labels >= 0
    result = {
        "name": column["name"],
        "kind": column["kind"],
        "observed": int(observed.sum()),
        "population": len(observed),
        "coverage": float(observed.mean()),
        "groups": groups,
    }
    enough = (
        observed.sum() >= max(MIN_POPULATION, 3 * vectors.shape[1])
        if numeric
        else 2 <= groups <= MAX_GROUPS
    )
    result["eligible"] = bool(enough and result["coverage"] >= MIN_COVERAGE)
    result["missing"] = missing_effect(vectors, observed, rng) if (~observed).any() else None
    if not result["eligible"]:
        return result
    test = regression_test(vectors[observed]) if numeric else group_test(vectors[observed], groups)
    result["effect"], result["p"] = permutation_score(test, labels[observed], rng)
    return result


def text_axes(vectors, rows):
    """The main directions of variation, each split at the median into two sides."""
    centered = vectors - vectors.mean(axis=0)
    u, singular, _ = np.linalg.svd(centered, full_matrices=False)
    share = singular**2 / (singular**2).sum()
    axes = []
    for k in range(min(AXES, len(singular))):
        scores = u[:, k] * singular[k]
        high = scores > np.median(scores)
        axes.append(
            {
                "name": f"axis {k + 1}",
                "share": float(share[k]),
                "high": rows[high].tolist(),
                "low": rows[~high].tolist(),
            }
        )
    return axes


def mark_significant(columns):
    """Holm-correct across the columns that could be tested and apply the effect floor."""
    tested = [column for column in columns if column.get("p") is not None]
    for column, adjusted in zip(
        tested, holm([column["p"] for column in tested]) if tested else [], strict=True
    ):
        column["adjusted"] = float(adjusted)
        column["significant"] = bool(adjusted <= SIGNIFICANCE and column["effect"] >= EFFECT_FLOOR)
    return columns


def restrict(column, keep):
    """The column's values for the records that have text."""
    values = "values" if column["kind"] == "numeric" else "codes"
    return {**column, values: np.asarray(column[values])[keep].tolist()}


def run_column_screen(payload):
    data = json.loads(payload)
    vectors, lengths, usable = prepared(data["indexId"])
    population = np.asarray(data["population"], dtype=int)
    keep = usable[population]
    rows = population[keep]
    if len(rows) < MIN_POPULATION:
        return json.dumps({"population": len(rows), "columns": [], "axes": []})
    residual = residual_vectors(vectors[rows], lengths[rows])
    rng = np.random.default_rng(7)
    columns = [screen_column(residual, restrict(column, keep), rng) for column in data["columns"]]
    result = {
        "population": len(rows),
        "columns": mark_significant(columns),
        "axes": text_axes(residual, rows),
    }
    return json.dumps(result, allow_nan=False)

"""Which columns does the text vary with? Screens with null controls and a length control.

This screen is a candidate for the app, not existing app behaviour. It scores each column by
how strongly phrase usage differs across its groups (per-phrase chi-square, mean of the top
phrases), then calibrates against label shuffles. The length-controlled variant works within
text-length strata so that longer texts, which hold more distinct phrases, cannot pose as signal.
"""

import numpy as np

TOP_PHRASES = 50
PERMUTATIONS = 30
STRATA = 8
MIN_DOCS = 10  # A phrase must appear in this many records to take part.
MAX_GROUPS = 50
MAX_DISCRETE = 12


def presence_matrix(field):
    matrix = field["matrix"].astype(bool).astype(np.float32).tocsc()
    keep = np.flatnonzero(np.asarray(matrix.sum(axis=0)).ravel() >= MIN_DOCS)
    return matrix[:, keep].tocsr()


def column_groups(values):
    """Group labels for any column: few distinct values stay, many numbers become quartiles."""
    try:
        numbers = np.array([float(value) for value in values])
    except (TypeError, ValueError):
        return np.array([str(value) for value in values])
    if len(set(numbers)) <= MAX_DISCRETE:
        return numbers.astype(str)
    edges = np.quantile(numbers, [0.25, 0.5, 0.75])
    return np.digitize(numbers, edges).astype(str)


def length_strata(lengths, count=STRATA):
    edges = np.unique(np.quantile(lengths, np.linspace(0, 1, count + 1)[1:-1]))
    return np.digitize(lengths, edges)


def phrase_chi2(presence, labels):
    """Chi-square of phrase presence against group, per phrase."""
    groups, inverse = np.unique(labels, return_inverse=True)
    onehot = np.zeros((len(labels), len(groups)))
    onehot[np.arange(len(labels)), inverse] = 1
    present = np.asarray(presence.T @ onehot)
    size = onehot.sum(axis=0)
    total = present.sum(axis=1, keepdims=True)
    expected = total * size / len(labels)
    expected_absent = (len(labels) - total) * size / len(labels)
    with np.errstate(divide="ignore", invalid="ignore"):
        parts = (present - expected) ** 2 / expected + (size - present - expected_absent) ** 2 / (
            expected_absent
        )
    return np.nansum(parts, axis=1)


def strength(parts, labels, strata):
    """Sum per-stratum phrase statistics, then average the strongest phrases."""
    total = 0
    for level in np.unique(strata):
        mask = strata == level
        total = total + phrase_chi2(parts[level], labels[mask])
    return float(np.sort(total)[-TOP_PHRASES:].mean())


def permute_within(labels, strata, rng):
    shuffled = labels.copy()
    for level in np.unique(strata):
        where = np.flatnonzero(strata == level)
        shuffled[where] = rng.permutation(labels[where])
    return shuffled


def score_column(presence, values, strata, rng):
    labels = column_groups(values)
    if not 2 <= len(set(labels)) <= MAX_GROUPS:
        return None
    parts = {level: presence[strata == level] for level in np.unique(strata)}
    observed = strength(parts, labels, strata)
    null = [
        strength(parts, permute_within(labels, strata, rng), strata) for _ in range(PERMUTATIONS)
    ]
    spread = float(np.std(null)) or np.nan
    return {
        "strength": observed,
        "null_mean": float(np.mean(null)),
        "z": (observed - np.mean(null)) / spread,
    }


def control_columns(rows, manifest, rng):
    controls = manifest["controls"]
    columns = {}
    for name in controls["shuffled"]:
        values = np.array([row[name] for row in rows], dtype=object)
        for copy in range(controls["shuffles_per_column"]):
            columns[f"shuffled:{name}:{copy}"] = rng.permutation(values)
    for groups in controls["noise_categories"]:
        columns[f"noise:categories-{groups}"] = rng.integers(groups, size=len(rows))
    for copy in range(controls["noise_numeric"]):
        columns[f"noise:numeric-{copy}"] = rng.normal(size=len(rows))
    return columns


def screen_columns(subject, stratified):
    """Score every real column and every null control; returns {name: result}."""
    rows, manifest = subject.rows, subject.manifest
    rng = np.random.default_rng(subject.seed)
    presence = presence_matrix(subject.field)
    lengths = np.array([len(row[subject.text_field].split()) for row in rows])
    strata = length_strata(lengths) if stratified else np.zeros(len(rows), dtype=int)
    columns = {name: [row[name] for row in rows] for name in manifest["columns"]}
    columns.update(control_columns(rows, manifest, rng))
    results = {}
    for name, values in columns.items():
        result = score_column(presence, values, strata, rng)
        if result is not None:
            results[name] = result
    return results


def rank_auc(positive, negative):
    """Probability that a random positive outscores a random negative (ties count half)."""
    wins = sum((p > n) + 0.5 * (p == n) for p in positive for n in negative)
    return wins / (len(positive) * len(negative))


def grade_screen(results, manifest):
    """Grade a screen against the gold classes; NaN z (a column that is its own stratifier) is 0."""
    z = {name: 0.0 if np.isnan(r["z"]) else r["z"] for name, r in results.items()}
    kinds = {name: spec["expected"] for name, spec in manifest["columns"].items()}
    by_kind = {}
    for name, value in z.items():
        by_kind.setdefault(kinds.get(name, "null"), []).append(value)
    nulls = by_kind["null"]
    strong, moderate = by_kind["strong"], by_kind["moderate"]
    return {
        "z": dict(sorted(z.items(), key=lambda item: -item[1])),
        "strong_above_all_nulls": bool(min(strong) > max(nulls)),
        "auc_strong_vs_null": rank_auc(strong, nulls),
        "auc_strong_moderate_vs_null": rank_auc(strong + moderate, nulls),
        "null_false_positive_rate_z3": float(np.mean(np.array(nulls) > 3)),
        "null_max_z": max(nulls),
        "length_below_all_strong": bool(max(by_kind.get("length", [0])) < min(strong)),
    }

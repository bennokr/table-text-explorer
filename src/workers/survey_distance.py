"""Missingness-aware distance between survey respondents.

Questions are compared only where both respondents answered. A blank that routing explains
(the question was not shown) is not a mismatch, and a blank is never imputed. Questions are
averaged within their codebook group first, so a large section cannot outvote a small one. A
yes/no question whose common answer almost everyone gives only counts for a pair when one of
them differs from it. Text is compared by pooled answer embeddings and only when both
respondents have text. Pairs with little shared evidence are shrunk toward the typical
distance.

Input columns are plain data: {"name", "kind": "nominal" | "ordinal" | "numeric", "group", "values",
"states", "weight", "low", "high"}. `states` holds answered, asked_but_skipped, not_shown or
unknown per respondent (see src/routing.js); only answered cells are compared. The result is a
dense, symmetric float32 matrix, which suits a few thousand respondents; larger sets need row
blocks.
"""

import collections

import numpy as np

ANSWERED = "answered"
DEFAULT_WEIGHTS = {"categorical": 0.50, "text": 0.35, "numeric": 0.15}


def answered_values(column):
    """Values scaled to [0, 1] (raw codes for nominal columns) and who answered."""
    answered = np.array([state == ANSWERED for state in column["states"]])
    raw = np.array(
        [v if a else np.nan for v, a in zip(column["values"], answered, strict=True)], float
    )
    if column["kind"] == "nominal":
        return raw, answered
    low = column["low"] if "low" in column else (np.nanmin(raw) if answered.any() else 0.0)
    high = column["high"] if "high" in column else (np.nanmax(raw) if answered.any() else 1.0)
    return (raw - low) / max(high - low, 1e-9), answered


def pair_differences(values, kind):
    """Differences between every two respondents: 0/1 for nominal, absolute for the rest."""
    values = np.nan_to_num(values)
    if kind == "nominal":
        return (values[:, None] != values[None, :]).astype(np.float32)
    return np.abs(values[:, None] - values[None, :]).astype(np.float32)


def common_answer_mask(values, answered, rare):
    """Pairs that count for a yes/no style column: one of the two differs from the mode."""
    seen = values[answered]
    if not rare or not len(seen):
        return None
    mode, count = collections.Counter(seen.tolist()).most_common(1)[0]
    if count < rare * len(seen):
        return None
    off_mode = values != mode
    return off_mode[:, None] | off_mode[None, :]


def add_column(column, totals, options):
    """Adds one column's differences and the pairs it can compare to its group's running sums."""
    values, answered = answered_values(column)
    both = answered[:, None] & answered[None, :]
    if column["kind"] == "nominal":
        counted = common_answer_mask(values, answered, options["rare"])
        both = both if counted is None else both & counted
    block = "numeric" if column["kind"] == "numeric" else "categorical"
    group = column.get("group", "") if block == "categorical" and options["balance"] else ""
    sums, weights = totals.setdefault((block, group), [0.0, 0.0])
    weight = column.get("weight", 1.0)
    differences = pair_differences(values, column["kind"])
    totals[(block, group)] = [
        sums + weight * np.where(both, differences, 0),
        weights + weight * both,
    ]


def group_means(totals, block, size):
    """Mean over groups of the per-group mean difference, and the answers shared."""
    total = np.zeros((size, size), np.float32)
    used = np.zeros((size, size), np.float32)
    shared = np.zeros((size, size), np.float32)
    for (kind, _), (sums, weights) in totals.items():
        if kind != block:
            continue
        usable = weights > 0
        total += np.where(usable, sums / np.where(usable, weights, 1), 0)
        used += usable
        shared += weights
    distance = np.where(used > 0, total / np.where(used > 0, used, 1), np.nan)
    return distance, shared


def pool_text(vectors, owners, size):
    """One normalised vector per respondent: the mean of their normalised answer vectors."""
    vectors = np.asarray(vectors, np.float32)
    unit = vectors / np.maximum(np.linalg.norm(vectors, axis=1, keepdims=True), 1e-9)
    pooled = np.zeros((size, vectors.shape[1]), np.float32)
    counts = np.zeros(size)
    for owner, vector in zip(owners, unit, strict=True):
        pooled[owner] += vector
        counts[owner] += 1
    has = counts > 0
    pooled[has] /= np.maximum(np.linalg.norm(pooled[has], axis=1, keepdims=True), 1e-9)
    return pooled, has, counts


def calibrated(distance, available):
    """Distance scaled to a median of one over valid pairs, so blocks can be weighted."""
    valid = available & ~np.eye(len(distance), dtype=bool)
    median = np.median(distance[valid]) if valid.any() else 1.0
    return np.where(available, distance / max(median, 1e-9), 0)


def respondents(columns, text):
    """How many respondents there are, from the first column or, with none, from the text."""
    return len(columns[0]["states"]) if columns else len(text[1])


def block_distances(columns, text, options):
    """The comparable-pairs mask, calibrated distance and shared evidence of each block."""
    size = respondents(columns, text)
    totals = {}
    for column in columns:
        add_column(column, totals, options)
    blocks = {}
    for name in ("categorical", "numeric"):
        distance, shared = group_means(totals, name, size)
        blocks[name] = (shared > 0, distance, shared)
    pooled, has = text
    both = has[:, None] & has[None, :]
    blocks["text"] = (both, 1 - pooled @ pooled.T, both.astype(np.float32))
    return blocks


def survey_distance(columns, text=None, weights=None, **settings):
    """Distance matrix and diagnostics. `text` is (pooled, has_text) from `pool_text` or None."""
    options = {"rare": 0.8, "balance": True, "kappa": 8.0, "text_evidence": 6.0, **settings}
    weights = {**DEFAULT_WEIGHTS, **(weights or {})}
    size = respondents(columns, text)
    text = text or (np.zeros((size, 1), np.float32), np.zeros(size, bool))
    blocks = block_distances(columns, text, options)
    combined, weight_sum, evidence = np.zeros((size, size)), np.zeros((size, size)), 0.0
    for name, (available, distance, shared) in blocks.items():
        scaled = calibrated(distance, available)
        combined += np.where(available, weights[name] * scaled, 0)
        weight_sum += np.where(available, weights[name], 0)
        evidence = evidence + shared * (options["text_evidence"] if name == "text" else 1)
    return finish(combined, weight_sum, evidence, options["kappa"])


def finish(combined, weight_sum, evidence, kappa):
    """Shrinks each pair toward the typical distance by its evidence."""
    with np.errstate(invalid="ignore", divide="ignore"):
        gower = np.where(weight_sum > 0, combined / np.where(weight_sum > 0, weight_sum, 1), np.nan)
    off = ~np.eye(len(gower), dtype=bool)
    baseline = float(np.nanmedian(gower[off]))
    reliability = evidence / (evidence + kappa)
    shrunk = np.where(np.isnan(gower), baseline, reliability * gower + (1 - reliability) * baseline)
    np.fill_diagonal(shrunk, 0)
    shrunk = np.maximum((shrunk + shrunk.T) / 2, 0).astype(np.float32)
    return {"distance": shrunk, "evidence": evidence, "unsupported": int((evidence == 0).sum())}


def classical_mds(distance, dimensions=32):
    """Coordinates whose Euclidean distances approximate the distance matrix (Torgerson scaling)."""
    squared = distance.astype(np.float64) ** 2
    centred = np.eye(len(squared)) - 1 / len(squared)
    values, vectors = np.linalg.eigh(-0.5 * centred @ squared @ centred)
    top = np.argsort(values)[::-1][: min(dimensions, len(values) - 1)]
    return vectors[:, top] * np.sqrt(np.maximum(values[top], 0))


def missingness_distance(states):
    """Share of questions on which two respondents differ in state (answered, skipped, ...)."""
    kinds = sorted({state for column in states for state in column})
    matches = np.zeros((len(states[0]), len(states[0])), np.float32)
    for kind in kinds:
        indicator = np.array(
            [[state == kind for state in column] for column in states], np.float32
        ).T
        matches += indicator @ indicator.T
    return 1 - matches / len(states)


def nearest(distance, count):
    """Indices of each respondent's `count` nearest others."""
    shown = distance.astype(np.float64).copy()
    np.fill_diagonal(shown, np.inf)
    return np.argsort(shown, axis=1)[:, :count]


def neighbour_graph(distance, count):
    """Each respondent's `count` nearest, themselves first, with their distances (a UMAP graph)."""
    count = min(count, len(distance))
    self_first = distance.astype(np.float64) - np.eye(len(distance))
    order = np.argsort(self_first, axis=1, kind="stable")
    indices = order[:, :count]
    return indices, np.take_along_axis(distance, indices, axis=1)


def neighbour_overlap(first, second, count=15):
    """Mean share of nearest neighbours that two distance matrices have in common."""
    return float(
        np.mean(
            [
                len(set(a) & set(b)) / count
                for a, b in zip(nearest(first, count), nearest(second, count), strict=True)
            ]
        )
    )

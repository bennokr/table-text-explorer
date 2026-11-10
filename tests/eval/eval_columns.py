"""Which columns does the text vary with? Held-out skill beyond text length, with null controls.

This is a candidate for the app, not existing behaviour. For each column, predict its groups from
the app's own 32-d text vectors (TF-IDF, word or sentence embeddings, each reduced by SVD)
with a regularised logistic regression, scored by
repeated 5-fold cross-validation. Skill is the proportional reduction in log-loss against a
baseline. Two baselines are reported:

- skill_total: against the column's overall group frequencies.
- skill_beyond_length: against a model that knows only the text length. This is the score to
  rank by. A column that merely tracks length scores about zero here. When length alone already
  removes 90% of the loss the ratio is meaningless, so the column is marked length-determined
  and not scored (n/a).

Proportional skill does not depend on how many groups a column has, and held-out scoring puts
noise near zero. Shuffled and random control columns measure the floor, and a column is
detected when it beats nearly all of them (empirical one-sided p; at least 19 nulls are needed
to resolve p = 0.05).
"""

import numpy as np
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

FOLDS = 5
REPEATS = 2
STRATA = 8
MIN_GROUP = 10  # Smaller groups are merged so every fold can see every class.
MAX_GROUPS = 50
MAX_DISCRETE = 12
ALPHA = 0.05
LENGTH_DETERMINED = 0.9  # Length alone removes this share of loss: skill beyond it is undefined.


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


def merge_rare(labels):
    names, counts = np.unique(labels, return_counts=True)
    rare = set(names[counts < MIN_GROUP])
    return np.array(["(other)" if label in rare else label for label in labels])


def length_design(lengths):
    """Everything the baseline may know about length: 8 strata plus smooth log-length terms."""
    edges = np.unique(np.quantile(lengths, np.linspace(0, 1, STRATA + 1)[1:-1]))
    strata = np.eye(len(edges) + 1)[np.digitize(lengths, edges)]
    logs = np.log1p(lengths)
    logs = (logs - logs.mean()) / (logs.std() or 1.0)
    return np.column_stack([strata, logs, logs**2])


def held_out_loss(model, design, labels, seed):
    """Mean held-out log-loss over REPEATS shuffled stratified folds."""
    classes = np.unique(labels)
    losses = []
    for repeat in range(REPEATS):
        folds = StratifiedKFold(FOLDS, shuffle=True, random_state=seed + repeat)
        proba = cross_val_predict(model, design, labels, cv=folds, method="predict_proba")
        losses.append(log_loss(labels, proba, labels=classes))
    return float(np.mean(losses))


def score_column(vectors, lengths, values, seed):
    labels = merge_rare(column_groups(values))
    if not 2 <= len(set(labels)) <= MAX_GROUPS:
        return None
    text_model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=500))
    prior = held_out_loss(DummyClassifier(strategy="prior"), lengths, labels, seed)
    by_length = held_out_loss(text_model, lengths, labels, seed)
    combined = held_out_loss(text_model, np.hstack([vectors, lengths]), labels, seed)
    explained = 1 - by_length / prior
    determined = explained >= LENGTH_DETERMINED
    return {
        "skill_total": 1 - combined / prior,
        "length_explains": explained,
        "skill_beyond_length": float("nan") if determined else 1 - combined / by_length,
        "length_determined": bool(determined),
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


def screen_columns(subject):
    """Score every real column and every null control; returns {name: result}."""
    rows, manifest = subject.rows, subject.manifest
    rng = np.random.default_rng(subject.seed)
    vectors = subject.features
    lengths = length_design(np.array([len(row[subject.text_field].split()) for row in rows]))
    columns = {name: [row[name] for row in rows] for name in manifest["columns"]}
    columns.update(control_columns(rows, manifest, rng))
    results = {}
    for name, values in columns.items():
        result = score_column(vectors, lengths, values, subject.seed)
        if result is not None:
            results[name] = result
    return results


def rank_auc(positive, negative):
    """Probability that a random positive outscores a random negative (ties count half)."""
    wins = sum((p > n) + 0.5 * (p == n) for p in positive for n in negative)
    return wins / (len(positive) * len(negative))


def column_classes(results, manifest, text_field):
    """Gold class per column; controls and listed-null columns count as null."""
    overrides = manifest.get("field_overrides", {}).get(text_field, {})
    classes = {}
    for name in results:
        spec = manifest["columns"].get(name)
        classes[name] = overrides.get(name, spec["expected"] if spec else "null")
    return classes


def grade_screen(results, manifest, text_field):
    classes = column_classes(results, manifest, text_field)
    scorable = {
        n: r["skill_beyond_length"] for n, r in results.items() if not r["length_determined"]
    }
    nulls = np.array([value for name, value in scorable.items() if classes[name] == "null"])
    by_class = {}
    for name, value in scorable.items():
        by_class.setdefault(classes[name], []).append(value)
    strong, moderate = by_class.get("strong", []), by_class.get("moderate", [])
    p_values = {n: (1 + (nulls >= v).sum()) / (1 + len(nulls)) for n, v in scorable.items()}
    order = sorted(results, key=lambda n: -scorable.get(n, -np.inf))
    return {
        "table": {
            name: {**results[name], "class": classes[name], "p": p_values.get(name, float("nan"))}
            for name in order
        },
        "null_count": len(nulls),
        "alpha_resolvable": bool(1 / (1 + len(nulls)) <= ALPHA),
        "null_mean": float(nulls.mean()),
        "null_sd": float(nulls.std()),
        "null_max": float(nulls.max()),
        "strong_above_all_nulls": bool(min(strong) > nulls.max()),
        "auc_strong_vs_null": rank_auc(strong, nulls),
        "auc_strong_moderate_vs_null": rank_auc(strong + moderate, nulls),
        "length_columns_detected": [
            n for n, kind in classes.items() if kind == "length" and p_values.get(n, 1) <= ALPHA
        ],
        "length_determined_columns": [n for n, r in results.items() if r["length_determined"]],
    }

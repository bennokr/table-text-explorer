"""Do the app's phrase descriptions explain a group? Held-out recovery against null groups.

For each gold group (one against the rest) phrases are ranked by the app's own describe_terms
on a random half of the records. The top phrases are then judged on the other half: can the
presence of those phrases recover membership (AUC), how precise are they, and how many
members do they cover. Random groups of the same sizes give the chance level.
"""

import json

import numpy as np
from sklearn.metrics import roc_auc_score

RANKINGS = ["frequency", "balanced", "ctfidf", "contrast", "lift"]
TOP_K = 10
SPLITS = 3
SUPPORT = 2  # The app's default minimum matching records.
NULL_FRACTIONS = (1 / 12, 1 / 4, 5 / 12)  # One sub-area, one coarse area, the largest area.
NULL_PER_SIZE = 5
LENGTH_QUANTILE = 0.75


def hierarchy_groups(rows, manifest):
    groups = {}
    for level, column in manifest["hierarchy"].items():
        for value in sorted({row[column] for row in rows}):
            groups[f"{level}:{value}"] = np.array([row[column] == value for row in rows])
    return groups


def control_groups(rows, rng, length_column):
    groups = {}
    for fraction in NULL_FRACTIONS:
        size = round(fraction * len(rows))
        for copy in range(NULL_PER_SIZE):
            mask = np.zeros(len(rows), dtype=bool)
            mask[rng.choice(len(rows), size=size, replace=False)] = True
            groups[f"null:{size}-{copy}"] = mask
    lengths = np.array([float(row[length_column]) for row in rows])
    groups["length:longest-quartile"] = lengths >= np.quantile(lengths, LENGTH_QUANTILE)
    return groups


def top_phrases(subject, positive, negative, ranking, extra=None):
    request = {
        "indexId": subject.text_field,
        "subset": positive.tolist(),
        "comparison": negative.tolist(),
        "ranking": ranking,
        "support": SUPPORT,
        **(extra or {}),
    }
    result = json.loads(subject.terms.describe_terms(json.dumps(request)))
    return [term["phrase"] for term in result["fields"][0]["terms"][:TOP_K]]


def phrase_presence(field, phrases, ids):
    columns = [field["lookup"][phrase] for phrase in phrases]
    return (field["matrix"][ids][:, columns] > 0).toarray()


def held_out_scores(field, phrases, test_ids, truth):
    """AUC of 'how many of the phrases occur', mean phrase precision, and member coverage."""
    base_rate = float(truth.mean())
    if not phrases:
        return {"auc": 0.5, "precision": 0.0, "coverage": 0.0, "base_rate": base_rate, "phrases": 0}
    present = phrase_presence(field, phrases, test_ids)
    hits = present.sum(axis=1)
    counts = present.sum(axis=0)
    precision = np.divide(
        (present & truth[:, None]).sum(axis=0), counts, where=counts > 0, out=np.zeros(len(counts))
    )
    return {
        "auc": float(roc_auc_score(truth, hits)) if hits.std() > 0 else 0.5,
        "precision": float(precision[counts > 0].mean()) if (counts > 0).any() else 0.0,
        "coverage": float((hits[truth] > 0).mean()) if truth.any() else 0.0,
        "base_rate": base_rate,
        "phrases": len(phrases),
    }


def evaluate_group(subject, mask, ranking, rng):
    """Average held-out scores over SPLITS random half splits."""
    scores = []
    for _ in range(SPLITS):
        order = rng.permutation(len(mask))
        train, test = order[: len(order) // 2], order[len(order) // 2 :]
        phrases = top_phrases(subject, train[mask[train]], train[~mask[train]], ranking)
        scores.append(held_out_scores(subject.field, phrases, test, mask[test]))
    return {key: float(np.mean([score[key] for score in scores])) for key in scores[0]}


def example_phrases(subject, mask):
    """Top contrast phrases on all records, for display only."""
    everyone = np.arange(len(mask))
    return top_phrases(subject, everyone[mask], everyone[~mask], "contrast")


def evaluate_descriptions(subject):
    rng = np.random.default_rng(subject.seed)
    groups = {
        **hierarchy_groups(subject.rows, subject.manifest),
        **control_groups(subject.rows, rng, subject.manifest["length_column"]),
    }
    results = {
        ranking: {
            name: evaluate_group(subject, mask, ranking, rng) for name, mask in groups.items()
        }
        for ranking in RANKINGS
    }
    examples = {name: example_phrases(subject, mask) for name, mask in groups.items()}
    return {"groups": results, "examples": examples}

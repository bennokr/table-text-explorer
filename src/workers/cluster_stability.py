"""How reproducible are the groups of a clustering? Hennig's subsampling measure.

Each group is matched, in many re-clusterings of random 80% subsets, to the group it overlaps
most (Jaccard). A mean near 1 means the same groups come back; below about 0.6 a group is a
pattern in this sample rather than something the data keeps finding.
"""

import numpy as np

ROUNDS = 8
FRACTION = 0.8
STABLE = 0.75  # Hennig: stable above 0.75, a pattern between 0.6 and 0.75.
MAX_RECORDS = 3000  # Beyond this the repeated fits take too long in the browser.
STEPS_DOWN = 4  # How many smaller group counts are tried when the chosen one is not stable.


def group_stability(matrix, labels, refit):
    """Mean best Jaccard per group over re-clusterings; `refit(subset_matrix)` returns labels."""
    rng = np.random.default_rng(0)
    groups = {int(g): set(np.flatnonzero(labels == g)) for g in set(labels.tolist()) if g != -1}
    scores = {group: [] for group in groups}
    for _ in range(ROUNDS):
        chosen = np.sort(rng.choice(len(matrix), int(FRACTION * len(matrix)), replace=False))
        again = refit(matrix[chosen])
        found = [set(chosen[again == g]) for g in set(again.tolist()) if g != -1]
        for group, members in groups.items():
            kept = members & set(chosen.tolist())
            overlap = (len(kept & other) / max(len(kept | other), 1) for other in found)
            scores[group].append(max(overlap, default=0.0))
    return {group: round(float(np.mean(values)), 3) for group, values in scores.items()}


def mean_stability(scores):
    return float(np.mean(list(scores.values()))) if scores else 0.0


def suggest_groups(count, stability_at):
    """The largest group count below `count` whose groups are stable, or None."""
    for smaller in range(count - 1, max(1, count - 1 - STEPS_DOWN), -1):
        if mean_stability(stability_at(smaller)) >= STABLE:
            return smaller
    return None

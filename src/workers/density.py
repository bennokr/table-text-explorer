"""Version-pinned adapter for scikit-learn 1.7 HDBSCAN tree extraction/selection."""

import json

import numpy as np
from sklearn.cluster._hdbscan._tree import (
    HIERARCHY_dtype,
    _condense_tree,
    tree_to_labels,
)


def density_tree(linkage, minimum):
    condensed = _condense_tree(linkage, minimum)
    count = len(linkage) + 1
    largest = int(condensed["parent"].max())
    children = [[] for _ in range(largest - count + 1)]
    for edge in condensed:
        child = int(edge["child"])
        if child >= count:
            child = count + largest - child
        children[largest - int(edge["parent"])].append(child)
    return {"kind": "density", "children": children, "linkage": linkage.tolist()}


def density_labels(linkage, tree, minimum, method="eom", epsilon=0.0):
    labels, probabilities = tree_to_labels(
        linkage,
        min_cluster_size=minimum,
        cluster_selection_method=method,
        cluster_selection_epsilon=epsilon,
    )
    count = len(labels)
    homogeneous = labels.tolist()
    parents = {}
    for index, children in enumerate(tree["children"]):
        values = {homogeneous[child] for child in children}
        homogeneous.append(values.pop() if len(values) == 1 else -2)
        for child in children:
            parents[child] = count + index
    mapping = {}
    for node in range(count, len(homogeneous) - 1):
        label = homogeneous[node]
        if label >= 0 and homogeneous[parents[node]] != label:
            mapping[label] = node
    if set(labels) - {-1} != set(mapping):
        raise ValueError("Density selection could not map all labels to saved branches.")
    return {
        "labels": [mapping.get(int(label), -1) for label in labels],
        "cut": sorted(mapping.values()),
        "probabilities": probabilities.tolist(),
    }


def select_density(data):
    selection = data["selection"]
    method = selection["method"]
    epsilon = float(selection["epsilon"])
    if method not in {"eom", "leaf"} or not np.isfinite(epsilon) or epsilon < 0:
        raise ValueError("Choose stable/fine groups and a finite nonnegative separation.")
    linkage = np.array([tuple(row) for row in data["tree"]["linkage"]], dtype=HIERARCHY_dtype)
    return density_labels(linkage, data["tree"], data["minimum"], method, epsilon)


def run_density_selection(payload):
    return json.dumps(select_density(json.loads(payload)), allow_nan=False)


def density_result(fitted):
    linkage = fitted._single_linkage_tree_
    tree = density_tree(linkage, fitted.min_cluster_size)
    return {"tree": tree, **density_labels(linkage, tree, fitted.min_cluster_size)}

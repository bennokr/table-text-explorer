"""Do clusters and maps recover known structure? Agreement with gold labels and chance level."""

import json
import subprocess
import tempfile
from contextlib import contextmanager
from pathlib import Path

import numpy as np
from eval_common import ROOT
from sklearn.metrics import adjusted_rand_score, normalized_mutual_info_score
from sklearn.neighbors import NearestNeighbors

NEIGHBORS = 15  # The app's default UMAP neighbors and epochs.
EPOCHS = 150
KNN = 10
SHUFFLES = 10
REPEATS = 20  # Subsample-and-seed repeats for k-means.
UMAP_SEEDS = (1, 2, 3, 4, 5)
DEFAULT_UMAP_SEED = 42  # The app's own seed.
SUBSAMPLE_SHARE = 0.8
CLUSTER_RUNS = [
    ("minibatch", {"method": "minibatch"}),
    ("agglomerative", {"method": "agglomerative"}),
    ("hdbscan", {"method": "hdbscan", "minClusterSize": 15, "minSamples": 5}),
]


def length_values(rows, manifest):
    return np.array([float(row[manifest["length_column"]]) for row in rows])


def label_sets(rows, manifest, rng):
    names = [*manifest["hierarchy"].values(), *manifest.get("extra_labels", [])]
    labels = {name: [str(row[name]) for row in rows] for name in names}
    quartiles = np.digitize(
        length_values(rows, manifest), np.quantile(length_values(rows, manifest), [0.25, 0.5, 0.75])
    )
    labels["length quartile"] = [str(int(v)) for v in quartiles]
    fine = np.array(labels[manifest["hierarchy"]["fine"]])
    labels["shuffled fine"] = [rng.permutation(fine) for _ in range(SHUFFLES)]
    return labels


def agreement(predicted, labels):
    """ARI and NMI against each label set; the shuffled set reports its mean over shuffles."""
    scores = {}
    for name, truth in labels.items():
        if name == "shuffled fine":
            scores[name] = tuple(
                float(np.mean([f(t, predicted) for t in truth]))
                for f in (adjusted_rand_score, normalized_mutual_info_score)
            )
        else:
            scores[name] = (
                adjusted_rand_score(truth, predicted),
                normalized_mutual_info_score(truth, predicted),
            )
    return scores


def cluster_runs(clustering, features, labels, manifest):
    counts = {
        "coarse": len(set(labels[manifest["hierarchy"]["coarse"]])),
        "fine": len(set(labels[manifest["hierarchy"]["fine"]])),
    }
    results = {}
    for name, config in CLUSTER_RUNS:
        levels = counts.items() if name != "hdbscan" else [("density", None)]
        for level, groups in levels:
            output = clustering.cluster({**config, "clusters": groups, "normalize": True}, features)
            predicted = np.array(output["labels"])
            results[f"{name} ({level}{f', k={groups}' if groups else ''})"] = {
                "agreement": agreement(predicted, labels),
                "clusters": int(len(set(predicted)) - (1 if -1 in predicted else 0)),
                "unassigned": float((predicted == -1).mean()),
            }
    return results


def knn_purity(points, labels):
    """Mean share of each record's nearest neighbours that carry its own label."""
    indices = (
        NearestNeighbors(n_neighbors=KNN + 1)
        .fit(points)
        .kneighbors(points, return_distance=False)[:, 1:]
    )
    labels = np.asarray(labels)
    return float((labels[indices] == labels[:, None]).mean())


def umap_coordinates(features, seed=DEFAULT_UMAP_SEED):
    with tempfile.TemporaryDirectory() as folder:
        source, target = Path(folder, "features.json"), Path(folder, "umap.json")
        source.write_text(
            json.dumps(
                {
                    "features": features.tolist(),
                    "neighbors": NEIGHBORS,
                    "epochs": EPOCHS,
                    "seed": seed,
                }
            )
        )
        subprocess.run(
            ["node", str(ROOT / "tests/eval/umap-map.mjs"), str(source), str(target)],
            cwd=ROOT,
            check=True,
        )
        return np.array(json.loads(target.read_text()))


def map_runs(analysis, features, labels, manifest, rng):
    maps = {
        "32-d text vectors": features,
        "PCA (2-d)": np.array(analysis.coordinates(features, "pca")["coordinates"]),
        "SVD (2-d)": np.array(analysis.coordinates(features, "svd")["coordinates"]),
        "UMAP (2-d)": umap_coordinates(features),
    }
    results = {}
    for name, points in maps.items():
        results[name] = {}
        for level, column in manifest["hierarchy"].items():
            truth = np.array(labels[column])
            chance = float(np.mean([knn_purity(points, rng.permutation(truth)) for _ in range(3)]))
            results[name][level] = {"purity": knn_purity(points, truth), "chance": chance}
    return results


@contextmanager
def kmeans_seed(clustering, seed):
    """MiniBatch K-means exactly as the app configures it, but with a chosen random seed."""
    original = clustering.MiniBatchKMeans
    clustering.MiniBatchKMeans = lambda **kwargs: original(**{**kwargs, "random_state": seed})
    try:
        yield
    finally:
        clustering.MiniBatchKMeans = original


def stability(clustering, features, labels, manifest):
    """Per-repeat ARI and NMI of MiniBatch on 80% subsamples with a new seed each time.

    Subsamples and seeds depend only on the repeat number, so every representation sees the same
    ones and results can be compared pairwise.
    """
    results = {}
    for level, column in manifest["hierarchy"].items():
        truth = np.array(labels[column])
        config = {"method": "minibatch", "clusters": len(set(truth)), "normalize": True}
        scores = []
        for repeat in range(REPEATS):
            keep = np.random.default_rng(repeat).choice(
                len(truth), size=int(0.8 * len(truth)), replace=False
            )
            with kmeans_seed(clustering, repeat):
                predicted = clustering.cluster(config, features[keep])["labels"]
            scores.append(
                [
                    adjusted_rand_score(truth[keep], predicted),
                    normalized_mutual_info_score(truth[keep], predicted),
                ]
            )
        results[level] = scores
    return results


def umap_seeds(features, labels, manifest):
    """kNN purity of UMAP layouts from different random seeds."""
    results = {level: [] for level in manifest["hierarchy"]}
    for seed in UMAP_SEEDS:
        points = umap_coordinates(features, seed)
        for level, column in manifest["hierarchy"].items():
            results[level].append(knn_purity(points, np.array(labels[column])))
    return results


def evaluate_structure(subject):
    rng = np.random.default_rng(subject.seed)
    labels = label_sets(subject.rows, subject.manifest, rng)
    return {
        "clusters": cluster_runs(subject.clustering, subject.features, labels, subject.manifest),
        "stability": stability(subject.clustering, subject.features, labels, subject.manifest),
        "umap_seeds": umap_seeds(subject.features, labels, subject.manifest),
        "maps": map_runs(subject.analysis, subject.features, labels, subject.manifest, rng),
    }

# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["numpy==1.26.4", "scikit-learn==1.7.0"]
# ///
"""Native numerical checks and synthetic timing; never reads local datasets."""

import importlib.util
import json
import sys
import unittest
from pathlib import Path

import numpy as np
from sklearn.cluster import HDBSCAN, KMeans, MiniBatchKMeans
from sklearn.datasets import make_blobs
from sklearn.metrics import adjusted_rand_score

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / "src/workers"))
spec = importlib.util.spec_from_file_location("clustering", ROOT / "src/workers/clustering.py")
clustering = importlib.util.module_from_spec(spec)
density_spec = importlib.util.spec_from_file_location("density", ROOT / "src/workers/density.py")
density = importlib.util.module_from_spec(density_spec)
density_spec.loader.exec_module(density)
clustering.density_result = density.density_result
clustering.select_density = density.select_density
spec.loader.exec_module(clustering)


class ClusteringChecks(unittest.TestCase):
    def test_separated_groups_and_repeatability(self):
        features, truth = make_blobs(n_samples=200, n_features=8, centers=4, random_state=42)
        for method in ("kmeans", "minibatch", "agglomerative", "hdbscan"):
            config = {"method": method, "clusters": 4, "normalize": False}
            first = clustering.cluster(config, features)["labels"]
            second = clustering.cluster(config, features)["labels"]
            self.assertEqual(first, second)
            self.assertGreater(adjusted_rand_score(truth, first), 0.95)

    def test_separated_groups_are_stable_and_noise_suggests_fewer_groups(self):
        blobs, _ = make_blobs(n_samples=200, n_features=8, centers=4, random_state=42)
        result = clustering.cluster({"method": "kmeans", "clusters": 4, "normalize": False}, blobs)
        self.assertEqual(len(result["stability"]), 4)
        self.assertGreater(min(result["stability"].values()), 0.9)
        self.assertIsNone(result["suggestedGroups"])
        noise = np.random.default_rng(3).normal(size=(200, 8))
        result = clustering.cluster({"method": "kmeans", "clusters": 8, "normalize": False}, noise)
        self.assertLess(np.mean(list(result["stability"].values())), 0.75)
        self.assertNotIn("stability", clustering.cluster({"method": "hdbscan"}, blobs))

    def test_saved_hierarchy(self):
        features, _ = make_blobs(n_samples=30, centers=3, random_state=42)
        result = clustering.cluster(
            {"method": "agglomerative", "clusters": 3, "normalize": False}, features
        )
        tree = result["tree"]
        self.assertEqual(len(tree["children"]), 29)
        self.assertEqual(len(tree["distances"]), 29)
        leaves = {index: {index} for index in range(30)}
        for index, children in enumerate(tree["children"]):
            self.assertTrue(all(child < 30 + index for child in children))
            left, right = (leaves[child] for child in children)
            self.assertFalse(left & right)
            leaves[30 + index] = left | right
        self.assertEqual(leaves[58], set(range(30)))
        self.assertTrue(all(value >= 0 for value in tree["distances"]))
        self.assertNotIn("tree", clustering.cluster({"method": "minibatch"}, features))

    def test_density_tree_and_saved_selection(self):
        features, _ = make_blobs(n_samples=100, centers=4, random_state=9)
        output = clustering.cluster(
            {"method": "hdbscan", "minClusterSize": 7, "normalize": False}, features
        )
        tree = output["tree"]
        self.assertEqual(tree["kind"], "density")
        self.assertEqual(len(tree["linkage"]), 99)
        for index, children in enumerate(tree["children"]):
            self.assertTrue(all(child < 100 + index for child in children))
        for method in ("eom", "leaf"):
            for epsilon in (0.0, 0.5, 5.0, 50.0):
                selected = clustering.select_density(
                    {
                        "tree": tree,
                        "minimum": 7,
                        "selection": {"method": method, "epsilon": epsilon},
                    }
                )
                reference = HDBSCAN(
                    min_cluster_size=7,
                    min_samples=5,
                    cluster_selection_method=method,
                    cluster_selection_epsilon=epsilon,
                ).fit_predict(features)
                self.assertEqual(adjusted_rand_score(reference, selected["labels"]), 1.0)
                self.assertEqual(
                    np.flatnonzero(reference == -1).tolist(),
                    np.flatnonzero(np.array(selected["labels"]) == -1).tolist(),
                )
                self.assertEqual(set(selected["cut"]), set(selected["labels"]) - {-1})

    def test_density_degenerate_and_invalid_selection(self):
        features = np.r_[np.zeros((20, 2)), np.ones((20, 2))]
        output = clustering.cluster({"method": "hdbscan", "normalize": False}, features)
        json.dumps(output, allow_nan=False)
        self.assertEqual(len(set(output["labels"])), 2)
        for epsilon in (-1, float("nan")):
            with self.assertRaises(ValueError):
                clustering.select_density(
                    {
                        "tree": output["tree"],
                        "minimum": 15,
                        "selection": {"method": "eom", "epsilon": epsilon},
                    }
                )

    def test_noise_and_normalization(self):
        features = np.eye(20)
        result = clustering.cluster({"method": "hdbscan", "minClusterSize": 15}, features)
        self.assertEqual(set(result["labels"]), {-1})
        zeros = clustering.cluster({"method": "minibatch", "clusters": 2}, np.zeros((4, 2)))
        self.assertEqual(len(zeros["labels"]), 4)

    def test_invalid_inputs(self):
        invalid = [[], [[1, 2]], [[float("nan")], [2]], [[float("inf")], [2]]]
        for features in invalid:
            with self.assertRaises(ValueError):
                clustering.cluster({"method": "minibatch"}, features)
        for config in (
            {"method": "unknown"},
            {"method": "minibatch", "clusters": 3.2},
            {"method": "minibatch", "clusters": 21},
            {"method": "kmeans", "clusters": 21},
            {"method": "agglomerative", "linkage": "invalid"},
        ):
            with self.assertRaises(ValueError):
                clustering.cluster(config, np.eye(20))

    def test_kmeans_is_exact_with_restarts_up_to_the_limit_and_minibatch_beyond(self):
        small = clustering.estimator({"method": "kmeans", "clusters": 3}, 100)
        large = clustering.estimator({"method": "kmeans", "clusters": 3}, 5001)
        self.assertIsInstance(small, KMeans)
        self.assertEqual(small.n_init, 10)
        self.assertIsInstance(large, MiniBatchKMeans)
        self.assertIsInstance(clustering.estimator({"method": "minibatch"}, 100), MiniBatchKMeans)

    def test_agglomerative_memory_guard(self):
        with self.assertRaisesRegex(ValueError, "5,000"):
            clustering.cluster({"method": "agglomerative"}, np.ones((5001, 2)))


def timings():
    evidence = []
    for count, methods in (
        (2000, ("kmeans", "minibatch", "agglomerative", "hdbscan")),
        (20000, ("kmeans", "minibatch")),
    ):
        features, _ = make_blobs(n_samples=count, n_features=32, centers=8, random_state=42)
        for method in methods:
            result = clustering.cluster({"method": method, "normalize": False}, features)
            evidence.append(
                {
                    "records": count,
                    "dimensions": 32,
                    "method": method,
                    "seconds": round(result["seconds"], 4),
                }
            )
    print(
        json.dumps(
            {"runtime": "native scikit-learn 1.7.0; not WASM timings", "timings": evidence},
            indent=2,
        )
    )


if __name__ == "__main__":
    outcome = unittest.main(exit=False)
    if not outcome.result.wasSuccessful():
        raise SystemExit(1)
    timings()

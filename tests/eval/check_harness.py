# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["numpy==1.26.4", "scikit-learn==1.7.0"]
# ///
"""Positive and negative controls for the harness itself, on synthetic planted structure.

A harness that cannot find planted structure, or that finds structure in noise, says nothing
about the app. Texts mix a shared vocabulary with group-specific words; text length is varied
independently of group, so a length effect exists to be controlled.
"""

import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))

from eval_columns import grade_screen, screen_columns
from eval_common import load_clustering, load_module
from eval_common import make_subject as shared_subject
from eval_descriptions import evaluate_descriptions
from eval_surfacing import phrase_information
from scipy.sparse import csc_matrix

GROUPS = ["alpha", "beta", "gamma"]
MANIFEST = {
    "columns": {
        "signal": {"expected": "strong"},
        "weak_signal": {"expected": "moderate"},
        "length": {"expected": "length"},
    },
    "controls": {
        "shuffled": ["signal"],
        "shuffles_per_column": 14,
        "noise_categories": [3, 5, 8],
        "noise_numeric": 4,
    },
    "hierarchy": {"coarse": "signal", "fine": "signal"},
}


def planted_rows(count=900, seed=0, own_share=0.25):
    rng = np.random.default_rng(seed)
    shared = [f"gemeen{i}" for i in range(400)]
    rows = []
    for _ in range(count):
        group = int(rng.integers(3))
        size = int(rng.integers(8, 80))
        words = []
        for _ in range(size):
            own = rng.random() < own_share
            words.append(
                f"{GROUPS[group]}woord{rng.integers(20)}" if own else shared[rng.integers(400)]
            )
        faint = rng.random() < 0.5
        rows.append(
            {
                "text": " ".join(words),
                "signal": GROUPS[group],
                "weak_signal": GROUPS[group] if faint else GROUPS[int(rng.integers(3))],
                "length": size,
                "ruling_words": size,
            }
        )
    return rows


def make_subject(own_share=0.25):
    modules = (load_module("terms"), load_module("analysis"), load_clustering())
    manifest = {**MANIFEST, "length_column": "ruling_words"}
    return shared_subject(modules, planted_rows(own_share=own_share), manifest, "text", 3)


def graded(subject):
    return grade_screen(screen_columns(subject), MANIFEST, "text")


class HarnessControls(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.subject = make_subject()

    def test_screen_finds_planted_columns_and_ignores_noise_and_length(self):
        grade = graded(self.subject)
        self.assertTrue(grade["alpha_resolvable"])
        self.assertTrue(grade["strong_above_all_nulls"])
        self.assertGreater(grade["auc_strong_moderate_vs_null"], 0.95)
        self.assertEqual(grade["length_columns_detected"], [])
        self.assertEqual(grade["length_determined_columns"], ["length"])
        self.assertLess(grade["null_max"], 0.05)

    def test_faint_signal_is_still_found(self):
        grade = graded(make_subject(own_share=0.04))
        self.assertLessEqual(grade["table"]["signal"]["p"], 0.05)
        self.assertGreater(grade["table"]["signal"]["skill_beyond_length"], grade["null_max"])

    def test_phrase_information_scores_perfect_split_one_and_independence_zero(self):
        labels = np.array(["a"] * 50 + ["b"] * 50)
        phrases = np.column_stack([labels == "a", np.tile([1, 0], 50)]).astype(float)
        information = phrase_information(csc_matrix(phrases), labels)
        self.assertAlmostEqual(information[0], 1.0, places=6)
        self.assertAlmostEqual(information[1], 0.0, places=6)

    def test_descriptions_recover_planted_groups_but_not_random_ones(self):
        output = evaluate_descriptions(self.subject)["groups"]["contrast"]
        planted = [v["auc"] for k, v in output.items() if k.startswith("fine")]
        random = [v["auc"] for k, v in output.items() if k.startswith("null")]
        self.assertGreater(min(planted), 0.85)
        self.assertLess(max(random), 0.6)


if __name__ == "__main__":
    unittest.main()

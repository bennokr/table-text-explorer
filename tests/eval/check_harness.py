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
from eval_common import Subject, build_index, load_clustering, load_module
from eval_descriptions import evaluate_descriptions

GROUPS = ["alpha", "beta", "gamma"]
MANIFEST = {
    "columns": {
        "signal": {"expected": "strong"},
        "weak_signal": {"expected": "moderate"},
        "length": {"expected": "length"},
    },
    "controls": {
        "shuffled": ["signal"],
        "shuffles_per_column": 3,
        "noise_categories": [3, 5],
        "noise_numeric": 2,
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
    terms = load_module("terms")
    rows = planted_rows(own_share=own_share)
    field = build_index(terms, rows, "text")
    return Subject(
        terms, load_module("analysis"), load_clustering(), rows, MANIFEST, "text", field, 3
    )


class HarnessControls(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.subject = make_subject()

    def test_screen_finds_planted_columns_and_ignores_noise(self):
        grade = grade_screen(screen_columns(self.subject, stratified=True), MANIFEST)
        self.assertTrue(grade["strong_above_all_nulls"])
        self.assertGreater(grade["auc_strong_moderate_vs_null"], 0.95)
        self.assertLessEqual(grade["null_false_positive_rate_z3"], 0.1)
        self.assertTrue(grade["length_below_all_strong"])

    def test_faint_signal_is_still_found_and_length_is_not(self):
        subject = make_subject(own_share=0.04)
        controlled = grade_screen(screen_columns(subject, stratified=True), MANIFEST)
        self.assertGreater(controlled["z"]["signal"], 3)
        self.assertLess(controlled["z"]["length"], 3)

    def test_descriptions_recover_planted_groups_but_not_random_ones(self):
        output = evaluate_descriptions(self.subject)["groups"]["contrast"]
        planted = [v["auc"] for k, v in output.items() if k.startswith("fine")]
        random = [v["auc"] for k, v in output.items() if k.startswith("null")]
        self.assertGreater(min(planted), 0.85)
        self.assertLess(max(random), 0.6)


if __name__ == "__main__":
    unittest.main()

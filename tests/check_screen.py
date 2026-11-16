# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["numpy==1.26.4", "scikit-learn==1.7.0"]
# ///
"""The closed-form column screen on synthetic text with planted structure and missing values."""

import json
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parents[1] / "src/workers"))

import column_screen as screen
import terms

ROWS = 900
GROUPS = ["alfa", "beta", "gamma"]


def planted():
    """Texts mix shared words with group-specific ones; lengths vary independently of the group."""
    rng = np.random.default_rng(0)
    shared = [f"gemeen{i}" for i in range(300)]
    group = rng.integers(3, size=ROWS)
    sizes = rng.integers(10, 70, size=ROWS)
    texts = [
        " ".join(
            f"{GROUPS[g]}woord{rng.integers(15)}"
            if rng.random() < 0.2
            else shared[rng.integers(300)]
            for _ in range(size)
        )
        for g, size in zip(group, sizes, strict=True)
    ]
    return rng, group, sizes, texts


def build_index(texts):
    payload = {
        "rows": len(texts),
        "indexId": "screen",
        "sizes": [1, 1],
        "stopwords": [],
        "columns": [{"name": "text", "texts": texts}],
    }
    terms.build_term_index(json.dumps(payload))


def categorical(name, codes):
    return {"name": name, "kind": "categorical", "codes": [int(c) for c in codes]}


def numeric(name, values):
    return {
        "name": name,
        "kind": "numeric",
        "values": [None if v is None else float(v) for v in values],
    }


def run(columns, population=None):
    payload = {
        "indexId": "screen",
        "population": list(range(ROWS)) if population is None else population,
        "columns": columns,
    }
    result = json.loads(screen.run_column_screen(json.dumps(payload)))
    return result, {column["name"]: column for column in result["columns"]}


class ColumnScreen(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        rng, group, sizes, texts = planted()
        build_index(texts)
        cls.rng, cls.group, cls.sizes = rng, group, sizes
        mcar = np.where(rng.random(ROWS) < 0.4, -1, group)
        mnar = np.where(group == 0, -1, group)  # Missing exactly where the text is of one kind.
        sparse = np.where(rng.random(ROWS) < 0.9, -1, group)
        cls.result, cls.by_name = run(
            [
                categorical("signal", group),
                categorical("noise", rng.integers(4, size=ROWS)),
                numeric("length", sizes),
                numeric("signal_number", group + rng.normal(scale=0.5, size=ROWS)),
                categorical("mcar", mcar),
                categorical("mnar", mnar),
                categorical("sparse", sparse),
                categorical("tiny_groups", rng.integers(300, size=ROWS)),
            ]
        )

    def test_planted_columns_are_significant_and_noise_and_length_are_not(self):
        by = self.by_name
        for name in ("signal", "signal_number"):
            self.assertTrue(by[name]["significant"], name)
        self.assertGreater(by["signal"]["effect"], 0.05)
        self.assertFalse(by["noise"]["significant"])
        self.assertFalse(by["length"]["significant"], "length is regressed out before scoring")

    def test_missing_values_are_scored_on_the_records_that_have_them(self):
        mcar = self.by_name["mcar"]
        self.assertAlmostEqual(mcar["coverage"], 0.6, delta=0.05)
        self.assertTrue(mcar["significant"])
        self.assertFalse(mcar["missing"]["differs"], "missing completely at random")
        self.assertGreater(self.by_name["mcar"]["effect"], 0.5 * self.by_name["signal"]["effect"])

    def test_missingness_that_depends_on_the_text_is_flagged(self):
        self.assertTrue(self.by_name["mnar"]["missing"]["differs"])
        self.assertFalse(self.by_name["signal"]["missing"] is not None)

    def test_columns_with_too_few_values_or_groups_are_not_offered(self):
        self.assertFalse(self.by_name["sparse"]["eligible"])
        self.assertLess(self.by_name["sparse"]["coverage"], 0.5)
        self.assertFalse(
            self.by_name["tiny_groups"]["eligible"], "almost every group is smaller than 10"
        )
        self.assertNotIn("p", self.by_name["tiny_groups"])

    def test_screening_inside_a_subset_uses_only_its_records(self):
        subset = [i for i in range(ROWS) if self.group[i] != 2]
        # Column values are aligned to the population, as the app sends them.
        result, by = run([categorical("signal", self.group[subset])], subset)
        self.assertEqual(result["population"], len(subset))
        self.assertEqual(by["signal"]["observed"], len(subset))
        self.assertEqual(by["signal"]["groups"], 2)
        self.assertTrue(by["signal"]["significant"])

    def test_a_tiny_population_is_not_screened(self):
        result, _ = run([categorical("signal", self.group[:59])], list(range(59)))
        self.assertEqual(result["columns"], [])

    def test_length_is_the_word_count_not_the_phrase_count(self):
        _, lengths, _ = screen.prepared("screen")
        self.assertEqual(lengths.tolist(), self.sizes.tolist())

    def test_numbers_are_binned_into_quartiles_with_ties_kept_together(self):
        codes = screen.quartile_codes([None, 1, 1, 1, 2, 3, 4, 5, 6, 7, 8])
        self.assertEqual(codes[0], -1, "a missing number stays missing")
        self.assertEqual(len(set(codes[codes >= 0])), 4)
        self.assertEqual(len(set(codes[1:4])), 1, "equal values share a bin")
        self.assertEqual(len(set(screen.quartile_codes([5.0] * 20))), 1, "a constant has no split")

    def test_holm_is_monotone_and_capped(self):
        adjusted = screen.holm([0.001, 0.2, 0.01, 0.9])
        self.assertAlmostEqual(adjusted[0], 0.004)
        self.assertAlmostEqual(adjusted[2], 0.03)
        self.assertTrue(all(0 <= value <= 1 for value in adjusted))


if __name__ == "__main__":
    unittest.main()

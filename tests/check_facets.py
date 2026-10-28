# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["numpy==1.26.4", "scikit-learn==1.7.0"]
# ///
"""Description evidence, sparse caches and group populations, without a browser."""

import json
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parents[1] / "src/workers"))

import facets
import terms
from descriptions import describe_descriptions


def request(**overrides):
    return {
        "content": "facets",
        "subset": [0, 1],
        "comparison": [2, 3],
        "ranking": "contrast",
        "support": 1,
        "facets": {
            "key": "test",
            "rows": 4,
            "fields": [
                {
                    "name": "group",
                    "label": "Group",
                    "predicates": [
                        {
                            "label": "A",
                            "predicate": {
                                "kind": "term",
                                "field": "group",
                                "op": "=",
                                "value": "A",
                            },
                            "ids": [0, 1],
                        },
                        {
                            "label": "B",
                            "predicate": {
                                "kind": "term",
                                "field": "group",
                                "op": "=",
                                "value": "B",
                            },
                            "ids": [2],
                        },
                        {
                            "label": "Missing",
                            "predicate": {
                                "kind": "term",
                                "field": "group",
                                "op": "=",
                                "value": "null",
                            },
                            "ids": [3],
                        },
                    ],
                }
            ],
        },
        **overrides,
    }


def describe(data, vectors=None):
    return json.loads(describe_descriptions(json.dumps(data), terms.describe_terms, vectors))


class FacetTests(unittest.TestCase):
    def setUp(self):
        facets.facet_index = None

    def test_contrast_evidence_and_independent_cached_index(self):
        result = describe(request())
        item = result["facets"][0]["terms"][0]
        self.assertEqual(item["ids"], [0, 1])
        self.assertEqual((item["support"], item["rest"]), (2, 0))
        self.assertEqual((item["contrast"], item["precision"], item["recall"]), (1, 1, 1))
        cached = facets.facet_index
        changed = describe(
            request(subset=[2, 3], comparison=[0, 1], facets={"key": "test", "rows": 4})
        )
        self.assertIs(facets.facet_index, cached)
        self.assertEqual(
            [item["label"] for item in changed["facets"][0]["terms"]], ["B", "Missing"]
        )
        with self.assertRaisesRegex(ValueError, "prepared again"):
            describe(request(facets={"key": "changed", "rows": 4}))

    def test_balanced_and_semantic_population_includes_missing_records(self):
        result = describe(request(subset=[0, 1, 2, 3], comparison=[], ranking="balanced"))
        item = result["facets"][0]["terms"][0]
        self.assertEqual(item["label"], "A")
        self.assertEqual(
            (item["population"], item["partitionSupport"], item["balanced"]), (4, 2, 1)
        )
        vectors = np.array([[1, 0], [1, 0], [0, 1], [0, 1]])
        result = describe(
            request(
                subset=[0, 1, 2, 3],
                comparison=[],
                ranking="semantic",
                embeddingDimensions=2,
                embeddingRowIds=[0, 1, 2, 3],
            ),
            vectors,
        )
        self.assertAlmostEqual(result["facets"][0]["terms"][0]["semantic"], 1)
        self.assertEqual(
            len(describe(request(ranking="balanced", support=3))["facets"][0]["terms"]), 0
        )

    def test_phrase_and_facet_evidence_share_the_same_populations_for_multiple_groups(self):
        terms.build_term_index(
            json.dumps(
                {
                    "indexId": "phrases",
                    "rows": 4,
                    "sizes": [1, 1],
                    "stopwords": [],
                    "columns": [
                        {"name": "text", "texts": ["camera", "camera", "battery", "battery"]}
                    ],
                }
            )
        )
        result = describe(
            request(
                content="both",
                indexId="phrases",
                groups=[
                    {"id": "a", "name": "First", "subset": [0, 1], "comparison": [2, 3]},
                    {"id": "b", "name": "Second", "subset": [2, 3], "comparison": [0, 1]},
                ],
            )
        )
        first = result["groups"][0]["description"]
        phrase, facet = first["fields"][0]["terms"][0], first["facets"][0]["terms"][0]
        self.assertEqual(phrase["ids"], facet["ids"])
        self.assertEqual(phrase["precision"], facet["precision"])
        self.assertEqual(phrase["predicate"]["op"], "~")
        self.assertEqual(facet["predicate"]["op"], "=")
        self.assertEqual(result["groups"][1]["description"]["facets"][0]["terms"][0]["label"], "B")

    def test_invalid_or_overlapping_populations_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "disjoint"):
            describe(request(comparison=[1, 2]))
        with self.assertRaisesRegex(ValueError, "Invalid record"):
            describe(request(subset=[4]))


if __name__ == "__main__":
    unittest.main()

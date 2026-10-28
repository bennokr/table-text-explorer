# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["numpy==1.26.4", "scikit-learn==1.7.0"]
# ///
"""Independent numeric and boundary checks for the same module used in Pyodide."""

import importlib.util
import json
import math
import runpy
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parents[1] / "src/workers"))

spec = importlib.util.spec_from_file_location(
    "subset_terms", Path(__file__).parents[1] / "src/workers/terms.py"
)
terms = importlib.util.module_from_spec(spec)
spec.loader.exec_module(terms)


def build(rows, fields=("text",), sizes=(1, 1), stopwords=()):
    return json.loads(
        terms.build_term_index(
            json.dumps(
                {
                    "rows": len(rows),
                    "indexId": "test",
                    "sizes": sizes,
                    "stopwords": stopwords,
                    "columns": [
                        {"name": field, "texts": [row.get(field) for row in rows]}
                        for field in fields
                    ],
                }
            )
        )
    )


def request(subset, comparison, **options):
    return json.dumps(
        {
            "indexId": "test",
            "subset": subset,
            "comparison": comparison,
            "ranking": "contrast",
            "support": 1,
            **options,
        }
    )


class TermTests(unittest.TestCase):
    def setUp(self):
        build(
            [
                {"text": text}
                for text in [
                    "red red common",
                    "red red common",
                    "blue blue blue common",
                    "blue blue blue common",
                ]
            ]
        )

    def test_hand_calculated_class_weights(self):
        weights = terms.class_weights([[4, 0, 2], [0, 6, 2]])
        self.assertAlmostEqual(weights[0, 0], 4 / 6 * math.log1p(7 / 4))
        self.assertAlmostEqual(weights[0, 2], 2 / 6 * math.log1p(7 / 4))
        self.assertAlmostEqual(weights[1, 1], 6 / 8 * math.log1p(7 / 6))

    def test_contrast_support_lift_and_index_reuse(self):
        matrix = terms.term_indexes["text"]["matrix"]
        result = json.loads(terms.describe_terms(request([0, 1], [2, 3], support=2)))
        red = result["fields"][0]["terms"][0]
        self.assertEqual(red["phrase"], "red")
        self.assertEqual(red["support"], 2)
        self.assertEqual(red["rest"], 0)
        self.assertAlmostEqual(red["ctfidf"], 4 / 6 * math.log1p(7 / 4))
        self.assertAlmostEqual(red["lift"], math.log2(5))
        terms.describe_terms(request([2, 3], [0, 1]))
        self.assertIs(terms.term_indexes["text"]["matrix"], matrix)
        result = json.loads(terms.describe_terms(request([0], [1, 2, 3], support=2)))
        self.assertEqual(result["fields"][0]["terms"], [])

    def test_boundaries_and_internal_stopwords(self):
        grams = set(terms.analyze_terms("goede en slechte. batterij\nscherm", {"en"}, (1, 3)))
        self.assertIn("goede en slechte", grams)
        for absent in ("en", "goede slechte", "slechte batterij", "batterij scherm"):
            self.assertNotIn(absent, grams)
        build([{"text": "alpha"}, {"text": "beta"}], sizes=(2, 2))
        self.assertIsNone(terms.term_indexes["text"])

    def test_fields_stay_separate_and_matches_are_exact(self):
        build(
            [
                {"positive": "battery good", "negative": "screen bad"},
                {"positive": "screen good", "negative": "battery bad"},
            ],
            fields=("positive", "negative"),
            sizes=(1, 2),
        )
        result = json.loads(terms.describe_terms(request([0], [1])))
        self.assertIn("battery good", [term["phrase"] for term in result["fields"][0]["terms"]])
        self.assertIn("screen bad", [term["phrase"] for term in result["fields"][1]["terms"]])
        payload = request([0], [1], field="positive", phrase="battery")
        self.assertEqual(json.loads(terms.matching_terms(payload))["ids"], [0])
        payload = request([0], [1], field="positive", phrase="batter")
        self.assertEqual(json.loads(terms.matching_terms(payload))["ids"], [])

    def test_empty_and_invalid_subsets(self):
        for subset, comparison in (([], [0, 1, 2, 3]), ([0, 1, 2, 3], [])):
            result = json.loads(terms.describe_terms(request(subset, comparison)))
            self.assertEqual(result["subset"], len(subset))
        for subset, comparison in (([-1], [1]), ([0], [0])):
            with self.assertRaises(ValueError):
                terms.describe_terms(request(subset, comparison))
        with self.assertRaises(ValueError):
            terms.describe_terms(request([0], [1], indexId="stale"))
        build([{"text": None}, {"text": "\\N"}])
        result = json.loads(terms.describe_terms(request([0], [1])))
        self.assertEqual(result["fields"][0]["vocabulary"], 0)

    def test_redundant_nested_phrases_keep_two_informative_spans(self):
        phrase = {"text": "kleur komt overeen met afbeelding"}
        build(
            [phrase] * 18
            + [{"text": "andere klacht"}, phrase]
            + [{"text": "andere producten"}] * 980,
            sizes=(1, 3),
            stopwords=("met",),
        )
        subset, rest = list(range(19)), list(range(19, 1000))
        result = json.loads(terms.describe_terms(request(subset, rest, support=2)))
        phrases = [term["phrase"] for term in result["fields"][0]["terms"]]
        self.assertEqual(set(phrases), {"kleur komt overeen", "overeen met afbeelding"})
        raw = json.loads(terms.describe_terms(request(subset, rest, support=2, deduplicate=False)))
        raw_terms = {term["phrase"]: term for term in raw["fields"][0]["terms"]}
        for term in result["fields"][0]["terms"]:
            self.assertEqual(term, raw_terms[term["phrase"]])
        self.assertIn("afbeelding", raw_terms)

    def test_redundancy_requires_nested_words_and_actual_record_overlap(self):
        members = {"goed": {0, 1}, "heel goed": {2, 3}, "prima": {0, 1}}
        values = dict.fromkeys(members, 1.0)
        self.assertFalse(terms.redundant_phrase("goed", "heel goed", members, values))
        self.assertFalse(terms.redundant_phrase("goed", "prima", members, values))
        members["heel goed"] = {0, 1}
        self.assertTrue(terms.redundant_phrase("goed", "heel goed", members, values))
        members["goed"] = set(range(20))
        members["heel goed"] = set(range(18))
        self.assertTrue(terms.redundant_phrase("goed", "heel goed", members, values))
        members["heel goed"] = set(range(17))
        self.assertFalse(terms.redundant_phrase("goed", "heel goed", members, values))
        members["heel goed"] = set(range(20))
        values["heel goed"] = 0.5
        self.assertFalse(terms.redundant_phrase("goed", "heel goed", members, values))

    def test_twenty_thousand_sparse_records(self):
        build(
            [{"text": "camera scherp" if i % 2 else "batterij leeg"} for i in range(20000)],
            sizes=(1, 3),
        )
        subset = list(range(0, 20000, 2))
        result = json.loads(
            terms.describe_terms(request(subset, list(range(1, 20000, 2)), support=100))
        )
        self.assertEqual(result["fields"][0]["terms"][0]["support"], 10000)
        self.assertTrue(np.isfinite(result["fields"][0]["terms"][0]["contrast"]))

    def test_population_frequency_and_balanced_splits_exclude_empty_field_values(self):
        build(
            [
                {"text": text}
                for text in [
                    "red red common",
                    "red common",
                    "blue common",
                    "blue common",
                    None,
                    "\\N",
                ]
            ]
        )
        payload = request(list(range(6)), [], ranking="frequency", deduplicate=False)
        field = json.loads(terms.describe_terms(payload))["fields"][0]
        rows = {term["phrase"]: term for term in field["terms"]}
        self.assertEqual(field["textRecords"], 4)
        self.assertEqual(rows["common"]["frequency"], 1)
        self.assertEqual(rows["red"]["frequency"], 0.5)
        self.assertEqual(rows["red"]["support"], 2)
        balanced = json.loads(terms.describe_terms(request(list(range(6)), [], ranking="balanced")))
        self.assertEqual(
            {term["phrase"] for term in balanced["fields"][0]["terms"]}, {"red", "blue"}
        )
        self.assertEqual(balanced["fields"][0]["terms"][0]["balanced"], 1)

    def test_semantic_gain_and_embedding_row_alignment(self):
        build(
            [{"text": text} for text in ["red random", "red", "blue random", "blue", "red", None]]
        )
        terms.embedding_values = [[-1, 0], [1, 0], [-1, 0], [1, 0]]
        try:
            payload = request(
                list(range(6)),
                [],
                ranking="semantic",
                deduplicate=False,
                embeddingDimensions=2,
                embeddingRowIds=[2, 0, 3, 1],
            )
            field = json.loads(terms.describe_terms(payload))["fields"][0]
            self.assertEqual(field["textRecords"], 5)
            self.assertEqual(field["population"], 4)
            self.assertEqual({term["phrase"] for term in field["terms"]}, {"red", "blue"})
            self.assertAlmostEqual(field["terms"][0]["semantic"], 1)
            self.assertEqual(field["terms"][0]["partitionSupport"], 2)
        finally:
            terms.embedding_values = None
        with self.assertRaisesRegex(ValueError, "existing embedding"):
            terms.describe_terms(payload)


class ExactPhraseQueries(unittest.TestCase):
    def test_query_matches_counting_boundaries_casefold_and_normalization(self):
        matcher = runpy.run_path(
            Path(__file__).parents[1] / "src/workers/phrase_queries.py", init_globals=vars(terms)
        )["match_phrases"]
        texts = [
            "Straße echt",
            "STRASSE ECHT",
            "strasse, echt",
            "strasse\techt",
            "strassenecht",
            None,
            "\\N",
            "Cafe\u0301 noir",
        ]
        terms.build_term_index(
            json.dumps(
                {
                    "indexId": "test",
                    "revision": "query-test",
                    "rows": len(texts),
                    "sizes": [1, 3],
                    "stopwords": [],
                    "columns": [{"name": "text", "texts": texts}],
                }
            )
        )
        payload = {
            "revision": "query-test",
            "columns": [{"name": "text", "texts": texts}],
            "requests": [
                {"field": "text", "phrase": "strasse echt"},
                {"field": "text", "phrase": "café noir"},
            ],
        }
        result = json.loads(matcher(json.dumps(payload)))
        self.assertEqual(json.loads(matcher(json.dumps({**payload, "columns": []}))), result)
        self.assertEqual(result["matches"][0]["ids"], [0, 1, 3])
        self.assertEqual(result["matches"][1]["ids"], [7])
        indexed = json.loads(
            terms.matching_terms(request(list(range(8)), [], field="text", phrase="strasse echt"))
        )
        self.assertEqual(indexed["ids"], result["matches"][0]["ids"])
        build([{"text": text} for text in texts], sizes=(1, 1), stopwords=("echt",))
        self.assertEqual(json.loads(matcher(json.dumps(payload))), result)


class SharedIndexes(unittest.TestCase):
    def test_new_dataset_releases_prior_count_variants(self):
        from text_indexes import get_text_index, register_text_index

        data = {
            "revision": "old-data",
            "rows": 2,
            "sizes": [1, 3],
            "stopwords": [],
            "columns": [{"name": "text"}],
            "indexId": "old",
        }
        register_text_index(data, lambda *_: None)
        register_text_index(
            {**data, "revision": "new-data", "indexId": "new", "protectedIndexId": "old"},
            lambda *_: None,
        )
        with self.assertRaises(ValueError):
            get_text_index("old")
        self.assertEqual(get_text_index("new")["rows"], 2)

    def test_tfidf_uses_shared_field_counts_without_crossing_field_boundaries(self):
        from text_indexes import get_text_index

        build(
            [
                {"left": "Camera sharp.", "right": "battery lasts"},
                {"left": "camera vivid", "right": "battery flat"},
            ],
            fields=("left", "right"),
            sizes=(2, 2),
        )
        original = get_text_index("test")["fields"]
        analysis = runpy.run_path(Path(__file__).parents[1] / "src/workers/analysis.py")
        matrix = analysis["text_features"]({"indexId": "test"})
        self.assertEqual(matrix.shape, (2, 4))
        self.assertIs(get_text_index("test")["fields"], original)
        tokens = json.loads(terms.index_tokens(json.dumps({"indexId": "test"})))
        self.assertEqual(tokens["left"][0], ["camera", "sharp"])
        build([{"text": "short"}], sizes=(3, 3))
        self.assertEqual(
            json.loads(terms.index_tokens(json.dumps({"indexId": "test"}))), {"text": [["short"]]}
        )

    def test_compatible_fields_reuse_matrices_and_preserve_active_variants(self):
        from text_indexes import get_text_index, register_text_index

        calls = []

        def build(column, _):
            calls.append(column["name"])
            return object()

        data = {
            "revision": "shared-test",
            "rows": 2,
            "sizes": [1, 3],
            "stopwords": [],
            "columns": [{"name": "text"}],
            "indexId": "inspector",
        }
        original = register_text_index(data, build)
        expanded = register_text_index(
            {**data, "indexId": "naming", "columns": [{"name": "text"}, {"name": "extra"}]}, build
        )
        self.assertIs(original["fields"]["text"], expanded["fields"]["text"])
        self.assertEqual(calls, ["text", "extra"])
        for index in range(5):
            register_text_index(
                {
                    **data,
                    "indexId": f"variant-{index}",
                    "sizes": [index + 1, index + 1],
                    "protectedIndexId": "inspector",
                },
                build,
            )
        self.assertIs(get_text_index("inspector"), original)
        with self.assertRaises(ValueError):
            get_text_index("naming")


if __name__ == "__main__":
    unittest.main()

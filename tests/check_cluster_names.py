# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["numpy==1.26.4", "scikit-learn==1.7.0"]
# ///
"""Native checks for the exact phrase evidence/assignment code used in the worker."""

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).parents[1] / "src/workers"
sys.path.insert(0, str(ROOT))
import cluster_names  # noqa: E402
import terms as terms_module  # noqa: E402

terms = vars(terms_module)
names = vars(cluster_names)


def request(texts, groups, **options):
    data = {
        "cacheKey": json.dumps(texts),
        "rows": len(texts),
        "columns": [{"name": "text", "texts": texts}],
        "sizes": [1, 3],
        "stopwords": [],
        "groups": groups,
        **options,
    }
    data["indexId"] = data["cacheKey"]
    terms["build_term_index"](json.dumps(data))
    return json.dumps(
        {
            "indexId": data["indexId"],
            "groups": groups,
            **({"maxPhrases": options["maxPhrases"]} if "maxPhrases" in options else {}),
        }
    )


def group(identity, subset, comparison, **options):
    return {
        "id": str(identity),
        "name": f"#{identity + 1}",
        "subset": subset,
        "comparison": comparison,
        **options,
    }


class ClusterNames(unittest.TestCase):
    def test_distinct_short_names_and_reusable_evidence(self):
        payload = request(
            [
                "camera sharp photos",
                "camera sharp photos",
                "battery lasts long",
                "battery lasts long",
            ],
            [group(0, [0, 1], [2, 3]), group(1, [2, 3], [0, 1])],
        )
        labels = json.loads(names["name_clusters"](payload))["labels"]
        self.assertFalse(set(labels["0"]["words"]) & set(labels["1"]["words"]))
        self.assertEqual(set(labels["0"]["phrases"][0]["matches"]), {0, 1})
        self.assertEqual(labels["0"]["kind"], "phrases")
        self.assertTrue(
            all(
                len(phrase["phrase"].split()) <= 3
                for item in labels.values()
                for phrase in item["phrases"]
            )
        )
        self.assertTrue(
            all(phrase["support"] == 2 for item in labels.values() for phrase in item["phrases"])
        )

    def test_twenty_thousand_records_keep_disjoint_names_and_exact_support(self):
        texts = [f"brand{index % 8} customer review good service" for index in range(20000)]
        groups = [
            group(
                index,
                list(range(index, 20000, 8)),
                [row for row in range(20000) if row % 8 != index],
            )
            for index in range(8)
        ]
        labels = json.loads(names["name_clusters"](request(texts, groups)))["labels"]
        used = set()
        for item in labels.values():
            self.assertEqual(item["phrases"][0]["support"], 2500)
            self.assertEqual(item["phrases"][0]["comparisonSupport"], 0)
            self.assertEqual(len(item["phrases"][0]["matches"]), 2500)
            self.assertFalse(used & set(item["words"]))
            used.update(item["words"])

    def test_requested_lengths_include_four_and_five_word_phrases(self):
        texts = ["camera makes very sharp photos"] * 2 + ["battery lasts all day long"] * 2
        groups = [group(0, [0, 1], [2, 3]), group(1, [2, 3], [0, 1])]
        for sizes in [[2, 4], [4, 4], [3, 5], [5, 5]]:
            payload = request(texts, groups, sizes=sizes)
            labels = json.loads(names["name_clusters"](payload))["labels"]
            used = set()
            for item in labels.values():
                self.assertEqual(item["kind"], "phrases")
                self.assertTrue(
                    all(
                        sizes[0] <= len(phrase["phrase"].split()) <= sizes[1]
                        for phrase in item["phrases"]
                    )
                )
                self.assertFalse(used & set(item["words"]))
                used.update(item["words"])

    def test_names_bundle_distinct_configured_ngrams_with_no_sibling_overlap(self):
        texts = ["camera sharp photos vivid colors crisp"] * 2 + [
            "battery lasts charging quick power steady"
        ] * 2
        payload = request(
            texts,
            [group(0, [0, 1], [2, 3]), group(1, [2, 3], [0, 1])],
            sizes=[2, 2],
            maxPhrases=3,
        )
        labels = json.loads(names["name_clusters"](payload))["labels"]
        used = set()
        for item in labels.values():
            self.assertTrue(2 <= len(item["phrases"]) <= 3)
            self.assertTrue(all(len(phrase["phrase"].split()) == 2 for phrase in item["phrases"]))
            self.assertFalse(used & set(item["words"]))
            used.update(item["words"])

    def test_maximum_allows_one_useful_phrase_without_forcing_a_fallback(self):
        labels = json.loads(
            names["name_clusters"](
                request(
                    ["camera", "camera", "battery", "battery"],
                    [group(0, [0, 1], [2, 3]), group(1, [2, 3], [0, 1])],
                    maxPhrases=5,
                )
            )
        )["labels"]
        self.assertEqual(labels["0"]["phrase"], "camera")
        self.assertEqual(len(labels["0"]["phrases"]), 1)

    def test_joint_search_avoids_greedy_word_conflicts(self):
        fields = {}
        choose = names["choose_names"]
        original = choose.__globals__["name_candidates"]
        choose.__globals__["name_candidates"] = lambda item, *_: [
            {"phrase": phrase, "words": sorted(names["name_words"](phrase)), "score": score}
            for phrase, score in {
                "0": [("shared", 1), ("camera", 0.8)],
                "1": [("shared", 0.9), ("battery", 0.1)],
            }[item["id"]]
        ]
        try:
            labels = choose([group(0, [], []), group(1, [], [])], fields)
        finally:
            choose.__globals__["name_candidates"] = original
        self.assertEqual([labels[key]["phrase"] for key in ["0", "1"]], ["camera", "shared"])

    def test_normalization_locked_names_and_sibling_blocks(self):
        self.assertEqual(names["name_words"]("CAMERA, café!"), {"camera", "café"})
        payload = request(
            ["camera sharp", "camera sharp", "battery camera", "battery camera"],
            [
                group(0, [0, 1], [2, 3], name="CAMERA", locked=True),
                group(1, [2, 3], [0, 1], blocked=["battery"]),
            ],
        )
        labels = json.loads(names["name_clusters"](payload))["labels"]
        self.assertNotIn("0", labels)
        self.assertTrue(labels["1"]["phrase"].startswith("#"))

    def test_names_avoid_function_words_and_negations_at_their_edges(self):
        texts = ["niet echt goed over", "niet echt goed over", "mooi boek van", "mooi boek van"]
        groups = [group(0, [0, 1], [2, 3]), group(1, [2, 3], [0, 1])]
        lexicon = {"stopwords": ["over", "van"], "leadwords": ["echt"], "negations": ["niet"]}
        payload = request(texts, groups, maxPhrases=1, **lexicon)
        labels = json.loads(names["name_clusters"](payload))["labels"]
        blocked = {"over", "van", "echt", "niet"}
        for item in labels.values():
            for phrase in item["phrases"]:
                tokens = phrase["phrase"].split()
                self.assertNotIn(tokens[0], blocked)
                self.assertNotIn(tokens[-1], blocked)
        self.assertFalse(labels["0"]["phrase"].startswith("niet"))

    def test_a_name_does_not_repeat_a_word_in_another_form(self):
        fold = {"collapse": False, "undouble": False, "dropE": False, "rules": [["en", "", 3]]}
        texts = ["boek lezen"] * 3 + ["boeken lezen"] * 3 + ["film kijken"] * 3
        groups = [group(0, [0, 1, 2], [3, 4, 5, 6, 7, 8]), group(1, [3, 4, 5], [0, 1, 2, 6, 7, 8])]
        for folding, repeated in ((None, True), (fold, False)):
            payload = request(texts, groups, maxPhrases=1, fold=folding)
            labels = json.loads(names["name_clusters"](payload))["labels"]
            words = [name_word for item in labels.values() for name_word in item["words"]]
            self.assertEqual("boek" in words and "boeken" in words, repeated)

    def test_a_group_whose_best_word_is_common_still_gets_a_name_not_a_number(self):
        texts = ["camera sharp"] * 2 + ["camera"] * 2 + ["battery"] * 2
        groups = [group(0, [0, 1], [2, 3, 4, 5]), group(1, [2, 3], [0, 1, 4, 5])]
        labels = json.loads(names["name_clusters"](request(texts, groups, maxPhrases=1)))["labels"]
        self.assertEqual(labels["0"]["phrase"], "sharp")
        self.assertEqual(labels["1"]["phrase"], "camera", "common, but better than #2")
        self.assertTrue(labels["1"].get("loose"))

    def test_identical_empty_numeric_and_other_text_have_honest_fallbacks(self):
        for texts in [["same", "same"], ["", ""], ["123", "456"], ["Other", "Other"]]:
            labels = json.loads(
                names["name_clusters"](request(texts, [group(0, [0], [1]), group(1, [1], [0])]))
            )["labels"]
            self.assertEqual([labels[key]["phrase"] for key in ["0", "1"]], ["#1", "#2"])
        fallback = names["fallback_name"](group(0, [], []), {"1"})
        self.assertFalse(set(fallback["words"]) & {"1"})


if __name__ == "__main__":
    unittest.main()

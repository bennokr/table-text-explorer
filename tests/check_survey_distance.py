# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["numpy==1.26.4", "scipy"]
# ///
"""Native checks for the survey distance: routing is no mismatch, evidence shrinks."""

import json
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parents[1] / "src/workers"))
import survey_distance as survey
import survey_names
import survey_task

RNG = np.random.default_rng(7)


def column(name, values, kind="nominal", group="g", shown=None):
    shown = [True] * len(values) if shown is None else shown
    states = [
        "answered" if s and v is not None else "not_shown"
        for v, s in zip(values, shown, strict=True)
    ]
    return {"name": name, "kind": kind, "group": group, "values": values, "states": states}


def planted(size=60, topics=3, questions=12):
    """Respondents in `topics` groups; each topic favours its own block of questions."""
    topic = np.arange(size) % topics
    columns = []
    for index in range(questions):
        favoured = index % topics
        values = [int(RNG.random() < (0.9 if t == favoured else 0.1)) for t in topic]
        columns.append(column(f"q{index}", values, group=f"g{index % topics}"))
    return topic, columns


class SurveyDistance(unittest.TestCase):
    def test_matrix_is_finite_symmetric_and_zero_on_the_diagonal(self):
        _, columns = planted()
        distance = survey.survey_distance(columns)["distance"]
        self.assertTrue(np.isfinite(distance).all())
        self.assertTrue(np.allclose(distance, distance.T))
        self.assertTrue(np.allclose(np.diag(distance), 0))

    def test_neighbours_come_from_the_same_planted_topic(self):
        topic, columns = planted()
        distance = survey.survey_distance(columns, rare=0)["distance"].astype(float)
        np.fill_diagonal(distance, np.inf)
        nearest = np.argsort(distance, axis=1)[:, :5]
        self.assertGreater(float(np.mean(topic[nearest] == topic[:, None])), 0.8)

    def test_a_question_that_was_not_shown_is_not_a_mismatch(self):
        shared = [column(f"s{i}", [1, 1, 0, 0]) for i in range(8)]
        routed = column("follow", [1, None, 1, None], shown=[True, False, True, False])
        distance = survey.survey_distance([*shared, routed], rare=0)["distance"]
        self.assertLess(distance[0, 1], distance[0, 2])

    def test_respondents_with_nothing_in_common_get_the_typical_distance(self):
        first = column("a", [1, 1, None, None])
        second = column("b", [None, None, 1, 0])
        result = survey.survey_distance([first, second], rare=0)
        self.assertEqual(result["unsupported"], 8)
        self.assertAlmostEqual(float(result["distance"][0, 2]), float(result["distance"][1, 3]))

    def test_little_shared_evidence_pulls_a_pair_toward_the_typical_distance(self):
        gower = np.full((4, 4), 0.5)
        gower[0, 1] = gower[1, 0] = gower[2, 3] = gower[3, 2] = 1.0
        evidence = np.full((4, 4), 100.0)
        evidence[0, 1] = evidence[1, 0] = 1.0
        shrunk = survey.finish(gower, np.ones((4, 4)), evidence, 8.0)["distance"]
        self.assertLess(shrunk[0, 1], shrunk[2, 3])
        self.assertGreater(shrunk[0, 1], 0.5)

    def test_groups_count_equally_whatever_their_size(self):
        big = [column(f"b{i}", [0, 0, 0, 0], group="big") for i in range(20)]
        small = column("s", [0, 1, 0, 1], group="small")
        for balance, expected in ((True, 0.5), (False, 1 / 21)):
            totals = {}
            for item in [*big, small]:
                survey.add_column(item, totals, {"rare": 0, "balance": balance})
            distance, _ = survey.group_means(totals, "categorical", 4)
            self.assertAlmostEqual(float(distance[0, 1]), expected, places=5)

    def test_text_is_compared_only_when_both_have_it(self):
        _, columns = planted(size=12)
        vectors = np.eye(12, 4, dtype=np.float32) + 0.1
        pooled, has, _ = survey.pool_text(vectors[:6], list(range(6)), 12)
        result = survey.survey_distance(columns, (pooled, has))
        self.assertTrue(np.isfinite(result["distance"]).all())

    def test_pooled_text_is_normalised_and_missing_text_stays_empty(self):
        pooled, has, counts = survey.pool_text(np.array([[3.0, 0], [0, 2.0]]), [0, 0], 2)
        self.assertAlmostEqual(float(np.linalg.norm(pooled[0])), 1.0, places=5)
        self.assertEqual((has.tolist(), counts.tolist()), ([True, False], [2, 0]))
        self.assertEqual(float(np.linalg.norm(pooled[1])), 0.0)


class SurveyTask(unittest.TestCase):
    def payload(self, size=40, with_text=False):
        topic, columns = planted(size=size)
        for item in columns:
            item["states"] = ["answered"] * size
        data = {
            "rows": size,
            "columns": columns,
            "textColumns": [],
            "textRows": list(range(0, size, 2)) if with_text else [],
            "options": {"textWeight": 0.35, "common": True, "balance": True},
        }
        return topic, data

    def run_task(self, data, vectors=None):
        survey_task.bridge.embedding_values = vectors
        return json.loads(survey_task.run_survey_prepare(json.dumps(data)))

    def test_the_embedding_has_one_row_per_record_and_keeps_the_planted_structure(self):
        topic, data = self.payload()
        result = self.run_task(data)
        features = np.array(result["features"])
        self.assertEqual(features.shape[0], 40)
        self.assertLessEqual(result["dimensions"], 32)
        self.assertEqual(result["survey"]["records"], 40)
        distances = np.linalg.norm(features[:, None] - features[None], axis=2)
        np.fill_diagonal(distances, np.inf)
        nearest = np.argsort(distances, axis=1)[:, :4]
        self.assertGreater(float(np.mean(topic[nearest] == topic[:, None])), 0.8)

    def test_the_neighbour_graph_lists_each_record_first_and_stays_within_its_topic(self):
        topic, data = self.payload()
        graph = self.run_task(data)["neighbours"]
        indices, distances = np.array(graph["indices"]), np.array(graph["distances"])
        self.assertEqual(indices.shape, (40, 40))
        self.assertTrue((indices[:, 0] == np.arange(40)).all())
        self.assertTrue((distances[:, 0] == 0).all())
        self.assertTrue((np.diff(distances, axis=1) >= 0).all())
        self.assertGreater(float(np.mean(topic[indices[:, 1:5]] == topic[:, None])), 0.8)

    def test_text_vectors_are_placed_on_the_records_that_have_them(self):
        _, data = self.payload(with_text=True)
        vectors = list(np.random.default_rng(1).normal(size=(20, 4)).ravel())
        result = self.run_task(data, vectors)
        self.assertEqual(len(result["features"]), 40)

    def test_large_and_tiny_tables_are_refused_with_a_message(self):
        _, data = self.payload()
        with self.assertRaisesRegex(ValueError, "up to"):
            self.run_task({**data, "rows": survey_task.MAX_RECORDS + 1})
        with self.assertRaisesRegex(ValueError, "at least four"):
            self.run_task({**data, "rows": 3})


class SurveyNames(unittest.TestCase):
    def request(self, locked=False):
        first, second = list(range(0, 20)), list(range(20, 40))
        answers = [
            {"question": "Mood", "text": "Mood: happy", "ids": first[:18] + second[:2]},
            {"question": "Mood", "text": "Mood: sad", "ids": first[18:] + second[2:]},
            {"question": "Pet", "text": "Pet: dog", "ids": first},
            {"question": "Pet", "text": "Pet: cat", "ids": second},
            {"question": "Rare", "text": "Rare: yes", "ids": [0, 1]},
        ]
        groups = [
            {"id": "0", "subset": first, "comparison": second, "locked": locked},
            {"id": "1", "subset": second, "comparison": first},
        ]
        return json.dumps({"rows": 40, "answers": answers, "groups": groups, "maxPhrases": 2})

    def test_clusters_are_named_by_the_answers_that_set_them_apart(self):
        labels = json.loads(survey_names.name_groups(self.request()))["labels"]
        self.assertEqual(labels["0"]["phrase"], "Pet: dog · Mood: happy")
        self.assertEqual(labels["1"]["phrase"], "Pet: cat · Mood: sad")
        self.assertEqual(len({part["question"] for part in labels["0"]["phrases"]}), 2)

    def test_locked_clusters_keep_their_name_and_rare_answers_name_nothing(self):
        labels = json.loads(survey_names.name_groups(self.request(locked=True)))["labels"]
        self.assertNotIn("0", labels)
        self.assertNotIn("Rare", labels["1"]["phrase"])


if __name__ == "__main__":
    unittest.main()

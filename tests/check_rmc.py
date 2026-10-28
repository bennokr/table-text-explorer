"""Synthetic-workload invariants using invented seeds, never private fixtures."""

import copy
import random
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))

from generate_rmc import ROOT, read_json, report, synthesize, validate
from rmc_sampling import comment_counts
from rmc_text import clean_text, extend_families


def invented_schema(config):
    # Exercise routing and sparse coverage without distributing the source codebook.
    names = set(config["response_answers"]) | {
        name for name in config["field_weights"] if name.endswith("Toel")
    }
    names |= {f"Extra{index}Toel" for index in range(37 - len(names))}
    fields = []
    for name in sorted(names):
        parent = name.removesuffix("Toel")
        fields.extend(
            [
                {"name": parent, "type": "integer"},
                {"name": f"{parent}Last", "type": "integer"},
                {"name": name, "type": "string", "x-role": "text"},
            ]
        )
    for name in ("NrBev", "ModPart"):
        fields.append({"name": name, "type": "integer"})
    for name in ("ToelVrgl", "ErvTkst"):
        fields.append({"name": name, "type": "string", "x-role": "text"})
    for name in ("Leeftijd", "Inclusie2", "AmduurBev"):
        fields.append(
            {"name": name, "type": "integer", "constraints": {"minimum": 0, "maximum": 3000}}
        )
    return {"fields": fields}


def inputs():
    config = read_json(ROOT / "scripts/rmc-synthesis.json")
    schema = invented_schema(config)
    fields = schema["fields"]
    families = []
    for index, field in enumerate(fields):
        name = field["name"]
        if not name.endswith("Toel"):
            continue
        families.append(
            {
                "id": name,
                "fields": [name],
                "parent_field": fields[index - 2]["name"],
                "responses": [{"text": f"Fictief {name} voorbeeld {i}."} for i in range(6)],
            }
        )
    for name, count in (("ToelVrgl", 33), ("ErvTkst", 14)):
        families.append(
            {
                "id": name,
                "fields": [name],
                "responses": [{"text": f"Fictief {name} voorbeeld {i}."} for i in range(count)],
            }
        )
    seed = dict.fromkeys(field["name"] for field in fields)
    seed.update({"Leeftijd": 30, "Inclusie2": 2020, "AmduurBev": 40, "NrBev": 2, "ModPart": 1})
    return {
        "config": config,
        "schema": schema,
        "families": families,
        "seeds": [seed, {**seed, "NrBev": 1}],
    }


class SyntheticRmcTests(unittest.TestCase):
    def test_three_scenarios_preserve_totals_and_exact_participant_histograms(self):
        source = inputs()
        originals = copy.deepcopy(source["seeds"])
        for scenario, settings in source["config"]["scenarios"].items():
            rows, details = synthesize(source, 1000, scenario, 12)
            summary = report(rows, source, 12, scenario, details)
            validate(rows, source, details, summary)
            expected = {int(count): frequency for count, frequency in settings["histogram"].items()}
            self.assertEqual(summary["texts"]["per_participant"], expected)
            self.assertEqual(summary["texts"]["cells"], 1167)
            self.assertTrue(
                all(
                    summary["texts"]["per_field"][name] > 0
                    for name in summary["texts"]["per_field"]
                    if name.endswith("Toel")
                )
            )
            self.check_routing(rows, details, source)
        self.assertEqual(source["seeds"], originals)

    def check_routing(self, rows, details, source):
        by_name = {family["fields"][0]: family for family in source["families"]}
        for row, lineage in zip(rows, details["lineage"], strict=True):
            if row["ErvTkst"]:
                self.assertGreater(row["NrBev"], 1)
            for item in lineage:
                family = by_name[item["field"]]
                parent = family.get("parent_field")
                if parent is None:
                    continue
                answers = source["config"]["response_answers"].get(item["field"], [1] * 6)
                self.assertTrue(all(answers[index] == row[parent] for index in item["responses"]))

    def test_seeded_runs_reproduce_and_new_seeds_change_records(self):
        source = inputs()
        first = synthesize(source, 80, "baseline", 12)
        self.assertEqual(first, synthesize(source, 80, "baseline", 12))
        self.assertNotEqual(first[0], synthesize(source, 80, "baseline", 13)[0])
        self.assertEqual(len({row["ResPno"] for row in first[0]}), 80)
        with self.assertRaises(ValueError):
            synthesize(source, 0, "baseline", 12)

    def test_scaled_histograms_round_to_the_known_overall_density(self):
        config = inputs()["config"]
        for size in (1, 17, 100, 12000):
            counts = comment_counts(
                size, config["scenarios"]["baseline"]["histogram"], [7, 6], random.Random(4)
            )
            self.assertEqual(len(counts), size)
            self.assertEqual(sum(counts), round(size * 7 / 6))
            self.assertGreaterEqual(min(counts), 0)

    def test_text_additions_preserve_answer_codes_and_reject_duplicates(self):
        source = inputs()
        addition = {
            "field": "ComInfoToel",
            "parent_answer": 0,
            "text": "Alle stappen werden rustig uitgelegd.",
        }
        extend_families(source["families"], source["config"], {"responses": [addition]})
        self.assertEqual(source["config"]["response_answers"]["ComInfoToel"][-1], 0)
        with self.assertRaises(ValueError):
            extend_families(source["families"], source["config"], {"responses": [addition]})
        self.assertEqual(
            clean_text(
                "Dit bleef lastig. Dat bleef me bij en dat vond ik lastig en dat vond ik lastig."
            ),
            "Dit bleef lastig.",
        )


if __name__ == "__main__":
    unittest.main()

"""Generate a reproducible local sparse-table workload from fictional RMC seeds."""

import argparse
import hashlib
import json
import random
import re
import subprocess
from collections import Counter
from pathlib import Path

from rmc_sampling import choose_fields, comment_counts, structured_row
from rmc_text import extend_families, fill_participant

ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads(Path(path).read_text())


def workbook(operation, path, rows=None):
    result = subprocess.run(
        ["node", "scripts/rmc_workbook.mjs", operation, str(path)],
        input=json.dumps(rows) if rows is not None else None,
        text=True,
        capture_output=True,
        cwd=ROOT,
        check=True,
    )
    return json.loads(result.stdout) if operation == "read" else None


def load_inputs(config, seed_file):
    schema = read_json(ROOT / config["schema_file"])
    bank = read_json(ROOT / config["bank_file"])
    fields = {field["name"]: field for field in schema["fields"]}
    required = {name for name in fields if name.endswith("Toel")}
    families = bank["families"]
    covered = {name for family in families for name in family["fields"]}
    if not required <= covered or not bank.get("synthetic"):
        raise ValueError("Use a fictional bank covering every Toel field.")
    for family in families:
        if len(family["fields"]) != 1 or family["fields"][0] not in fields:
            raise ValueError("Each response family must target exactly one known field.")
        # General free-text questions have no preceding binary routing question.
        if family.get("parent_field") == family["fields"][0]:
            family.pop("parent_field")
        answers = config["response_answers"].get(family["fields"][0])
        if answers is not None and len(answers) != len(family["responses"]):
            raise ValueError("Response-answer mappings no longer match the text bank.")
    additions = ROOT / config["additions_file"]
    if additions.exists():
        extend_families(families, config, read_json(additions))
    seeds = workbook("read", seed_file)
    if not seeds:
        raise ValueError("The synthetic seed workbook is empty.")
    return {"schema": schema, "families": families, "seeds": seeds, "config": config}


def synthesize(inputs, size, scenario, seed):
    if size < 1:
        raise ValueError("Choose a positive record count.")
    rng = random.Random(seed)
    config = inputs["config"]
    counts = comment_counts(
        size, config["scenarios"][scenario]["histogram"], config["texts_per_record"], rng
    )
    profiles = rng.choices(
        config["profiles"], [profile["weight"] for profile in config["profiles"]], k=size
    )
    context = {
        **inputs,
        "rng": rng,
        "fields": {field["name"]: field for field in inputs["schema"]["fields"]},
    }
    rows = [
        structured_row(rng.choice(inputs["seeds"]), profile, index + 1, context)
        for index, profile in enumerate(profiles)
    ]
    selected = choose_fields(rows, profiles, counts, context)
    used = set()
    lineage = [
        fill_participant(row, chosen, context, used)
        for row, chosen in zip(rows, selected, strict=True)
    ]
    return rows, {
        "counts": counts,
        "lineage": lineage,
        "profiles": [profile["id"] for profile in profiles],
    }


def text_summary(rows, fields):
    names = [field["name"] for field in fields if field.get("x-role") == "text"]
    values = [str(row[name]) for row in rows for name in names if row[name] not in (None, "")]
    counts = Counter(sum(row[name] not in (None, "") for name in names) for row in rows)
    lengths = Counter(
        "short" if len(text.split()) <= 6 else "medium" if len(text.split()) <= 24 else "long"
        for text in values
    )
    return {
        "cells": len(values),
        "unique_texts": len(set(values)),
        "duplicate_cells": len(values) - len(set(values)),
        "per_participant": dict(sorted(counts.items())),
        "lengths": dict(lengths),
        "per_field": {name: sum(row[name] not in (None, "") for row in rows) for name in names},
    }


def field_summary(rows, field):
    values = [row[field["name"]] for row in rows if row[field["name"]] not in (None, "")]
    summary = {"missing": len(rows) - len(values), "distinct": len(set(values))}
    if field.get("categories"):
        summary["categories"] = dict(Counter(map(str, values)))
    if values and field["type"] in {"integer", "number", "year"}:
        summary["range"] = [min(values), max(values)]
    return summary


def report(rows, inputs, seed, scenario, details):
    schema, config = inputs["schema"], inputs["config"]
    return {
        "synthetic": True,
        "calibrated": False,
        "notice": config["notice"],
        "scenario": scenario,
        "seed": seed,
        "records": len(rows),
        "seed_records": len(inputs["seeds"]),
        "rows_sha256": hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest(),
        "assumptions": config,
        "text_generation": {
            "method": "One to three compatible fictional responses; prefer unused compositions",
            "seed_responses": sum(len(family["responses"]) for family in inputs["families"]),
            "coverage_floor": "One populated cell per bank field when allocated slots permit",
            "limitation": (
                "Distinct strings do not imply independently authored "
                "or realistic phrase frequencies"
            ),
        },
        "texts": text_summary(rows, schema["fields"]),
        "fields": {field["name"]: field_summary(rows, field) for field in schema["fields"]},
        "experience_by_profile": {
            name: dict(
                Counter(
                    str(row["ErvLtst"])
                    for row, profile in zip(rows, details["profiles"], strict=True)
                    if profile == name
                )
            )
            for name in sorted(set(details["profiles"]))
        },
    }


def validate(rows, inputs, details, summary):
    schema, config = inputs["schema"], inputs["config"]
    expected = round(len(rows) * config["texts_per_record"][0] / config["texts_per_record"][1])
    if summary["texts"]["cells"] != expected or len({row["ResPno"] for row in rows}) != len(rows):
        raise ValueError("Invalid text totals or duplicate participant identifiers.")
    for row, count in zip(rows, details["counts"], strict=True):
        actual = sum(
            row[field["name"]] not in (None, "")
            for field in schema["fields"]
            if field.get("x-role") == "text"
        )
        if actual != count:
            raise ValueError("Text assignment changed a participant's allocated comment count.")
    for field in schema["fields"]:
        validate_field(rows, field)


def validate_field(rows, field):
    allowed = [category["value"] for category in field.get("categories", [])]
    values = [row[field["name"]] for row in rows if row[field["name"]] not in (None, "")]
    if allowed and any(value not in allowed for value in values):
        raise ValueError(f"Unknown category in {field['name']}")
    bounds = field.get("constraints", {})
    if "minimum" in bounds and any(value < bounds["minimum"] for value in values):
        raise ValueError(f"Value below minimum in {field['name']}")
    if "maximum" in bounds and any(value > bounds["maximum"] for value in values):
        raise ValueError(f"Value above maximum in {field['name']}")
    if "pattern" in bounds and any(
        not re.fullmatch(bounds["pattern"], str(value)) for value in values
    ):
        raise ValueError(f"Invalid format in {field['name']}")


def save(rows, inputs, summary, details, output):
    schema, config = inputs["schema"], inputs["config"]
    destination = ROOT / "fixtures/rmc-synthetic" / output.stem
    destination.mkdir(parents=True, exist_ok=True)
    workbook("write", output, rows)
    for name, content in (("rows", rows), ("report", summary), ("lineage", details)):
        (destination / f"{name}.json").write_text(json.dumps(content, indent=2) + "\n")
    directory = ROOT / "demo-config" / output.name
    directory.mkdir(parents=True, exist_ok=True)
    demo = read_json(ROOT / Path(config["schema_file"]).parent / "demo.json")
    demo["analysis"]["features"] = [family["fields"][0] for family in inputs["families"]]
    (directory / "demo.json").write_text(json.dumps(demo, indent=2) + "\n")
    (directory / "schema.metadata.json").write_text(
        json.dumps(
            {
                **schema,
                "x-synthetic": {
                    "scenario": summary["scenario"],
                    "seed": summary["seed"],
                    "calibrated": False,
                },
            },
            indent=2,
        )
        + "\n"
    )
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rows", type=int, default=1000)
    parser.add_argument("--seed", type=int, default=20261028)
    parser.add_argument(
        "--scenario", choices=["baseline", "spread", "concentrated"], default="baseline"
    )
    parser.add_argument("--seed-file", type=Path)
    arguments = parser.parse_args()
    config = read_json(ROOT / "scripts/rmc-synthesis.json")
    inputs = load_inputs(config, arguments.seed_file or ROOT / config["seed_file"])
    rows, details = synthesize(inputs, arguments.rows, arguments.scenario, arguments.seed)
    summary = report(rows, inputs, arguments.seed, arguments.scenario, details)
    validate(rows, inputs, details, summary)
    suffix = "" if arguments.scenario == "baseline" else f"_{arguments.scenario}"
    output = ROOT / f"fixtures/RMC_synthetic{suffix}_{arguments.rows}.xlsx"
    destination = save(rows, inputs, summary, details, output)
    print(
        json.dumps(
            {
                "workbook": str(output),
                "report": str(destination / "report.json"),
                "records": len(rows),
                "text_cells": summary["texts"]["cells"],
                "unique_texts": summary["texts"]["unique_texts"],
                "text_counts": summary["texts"]["per_participant"],
            }
        )
    )


if __name__ == "__main__":
    main()

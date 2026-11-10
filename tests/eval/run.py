# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["numpy==1.26.4", "scikit-learn==1.7.0"]
# ///
"""Evaluate the app's structure discovery and explanations on the Rechtspraak sample.

Usage: uv run --script tests/eval/run.py [manifest.json] [output-folder]
Needs fixtures/rechtspraak-sample.json (npm run prepare:rechtspraak). Results are written to
.cache/eval/ as JSON and Markdown; nothing is uploaded.
"""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from eval_columns import grade_screen, screen_columns
from eval_common import (
    ROOT,
    Subject,
    build_index,
    load_clustering,
    load_manifest,
    load_module,
    load_rows,
)
from eval_descriptions import evaluate_descriptions
from eval_report import full_report
from eval_structure import evaluate_structure

SEED = 7


def make_subject(modules, rows, manifest, text_field):
    terms, analysis, clustering = modules
    field = build_index(terms, rows, text_field)
    return Subject(terms, analysis, clustering, rows, manifest, text_field, field, SEED)


def timed(label, function, *args):
    started = time.perf_counter()
    result = function(*args)
    print(f"{label}: {time.perf_counter() - started:.0f}s", flush=True)
    return result


def screens(subject):
    variants = {"naive": False, "length-controlled": True}
    return {
        name: grade_screen(screen_columns(subject, stratified), subject.manifest)
        for name, stratified in variants.items()
    }


def main():
    manifest_path = (
        Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "rechtspraak-gold.json"
    )
    output = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / ".cache/eval"
    manifest = load_manifest(manifest_path)
    rows = load_rows(manifest)
    modules = (load_module("terms"), load_module("analysis"), load_clustering())
    sections = {"columns": {}, "descriptions": {}, "structure": {}}
    for text_field in manifest["text_fields"]:
        subject = make_subject(modules, rows, manifest, text_field)
        sections["columns"][text_field] = timed(f"columns {text_field}", screens, subject)
        sections["descriptions"][text_field] = timed(
            f"descriptions {text_field}", evaluate_descriptions, subject
        )
        sections["structure"][text_field] = timed(
            f"structure {text_field}", evaluate_structure, subject
        )
    output.mkdir(parents=True, exist_ok=True)
    (output / "rechtspraak-results.json").write_text(json.dumps(sections, indent=1, default=float))
    (output / "rechtspraak-report.md").write_text(full_report(sections, rows, manifest))
    print((output / "rechtspraak-report.md").read_text())


if __name__ == "__main__":
    main()

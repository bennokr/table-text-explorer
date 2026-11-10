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
    EMBEDDING_KINDS,
    ROOT,
    has_representation,
    load_clustering,
    load_manifest,
    load_module,
    load_rows,
    make_subject,
    with_representation,
)
from eval_descriptions import evaluate_descriptions
from eval_report import full_report
from eval_structure import evaluate_structure
from eval_surfacing import evaluate_surfacing

SEED = 7


def timed(label, function, *args):
    started = time.perf_counter()
    result = function(*args)
    print(f"{label}: {time.perf_counter() - started:.0f}s", flush=True)
    return result


def column_screen(subject):
    results = screen_columns(subject)
    return grade_screen(results, subject.manifest, subject.text_field)


# Descriptions use the phrase index only, so they do not depend on the representation.
PER_REPRESENTATION = {
    "columns": column_screen,
    "structure": evaluate_structure,
    "surfacing": evaluate_surfacing,
}
ALL_SECTIONS = ["columns", "descriptions", "structure", "surfacing"]


def run_field(base, wanted, sections):
    manifest, text_field = base.manifest, base.text_field
    if "descriptions" in wanted:
        label = f"descriptions {text_field}"
        sections["descriptions"][text_field] = timed(label, evaluate_descriptions, base)
    for kind in ["tfidf", *EMBEDDING_KINDS]:
        if not has_representation(manifest, text_field, kind):
            print(f"skipping {kind} for {text_field}: no embeddings", flush=True)
            continue
        subject = with_representation(base, kind)
        for name in wanted:
            if name in PER_REPRESENTATION:
                label = f"{name} {text_field} {kind}"
                sections[name].setdefault(text_field, {})[kind] = timed(
                    label, PER_REPRESENTATION[name], subject
                )


def main():
    default = Path(__file__).parent / "rechtspraak-gold-v2.json"
    manifest_path = Path(sys.argv[1]) if len(sys.argv) > 1 else default
    output = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / ".cache/eval"
    manifest = load_manifest(manifest_path)
    rows = load_rows(manifest)
    modules = (load_module("terms"), load_module("analysis"), load_clustering())
    wanted = manifest.get("sections", ALL_SECTIONS)
    sections = {name: {} for name in wanted}
    for text_field in manifest["text_fields"]:
        base = make_subject(modules, rows, manifest, text_field, SEED)
        run_field(base, wanted, sections)
    output.mkdir(parents=True, exist_ok=True)
    stem = manifest["name"]
    (output / f"{stem}-results.json").write_text(json.dumps(sections, indent=1, default=float))
    (output / f"{stem}-report.md").write_text(full_report(sections, rows, manifest))
    print((output / f"{stem}-report.md").read_text())


if __name__ == "__main__":
    main()

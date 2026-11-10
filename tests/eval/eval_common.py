"""Shared setup: the app's own Python modules, the sample and its text index."""

import importlib.util
import json
import subprocess
import sys
from dataclasses import dataclass
from functools import cache
from pathlib import Path

ROOT = Path(__file__).parents[2]
WORKERS = ROOT / "src/workers"
sys.path.insert(0, str(WORKERS))


def load_module(name, **injected):
    """Import src/workers/<name>.py as the app does, optionally injecting helper names."""
    spec = importlib.util.spec_from_file_location(f"eval_{name}", WORKERS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    for key, value in injected.items():
        setattr(module, key, value)
    spec.loader.exec_module(module)
    return module


def load_clustering():
    density = load_module("density")
    return load_module(
        "clustering", density_result=density.density_result, select_density=density.select_density
    )


@cache
def app_stopwords():
    """The exact Dutch stoplist the app builds in src/features.js (negations kept)."""
    script = (
        "import('./src/features.js').then(m => console.log("
        "JSON.stringify(m.stopwordList({language: 'nl', stopwords: ''}, true))))"
    )
    run = ["node", "--input-type=module", "-e", script]
    return json.loads(
        subprocess.run(run, cwd=ROOT, capture_output=True, text=True, check=True).stdout
    )


def load_manifest(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def load_rows(manifest):
    return json.loads((ROOT / manifest["dataset"]).read_text(encoding="utf-8"))


def build_index(terms, rows, field):
    """Build the app's phrase index (its default 1-3 word phrases) for one text field."""
    payload = {
        "rows": len(rows),
        "indexId": field,
        "sizes": [1, 3],
        "stopwords": app_stopwords(),
        "columns": [{"name": field, "texts": [row[field] for row in rows]}],
    }
    terms.build_term_index(json.dumps(payload))
    return terms.term_indexes[field]


@dataclass(frozen=True)
class Subject:
    """Everything one evaluation needs: app modules, records, gold manifest and one text field."""

    terms: object
    analysis: object
    clustering: object
    rows: list
    manifest: dict
    text_field: str
    field: dict  # The app's phrase index for text_field (its indexId is the field name).
    seed: int

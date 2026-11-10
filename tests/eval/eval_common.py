"""Shared setup: the app's own Python modules, the sample and its text index."""

import importlib.util
import json
import subprocess
import sys
from dataclasses import dataclass, replace
from functools import cache
from pathlib import Path

import numpy as np

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


EMBEDDINGS = ROOT / ".cache/eval/embeddings"
EMBEDDING_KINDS = ["words-mean", "words-tfidf", "sentences-multilingual", "sentences-dutch"]


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
    representation: str = "tfidf"
    features: object = None  # The 32-d vectors the app feeds to clusters, maps and analyses.
    embeddings: object = None  # Raw embeddings (rows x dimensions) for embedding representations.


class Saved:
    """Stands in for the Pyodide proxy the app's Python reads embeddings from."""

    def __init__(self, values):
        self.values = values

    def to_py(self):
        return self.values


def embedding_path(manifest, text_field, kind):
    return EMBEDDINGS / f"{manifest['name']}-{text_field}-{kind}"


def has_representation(manifest, text_field, kind):
    return (
        kind == "tfidf" or embedding_path(manifest, text_field, kind).with_suffix(".f32").exists()
    )


def load_embeddings(manifest, text_field, kind):
    path = embedding_path(manifest, text_field, kind)
    meta = json.loads(path.with_suffix(".json").read_text())
    values = np.fromfile(path.with_suffix(".f32"), dtype="<f4")
    return values.reshape(-1, meta["dimensions"])


def make_subject(modules, rows, manifest, text_field, seed):
    """Index one text field and attach the TF-IDF representation (the baseline)."""
    terms, analysis, clustering = modules
    field = build_index(terms, rows, text_field)
    subject = Subject(terms, analysis, clustering, rows, manifest, text_field, field, seed)
    return replace(subject, features=text_features(analysis, rows, text_field))


def with_representation(subject, kind):
    """The same subject seen through an embedding, reduced by the app's own SVD to 32-d."""
    if kind == "tfidf":
        return subject
    values = load_embeddings(subject.manifest, subject.text_field, kind)
    subject.analysis.embedding_values = Saved(values)
    mode = "words" if kind.startswith("words") else "sentences"
    payload = {
        "mode": mode,
        "method": "prepare",
        "rows": [{} for _ in subject.rows],
        "fields": [{"name": subject.text_field, "kind": "text"}],
        "dimensions": values.shape[1],
    }
    features = np.asarray(subject.analysis.project(payload)["features"], dtype=np.float32)
    return replace(subject, representation=kind, features=features, embeddings=values)


def text_features(analysis, rows, text_field):
    """The app's own text vectors: TF-IDF of the phrase index, reduced to 32 SVD dimensions."""
    payload = {
        "mode": "text",
        "method": "prepare",
        "indexId": text_field,
        "rows": [{} for _ in rows],
        "fields": [{"name": text_field, "kind": "text"}],
    }
    return np.asarray(analysis.project(payload)["features"], dtype=np.float32)

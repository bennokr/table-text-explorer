# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["numpy==1.26.4"]
# ///
"""Package the example datasets and their embeddings as `data-v1` release assets.

Run after the embeddings exist (tests/eval/embed.mjs writes .f32 files) and after
scripts/clean_rechtspraak.py. Writes the assets and SHA256SUMS to .cache/data-release/assets/
and the pinned manifest scripts/data-release.json. Upload the assets with:

    gh release create data-v1 .cache/data-release/assets/* --title "Example data (data-v1)"

Embeddings are stored as half-precision .npy (one row per record in table order): half the size of
float32, far inside the precision similarity needs. Nothing is uploaded by this script.
"""

import hashlib
import json
from pathlib import Path

import numpy as np

OUTPUT = Path(".cache/data-release/assets")
MODEL = {
    "key": "dutch",
    "model": "MarkSelles/dutch-minilm-l6-v2",
    "revision": "a4838aae5e41cfe6bd1ce54bafd1a4cdf3489bd7",
    "pooling": "attention-masked mean of 126-token chunks, averaged and normalised",
}
EMBEDDINGS = ".cache/eval/embeddings"
DATASETS = [
    {
        "name": "rechtspraak-sample.json",
        "table": ".cache/data-release/rechtspraak-sample.json",
        "embeddings": [
            ("summary", ".cache/data-release/embed/rechtspraak-summary-sentences-dutch.f32"),
            (
                "ruling_excerpt",
                ".cache/data-release/embed/rechtspraak-ruling_excerpt-sentences-dutch.f32",
            ),
        ],
    },
    {
        "name": "tweedekamer-motions-sample.json",
        "table": "fixtures/tweedekamer-motions-sample.json",
        "embeddings": [("text", f"{EMBEDDINGS}/tweedekamer-text-sentences-dutch.f32")],
    },
    {
        "name": "dbrd-test.json",
        "table": None,  # Tracked in examples/; only its embeddings are released.
        "rows": "examples/dbrd-test.json",
        "embeddings": [("text", f"{EMBEDDINGS}/dbrd-text-sentences-dutch.f32")],
    },
]


def checksum(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def asset(path, **details):
    return {"name": path.name, "bytes": path.stat().st_size, "sha256": checksum(path), **details}


def half_precision(source, rows, destination):
    """Float32 vectors as a half-precision .npy with exactly `rows` rows."""
    values = np.fromfile(source, dtype=np.float32)
    if values.size % rows:
        raise SystemExit(f"{source}: {values.size} values do not fit {rows} records")
    np.save(destination, values.reshape(rows, -1).astype(np.float16))


def package(dataset):
    rows_source = dataset["table"] or dataset["rows"]
    rows = len(json.loads(Path(rows_source).read_text(encoding="utf-8")))
    assets = []
    if dataset["table"]:
        copy = OUTPUT / dataset["name"]
        copy.write_bytes(Path(dataset["table"]).read_bytes())
        assets.append(asset(copy, role="table"))
    stem = dataset["name"].removesuffix(".json")
    for field, source in dataset["embeddings"]:
        target = OUTPUT / f"{stem}.{field}.dutch-minilm.npy"
        half_precision(source, rows, target)
        dimensions = int(np.load(target).shape[1])
        assets.append(
            asset(
                target,
                role="embeddings",
                field=field,
                dimensions=dimensions,
                records=rows,
                model=MODEL["key"],
                dtype="float16",
            )
        )
    return {"name": dataset["name"], "assets": assets}


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    datasets = [package(dataset) for dataset in DATASETS]
    release = {
        "repository": "bennokr/table-text-explorer",
        "tag": "data-v1",
        "model": MODEL,
        "datasets": datasets,
    }
    Path("scripts/data-release.json").write_text(json.dumps(release, indent=2) + "\n")
    lines = [f"{item['sha256']}  {item['name']}" for d in datasets for item in d["assets"]]
    (OUTPUT / "SHA256SUMS").write_text("\n".join(lines) + "\n")
    total = sum(item["bytes"] for d in datasets for item in d["assets"])
    print(f"Packaged {len(lines)} assets ({total / 1e6:.1f} MB) in {OUTPUT}")


if __name__ == "__main__":
    main()

# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["spacy==3.7.5", "numpy==1.26.4", "typer==0.9.4", "click==8.1.8"]
# ///
"""Extract pinned spaCy static vectors; no spaCy dependency in the browser."""

import hashlib
import json
import urllib.request
from pathlib import Path

from spacy.strings import hash_string
from spacy.vectors import Vectors

MODELS = {
    "nl": ("nl_core_news_md", "3bcc35e80224135520020fadc84db3d98492f2a4", "CC-BY-SA-4.0"),
    "en": ("en_core_web_md", "22f17ee20cda126e498ea2fb92dc504bea0d111c", "MIT"),
}


def download(url, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        with urllib.request.urlopen(url) as response:
            target.write_bytes(response.read())
    return hashlib.sha256(target.read_bytes()).hexdigest()


def prepare(language, specification):
    name, revision, license_name = specification
    base = f"https://huggingface.co/spacy/{name}/resolve/{revision}"
    cache = Path(".cache/vector-sources") / name
    target = Path("public/vendor/vectors") / language
    target.mkdir(parents=True, exist_ok=True)
    hashes = {}
    for filename in ("vocab/vectors", "vocab/key2row", "vocab/vectors.cfg", "vocab/strings.json"):
        hashes[filename] = download(f"{base}/{filename}", cache / filename)
    for filename in ("LICENSE", "LICENSES_SOURCES", "meta.json"):
        hashes[filename] = download(f"{base}/{filename}", target / filename)
    vectors = Vectors().from_disk(cache / "vocab", exclude=["strings"])
    strings = json.loads((cache / "vocab/strings.json").read_text())
    words = {
        word: vectors.key2row[hash_string(word)]
        for word in strings
        if hash_string(word) in vectors.key2row
    }
    (target / "words.json").write_text(json.dumps(words, ensure_ascii=False, separators=(",", ":")))
    vectors.data.astype("<f4").tofile(target / "vectors.f32")
    metadata = {
        "model": name,
        "revision": revision,
        "license": license_name,
        "dimensions": vectors.data.shape[1],
        "rows": len(vectors.data),
        "words": len(words),
        "source": f"https://huggingface.co/spacy/{name}",
        "sourceSha256": hashes,
    }
    metadata["files"] = {
        name: {
            "bytes": (target / name).stat().st_size,
            "sha256": hashlib.sha256((target / name).read_bytes()).hexdigest(),
        }
        for name in ("words.json", "vectors.f32")
    }
    (target / "manifest.json").write_text(json.dumps(metadata, indent=2))
    total_bytes = sum(file["bytes"] for file in metadata["files"].values())
    print(f"{language}: {len(words):,} words, {total_bytes:,} bytes")


for language, specification in MODELS.items():
    prepare(language, specification)

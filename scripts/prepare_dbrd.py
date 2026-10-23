"""Vendor the official DBRD test split, preserving review text and dataset licensing."""

import hashlib
import json
import re
import tarfile
import urllib.request
from pathlib import Path

URL = "https://github.com/benjaminvdb/DBRD/releases/download/v3.0/DBRD_v3.tgz"
SHA256 = "2d7eed5a2c56b19fec22f1656722b6036569aa542d362e576bd761eb91e1e76a"
ARCHIVE = Path(".cache/dbrd/DBRD_v3.tgz")
ATTRIBUTION = Path("examples/attribution/dbrd")


def acquire():
    ARCHIVE.parent.mkdir(parents=True, exist_ok=True)
    if not ARCHIVE.exists():
        urllib.request.urlretrieve(URL, ARCHIVE)
    if hashlib.sha256(ARCHIVE.read_bytes()).hexdigest() != SHA256:
        raise ValueError("DBRD archive hash mismatch; remove the cached archive and retry.")


def read_test():
    rows = []
    with tarfile.open(ARCHIVE) as archive:
        for member in archive:
            if member.name in {"DBRD/LICENSE", "DBRD/README.md"}:
                documentation = archive.extractfile(member).read().decode("utf-8")
                (ATTRIBUTION / Path(member.name).name).write_text(
                    "\n".join(line.rstrip() for line in documentation.splitlines()) + "\n"
                )
            match = re.fullmatch(r"DBRD/test/(pos|neg)/(\d+)_(\d+)\.txt", member.name)
            if not member.isfile() or not match:
                continue
            sentiment, review_id, rating = match.groups()
            text = archive.extractfile(member).read().decode("utf-8")
            rows.append(
                {
                    "review_id": int(review_id),
                    "rating": int(rating),
                    "sentiment": "positive" if sentiment == "pos" else "negative",
                    "text": text,
                    "word_count": len(text.split()),
                    "character_count": len(text),
                }
            )
    if len(rows) != 2224 or len({row["review_id"] for row in rows}) != 2224:
        raise ValueError("Unexpected DBRD test split size or duplicate IDs.")
    return sorted(rows, key=lambda row: row["review_id"])


def main():
    acquire()
    ATTRIBUTION.mkdir(parents=True, exist_ok=True)
    rows = read_test()
    target = Path("examples/dbrd-test.json")
    target.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n")
    provenance = {
        "source": URL,
        "archiveSha256": SHA256,
        "release": "v3.0",
        "split": "test",
        "authors": ["Benjamin van der Burgh", "Suzan Verberne"],
        "license": "CC-BY-NC-SA-4.0",
        "rows": len(rows),
        "sentimentCounts": {
            label: sum(row["sentiment"] == label for row in rows)
            for label in ("positive", "negative")
        },
        "transformation": (
            "Text preserved verbatim; IDs/ratings from filenames; "
            "whitespace word and character counts derived."
        ),
        "outputSha256": hashlib.sha256(target.read_bytes()).hexdigest(),
    }
    (ATTRIBUTION / "source.json").write_text(json.dumps(provenance, indent=2) + "\n")
    print(f"Vendored {len(rows)} DBRD reviews, {target.stat().st_size:,} bytes, CC-BY-NC-SA-4.0.")


if __name__ == "__main__":
    main()

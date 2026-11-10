"""Build the Rechtspraak evaluation sample from the CC0 open-data API.

Writes fixtures/rechtspraak-sample.json (ignored by Git). Raw API responses are cached in
.cache/rechtspraak/, so a rerun needs no network. The sample is deliberately balanced:
SAMPLE_PER_CELL rulings for each legal sub-area and year, drawn at uniformly random offsets
with a fixed seed. Only rulings that carry exactly one legal area are kept, so the area
label is a clean gold annotation. Balanced quotas are for evaluation, not for realism.
"""

import hashlib
import json
import random
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

API = "https://data.rechtspraak.nl/uitspraken"
AREA = "http://psi.rechtspraak.nl/rechtsgebied#"
SUB_AREAS = [
    "bestuursrecht_vreemdelingenrecht",
    "bestuursrecht_socialezekerheidsrecht",
    "bestuursrecht_omgevingsrecht",
    "bestuursrecht_belastingrecht",
    "civielRecht_arbeidsrecht",
    "civielRecht_personenEnFamilierecht",
    "civielRecht_verbintenissenrecht",
    "civielRecht_intellectueeleigendomsrecht",
    "civielRecht_insolventierecht",
    "strafrecht_materieelStrafrecht",
    "strafrecht_strafprocesrecht",
    "strafrecht_penitentiairStrafrecht",
]
YEARS = range(2016, 2026)
SAMPLE_PER_CELL = 25
DRAWS_PER_CELL = 36  # Spare draws replace multi-area, duplicate and text-less rulings.
SEED = 20261110
USER_AGENT = "table-text-explorer-eval/1.0"  # The API rejects the default Python agent.
EXCERPT_CHARS = 2500
CACHE = Path(".cache/rechtspraak")
OUTPUT = Path("fixtures/rechtspraak-sample.json")
NS = {
    "dc": "http://purl.org/dc/terms/",
    "psi": "http://psi.rechtspraak.nl/",
    "rs": "http://www.rechtspraak.nl/schema/rechtspraak-1.0",
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
}
COURT_TYPES = [
    ("Rechtbank", "Rechtbank"),
    ("Gerechtshof", "Gerechtshof"),
    ("Hoge Raad", "Hoge Raad"),
    ("Raad van State", "Raad van State"),
    ("Centrale Raad van Beroep", "Centrale Raad van Beroep"),
]


def fetch(url):
    """GET with an on-disk cache keyed by URL, so reruns are offline and polite."""
    path = CACHE / (hashlib.sha256(url.encode()).hexdigest() + ".xml")
    if path.exists():
        return path.read_text(encoding="utf-8")
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                text = response.read().decode("utf-8-sig")
            break
        except OSError as error:
            failure = error
            time.sleep(2**attempt)
    else:
        raise RuntimeError(f"Could not fetch {url}: {failure}")
    path.write_text(text, encoding="utf-8")
    time.sleep(0.2)
    return text


def search_url(area, year, offset):
    query = [
        ("subject", AREA + area),
        ("date", f"{year}-01-01"),
        ("date", f"{year}-12-31"),
        ("type", "Uitspraak"),
        ("return", "DOC"),
        ("sort", "ASC"),
        ("max", "1"),
        ("from", str(offset)),
    ]
    return f"{API}/zoeken?{urllib.parse.urlencode(query)}"


def pool_size(area, year):
    found = re.search(r"Aantal gevonden ECLI's: (\d+)", fetch(search_url(area, year, 0)))
    return int(found.group(1)) if found else 0


def draw_eclis(cell):
    """Return up to DRAWS_PER_CELL ECLIs at distinct random offsets of one area-year pool."""
    area, year = cell
    size = pool_size(area, year)
    rng = random.Random(f"{SEED}/{area}/{year}")
    eclis = []
    for offset in rng.sample(range(size), min(size, DRAWS_PER_CELL)):
        found = re.search(r"<entry><id>(ECLI:[^<]+)</id>", fetch(search_url(area, year, offset)))
        if found:
            eclis.append(found.group(1))
    return eclis


def text_of(node):
    return "" if node is None else " ".join("".join(node.itertext()).split())


def court_type(name):
    return next((label for prefix, label in COURT_TYPES if name.startswith(prefix)), "Overig")


def parse_document(xml):
    """Flatten one ruling into scalar columns, or None when it has no usable text."""
    root = ET.fromstring(xml)
    meta = root.find("rdf:RDF/rdf:Description", NS)
    subjects = meta.findall("dc:subject", NS)
    summary = text_of(root.find("rs:inhoudsindicatie", NS))
    body = text_of(root.find("rs:uitspraak", NS))
    if len(subjects) != 1 or not summary or not body:
        return None
    court = text_of(meta.find("dc:creator", NS))
    procedure = text_of(meta.find("psi:procedure", NS))
    date = text_of(meta.find("dc:date", NS))
    main, _, sub = text_of(subjects[0]).partition("; ")
    ecli = text_of(meta.find("dc:identifier", NS))
    sequence = ecli.rsplit(":", 1)[1]
    return {
        "ecli": ecli,
        "area_id": subjects[0].get("resourceIdentifier"),
        "date": date,
        "year": int(date[:4]),
        "court": court,
        "court_type": court_type(court),
        "procedure": procedure or "Onbekend",
        "legal_area": main,
        "legal_subarea": sub,
        "ecli_sequence": int(sequence) if sequence.isdigit() else None,
        "summary": summary,
        "ruling_excerpt": body[:EXCERPT_CHARS],
        "summary_words": len(summary.split()),
        "ruling_words": len(body.split()),
    }


def fetch_document(ecli):
    return parse_document(fetch(f"{API}/content?id={urllib.parse.quote(ecli)}"))


def is_wanted(document, cell, seen):
    """Keep a ruling that is in this cell's year, carries this cell's single area, and is new."""
    area, year = cell
    return (
        document is not None
        and document["area_id"] == AREA + area
        and document["year"] == year
        and document["ecli"] not in seen
    )


def cell_records(cell, drawn, seen):
    records = []
    for ecli in drawn:
        document = fetch_document(ecli)
        if is_wanted(document, cell, seen):
            records.append({k: v for k, v in document.items() if k != "area_id"})
            seen.add(document["ecli"])
        if len(records) == SAMPLE_PER_CELL:
            break
    return records


def summarize(records):
    names = sorted({record["legal_subarea"] for record in records})
    return {name: sum(record["legal_subarea"] == name for record in records) for name in names}


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    cells = [(area, year) for area in SUB_AREAS for year in YEARS]
    with ThreadPoolExecutor(max_workers=3) as pool:
        drawn = dict(zip(cells, pool.map(draw_eclis, cells), strict=True))
        list(pool.map(fetch_document, [ecli for cell in cells for ecli in drawn[cell]]))
    seen, records = set(), []
    for cell in cells:
        records.extend(cell_records(cell, drawn[cell], seen))
    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text(json.dumps(records, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(records), "records", json.dumps(summarize(records), ensure_ascii=False))


if __name__ == "__main__":
    main()

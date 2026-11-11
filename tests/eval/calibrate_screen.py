# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["numpy==1.26.4", "scikit-learn==1.7.0"]
# ///
"""Calibrate the app's column screen on real tables: real columns, nulls, small sets, missingness.

Usage: uv run --script tests/eval/calibrate_screen.py <real|null|population|missing> [dataset ...]
Datasets: dbrd, rechtspraak (summaries), rechtspraak-excerpt, tweedekamer. The Rechtspraak and
Tweede Kamer samples come from npm run prepare:rechtspraak and prepare:tweedekamer; nothing is
uploaded. Every number comes from the app's own src/workers/column_screen.py.
"""

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))

from eval_common import ROOT, app_stopwords, load_module

TABLES = {
    "dbrd": ("examples/dbrd-test.json", "text", "sentiment"),
    "rechtspraak": ("fixtures/rechtspraak-sample.json", "summary", "legal_area"),
    "rechtspraak-excerpt": ("fixtures/rechtspraak-sample.json", "ruling_excerpt", "legal_area"),
    "tweedekamer": ("fixtures/tweedekamer-motions-sample.json", "text", "party"),
}
IDENTIFIERS = {"id", "review_id", "ecli", "ecli_sequence", "date", "dossier_title"}
terms = load_module("terms")
screen = load_module("column_screen")
tables = {}


def table(name):
    """Rows and text field, with the app's phrase index built under the table's name."""
    if name not in tables:
        path, field, _ = TABLES[name]
        rows = json.loads((ROOT / path).read_text(encoding="utf-8"))
        texts = [row[field] or "" for row in rows]
        payload = {
            "rows": len(rows),
            "indexId": name,
            "sizes": [1, 3],
            "stopwords": app_stopwords(),
            "columns": [{"name": field, "texts": texts}],
        }
        terms.build_term_index(json.dumps(payload))
        tables[name] = (rows, field)
    return tables[name]


def categorical(name, values):
    """Codes for any labels; None is missing."""
    names = sorted({value for value in values if value is not None}, key=str)
    codes = {value: index for index, value in enumerate(names)}
    return {
        "name": name,
        "kind": "categorical",
        "codes": [-1 if value is None else codes[value] for value in values],
    }


def numeric(name, values):
    return {
        "name": name,
        "kind": "numeric",
        "values": [None if v is None else float(v) for v in values],
    }


def real_columns(name):
    """The table's own columns as the app offers them: text and identifiers are left out."""
    rows, field = table(name)
    columns = []
    for key in rows[0]:
        values = [row.get(key) for row in rows]
        if key == field or key in IDENTIFIERS or key in {"summary", "ruling_excerpt", "text"}:
            continue
        try:
            numbers = [None if value in (None, "") else float(value) for value in values]
        except ValueError:
            numbers = []
        if len({n for n in numbers if n is not None}) > 12:
            columns.append(numeric(key, numbers))
        else:
            columns.append(categorical(key, [None if v in (None, "") else str(v) for v in values]))
    return columns


def run(name, columns, population=None):
    rows, _ = table(name)
    population = list(range(len(rows))) if population is None else [int(i) for i in population]
    payload = {"indexId": name, "population": population, "columns": columns}
    result = json.loads(screen.run_column_screen(json.dumps(payload)))
    return result, {column["name"]: column for column in result["columns"]}


def report_real(name):
    result, _ = run(name, real_columns(name))
    print(f"\n{name}: {result['population']} records")
    for column in sorted(result["columns"], key=lambda c: -c.get("effect", -1)):
        missing = column["missing"]
        flag = f" missing differs={missing['differs']}" if missing else ""
        shown = (
            f"effect {column['effect']:+.4f}  p {column['p']:.4f}"
            if column["eligible"]
            else "not eligible"
        )
        print(
            f"  {column['name']:16s} {column['kind'][:3]} groups {column['groups']:3d}  "
            f"coverage {column['coverage']:.2f}  {shown}  sig={column.get('significant')}{flag}"
        )


def null_batch(rng, size, reps):
    """Columns with no link to the text: shuffled groups of several sizes, noise, and coverage."""
    batch = {}
    for groups in (2, 3, 5, 10, 25, 50):
        weights = rng.dirichlet(np.ones(groups) * 2, size=reps)
        batch[f"{groups} uneven groups"] = [
            categorical(f"c{i}", rng.choice(groups, size=size, p=w)) for i, w in enumerate(weights)
        ]
    batch["gaussian"] = [numeric(f"c{i}", rng.normal(size=size)) for i in range(reps)]
    batch["lognormal"] = [numeric(f"c{i}", rng.lognormal(size=size)) for i in range(reps)]
    for coverage in (0.9, 0.7):
        labels = [
            np.where(rng.random(size) < coverage, rng.integers(3, size=size), -1)
            for _ in range(reps)
        ]
        batch[f"3 groups, coverage {coverage}"] = [
            categorical(f"c{i}", [None if v < 0 else int(v) for v in values])
            for i, values in enumerate(labels)
        ]
    return batch


def report_null(name, reps=40):
    """False-positive rate of p, the null effect, and whether length alone is ever offered."""
    rows, field = table(name)
    rng = np.random.default_rng(11)
    words = np.array([len((row[field] or "").split()) for row in rows], dtype=float)
    print(f"\n{name}: {reps} null columns per setting")
    flagged = 0
    for label, columns in null_batch(rng, len(rows), reps).items():
        result, _ = run(name, columns)
        eligible = [c for c in result["columns"] if c["eligible"]]
        p = np.array([c["p"] for c in eligible])
        effect = np.array([c["effect"] for c in eligible])
        flagged += sum(c["significant"] for c in eligible)
        print(
            f"  {label:28s} p<.05 {np.mean(p < 0.05):.2f}  p<.01 {np.mean(p < 0.01):.2f}  "
            f"effect max {effect.max():+.4f}"
        )
    own, _ = run(name, [numeric("word count", words)])
    print(
        f"  false flags after Holm and the floor: {flagged}; text length itself: "
        f"effect {own['columns'][0]['effect']:+.4f}, significant={own['columns'][0]['significant']}"
    )


def report_population(name, reps=40):
    """Null flags and power of the table's signal column inside random subsets of the records."""
    rows, _ = table(name)
    signal = {c["name"]: c for c in real_columns(name)}[TABLES[name][2]]
    codes = np.array(signal["codes"])
    rng = np.random.default_rng(31)
    screen.MIN_POPULATION = 30  # Measure below the app's minimum too, to show why it is 60.
    print(f"\n{name}: random subsets; signal column {signal['name']}")
    for size in (30, 60, 120, 250, 500, 1000):
        nulls = found = 0
        for _ in range(reps):
            subset = np.sort(rng.choice(len(rows), size=size, replace=False))
            noise = [categorical(f"k{k}", rng.integers(k, size=size)) for k in (2, 3, 5, 10)]
            column = {**signal, "name": "signal", "codes": [int(c) for c in codes[subset]]}
            result, by_name = run(name, [*noise, column], subset)
            nulls += any(c.get("significant") for c in result["columns"] if c["name"] != "signal")
            found += bool(by_name.get("signal", {}).get("significant"))
        print(
            f"  {size:5d} records: false flag in {nulls}/{reps} runs, signal found {found}/{reps}"
        )


def report_missing(name, reps=40):
    """How strongly must missingness depend on the text before the screen says so?"""
    rows, _ = table(name)
    signal = {c["name"]: c for c in real_columns(name)}[TABLES[name][2]]
    codes = np.array(signal["codes"])
    target = codes == np.bincount(codes[codes >= 0]).argmax()
    rng = np.random.default_rng(41)
    print(f"\n{name}: a noise column whose missingness depends on {signal['name']}")
    for inside, outside in [(0.4, 0.4), (0.5, 0.3), (0.6, 0.2), (0.7, 0.1), (0.9, 0.1)]:
        flagged = 0
        for _ in range(reps):
            gone = rng.random(len(rows)) < np.where(target, inside, outside)
            values = [
                None if g else int(v)
                for g, v in zip(gone, rng.integers(3, size=len(rows)), strict=True)
            ]
            _, by_name = run(name, [categorical("noise", values)])
            flagged += by_name["noise"]["missing"]["differs"]
        print(f"  missing {inside:.1f} in group, {outside:.1f} elsewhere: flagged {flagged}/{reps}")


EXPERIMENTS = {
    "real": report_real,
    "null": report_null,
    "population": report_population,
    "missing": report_missing,
}


def main(arguments):
    experiment = EXPERIMENTS[arguments[0]]
    for name in arguments[1:] or TABLES:
        experiment(name)


if __name__ == "__main__":
    main(sys.argv[1:])

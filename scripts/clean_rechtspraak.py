"""Remove what a ruling's text repeats about its own court, court type and year.

The Rechtspraak columns `court`, `court_type` and `year` are echoed in the text: a header names the
court, the ECLI and case number carry the year, "Zittingsplaats Arnhem" gives the location. A map
built from that text partly rediscovers those columns, so the example text is cleaned of them, the
same way for every ruling (removing only a ruling's own court would make its absence a signal).

Nothing else changes: no names are scrubbed, and every column keeps its original value.

Usage: python3 scripts/clean_rechtspraak.py [input.json] [output.json]
Defaults: fixtures/rechtspraak-sample.json -> .cache/data-release/rechtspraak-sample.json
"""

import json
import re
import sys
from collections import Counter
from pathlib import Path

TEXT_FIELDS = ("summary", "ruling_excerpt")
COURT_TYPE_TERMS = (
    "college van beroep voor het bedrijfsleven",
    "centrale raad van beroep",
    "gerechtshof",
    "hoge raad",
    "raad van state",
    "rechtbank",
    "hof",
)


def patterns(rows):
    """The kinds of echo, each as a compiled expression, longest alternatives first."""
    courts = sorted({row["court"] for row in rows if row.get("court")}, key=len, reverse=True)
    return {
        "ecli": re.compile(r"\bECLI:NL:[A-Z]+:\d{4}:\d+\b"),
        "case number": re.compile(r"\b(?:19|20)\d{2}\d{4,}(?:/\d+)*(?:/[A-Za-z0-9]+)?\b"),
        "court": re.compile("|".join(re.escape(name) for name in courts), re.IGNORECASE),
        "court type": re.compile(
            r"\b(?:" + "|".join(re.escape(term) for term in COURT_TYPE_TERMS) + r")\b",
            re.IGNORECASE,
        ),
        "location": re.compile(r"\bZittingsplaats\s+[\w-]+", re.IGNORECASE),
        "year": re.compile(r"\b(?:19|20)\d{2}\b"),
    }


def clean(text, expressions, counts):
    for kind, expression in expressions.items():
        text, found = expression.subn(" ", text)
        counts[kind] += found
    return re.sub(r"\s+", " ", text).strip()


def main(source, destination):
    rows = json.loads(Path(source).read_text(encoding="utf-8"))
    expressions = patterns(rows)
    counts = Counter()
    for row in rows:
        for field in TEXT_FIELDS:
            row[field] = clean(row[field] or "", expressions, counts)
    Path(destination).parent.mkdir(parents=True, exist_ok=True)
    Path(destination).write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    summary = ", ".join(f"{kind} {count}" for kind, count in counts.most_common())
    print(f"Cleaned {len(rows)} rulings ({summary}); wrote {destination}")
    return dict(counts)


if __name__ == "__main__":
    arguments = sys.argv[1:]
    main(
        arguments[0] if arguments else "fixtures/rechtspraak-sample.json",
        arguments[1] if len(arguments) > 1 else ".cache/data-release/rechtspraak-sample.json",
    )

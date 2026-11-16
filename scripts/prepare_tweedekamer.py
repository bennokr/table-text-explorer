"""Build a Tweede Kamer motions sample from the open OData API (no key needed).

Writes fixtures/tweedekamer-motions-sample.json (ignored by Git). Raw responses are cached in
.cache/tweedekamer/. The sample takes WINDOWS blocks of PAGE motions spread evenly over 2017-2024,
so every year is present. The text is the motion's subject without the header that names the
submitters ("Motie van het lid X c.s. over ..."), which would give the party away.
"""

import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0/"
FILTER = (
    "Soort eq 'Motie' and Verwijderd eq false and GestartOp ge 2017-01-01T00:00:00Z"
    " and GestartOp lt 2025-01-01T00:00:00Z"
)
EXPAND = "Besluit($expand=Stemming($select=Soort)),ZaakActor"
WINDOWS = 36
PAGE = 100
CACHE = Path(".cache/tweedekamer")
OUTPUT = Path("fixtures/tweedekamer-motions-sample.json")


def get(path, **params):
    query = urllib.parse.urlencode(params, safe="$,()'/ ")
    request = urllib.request.Request(
        f"{BASE}{path}?{query}",
        headers={"User-Agent": "table-text-explorer-eval/1.0", "Accept": "application/json"},
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read()
        except OSError:
            time.sleep(3 * (attempt + 1))
    raise SystemExit(f"Could not fetch {path}")


def window(index, stride):
    """One cached block of motions, ordered by start date."""
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"window-{index}.json"
    if not path.exists():
        params = {"$filter": FILTER, "$orderby": "GestartOp", "$top": PAGE, "$expand": EXPAND}
        path.write_bytes(get("Zaak", **params, **{"$skip": index * stride}))
    return json.loads(path.read_text())["value"]


def final_decision(motion):
    """The vote's outcome: the first voting decision, since the list is unordered otherwise."""
    votes = [b for b in motion["Besluit"] if (b.get("BesluitSoort") or "").startswith("Stemmen - ")]
    votes.sort(key=lambda decision: decision.get("AgendapuntZaakBesluitVolgorde") or 0)
    if not votes:
        return None, None
    outcome = votes[0]["BesluitSoort"].removeprefix("Stemmen - ")
    kind = next((v["StemmingsSoort"] for v in votes if v.get("StemmingsSoort")), None)
    return ("aangehouden" if outcome.startswith("aangehouden") else outcome), kind


def record(motion):
    subject = (motion["Onderwerp"] or "").strip()
    about = re.search(r"\bover\b\s*(.*)$", subject, flags=re.IGNORECASE | re.DOTALL)
    submitters = [a for a in motion["ZaakActor"] if a["Relatie"] in ("Indiener", "Medeindiener")]
    lead = [a for a in motion["ZaakActor"] if a["Relatie"] == "Indiener"]
    outcome, vote_type = final_decision(motion)
    appreciation = motion["Kabinetsappreciatie"] or ""
    return {
        "id": motion["Nummer"],
        "year": motion["GestartOp"][:4],
        "text": (about.group(1) if about else subject).strip(),
        "dossier_title": motion["Titel"],
        "outcome": outcome,
        # Not recorded before April 2019: missing in a way that depends on the year.
        "appreciation": None if appreciation.startswith("Niet beschikbaar") else appreciation,
        "party": lead[0]["ActorFractie"] if lead else None,
        "submitters": len(submitters),
        "vote_type": vote_type,
    }


def main():
    total = int(get("Zaak/$count", **{"$filter": FILTER}))
    motions = {}
    for index in range(WINDOWS):
        for motion in window(index, total // WINDOWS):
            motions[motion["Id"]] = motion
    rows = [record(motion) for motion in motions.values()]
    rows = [row for row in rows if len(row["text"].split()) >= 3]
    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text(json.dumps(rows, ensure_ascii=False))
    print(f"Wrote {len(rows)} motions to {OUTPUT}")


if __name__ == "__main__":
    main()

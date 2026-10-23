"""Build local-only SAV expectations using native ReadStat, never an upload."""

import json
from pathlib import Path

import pandas as pd
import pyreadstat


def summarize(path):
    frame, metadata = pyreadstat.read_sav(path, user_missing=True)
    return {
        "columns": list(frame.columns),
        "rows": json.loads(frame.to_json(orient="values", double_precision=15)),
        "labels": metadata.column_names_to_labels,
        "value_labels": metadata.variable_value_labels,
        "missing_ranges": metadata.missing_ranges,
    }


def main():
    output = Path("public/reference")
    output.mkdir(parents=True, exist_ok=True)
    frame = pd.DataFrame(
        {
            "id": [1.0, 2.0, 3.0],
            "score": [1.0, 99.0, float("nan")],
            "text": ["Patiënt heeft rugpijn", "café naïef", "a" * 300],
        }
    )
    pyreadstat.write_sav(
        frame,
        str(output / "edge.sav"),
        column_labels={"score": "Beoordeling"},
        variable_value_labels={"score": {1: "Goed", 99: "Onbekend"}},
        missing_ranges={"score": [99]},
    )
    result = {
        "survey": summarize("fixtures/survey.sav"),
        "edge": summarize(str(output / "edge.sav")),
    }
    (output / "expected.json").write_text(json.dumps(result))
    print("Native ReadStat references prepared locally: survey + synthetic edge cases.")


if __name__ == "__main__":
    main()

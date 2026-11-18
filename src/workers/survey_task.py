"""The survey-answers input: respondents become coordinates that follow the survey distance.

The page sends the columns (values, codebook group, weight and the state of every cell), the
pooled text vectors through bridge.py and the settings. The reply is a dense embedding of at most
32 dimensions (a metric embedding of the distance), like every other prepared input, so maps and
clusterings need nothing new, plus a few diagnostics.
"""

import json

import bridge
import numpy as np
import survey_distance as survey

MAX_RECORDS = 3000  # The distance is a dense matrix; larger tables need row blocks.
COMPONENTS = 32
NEIGHBOURS = 15
GRAPH_NEIGHBOURS = 100  # The most the UMAP neighbours setting allows.


def text_input(data, size):
    """(pooled vectors, has_text) from the vectors the page embedded, or None without any."""
    rows = data["textRows"]
    if not rows:
        return None
    vectors = np.asarray(bridge.values(), np.float32).reshape(len(rows), -1)
    pooled = np.zeros((size, vectors.shape[1]), np.float32)
    pooled[rows] = vectors
    has = np.zeros(size, bool)
    has[rows] = True
    return pooled, has


def diagnostics(distance, data, result):
    """How much of the map's neighbourhood structure a map of the blanks alone would also have."""
    states = [column["states"] for column in [*data["columns"], *data["textColumns"]]]
    size = len(distance)
    shared = survey.neighbour_overlap(distance, survey.missingness_distance(states), NEIGHBOURS)
    return {
        "records": size,
        "unsupportedPairs": result["unsupported"],
        "neighboursSharedWithMissingness": round(shared, 3),
        "chance": round(NEIGHBOURS / (size - 1), 3),
    }


def run_survey_prepare(payload):
    data = json.loads(payload)
    size = data["rows"]
    if size > MAX_RECORDS:
        raise ValueError(f"Survey answers support up to {MAX_RECORDS:,} records for now.")
    if size < 4:
        raise ValueError("Survey answers need at least four records.")
    options = data["options"]
    text = text_input(data, size)
    weights = {"text": options["textWeight"] if text else 0.0}
    result = survey.survey_distance(
        data["columns"],
        text,
        weights,
        rare=0.8 if options["common"] else 0,
        balance=options["balance"],
    )
    embedding = survey.classical_mds(result["distance"], COMPONENTS)
    indices, distances = survey.neighbour_graph(result["distance"], GRAPH_NEIGHBOURS)
    return json.dumps(
        {
            "features": embedding.tolist(),
            "dimensions": embedding.shape[1],
            "neighbours": {"indices": indices.tolist(), "distances": distances.tolist()},
            "survey": diagnostics(result["distance"], data, result),
        },
        allow_nan=False,
    )

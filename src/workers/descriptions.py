"""Phrase and metadata descriptions share populations, evidence and filter ASTs."""

import json

import bridge
from facets import describe_facets, prepare_facets
from term_ranking import POPULATION_RANKINGS, embedding_population
from terms import describe_terms


def describe_population(data, facets, embeddings, phrases):
    result = {
        "subset": len(data["subset"]),
        "comparison": len(data["comparison"]),
        "ranking": data["ranking"],
        "fields": [],
    }
    if data.get("indexId") and data["content"] != "facets":
        result = json.loads(phrases(json.dumps(data)))
    if facets is not None:
        result["facets"] = describe_facets(facets, data, embeddings)
    return result


def describe_descriptions(payload, phrases=None, vectors=None):
    data = json.loads(payload)
    if (
        data["ranking"] not in {"ctfidf", "contrast", "lift"} | POPULATION_RANKINGS
        or data["support"] < 1
    ):
        raise ValueError("Choose a ranking and positive record support.")
    facets = prepare_facets(data.pop("facets", None))
    embeddings = embedding_population(data, vectors if vectors is not None else bridge.values())
    phrases = phrases or describe_terms
    groups = data.get("groups")
    if groups is None:
        return json.dumps(describe_population(data, facets, embeddings, phrases), allow_nan=False)
    result = [
        {
            **group,
            "description": describe_population({**data, **group}, facets, embeddings, phrases),
        }
        for group in groups
    ]
    return json.dumps({"groups": result}, allow_nan=False)

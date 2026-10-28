"""Phrase evidence and bounded joint naming; independent of the inspector index."""

import json
import re
import unicodedata

import numpy as np
from text_indexes import get_text_index


def name_words(text):
    normalized = unicodedata.normalize("NFKC", text).casefold().replace("\u2019", "'")
    return set(re.findall(r"[^\W_]+(?:'[^\W_]+)*", normalized))


def phrase_evidence(name, field, subset, comparison):
    if field is None or not subset:
        return []
    matrix = field["matrix"]
    scores = globals()["describe_counts"](matrix, subset, comparison)
    coverage = scores["support"] / len(subset)
    background = scores["rest"] / max(1, len(comparison))
    values = (coverage - background) * coverage
    order = np.argsort(-values, kind="stable")[:100]
    candidates = []
    for column in order:
        phrase = str(field["terms"][column])
        words = name_words(phrase)
        support = int(scores["support"][column])
        if not usable_phrase(phrase, words, support, len(subset)) or values[column] <= 0:
            continue
        ids = matrix[subset, column].nonzero()[0]
        candidates.append(
            {
                "kind": "phrase",
                "field": name,
                "phrase": phrase,
                "words": sorted(words),
                "support": support,
                "comparisonSupport": int(scores["rest"][column]),
                "subsetSize": len(subset),
                "comparisonSize": len(comparison),
                "score": float(values[column]) / (1 + 0.25 * (len(phrase.split()) - 1)),
                "matches": [subset[int(index)] for index in ids],
            }
        )
    return candidates


def usable_phrase(phrase, words, support, size):
    return (
        0 < len(phrase) <= 36
        and 1 <= len(phrase.split()) <= 5
        and all(any(letter.isalpha() for letter in word) for word in words)
        and support >= min(2, size)
    )


def name_candidates(group, fields):
    candidates = []
    for name, field in fields.items():
        candidates.extend(phrase_evidence(name, field, group["subset"], group["comparison"]))
    candidates.sort(
        key=lambda candidate: (-candidate["score"], candidate["phrase"], candidate["field"])
    )
    return candidates[:24]


def name_bundles(candidates, counts):
    bundles = []
    for seed in candidates:
        chosen = [seed]
        used = set(seed["words"])
        for candidate in candidates:
            if len(chosen) >= counts[1]:
                break
            if used.isdisjoint(candidate["words"]):
                chosen.append(candidate)
                used.update(candidate["words"])
        if len(chosen) >= counts[0]:
            bundles.append(
                {
                    "kind": "phrases",
                    "phrase": " · ".join(item["phrase"] for item in chosen),
                    "phrases": chosen,
                    "words": sorted(used),
                    "score": sum(item["score"] for item in chosen),
                }
            )
    return bundles


def extend_names(states, group, candidates):
    blocked = set().union(*(name_words(name) for name in group.get("blocked", [])))
    expanded = []
    for score, used, labels in states:
        for candidate in [*candidates, fallback_name(group, used | blocked)]:
            words = set(candidate["words"])
            if words & (used | blocked):
                continue
            expanded.append(
                (score + candidate["score"], used | words, {**labels, group["id"]: candidate})
            )
    expanded.sort(key=lambda state: -state[0])
    return expanded[:32]


def fallback_name(group, blocked):
    base = f"#{int(group['id']) + 1}"
    name = base
    suffix = 2
    while name_words(name) & blocked:
        name = f"{base}v{suffix}"
        suffix += 1
    return {"phrase": name, "words": sorted(name_words(name)), "score": 0}


def choose_names(groups, fields, counts=None):
    locked = [group["name"] for group in groups if group.get("locked")]
    reserved = set().union(name_words("Other"), *(name_words(name) for name in locked))
    states = [(0, reserved, {})]
    for group in groups:
        if not group.get("locked"):
            candidates = name_candidates(group, fields)
            if counts is not None:
                candidates = name_bundles(candidates, counts)
            states = extend_names(states, group, candidates)
    return states[0][2]


def name_clusters(payload):
    data = json.loads(payload)
    fields = get_text_index(data["indexId"])["fields"]
    maximum = data.get("maxPhrases", 4)
    if not isinstance(maximum, int) or not 1 <= maximum <= 5:
        raise ValueError("Choose a maximum of one to five phrases per name.")
    labels = choose_names(data["groups"], fields, [1, maximum])
    return json.dumps({"labels": labels}, allow_nan=False)

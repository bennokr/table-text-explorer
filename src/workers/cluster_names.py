"""Phrase evidence and bounded joint naming; independent of the inspector index."""

import json
import re
import unicodedata

import numpy as np
from terms import describe_counts
from text_indexes import get_text_index

# Function words and negations say nothing about a topic. Names avoid the lexicon's stop, lead and
# negation words at the edges, so "niet echt" or "over de" never name a cluster, but "zorg voor
# kinderen" can. Words are compared by their folded key, so "boek" in one name blocks "boeken".
NO_VOCAB = {"blocked": frozenset(), "fold": lambda word: word}
GENERIC_COVERAGE = 0.35  # In over a third of the other records: not distinctive.


def ordered_words(text):
    normalized = unicodedata.normalize("NFKC", text).casefold().replace("\u2019", "'")
    return re.findall(r"[^\W_]+(?:'[^\W_]+)*", normalized)


def name_words(text, fold=NO_VOCAB["fold"]):
    return {fold(word) for word in ordered_words(text)}


def stop_edges(phrase, blocked):
    tokens = ordered_words(phrase)
    return bool(tokens) and (tokens[0] in blocked or tokens[-1] in blocked)


def only_stopwords(phrase, blocked):
    return all(token in blocked for token in ordered_words(phrase))


def phrase_evidence(name, field, group, vocab, strict=True):
    """Candidate names: strict ones avoid generic words, loose ones are a last resort."""
    subset, comparison = group["subset"], group["comparison"]
    if field is None or not subset:
        return []
    matrix = field["matrix"]
    scores = describe_counts(matrix, subset, comparison)
    coverage = scores["support"] / len(subset)
    background = scores["rest"] / max(1, len(comparison))
    values = (coverage - background) * coverage
    order = np.argsort(-values, kind="stable")[:100]
    candidates = []
    for column in order:
        phrase = str(field["terms"][column])
        words = name_words(phrase, vocab["fold"])
        support = int(scores["support"][column])
        if not usable_phrase(phrase, words, support, len(subset)) or values[column] <= 0:
            continue
        if not acceptable(phrase, background[column], strict, vocab["blocked"]):
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
                **({} if strict else {"loose": True}),
            }
        )
    return candidates


def acceptable(phrase, background, strict, blocked):
    if strict:
        return not stop_edges(phrase, blocked) and background <= GENERIC_COVERAGE
    return not only_stopwords(phrase, blocked)


def usable_phrase(phrase, words, support, size):
    return (
        0 < len(phrase) <= 36
        and 1 <= len(phrase.split()) <= 5
        and all(any(letter.isalpha() for letter in word) for word in words)
        and support >= min(2, size)
    )


def name_candidates(group, fields, vocab):
    candidates = []
    for name, field in fields.items():
        candidates.extend(phrase_evidence(name, field, group, vocab))
    candidates.sort(
        key=lambda candidate: (-candidate["score"], candidate["phrase"], candidate["field"])
    )
    return candidates[:24]


def loose_candidates(group, fields, vocab):
    """Names that may repeat words of other names or be common; used when no strict name fits."""
    candidates = []
    for name, field in fields.items():
        candidates.extend(phrase_evidence(name, field, group, vocab, strict=False))
    candidates.sort(key=lambda item: (-item["score"], item["phrase"], item["field"]))
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
                    **({"loose": True} if seed.get("loose") else {}),
                }
            )
    return bundles


def fits(candidate, used, fixed, taken):
    """Strict names share no word with another; loose ones avoid only locked and sibling words."""
    words = set(candidate["words"])
    if candidate.get("loose"):
        return not words & fixed and candidate["phrase"] not in taken
    return not words & used


def extend_names(states, group, options, fixed, fold):
    candidates, loose = options
    blocked = set().union(*(name_words(name, fold) for name in group.get("blocked", [])))
    expanded = []
    for score, used, labels in states:
        taken = {label["phrase"] for label in labels.values()}
        options = [*candidates, *({**item, "score": item["score"] - 1} for item in loose)]
        for candidate in [*options, fallback_name(group, used | blocked)]:
            if not fits(candidate, used | blocked, fixed | blocked, taken):
                continue
            words = set(candidate["words"])
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
    return {"phrase": name, "words": sorted(name_words(name)), "score": -10}


def choose_names(groups, fields, counts=None, vocab=NO_VOCAB):
    fold = vocab["fold"]
    locked = [group["name"] for group in groups if group.get("locked")]
    reserved = set().union(name_words("Other", fold), *(name_words(name, fold) for name in locked))
    states = [(0, reserved, {})]
    for group in groups:
        if not group.get("locked"):
            candidates = name_candidates(group, fields, vocab)
            loose = loose_candidates(group, fields, vocab)
            if counts is not None:
                candidates = name_bundles(candidates, counts)
                loose = name_bundles(loose, [1, counts[1]])
            states = extend_names(states, group, (candidates, loose), reserved, fold)
    return states[0][2]


def name_clusters(payload):
    data = json.loads(payload)
    entry = get_text_index(data["indexId"])
    fields = entry["fields"]
    maximum = data.get("maxPhrases", 4)
    if not isinstance(maximum, int) or not 1 <= maximum <= 5:
        raise ValueError("Choose a maximum of one to five phrases per name.")
    labels = choose_names(data["groups"], fields, [1, maximum], entry["vocab"])
    return json.dumps({"labels": labels}, allow_nan=False)

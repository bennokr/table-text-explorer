"""Names for survey clusters from the answers that set each cluster apart.

An answer ("Question: value") is distinctive for a cluster when many of its members give it and
few other respondents do, the same measure that ranks phrases. A name joins the best answers to
different questions; a cluster with no distinctive answer keeps its number.
"""

import json

import numpy as np
from scipy.sparse import csc_matrix

MIN_SUPPORT = 3  # Members who must give an answer for it to name a cluster.
MIN_COVERAGE = 0.2  # Share of the cluster's members who must give it.
COMMON = 0.5  # An answer half the other respondents give says nothing about this cluster.


def answer_matrix(answers, rows):
    """Records by answers, 1 where the record gave that answer."""
    indices = [record for answer in answers for record in answer["ids"]]
    pointers = np.cumsum([0] + [len(answer["ids"]) for answer in answers])
    return csc_matrix((np.ones(len(indices)), indices, pointers), shape=(rows, len(answers)))


def distinctive(group, matrix, answers):
    """Candidate answers for one cluster, best first, at most one per question."""
    subset, comparison = group["subset"], group["comparison"]
    support = np.asarray(matrix[subset].sum(axis=0)).ravel()
    rest = np.asarray(matrix[comparison].sum(axis=0)).ravel()
    coverage = support / max(1, len(subset))
    background = rest / max(1, len(comparison))
    score = (coverage - background) * coverage
    usable = (support >= MIN_SUPPORT) & (coverage >= MIN_COVERAGE) & (background < COMMON)
    chosen, questions = [], set()
    for column in np.argsort(-score, kind="stable"):
        question = answers[column]["question"]
        if not usable[column] or score[column] <= 0 or question in questions:
            continue
        questions.add(question)
        chosen.append(
            {
                "phrase": answers[column]["text"],
                "question": question,
                "support": int(support[column]),
                "subsetSize": len(subset),
                "comparisonSupport": int(rest[column]),
                "comparisonSize": len(comparison),
                "score": float(score[column]),
            }
        )
    return chosen


def name_groups(payload):
    data = json.loads(payload)
    answers = data["answers"]
    matrix = answer_matrix(answers, data["rows"])
    maximum = data.get("maxPhrases", 4)
    labels, taken = {}, set()
    for group in data["groups"]:
        if group.get("locked"):
            continue
        candidates = distinctive(group, matrix, answers)
        for size in range(maximum, 0, -1):
            parts = candidates[:size]
            phrase = " · ".join(part["phrase"] for part in parts)
            if parts and phrase not in taken:
                taken.add(phrase)
                labels[group["id"]] = {"kind": "phrases", "phrase": phrase, "phrases": parts}
                break
    return json.dumps({"labels": labels}, allow_nan=False)

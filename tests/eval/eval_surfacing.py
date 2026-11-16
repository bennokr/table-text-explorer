"""Do unsupervised split rankings surface the known structure?

The app can rank phrases by how evenly they split a population ("balanced splits") or by how much
of the embedding variation their presence explains ("semantic splits"). Neither looks at any
annotation. This asks whether the top phrases nevertheless line up with the gold columns.

For each phrase, information is the share of a gold column's entropy that the phrase's presence
explains (mutual information divided by label entropy). The percentile compares a top phrase with
all phrases of similar document frequency, so 50 means no better than a random phrase of the
same frequency, and 100 means better than all of them.
"""

import numpy as np
from eval_descriptions import top_phrases

TOP = 15  # The app shows at most 15 phrases.
MIN_DOCS = 2  # The app's default minimum matching records.
RANKINGS = ["frequency", "balanced", "semantic"]
AXES = 3  # Main directions of variation of the 32-d vectors offered as "text axes".
AXIS_SIDE = 8  # Phrases kept for each side of an axis (about the 15 the app shows).
RANDOM_AXES = 5  # Random directions and random record splits, as controls for the axes.


def phrase_information(presence, labels):
    """Mutual information of each phrase's presence with the labels, over label entropy."""
    groups, inverse = np.unique(labels, return_inverse=True)
    onehot = np.eye(len(groups))[inverse]
    size, records = onehot.sum(axis=0), len(labels)
    with_phrase = np.asarray(presence.T @ onehot)
    phrase_docs = with_phrase.sum(axis=1, keepdims=True)
    information = np.zeros(len(with_phrase))
    for joint, marginal in (
        (with_phrase, phrase_docs),
        (size - with_phrase, records - phrase_docs),
    ):
        with np.errstate(divide="ignore", invalid="ignore"):
            terms = joint / records * np.log(joint * records / (marginal * size))
        information += np.nansum(terms, axis=1)
    return information / -(size / records * np.log(size / records)).sum()


def percentile_among_similar(columns, docs, information):
    """For each chosen phrase, the share of same-frequency phrases it beats."""
    result = []
    for column in columns:
        similar = (docs >= 0.8 * docs[column]) & (docs <= 1.25 * docs[column]) & (docs >= MIN_DOCS)
        result.append(float(np.mean(information[similar] < information[column])))
    return float(np.mean(result)) * 100


def ranked_columns(subject, ranking):
    everyone = np.arange(len(subject.rows))
    extra = None
    if ranking == "semantic":
        import bridge

        bridge.embedding_values = subject.embeddings.ravel()
        extra = {
            "embeddingDimensions": subject.embeddings.shape[1],
            "embeddingRowIds": everyone.tolist(),
        }
    phrases = top_phrases(subject, everyone, everyone[:0], ranking, extra)[:TOP]
    return phrases, [subject.field["lookup"][phrase] for phrase in phrases]


def axis_scores(features, seed):
    """Record scores on the main axes of variation, then on random directions as a control."""
    centered = features - features.mean(axis=0)
    u, singular, _ = np.linalg.svd(centered, full_matrices=False)
    scores = {f"axis {k + 1}": u[:, k] * singular[k] for k in range(AXES)}
    rng = np.random.default_rng(seed)
    for k in range(RANDOM_AXES):
        scores[f"random axis {k + 1}"] = centered @ rng.normal(size=centered.shape[1])
        scores[f"null split {k + 1}"] = rng.random(
            len(features)
        )  # A true null: unrelated to the text.
    return scores


def split_phrases(subject, scores):
    """Contrast phrases for both sides of a median split of the records on one score."""
    high = np.flatnonzero(scores > np.median(scores))
    low = np.flatnonzero(scores <= np.median(scores))
    phrases = top_phrases(subject, high, low, "contrast")[:AXIS_SIDE]
    phrases += top_phrases(subject, low, high, "contrast")[:AXIS_SIDE]
    return phrases, [subject.field["lookup"][phrase] for phrase in phrases]


def evaluate_surfacing(subject):
    presence = (subject.field["matrix"] > 0).astype(np.float32).tocsc()
    docs = np.asarray(presence.sum(axis=0)).ravel()
    available = [r for r in RANKINGS if r != "semantic" or subject.embeddings is not None]
    chosen = {ranking: ranked_columns(subject, ranking) for ranking in available}
    for name, scores in axis_scores(subject.features, subject.seed).items():
        chosen[name] = split_phrases(subject, scores)
    results = {}
    for level, column in subject.manifest["hierarchy"].items():
        labels = np.array([str(row[column]) for row in subject.rows])
        information = phrase_information(presence, labels)
        eligible = np.flatnonzero(docs >= MIN_DOCS)
        results[level] = {
            "best_possible": float(np.sort(information[eligible])[-TOP:].mean()),
            "typical": float(information[eligible].mean()),
            "rankings": {
                ranking: {
                    "information": float(information[columns].mean()),
                    "percentile": percentile_among_similar(columns, docs, information),
                    "phrases": phrases,
                }
                for ranking, (phrases, columns) in chosen.items()
            },
        }
    return results

# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = [
#   "numpy==1.26.4", "scikit-learn==1.7.0", "scipy", "umap-learn",
#   "numba==0.60.0", "llvmlite==0.43.0",
# ]
# ///
"""How stable and how missingness-free are the clusters of a survey distance?

Works on any table with a codebook.

Inputs: records (JSON array), a Table Schema with x-linked-codebook (levels, groups,
applies_when), the cell states from `node scripts/routing_states.mjs`, and optionally answer
embeddings from `tests/eval/embed.mjs` (one text per answered free-text cell, in the order that
`--write-items` lists them) and known labels.

    uv run --script tests/eval/survey_stability.py --records rows.json --schema schema.json \
        --states states.json \
        [--embeddings prefix] [--labels labels.json] [--groups REGEX] [--out report.json]
"""

import argparse
import collections
import json
import re
import sys
from pathlib import Path

import numpy as np
from sklearn.cluster import HDBSCAN, AgglomerativeClustering, KMeans, SpectralClustering
from sklearn.metrics import adjusted_rand_score, normalized_mutual_info_score

sys.path.insert(0, str(Path(__file__).parents[2] / "src/workers"))
import survey_distance as survey

NEIGHBOURS = 15


def read_json(path):
    return json.loads(Path(path).read_text())


def column_kind(field):
    """nominal, ordinal, numeric or text for a Table Schema field; None for an identifier."""
    extension = field.get("x-linked-codebook", {})
    if extension.get("identifying"):
        return None
    if field["type"] == "string" and not field.get("categories"):
        return "text"
    if field.get("categories") or extension.get("level") in ("nominal", "ordinal"):
        ordered = extension.get("level") == "ordinal" or field.get("categoriesOrdered")
        return "ordinal" if ordered else "nominal"
    return "numeric"


def text_fields(fields, rows):
    """Free-text columns: strings of two or more words on average."""
    names = []
    for field in fields:
        if column_kind(field) != "text":
            continue
        answers = [
            str(row[field["name"]]) for row in rows if row.get(field["name"]) not in (None, "")
        ]
        if answers and np.mean([len(text.split()) for text in answers]) >= 2:
            names.append(field["name"])
    return names


def question(field):
    return (field.get("description") or field.get("title") or field["name"]).strip()


def text_items(fields, rows, states):
    """One text per answered free-text cell, led by its question, plus who wrote it."""
    items, owners = [], []
    by_name = {field["name"]: field for field in fields}
    for name in text_fields(fields, rows):
        for index, row in enumerate(rows):
            if states[name][index] == survey.ANSWERED:
                items.append({"text": f"{question(by_name[name])} {row[name]}"})
                owners.append(index)
    return items, owners


def scale_bounds(field):
    """The declared range of an ordinal or numeric column: constraints, else category codes."""
    bounds = field.get("constraints", {})
    codes = [c["value"] if isinstance(c, dict) else c for c in field.get("categories", [])]
    low = bounds.get("minimum", min(codes) if codes else None)
    high = bounds.get("maximum", max(codes) if codes else None)
    return {} if low is None or high is None else {"low": low, "high": high}


def structured_columns(fields, rows, states, pattern):
    """Columns for the distance, restricted to codebook groups matching the pattern."""
    columns = []
    for field in fields:
        kind = column_kind(field)
        group = field.get("x-linked-codebook", {}).get("group", "")
        if kind in (None, "text") or (pattern and not pattern.search(group)):
            continue
        name = field["name"]
        values = [row.get(name) for row in rows]
        columns.append(
            {
                "name": name,
                "kind": kind,
                "group": group,
                "states": states[name],
                "values": values,
                **scale_bounds(field),
            }
        )
    return columns


def neighbours(distance, count=NEIGHBOURS):
    return survey.nearest(distance, count)


def overlap(first, second):
    return float(
        np.mean([len(set(a) & set(b)) / len(a) for a, b in zip(first, second, strict=True)])
    )


def cluster(distance, method, size):
    """Cluster labels (-1 is unassigned). Methods: hdbscan, average-K, spectral-K, mds-K."""
    kind, _, count = method.partition("-")
    if kind == "hdbscan":
        model = HDBSCAN(
            min_cluster_size=max(15, size // 50), min_samples=5, metric="precomputed", copy=True
        )
        return model.fit_predict(distance.astype(np.float64))
    if kind == "average":
        model = AgglomerativeClustering(
            n_clusters=int(count), metric="precomputed", linkage="average"
        )
        return model.fit_predict(distance)
    if kind == "spectral":
        model = SpectralClustering(
            n_clusters=int(count),
            affinity="precomputed_nearest_neighbors",
            n_neighbors=NEIGHBOURS,
            random_state=0,
        )
        return model.fit_predict(distance.astype(np.float64))
    return KMeans(n_clusters=int(count), n_init=10, random_state=0).fit_predict(
        survey.classical_mds(distance, 10)
    )


def jaccard(first, second):
    return len(first & second) / max(len(first | second), 1)


def cluster_stability(distance, labels, method, settings):
    """Mean best Jaccard of each cluster over subsample re-clusterings (Hennig's measure)."""
    size = len(labels)
    rounds, fraction, rng = settings["rounds"], settings["fraction"], settings["rng"]
    members = {c: set(np.where(labels == c)[0]) for c in set(labels) - {-1}}
    scores = collections.defaultdict(list)
    for _ in range(rounds):
        chosen = np.sort(rng.choice(size, int(fraction * size), replace=False))
        sub = cluster(distance[np.ix_(chosen, chosen)], method, len(chosen))
        found = [set(chosen[sub == c]) for c in set(sub) - {-1}]
        for c, group in members.items():
            kept = group & set(chosen)
            scores[c].append(max((jaccard(kept, other) for other in found), default=0.0))
    return {int(c): round(float(np.mean(values)), 3) for c, values in scores.items()}


def map_runs(distance, seeds, neighbour_counts):
    import umap  # heavy, and only needed here

    return {
        (seed, count): umap.UMAP(
            metric="precomputed", n_neighbors=count, min_dist=0.15, random_state=seed
        ).fit_transform(distance)
        for seed in seeds
        for count in neighbour_counts
    }


def map_agreement(maps):
    """Mean neighbour overlap between maps that differ in seed only, and in n_neighbors only."""
    keys = list(maps)
    graphs = {
        key: neighbours(np.linalg.norm(maps[key][:, None] - maps[key][None], axis=2))
        for key in keys
    }
    same_count = [
        overlap(graphs[a], graphs[b]) for a in keys for b in keys if a < b and a[1] == b[1]
    ]
    same_seed = [
        overlap(graphs[a], graphs[b]) for a in keys for b in keys if a < b and a[0] == b[0]
    ]
    return {
        "across_seeds": round(float(np.mean(same_count)), 3),
        "across_n_neighbors": round(float(np.mean(same_seed)), 3),
    }


def agreement_with_truth(labels, truth):
    return {
        "ari": round(float(adjusted_rand_score(truth, labels)), 3),
        "nmi": round(float(normalized_mutual_info_score(truth, labels)), 3),
    }


def build(args):
    rows = read_json(args.records)
    schema = read_json(args.schema)
    states = read_json(args.states)["states"]
    fields = schema["fields"]
    pattern = re.compile(args.groups) if args.groups else None
    columns = structured_columns(fields, rows, states, pattern)
    items, owners = text_items(fields, rows, states)
    if args.write_items:
        Path(args.write_items).write_text(json.dumps(items))
        sys.exit(
            f"wrote {len(items)} texts to {args.write_items}; embed them with tests/eval/embed.mjs"
        )
    text = None
    if args.embeddings:
        vectors = np.fromfile(args.embeddings + ".f32", dtype=np.float32).reshape(len(items), -1)
        pooled, has, _ = survey.pool_text(vectors, owners, len(rows))
        text = (pooled, has)
    return rows, columns, states, text


def parse_arguments():
    parser = argparse.ArgumentParser()
    for name in ("records", "schema", "states"):
        parser.add_argument(f"--{name}", required=True)
    for name in ("embeddings", "labels", "groups", "write-items", "out"):
        parser.add_argument(f"--{name}")
    parser.add_argument("--text-weight", type=float, default=0.35)
    parser.add_argument("--rounds", type=int, default=20)
    parser.add_argument("--seeds", type=int, default=3, help="UMAP seeds; 0 skips the maps")
    parser.add_argument("--methods", default="hdbscan,average-6,spectral-5,mds-5")
    return parser.parse_args()


def evaluate_method(distance, method, settings):
    """Clusters, their stability under subsampling and, with known labels, their agreement."""
    labels = cluster(distance, method, len(distance))
    stability = cluster_stability(distance, labels, method, settings)
    mean = round(float(np.mean(list(stability.values()))), 3) if stability else None
    truth = settings["truth"]
    return {
        "clusters": len(set(labels) - {-1}),
        "unassigned": int((labels == -1).sum()),
        "stability": stability,
        "mean_stability": mean,
        **(agreement_with_truth(labels, truth) if truth is not None else {}),
    }


def main():
    args = parse_arguments()
    rows, columns, states, text = build(args)
    result = survey.survey_distance(columns, text, {"text": args.text_weight if text else 0.0})
    distance = result["distance"]
    shared = survey.neighbour_overlap(
        distance, survey.missingness_distance([states[name] for name in states]), NEIGHBOURS
    )
    report = {
        "respondents": len(rows),
        "columns": len(columns),
        "unsupported_pairs": result["unsupported"],
        "overlap_with_missingness_only": round(shared, 3),
        "chance_overlap": round(NEIGHBOURS / (len(rows) - 1), 3),
        "methods": {},
    }
    settings = {
        "rounds": args.rounds,
        "fraction": 0.8,
        "rng": np.random.default_rng(0),
        "truth": np.array(read_json(args.labels)) if args.labels else None,
    }
    for method in args.methods.split(","):
        report["methods"][method] = evaluate_method(distance, method, settings)
    if args.seeds:
        report["maps"] = map_agreement(map_runs(distance, range(args.seeds), (15, 40, 80)))
    print(json.dumps(report, indent=1))
    if args.out:
        Path(args.out).write_text(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()

# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["numpy==1.26.4", "scikit-learn==1.7.0"]
# ///
"""Before and after the lexicon: variants and empty words in the examples' clouds and cluster names.

Runs the worker modules natively on each example's text and its shipped clustering
(demo-config/<table>/results.json). "Before" is what the app did previously: a 38-word Dutch
stoplist (negations kept), no lead words, no folding, and a separate 90-word list for names.
"After" is src/lexicon/nl. Both are measured with the same yardstick, the new lexicon, so the
numbers compare; the yardstick is also what "after" is built from, so empty words and variants
fall to zero by construction. The "before" column is the finding, and the prefix proxy is the one
number that does not use the lexicon.

    uv run --script tests/eval/lexicon_report.py [fixtures directory]
"""

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).parents[2]
sys.path.insert(0, str(ROOT / "src/workers"))
sys.path.insert(0, str(ROOT / "tests"))

import cluster_names  # noqa: E402
import terms  # noqa: E402
from fold import compile_fold, fold_phrase  # noqa: E402
from lexicon_reader import payload, read_words  # noqa: E402

TABLES = {
    "dbrd-test.json": "text",
    "rechtspraak-sample.json": "summary",
    "tweedekamer-motions-sample.json": "text",
}
# The previous Dutch list, without "niet": negations were kept.
OLD_STOPWORDS = (
    "de",
    "het",
    "een",
    "en",
    "van",
    "in",
    "op",
    "te",
    "dat",
    "die",
    "is",
    "was",
    "voor",
    "met",
    "aan",
    "er",
    "om",
    "als",
    "ik",
    "je",
    "hij",
    "zij",
    "wij",
    "maar",
    "ook",
    "dan",
    "dit",
    "zijn",
    "wordt",
    "door",
    "bij",
    "naar",
    "tot",
    "uit",
    "heeft",
    "hebben",
)
OLD_NAMING = frozenset(
    re.findall(
        r"\w+",
        """de het een en van in op te dat die is was voor met aan er om als ik je hij zij wij ze
we niet maar ook dan dit zijn wordt door bij naar tot uit heeft hebben had heb of over
geen nog wel meer veel zo zich deze kan zal moet worden werd hun hem haar mij me u uw
nu al toch hoe wat wie waar onder tegen tussen na zonder alle alles even eens niets
nooit nl dus the a an and on to that for with at as i you he she not but also then this
are be by from has have or no it its""",
    )
)
TOP = 15
MAX_ROWS = 3600


def load(table, directory):
    for folder in (directory, ROOT / "examples"):
        path = Path(folder) / table
        if path.exists():
            return json.loads(path.read_text())
    raise SystemExit(f"{table} not found; pass the fixtures directory (default public/fixtures)")


def build(rows, field, lexicon):
    texts = [str(row.get(field) or "") for row in rows]
    request = {
        "rows": len(texts),
        "indexId": "report",
        "cacheKey": json.dumps(
            [field, len(texts), sorted(lexicon["stopwords"])[:5], lexicon["fold"] is None]
        ),
        "sizes": [1, 3],
        "columns": [{"name": field, "texts": texts}],
        **lexicon,
    }
    request["indexId"] = request["cacheKey"]
    terms.build_term_index(json.dumps(request))
    return request["indexId"]


def describe(index, subset, comparison, ranking):
    request = {
        "indexId": index,
        "subset": subset,
        "comparison": comparison,
        "ranking": ranking,
        "support": 2,
    }
    result = json.loads(terms.describe_terms(json.dumps(request)))
    return [term["phrase"] for term in result["fields"][0]["terms"]][:TOP]


def yardstick():
    stop, lead, negation = (set(read_words("nl", kind)) for kind in ("stop", "lead", "negation"))
    return {
        "stop": stop,
        "lead": lead,
        "negation": negation,
        "fold": compile_fold(payload("nl")["fold"]),
    }


def prefix_pairs(phrases, length=5):
    """Pairs of different words that share their first letters: inflections folding may miss.
    An upper bound, not a measure of errors (onderwijs/onderwerp also share a prefix)."""
    words = {word for phrase in phrases for word in phrase.split() if len(word) > length}
    stems = Counter(word[:length] for word in words)
    return sum(count * (count - 1) // 2 for count in stems.values())


def empty_words(phrase, ruler):
    """Whether the phrase breaks the new rules: an empty word alone, or at an edge."""
    tokens = phrase.split()
    first_bad = tokens[0] in ruler["stop"]
    last_bad = tokens[-1] in ruler["stop"] or tokens[-1] in ruler["lead"]
    return first_bad or last_bad


def variant_pairs(phrases, ruler):
    keys = Counter(fold_phrase(phrase, ruler["fold"]) for phrase in phrases)
    return sum(count * (count - 1) // 2 for count in keys.values())


def cloud_metrics(index, labels, ruler):
    by_cluster = defaultdict(list)
    for row, label in enumerate(labels):
        if label is not None:
            by_cluster[label].append(row)
    everyone = sorted(row for rows in by_cluster.values() for row in rows)
    lists = [
        describe(index, rows, sorted(set(everyone) - set(rows)), "contrast")
        for rows in by_cluster.values()
    ]
    common = describe(index, everyone, [], "frequency")
    return {
        "variant pairs per cluster cloud": sum(variant_pairs(item, ruler) for item in lists)
        / len(lists),
        "clusters with a variant pair": sum(variant_pairs(item, ruler) > 0 for item in lists),
        "word pairs sharing a 5-letter prefix per cluster cloud (proxy)": sum(
            prefix_pairs(item) for item in lists
        )
        / len(lists),
        "empty-word phrases per cluster cloud": sum(
            empty_words(p, ruler) for item in lists for p in item
        )
        / len(lists),
        "empty-word phrases in the common cloud": sum(
            empty_words(phrase, ruler) for phrase in common
        ),
        "negation phrases in the common cloud": sum(
            phrase in ruler["negation"] for phrase in common
        ),
    }, common


def naming(index, labels, vocab_override=None):
    groups = []
    for cluster in sorted({label for label in labels if label is not None}):
        subset = [row for row, label in enumerate(labels) if label == cluster]
        comparison = [row for row, label in enumerate(labels) if label not in (None, cluster)]
        groups.append(
            {
                "id": str(cluster),
                "name": f"#{cluster + 1}",
                "subset": subset,
                "comparison": comparison,
            }
        )
    payload_ = {"indexId": index, "groups": groups, "maxPhrases": 4}
    entry = terms.get_text_index(index)
    saved = entry["vocab"]
    if vocab_override:
        entry["vocab"] = vocab_override
    try:
        result = json.loads(cluster_names.name_clusters(json.dumps(payload_)))["labels"]
    finally:
        entry["vocab"] = saved
    return [result[group["id"]]["phrase"] for group in groups]


def name_metrics(names, ruler):
    keys_by_name = [
        {ruler["fold"](word) for phrase in name.split(" · ") for word in phrase.split()}
        for name in names
    ]
    repeated = Counter(key for keys in keys_by_name for key in keys)
    phrases = [phrase for name in names for phrase in name.split(" · ")]
    edge = ruler["stop"] | ruler["lead"] | ruler["negation"]
    return {
        "words repeated across names": sorted(key for key, count in repeated.items() if count > 1),
        "name phrases with an empty edge word": sum(
            phrase.split()[0] in edge or phrase.split()[-1] in edge for phrase in phrases
        ),
    }


def report(directory):
    ruler = yardstick()
    after = payload("nl")
    before = {"stopwords": OLD_STOPWORDS, "leadwords": [], "negations": [], "fold": None}
    old_vocab = {"blocked": OLD_NAMING, "fold": lambda word: word}
    lines = ["| table | measure | before | after |", "|---|---|---:|---:|"]
    examples = []
    for table, field in TABLES.items():
        rows = load(table, directory)[:MAX_ROWS]
        labels = json.loads((ROOT / f"demo-config/{table}/results.json").read_text())["clustering"][
            "labels"
        ][: len(rows)]
        results = {}
        for name, lexicon in (("before", before), ("after", after)):
            index = build(rows, field, lexicon)
            clouds, common = cloud_metrics(index, labels, ruler)
            names = naming(index, labels, old_vocab if name == "before" else None)
            results[name] = (clouds, name_metrics(names, ruler), names, common)
        for measure in results["before"][0]:
            lines.append(
                f"| {table} | {measure} | {results['before'][0][measure]:g} "
                f"| {results['after'][0][measure]:g} |"
            )
        for measure in results["before"][1]:
            old, new = results["before"][1][measure], results["after"][1][measure]
            show = (
                (lambda value: ", ".join(value) or "none")
                if isinstance(old, list)
                else (lambda value: f"{value:g}")
            )
            lines.append(f"| {table} | {measure} | {show(old)} | {show(new)} |")
        examples.append((table, results))
    print("\n".join(lines))
    for table, results in examples:
        print(f"\n### {table}\n")
        for name in ("before", "after"):
            print(f"{name} names: " + "; ".join(results[name][2]))
            print(f"{name} common cloud: " + ", ".join(results[name][3]) + "\n")


if __name__ == "__main__":
    report(sys.argv[1] if len(sys.argv) > 1 else ROOT / "public/fixtures")

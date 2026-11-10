"""Render evaluation results as Markdown tables."""

from collections import Counter

import numpy as np

AUC_KINDS = ["fine", "coarse", "null", "length"]


def table(header, rows):
    lines = [
        "| " + " | ".join(header) + " |",
        "|" + "|".join(["---"] + ["---:"] * (len(header) - 1)) + "|",
    ]
    lines += ["| " + " | ".join(str(cell) for cell in row) + " |" for row in rows]
    return "\n".join(lines)


def sample_summary(rows, manifest):
    text = f"{len(rows)} records. Gold manifest revision {manifest['revision']}."
    if "hierarchy" not in manifest:
        return text
    fine = Counter(row[manifest["hierarchy"]["fine"]] for row in rows)
    courts = Counter(row["court_type"] for row in rows)
    lengths = {
        f: int(np.median([row[f] for row in rows])) for f in ("summary_words", "ruling_words")
    }
    return (
        f"{text} {len(fine)} sub-areas ({min(fine.values())}-{max(fine.values())} each), "
        f"{len({row['year'] for row in rows})} years, court types {dict(courts.most_common())}, "
        f"{len({row['court'] for row in rows})} courts. Median words: {lengths}."
    )


def column_tables(screens):
    """Per text field: real columns by skill beyond text length, then the null-control floor."""
    parts = []
    for text_field, grade in screens.items():
        rows = []
        for name, entry in grade["table"].items():
            if entry["class"] == "null" and name.startswith(("shuffled:", "noise:")):
                continue
            rows.append(
                [
                    name,
                    entry["class"],
                    "n/a" if entry["length_determined"] else f"{entry['skill_beyond_length']:.3f}",
                    f"{entry['skill_total']:.3f}",
                    f"{entry['length_explains']:.2f}"
                    + (" (determined)" if entry["length_determined"] else ""),
                    "n/a" if entry["length_determined"] else f"{entry['p']:.3f}",
                ]
            )
        floor = f"{grade['null_mean']:.3f} ± {grade['null_sd']:.3f} (max {grade['null_max']:.3f})"
        rows.append([f"null controls (n={grade['null_count']})", "null", floor, "", "", ""])
        header = [
            "column",
            "class",
            "skill beyond length",
            "skill total",
            "length alone explains",
            "p vs nulls",
        ]
        parts.append(f"**Text field `{text_field}`**\n\n" + table(header, rows))
        grades = [
            ["strong columns beat every null", grade["strong_above_all_nulls"]],
            ["p = 0.05 resolvable with this many nulls", grade["alpha_resolvable"]],
            ["AUC strong vs null", fmt(grade["auc_strong_vs_null"])],
            ["AUC strong+moderate vs null", fmt(grade["auc_strong_moderate_vs_null"])],
            ["length columns detected beyond length", grade["length_columns_detected"] or "none"],
            [
                "columns determined by length (not scored)",
                grade["length_determined_columns"] or "none",
            ],
        ]
        parts.append(table(["grade", "result"], grades))
    return "\n\n".join(parts)


def fmt(value):
    return f"{value:.2f}" if isinstance(value, float) else str(value)


def mean_by_kind(groups, kind, key):
    values = [scores[key] for name, scores in groups.items() if name.startswith(kind)]
    return float(np.mean(values)) if values else float("nan")


def description_tables(results):
    parts = []
    for text_field, output in results.items():
        rows = []
        for ranking, groups in output["groups"].items():
            rows.append(
                [ranking]
                + [f"{mean_by_kind(groups, kind, 'auc'):.3f}" for kind in AUC_KINDS]
                + [
                    f"{mean_by_kind(groups, 'fine', 'precision'):.2f}",
                    f"{mean_by_kind(groups, 'fine', 'coverage'):.2f}",
                    f"{mean_by_kind(groups, 'null', 'precision'):.2f}",
                ]
            )
        header = [
            "ranking",
            "AUC fine",
            "AUC coarse",
            "AUC null",
            "AUC length",
            "precision fine",
            "coverage fine",
            "precision null",
        ]
        parts.append(
            f"**Text field `{text_field}`** (held-out, top 10 phrases)\n\n" + table(header, rows)
        )
    return "\n\n".join(parts)


def example_table(results, text_field, ranking="contrast"):
    output = results[text_field]
    rows = []
    for name, phrases in output["examples"].items():
        if name.startswith(("fine", "coarse", "length")):
            auc = output["groups"][ranking][name]["auc"]
            rows.append([name, f"{auc:.2f}", ", ".join(phrases[:7])])
    return table(["group", "held-out AUC", "top contrast phrases"], rows)


def cluster_table(clusters):
    names = list(next(iter(clusters.values()))["agreement"])
    rows = []
    for run, output in clusters.items():
        cells = [
            f"{output['agreement'][name][0]:.2f} / {output['agreement'][name][1]:.2f}"
            for name in names
        ]
        rows.append([run, output["clusters"], f"{output['unassigned']:.0%}", *cells])
    return table(["run", "clusters", "unassigned", *[f"{n} ARI / NMI" for n in names]], rows)


def map_table(maps):
    rows = []
    for name, levels in maps.items():
        rows.append(
            [name] + [f"{v['purity']:.2f} (chance {v['chance']:.2f})" for v in levels.values()]
        )
    return table(
        ["representation", *[f"kNN purity {level}" for level in next(iter(maps.values()))]], rows
    )


def full_report(sections, rows, manifest):
    parts = [f"# {manifest['name']} evaluation", sample_summary(rows, manifest)]
    parts += ["## Which columns does the text vary with?", column_tables(sections["columns"])]
    if "descriptions" in sections:
        parts += [
            "## Do phrase descriptions explain a group?",
            description_tables(sections["descriptions"]),
        ]
        for text_field in sections["descriptions"]:
            parts += [
                f"Examples, `{text_field}`",
                example_table(sections["descriptions"], text_field),
            ]
    for text_field, output in sections.get("structure", {}).items():
        parts += [
            f"## Clusters and maps, `{text_field}`",
            cluster_table(output["clusters"]),
            map_table(output["maps"]),
        ]
    return "\n\n".join(parts) + "\n"

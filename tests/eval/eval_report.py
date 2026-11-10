"""Render evaluation results as Markdown tables, one column per representation."""

from collections import Counter

import numpy as np

AUC_KINDS = ["fine", "coarse", "null", "length"]


def table(header, rows):
    divider = "|" + "|".join(["---"] + ["---:"] * (len(header) - 1)) + "|"
    lines = ["| " + " | ".join(header) + " |", divider]
    lines += ["| " + " | ".join(str(cell) for cell in row) + " |" for row in rows]
    return "\n".join(lines)


def fmt(value):
    return f"{value:.2f}" if isinstance(value, float) else str(value)


def sample_summary(rows, manifest):
    text = f"{len(rows)} records. Gold manifest revision {manifest['revision']}."
    fine = Counter(row[manifest["hierarchy"]["fine"]] for row in rows)
    return f"{text} {len(fine)} fine groups ({min(fine.values())}-{max(fine.values())} each)."


# ---- which columns does the text vary with?


def skill_cell(entry):
    return "n/a" if entry["length_determined"] else f"{entry['skill_beyond_length']:.3f}"


def columns_table(by_representation):
    """Rows: real columns. Columns: representations. Cells: skill beyond text length."""
    kinds = list(by_representation)
    first = by_representation[kinds[0]]["table"]
    names = [n for n, e in first.items() if not n.startswith(("shuffled:", "noise:"))]
    rows = [
        [n, first[n]["class"], *[skill_cell(by_representation[k]["table"][n]) for k in kinds]]
        for n in names
    ]
    floor = [f"{g['null_mean']:.3f} (max {g['null_max']:.3f})" for g in by_representation.values()]
    rows.append(["null floor: mean (max)", "null", *floor])
    verdict = [f"{g['strong_above_all_nulls']}" for g in by_representation.values()]
    rows.append(["strong columns beat every null", "", *verdict])
    return table(["column", "class", *kinds], rows)


def column_tables(screens):
    parts = []
    for text_field, by_representation in screens.items():
        parts.append(
            f"**Text field `{text_field}`** (skill beyond length)\n\n"
            + columns_table(by_representation)
        )
    return "\n\n".join(parts)


# ---- do phrase descriptions explain a group?


def mean_by_kind(groups, kind, key):
    values = [scores[key] for name, scores in groups.items() if name.startswith(kind)]
    return float(np.mean(values)) if values else float("nan")


def description_tables(results):
    parts = []
    header = [
        "ranking",
        "AUC fine",
        "AUC coarse",
        "AUC null",
        "AUC length",
        "precision fine",
        "coverage fine",
    ]
    for text_field, output in results.items():
        rows = []
        for ranking, groups in output["groups"].items():
            cells = [f"{mean_by_kind(groups, kind, 'auc'):.3f}" for kind in AUC_KINDS]
            extra = [f"{mean_by_kind(groups, 'fine', k):.2f}" for k in ("precision", "coverage")]
            rows.append([ranking, *cells, *extra])
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


# ---- split surfacing


def surfacing_table(by_representation, manifest):
    rows = []
    kinds = list(by_representation)
    for level in manifest["hierarchy"]:
        for kind in kinds:
            entry = by_representation[kind][level]
            for ranking, result in entry["rankings"].items():
                if ranking != "semantic" and kind != kinds[0]:
                    continue  # Frequency and balanced do not depend on the representation.
                name = f"semantic ({kind})" if ranking == "semantic" else ranking
                rows.append(
                    [
                        level,
                        name,
                        f"{result['information']:.3f}",
                        f"{result['percentile']:.0f}",
                        ", ".join(result["phrases"][:6]),
                    ]
                )
        first = by_representation[kinds[0]][level]
        rows.append([level, "best possible 15 phrases", f"{first['best_possible']:.3f}", "100", ""])
        rows.append([level, "typical phrase", f"{first['typical']:.3f}", "50", ""])
    return table(["level", "ranking", "information", "percentile", "top phrases"], rows)


# ---- clusters and maps


def matched_label(run, manifest):
    level = "coarse" if "coarse" in run else "fine"
    return manifest["hierarchy"][level]


def cluster_table(by_representation, manifest):
    kinds = list(by_representation)
    rows = []
    for run in by_representation[kinds[0]]["clusters"]:
        label = matched_label(run, manifest)
        cells = []
        for kind in kinds:
            output = by_representation[kind]["clusters"][run]
            ari, nmi = output["agreement"][label]
            lost = f", {output['unassigned']:.0%} unassigned" if output["unassigned"] else ""
            cells.append(f"{ari:.2f} / {nmi:.2f}{lost}")
        rows.append([f"{run} vs {label}", *cells])
    return table(["run (ARI / NMI)", *kinds], rows)


def map_table(by_representation, manifest):
    kinds = list(by_representation)
    rows = []
    for name in by_representation[kinds[0]]["maps"]:
        for level in manifest["hierarchy"]:
            cells = [f"{by_representation[k]['maps'][name][level]['purity']:.2f}" for k in kinds]
            chance = by_representation[kinds[0]]["maps"][name][level]["chance"]
            rows.append([f"{name}, {level}", *cells, f"{chance:.2f}"])
    return table(["representation (kNN purity)", *kinds, "chance"], rows)


def structure_tables(structure, manifest):
    parts = []
    for text_field, by_representation in structure.items():
        parts += [f"### Clusters, `{text_field}`", cluster_table(by_representation, manifest)]
        parts += [f"### Maps, `{text_field}`", map_table(by_representation, manifest)]
    return parts


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
    if "surfacing" in sections:
        parts += ["## Do unsupervised splits surface the known structure?"]
        for text_field, by_representation in sections["surfacing"].items():
            parts += [f"`{text_field}`", surfacing_table(by_representation, manifest)]
    if "structure" in sections:
        parts += ["## Clusters and maps", *structure_tables(sections["structure"], manifest)]
    return "\n\n".join(parts) + "\n"

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


def raw_table(by_representation):
    """Strong columns: tuned skill on the app's 32-d vectors against unreduced vectors."""
    kinds = list(by_representation)
    rows = []
    for name in by_representation[kinds[0]]["reduced"]["skills"]:
        cells = []
        for kind in kinds:
            result = by_representation[kind]
            cells.append(
                f"{result['reduced']['skills'][name]:.3f} / {result['raw']['skills'][name]:.3f}"
            )
        rows.append([name, *cells])
    dims = [f"{by_representation[k]['raw']['dimensions']}" for k in kinds]
    floor = []
    for kind in kinds:
        result = by_representation[kind]
        floor.append(f"{result['reduced']['null_max']:.3f} / {result['raw']['null_max']:.3f}")
    rows += [["raw dimensions", *dims], ["null max", *floor]]
    return table(["strong column: 32-d / raw (tuned)", *kinds], rows)


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

T_95 = 2.093  # Two-sided 95% t quantile for 19 degrees of freedom (20 paired repeats).


def paired_table(by_representation, manifest):
    """Each representation minus TF-IDF over the same 20 subsamples: mean difference and 95% CI."""
    kinds = list(by_representation)
    base = {
        lv: np.array(by_representation[kinds[0]]["stability"][lv]) for lv in manifest["hierarchy"]
    }
    rows = []
    for level in manifest["hierarchy"]:
        for index, metric in enumerate(("ARI", "NMI")):
            cells = []
            for kind in kinds[1:]:
                diff = (
                    np.array(by_representation[kind]["stability"][level])[:, index]
                    - base[level][:, index]
                )
                half = T_95 * diff.std(ddof=1) / np.sqrt(len(diff))
                low, high = diff.mean() - half, diff.mean() + half
                wins = f"{(diff > 0).sum()}/{len(diff)}"
                cells.append(f"{diff.mean():+.2f} [{low:+.2f}, {high:+.2f}], wins {wins}")
            rows.append([f"{level} {metric}", *cells])
    return table(["minus TF-IDF: mean [95% CI], wins", *kinds[1:]], rows)


def umap_seed_table(by_representation, manifest):
    kinds = list(by_representation)
    rows = []
    for level in manifest["hierarchy"]:
        cells = []
        for kind in kinds:
            values = np.array(by_representation[kind]["umap_seeds"][level])
            cells.append(f"{values.mean():.3f} ± {values.std(ddof=1):.3f}")
        rows.append([f"UMAP kNN purity, {level}: mean ± sd over 5 seeds", *cells])
    return table(["", *kinds], rows)


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
    for level, column in manifest["hierarchy"].items():
        cells = []
        for kind in kinds:
            scores = np.array(by_representation[kind]["stability"][level])
            mean, sd = scores.mean(axis=0), scores.std(axis=0, ddof=1)
            cells.append(f"{mean[0]:.2f} ± {sd[0]:.2f} / {mean[1]:.2f} ± {sd[1]:.2f}")
        rows.append([f"minibatch ({level}), 20 subsample+seed runs vs {column}: mean ± sd", *cells])
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
        parts += [f"Paired differences, `{text_field}`", paired_table(by_representation, manifest)]
        parts += [f"### Maps, `{text_field}`", map_table(by_representation, manifest)]
        parts += [umap_seed_table(by_representation, manifest)]
    return parts


def full_report(sections, rows, manifest):
    parts = [f"# {manifest['name']} evaluation", sample_summary(rows, manifest)]
    if "columns" in sections:
        parts += ["## Which columns does the text vary with?", column_tables(sections["columns"])]
    for text_field, by_representation in sections.get("columns_raw", {}).items():
        parts += [
            f"Without the 32-d reduction, `{text_field}`",
            raw_table(by_representation),
        ]
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

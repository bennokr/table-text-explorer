# Documentation

Two kinds of documents live here. **User help** is bundled into the app and opened from its **?** buttons; **developer
documents** describe how the app is built and why.

## User help (`docs/help/`)

[Start](help/start.md) · [Words and buttons](help/glossary.md) · [Highlight and filter](help/selection.md) ·
[Subset descriptions](help/descriptions.md) · [Maps](help/maps.md) · [Text models](help/text-models.md) ·
[Combining columns](help/combining.md) · [Clustering](help/clustering.md) · [Data and exports](help/data.md).
Each page starts with a one-sentence summary (shown as a tooltip), then an example, steps and how to read the result.
A test checks every page's links and the length of every summary.

## Developer documents

| Document | What it is | Status |
|---|---|---|
| [implementation.md](implementation.md) | Architecture and behavior of the current app | Maintained: update with the code |
| [maintenance.md](maintenance.md) | Checks, CI, size budgets and their rationale, sentence model preparation | Maintained: every budget raise is explained here |
| [data-and-assets.md](data-and-assets.md) | Assets, example data, releases, curated example results, provenance | Maintained |
| [spec.md](spec.md) · [plan.md](plan.md) | Scope, and the work that is left | Maintained |
| [codebook-profile.md](codebook-profile.md) | Optional JSON/spreadsheet codebooks and demo defaults | Maintained |
| [compare-by-spec.md](compare-by-spec.md) | Design record of the column screen and the first Color stage | Design record: the controls were renamed (Size, Color, Contrast) |
| [evaluation.md](evaluation.md) · `evaluation-*-report.md` | The evaluation harness and its generated reports | Reports are generated; see the status note |
| [evaluation-lexicon.md](evaluation-lexicon.md) | Before/after measurement of the lexicon | Generated once, from `npm run report:lexicon` |
| [synthetic-rmc.md](synthetic-rmc.md) | A local synthetic workload for scale checks | Local tooling |
| [archive/](archive/) | Historical stage notes | Not maintained |

Working agreements are in [AGENTS.md](../AGENTS.md).

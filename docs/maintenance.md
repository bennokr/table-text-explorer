# Maintenance

## Checks

Run `npm test`, `npm run check`, the relevant native checks, `npm run build` and
`npm run check:bundle` before handoff. Reports belong in ignored `.cache/checks/`.

| Scope | Command |
| --- | --- |
| JavaScript unit tests and native phrase checks | `npm run test:quick` |
| Metadata predicate scoring and comparisons | `npm run test:facets` |
| Phrase-based cluster naming | `npm run test:cluster-names` |
| Folding rules and the lexicon files | `npm run test:fold` (and `npm test` for the file format) |
| Lexicon before/after on the examples (writes a table to stdout) | `npm run report:lexicon` |
| Clustering algorithms / WASM worker bridge | `npm run test:clustering` / `npm run test:clustering:wasm` |
| Synthetic workload invariants, without private files | `npm run test:rmc` |
| Offline sentence inference and chunking | `npm run test:sentences:wasm` |
| Production asset boundaries | `npm run check:bundle` |

Browser tests cover important workflows; matching, caching, tree membership and
numeric edge cases belong in unit/native/WASM checks. Build before production
browser tests. Install Chromium with `npx playwright install chromium`, or set
`CHROMIUM_PATH` to an installed Chromium executable.

| Browser scope | Command |
| --- | --- |
| Workspace, layout and export | `npm run test:browser:smoke` |
| Maps and clustering | `npm run test:browser:analysis` |
| All journeys except pretrained embeddings | `npm run test:browser` |
| Real word/sentence inference | `npm run test:browser:models` |
| Everything | `npm run test:browser:all` |
| Non-model journeys on Vite's development server | `npm run test:browser:dev` |

Playwright owns its localhost server, uses synthetic records or the approved DBRD
example, disables GPU APIs, and blocks external/non-GET requests. Python/scikit-learn
warm up even in UI-only journeys; pretrained models remain opt-in. Failures go to
ignored `.cache/e2e/`; enable traces with `E2E_TRACE=1`.

## GitHub Pages

`.github/workflows/pages.yml` checks, tests and builds on every branch push and deploys `dist/` on pushes
to `main` (or manually). The repository's Pages source must be set to **GitHub Actions**. The build
sets `BASE_PATH=/<repository>/`; code resolves runtime URLs through `src/base.js`, so
never hard-code root-absolute asset paths. Only approved public examples are published.
CI runs `npm run check` (ESLint, size budgets, ruff check and format; it first runs
`uv sync --cache-dir .cache/uv` because the script calls `uv run --offline`), the unit
tests and the bundle check; browser journeys and pretrained-model assets are not part of it. `npm ci --ignore-scripts` skips the native
`onnxruntime-node` download, which only the optional offline Node probe uses.

## Readability budgets

Ruff/ESLint cap complexity at 8 and statements per function at 35. AST checks cap
each authored module at 250 statements, Python at 3550 total and JavaScript at
13260 total. Imports, nested bodies, tooling and tests count. Generated files,
dependencies and downloaded assets do not. No per-file exemptions apply.

The JavaScript budget grew from the initial 3750-statement phrase-cloud application
to cover ordinary resizable view cards, independent results, clustering trees,
local sentence inference, declarative metadata, a shared variable picker, typed
phrase/facet queries, grouped sentence aggregation and bundled contextual help.
The latest increase, 9600 to 10200, covers the Markdown reader, group controls and
focused regression coverage. Existing worker, cache and dialog paths are reused;
these additions introduce no UI framework. Prefer deleting obsolete paths and
splitting responsibilities over compressing code. Any future increase needs a
written rationale here; function and module limits stay unchanged.

The JavaScript budget rose from 10200 to 10400 for tooling and tests, not app code (`src/` grew by about 15
net statements): the offline embedding runner for the evaluation (`tests/eval/embed.mjs`, `umap-map.mjs`, 78),
the model-release packaging and restore scripts (85) and unit tests for the new defaults, map method and
progress arithmetic (62). Nothing here ships in the app.

The Python budget rose from 2500 to 2600 for the evaluation harness (`tests/eval/`, `scripts/prepare_rechtspraak.py`,
about 800 statements). It is tooling the budget counts but not product code: a seeded sampler, a gold-manifest
scorer with null controls, column screening, phrase-description recovery, cluster/map agreement, split surfacing,
multi-seed stability and a Markdown report, plus a self-check on synthetic planted structure. It is split into
modules under 250 statements with the usual function limits, and none of it ships in the app. See
[evaluation](evaluation.md).

The budgets rose again, JavaScript from 10400 to 11100 and Python from 2600 to 2900, for Compare by
([spec](compare-by-spec.md)). JavaScript grew by about 715 statements: roughly 520 in `src/` (query-path chips and
NOT, previous-step comparison, the Compare by picker and screen planning, colored cloud and legend, even-split
UI) and about 200 in tests (query path, column payloads, three browser journeys). Python grew by about 257: the
closed-form column screen (`src/workers/column_screen.py`, 148), its self-check on synthetic planted and missing
data (`tests/check_screen.py`, 88) and the even-split ranking in `facets.py`. The screen replaces nothing that
shipped before, so there is no deletion to offset it. Modules stay under 250 statements (`terms.js` was split into
`term-output.js`) and the function limits are unchanged.

The Python budget rose again, from 2900 to 3100, for the calibration of the column screen on three tables
(about 195 statements, none of it shipped): `scripts/prepare_tweedekamer.py` builds the Tweede Kamer motions
sample (61) and `tests/eval/calibrate_screen.py` runs the real-column, null, small-population and missingness
experiments against the app's own screen (126), and the screen's self-check gained two tests. See
[evaluation](evaluation.md#calibrating-the-column-screen).

The JavaScript budget rose from 11100 to 11300 for embedding import and export (`src/embedding-files.js`, `src/embedding-import.js`,
about 120 statements in the app and 39 in tests): vectors made earlier or elsewhere are read from a `.npy` or raw float32 file instead of
being encoded again, which took about 13 minutes for 2,224 reviews, and a map's embeddings download as `.npy`. Nothing is uploaded. The rest
is small Compare by fixes found while exploring the Tweede Kamer motions (a grey Other group, a not-significant note, the Auto label, and Compare by
stepping aside when a ranking is chosen).

The budgets rose a last time for the exploration fixes, JavaScript from 11300 to 11450 and Python from 3100 to 3150. JavaScript (about 100
statements, a third of it tests): default views chosen by what the columns are, identifier and repeated-label typing, a clear-visualizations
button, the legend placed after its map, one color per value shared by the map, legend and phrase cloud, and shorter map names. Python
(about 50): cluster naming now skips function words and generic phrases and falls back to looser phrases before a number, with tests.

Semantic splits then raised the budgets once more, JavaScript from 11450 to 11550 and Python from 3150 to 3200: phrases are chosen one after
another so each adds something the earlier ones do not (Python, about 35 statements with tests), and colored by the cluster where their
records sit (JavaScript, about 60 statements with tests). The same pass removed unused exports.

The JavaScript budget rose again, from 11550 to 12300 (about 700 statements, a fifth of it tests), for the explorer refactor stage: the ranking
hint, cluster chip dots, an event list, shared colors, a settings object with a job runner split from the panel binder, one Compare by, and the
search field with tokens and suggestions (`query-field.js`, `query-suggest.js`, `query-text.js`). The refactors moved code more than they added it;
the new behaviour is the field and the folded-in comparisons.

The Python budget rose from 3200 to 3300 for the example-data release (about 95 statements, none shipped in the app): the Rechtspraak echo
removal (`scripts/clean_rechtspraak.py`) and the release packaging (`scripts/package_data_release.py`). The JavaScript side of the same work
(example embeddings, the release restore, shared release download helper) is in the 12300.

The JavaScript budget rose from 12300 to 12350 for the Size/By stage, which removed text axes but still added about 40 statements (the stage
started 32 under the cap): the order helper that lists a clustering's values in its legend's order (`legendNames`, about 10), the job key that now
includes the query path (a click that adds a phrase to the path changes neither the subset nor the comparison, so the cloud was not redrawn),
greyed-out columns while a Size ranking is chosen, and the "no column stands out" label. About 20 of them are tests (an end-to-end check that
weak columns stay selectable and that a chosen Size greys the columns out, and the cluster order in the unit tests). Removing text axes took out
the `text_axes` worker function, `axisGroups`, the axes menu entries and their tests.

The JavaScript budget rose again, from 12350 to 12450, for the color key (`src/color-key.js`, about 85 statements, and its end-to-end spec,
about 25): one chip component and one list of "what the colors mean" shared by the map and scatter cards and the phrase cloud, so a value looks
and behaves the same wherever it is listed. The cloud's own chip code was replaced by it. The rest of the stage (heading "ranking by column",
what Automatic chose in the Size select, the highlight option moved into "Compare to") is a handful of statements.

The JavaScript budget rose from 12450 to 12650 for the curated example results: the loader (`src/example-results.js`, about 50 statements, the
only app code), the curation script that draws them with the app itself (`scripts/curate_example_results.mjs`, about 60, tooling), their unit and
end-to-end tests (about 45), and the test that keeps every help tooltip to one short sentence (about 25, with the lead-sentence helper). Removing
the Representative records block also removed its worker code and the per-phrase example lookup, which nothing else used.

The JavaScript budget rose from 12650 to 12750 for the Size / Color / Contrast restructure (about 80 statements net). The new module
`src/size-choices.js` (about 55) lists each embedding as its own semantic-splits entry in Size, which replaced the separate embeddings select;
Color now works with any Size, so a population-scored cloud is tinted by the Color column (the tint, its key and the job key that includes it,
about 30); and the end-to-end specs for the new behavior and the example's shipped embeddings (about 25). It removed the display and embedding
selects, the "Compare to" group and the rule that a chosen Size disables the columns.

The JavaScript budget rose from 12750 to 12775 (11 over) for the chip and control-row consolidation. The three kinds of chip (search conditions,
color key, cloud chips) now come from one component (`src/chip.js`) and one cluster-label rule with one hover (`conditionText`, `legendHover`),
which replaced three hand-built copies, and the unit test for that shared rule adds about 10 statements. The control rows of the cards and the
panel share markup and CSS, which saved CSS, not statements.

The budgets rose for the lexicon (Python 3300 to 3550, JavaScript 12775 to 12925). Python (about 235): the folding module `fold.py` (about 35),
the checks for it and for the new index behavior (lead words, variant merging, names that avoid repeated forms, about 70), a reader that shares the
lexicon files between those checks and the report (about 25), and `tests/eval/lexicon_report.py` (about 110), which measures the examples before and
after and writes `docs/evaluation-lexicon.md`; it replaced the separate 90-word naming list. JavaScript (about 130): the file reader and bundling
(`src/lexicon-parse.js`, `src/lexicon.js`, about 40) and their tests and an end-to-end check that the bundled lexicon is applied, which check that every language has its four files, that no word sits in two
tiers and that the folding rules are well formed (about 60).

The JavaScript budget rose from 12925 to 13150 for the interface consistency work (about 225): charts (about 70 in `src/`: natural
order of numbers and dates, the number of bars that fit the card, stacked bars colored like the map, a histogram bin setting) with
their unit and browser tests (about 75), the status-line Undo and the help Home button (about 25), and the browser tests for the
glyph and dialog conventions (about 55). The dialog rewrite itself removed code (the folded sections and the invalid-control reveal). A further 10 (13150 to 13160)
cover the browser check that the ⋯ button stays in the Size / Color / Contrast row.

## Codebook reader

`src/codebook-profile.js` (`readCodebook`) opens the XLSX codebook, checks every cell against the type its header
expects (loud warnings, or an error with `strict`), and hands the cells to linked-codebook (`fromTables`, then
`toFrictionless`). Only `scripts/convert_codebook.mjs` and the tests call it; the app reads the resulting
`schema.metadata.json` files through `schemaMetadata`, which takes `level`, `group`, `identifying` and the label
dictionary from the field property `x-linked-codebook`. `tests/fixtures/codebook-schema.json` pins the output.

History: on 2026-11-02 a swap was assessed as not worth it with linked-codebook 0.7.0 (no table format, no slots for
groups, identifiers or limits, different extension keys). linked-codebook 0.9.0 added the slots `group`, `identifying`,
`minimum`, `maximum` and `format` and a table format whose sheets follow the model; the reader and its sheet parsing
(about 100 lines of statements) were replaced by the call. What the profile cannot hold is gone: the field role
`text`/`code` (the app only used `identifier`), the Groups sheet titles, `primaryKey` (a primary key column is now
`identifying`), the Review notes and the per-field `pattern` constraint. The five committed `schema.metadata.json`
files and the example workbook were converted once and the converter was deleted; `scripts/prepare_rmc_codebook.mjs`,
the private-data adapter for the earlier profile, was deleted with it.

## Sentence model preparation

`npm run prepare:sentences` prepares both models. The optional Dutch model is pinned
to MarkSelles/dutch-minilm-l6-v2 commit `a4838aae5e41cfe6bd1ce54bafd1a4cdf3489bd7`.
It has no upstream ONNX artifact: `scripts/prepare_dutch_model.mjs` verifies pinned
source hashes, invokes `prepare_dutch_sentences.py`, and verifies the quantized output
hash. Export dependencies are pinned separately and use CPU. Raw weights stay in
ignored `vendor/`; the ~59 MB model/tokenizer assets, Apache-2.0 license, model card
and provenance are bundled for offline use.

The export needs torch, transformers and onnx, and `uv` downloads about 40 packages including NVIDIA CUDA
wheels (several GB) even though inference runs on CPU. To avoid that on every machine and in CI, package the
two prepared models once and publish them as a GitHub release:

```sh
npm run prepare:sentences                 # once, on a machine that can run the export
node scripts/package_model_release.mjs    # writes .cache/model-release/*.tar.gz, SHA256SUMS, scripts/model-release.json
gh release create models-v1 .cache/model-release/*.tar.gz .cache/model-release/SHA256SUMS
```

The archives are deterministic, so repackaging the same files gives the same hashes, which
`scripts/model-release.json` pins. `prepare_assets.mjs --model-only` first calls
`scripts/restore_model_release.mjs`: it uses a matching archive from `.cache/model-release/`, otherwise
`gh release download` (works for private repositories; CI needs `GH_TOKEN`) or a plain download, verifies the
SHA-256 and extracts into `public/vendor/models/`. If the release is unavailable it falls back to Hugging Face
and the torch export. The Pages workflow does not prepare any pretrained assets yet; once the release exists,
add `node scripts/prepare_assets.mjs --model-only` (with `GH_TOKEN`) before the build step.

The export retains full-precision embedding tables and checks native/quantized
agreement on synthetic Dutch text. This is a parity probe, not a quality benchmark.
The multilingual model remains the default. Switching models disposes the previous
worker model and separates caches; saved result arrays remain intact.

## Historical and local tooling

The original feasibility harness is optional, separate from the application:

```sh
npm run build:feasibility
npm run feasibility
```

It writes `dist-feasibility/` and may include private local data. Do not distribute
that output. Its SAV reference setup is in the [historical notes](archive/feasibility.md).
The [local sparse-workload generator](synthetic-rmc.md) needs ignored source files;
its invariant tests use invented in-memory inputs.

Never commit or upload private fixtures, source codebooks or their derived metadata.
Public example data requires explicit approval, a license and provenance.

The JavaScript budget rose from 13160 to 13260 for column language detection (about 100 statements, 57 of them tests): `src/language.js` asks
linked-codebook's `inferLanguage` (franc-min as the detector) for the language of each text column, fills the stoplist and embedding-model
settings from it, and says so in the loaded summary; `src/language-tags.js` is the ISO 639-3 to 639-1 table the detector needs. The identifier-name
rule left `src/schema.js` for linked-codebook's `isIdentifierName`, which removed one statement.


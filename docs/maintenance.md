# Maintenance

## Checks

Run `npm test`, `npm run check`, the relevant native checks, `npm run build` and
`npm run check:bundle` before handoff. Reports belong in ignored `.cache/checks/`.

| Scope | Command |
| --- | --- |
| JavaScript unit tests and native phrase checks | `npm run test:quick` |
| Metadata predicate scoring and comparisons | `npm run test:facets` |
| Phrase-based cluster naming | `npm run test:cluster-names` |
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
each authored module at 250 statements, Python at 2500 total and JavaScript at
10200 total. Imports, nested bodies, tooling and tests count. Generated files,
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

## Codebook reader

`src/codebook-profile.js` (`readCodebook`) reads the XLSX codebook (sheets Fields, Values, Missing, Dataset,
Groups, Review) into a Table Schema with `x-` extensions. Only `scripts/convert_codebook.mjs` and the tests call
it; the app reads the resulting `schema.metadata.json` files through `schemaMetadata`. The extensions it relies on:
`x-measurement`, `x-role`, `x-group`, `x-valueLabels` and `categories` (`field-metadata.js`, `group-vectors.js`,
`variable-options.js`), plus `missingValues`, `primaryKey`, `constraints`, `x-groups` and `x-reviewNotes`.

Assessment on 2026-11-02 (linked-codebook 0.7.0): the reader was not replaced, because no route through
`parse`/`toFrictionless` reproduces it.

- There is no XLSX reader to reuse. `parse` reads DSV JSON-LD and `fromRedcap` reads REDCap CSV, so an
  XLSX-to-`Profile` step would be new code in any case.
- `toFrictionless` writes different keys. `x-measurement` becomes `x-linked-codebook.level`, `x-valueLabels` becomes
  `x-linked-codebook.values` with `closed` false, a missing code keeps its label only in `values`, a closed category
  without a label becomes a bare value (which `fieldMetadata` does not treat as a label), and `year` has no
  `Datatype`.
- A `Profile` has no slot for `x-role` (identifier, text), `x-group` and the Groups sheet, `constraints`, `format`,
  `primaryKey`, `fieldsMatch` or the Review notes, so they would be lost or need a sidecar.
- Probe, with a best-effort XLSX-to-`Profile` mapping on `docs/examples/codebook` and `toFrictionless`: two of the
  seven fields change meaning in `schemaMetadata`. `record_id` is no longer an identifier (`x-role` and `primaryKey` are
  gone) and `level` becomes a number with no value labels. The other five keep kind, identifier flag and labels.

Effort for a safe swap is one to two days: the XLSX-to-`Profile` reader (about 60 lines), moving the three consumers
and the five committed `schema.metadata.json` files (four in `demo-config/`, one in `docs/examples/codebook/`) to
`x-linked-codebook`, a roles and groups sidecar because the `Profile` has none, and roughly 100 more statements in the
JavaScript budget (10125 of 10200 are used). The gain is small: the reader stays and a mapping layer is added.
If the goal is interoperability, add a one-way `profileOf(schema)` that feeds `build` or `toSssom` and leave
`readCodebook` alone. `tests/metadata.test.mjs` pins the reader's full output in
`tests/fixtures/codebook-schema.json`; a replacement must reproduce that file, or each difference must be documented.

## Sentence model preparation

`npm run prepare:sentences` prepares both models. The optional Dutch model is pinned
to MarkSelles/dutch-minilm-l6-v2 commit `a4838aae5e41cfe6bd1ce54bafd1a4cdf3489bd7`.
It has no upstream ONNX artifact: `scripts/prepare_dutch_model.mjs` verifies pinned
source hashes, invokes `prepare_dutch_sentences.py`, and verifies the quantized output
hash. Export dependencies are pinned separately and use CPU. Raw weights stay in
ignored `vendor/`; the ~59 MB model/tokenizer assets, Apache-2.0 license, model card
and provenance are bundled for offline use.

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

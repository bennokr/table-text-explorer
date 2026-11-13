# Data and offline assets

All records, text, queries, annotations and vectors stay on the user's machine.
Runtime/model downloads are static assets. No model is requested by importing a
file or opening the app; inference requires explicitly creating an embedding map.

## Preparing assets

`npm run setup` runs `node scripts/prepare_assets.mjs` (runtime plus examples); `npm run setup:models` adds the
sentence models and requires the `models-v1` release. `SKIP_DATA_RELEASE=1` leaves out the `data-v1` examples. The
README's Local deployment section lists what each step downloads.

`node scripts/prepare_assets.mjs` prepares Bokeh, Pyodide/scikit-learn and local
WASM runtime files. Pinned wheel hashes are checked and recorded in
`public/vendor/manifest.json`. `npm run prepare:sentences` verifies both the multilingual
MiniLM-L12 and optional Dutch MiniLM-L6 assets, retaining their Apache-2.0 licenses
and provenance. The Dutch model is exported locally from pinned weights; see
[maintenance](maintenance.md) for the export and quantization checks.
`npm run prepare:vectors` converts pinned Dutch/English spaCy models locally,
retaining licenses and provenance. All generated assets remain ignored by Git.

`npm run prepare:runtime` refreshes the two required ONNX Runtime WASM pairs:
asyncify for browser Transformers.js, the base pair for the offline Node probe.
GPU/JSPI variants and standalone JS backend bundles are not copied. The supported
external-WASM package condition prevents Vite from emitting a duplicate binary.
The ONNX Runtime MIT license is retained from the installed upstream commit in
[licenses/onnxruntime.txt](../licenses/onnxruntime.txt).

## Examples and build boundaries

Approved public examples live in `examples/`, with licenses/provenance under
`examples/attribution/`. Private fixtures stay in ignored `fixtures/`.
`npm run dev` explicitly includes private examples in the local picker.
`npm run build` includes approved examples only, preparing its own staging picker
without modifying the development picker or its local fixture copies. Its allowlisted public staging
contains vendor assets, attribution, approved fixture copies and the picker manifest;
private reference files and arbitrary files from `public/` are excluded.

The optional `build:feasibility` mode is local diagnostic output. It includes private
examples/reference data when present and writes `dist-feasibility/`, separate from
the distributable `dist/`. Do not distribute that diagnostic output with private data.

## Dataset provenance

Attribution of the approved examples is in `examples/attribution/<dataset>/` and is copied into the build. The
local-only Crawlfeeds example ([Booking Hotel Reviews Dataset](https://huggingface.co/datasets/crawlfeeds/Booking-Hotel-Reviews-Dataset),
revision `f39ceeede7b9d8a824909ebe88a7723ad31fa6c5`, declared CC BY-NC 4.0) is downloaded locally, never committed or bundled. Dutch vectors originate from
[spaCy nl_core_news_md](https://huggingface.co/spacy/nl_core_news_md) (CC BY-SA 4.0);
English vectors from [spaCy en_core_web_md](https://huggingface.co/spacy/en_core_web_md)
(MIT). Generated asset directories retain licenses and provenance manifests.

Dutch examples:

- **dbrd-test.json** is vendored in `examples/`: all 2,224 official DBRD test reviews,
  balanced positive/negative, about 3.6 MB. Review text is preserved verbatim. Rating
  and review ID come from the original filenames; word/character counts are derived.
  Dataset license: **CC BY-NC-SA 4.0**. The archive's license, README/citation and hash
  provenance are retained under `examples/attribution/dbrd/` and copied into builds.
  It appears in the picker even without a private `fixtures/` directory. Dutch static
  vectors and the `text` field are selected as defaults; fitting remains explicit.
- **bol-absa-preview.json** is an acquired local example of 1,000 Dutch product reviews.
  Select it in the picker after running `npm run probe:dutch-data`. Original `text` is retained; structured `pros` and `cons` dictionaries are omitted
  from the imported scalar table. Derived
  `pros_text`/`cons_text` columns join their aspect phrases, with counts for exploration.
  These two fields are selected for Dutch embeddings by default. The repository has
  no declared license, so this data remains in ignored local fixtures, not vendored.

`npm run prepare:dbrd` reproduces the vendored JSON from the official v3.0 archive,
checking its pinned SHA-256. It is unnecessary for a normal checkout. The Bol probe
keeps acquisition diagnostics under ignored `.cache/`.

## Example data release (`data-v1`)

Two more example datasets, the Rechtspraak sample (2,360 rulings) and the Tweede Kamer motions sample (3,585 motions),
and precomputed Dutch sentence embeddings for all three examples are published as release assets, not stored in git.
They are restored when the site is built, pinned by hash in `scripts/data-release.json`, the same way as the sentence
models (`scripts/restore_data_release.mjs`; `DATA_RELEASE_REQUIRED=1` makes a missing release fail the build). A
checkout without the release still works with the tracked examples; an example's `demo.json` lists its embeddings and
the app skips any that are missing.

- **Rechtspraak** (CC0 1.0 in the data.overheid.nl catalogue): `scripts/clean_rechtspraak.py` removes the echoes of
  court, court type and year from the text, the same way for every ruling (ECLI codes, case numbers carrying the year,
  court names, generic court-type words, "Zittingsplaats X", four-digit years). Nothing else is scrubbed, so names the
  court left in remain: pseudonymised is not anonymous. On the excerpts the year column fell from 0.043 to 0.012 of the
  text variation, while court (0.237 to 0.204) and court type (0.127 to 0.122) barely moved: courts specialise, so
  that signal is content, not echo.
- **Tweede Kamer motions** (CC0 1.0 in the catalogue; read the portal's disclaimer): subject lines without the
  submitters' header, so no member names, only the lead submitter's party.
- **Embeddings**: MarkSelles/dutch-minilm-l6-v2 (Apache-2.0), 384 dimensions, half-precision `.npy`, one row per
  record in table order. Derived from the data, so they carry its licence: the DBRD ones are CC BY-NC-SA 4.0.
- **Provenance** is in `examples/attribution/<dataset>/` (`source.json`, `README.md`) and is copied into the build.
- **Size**: about 8 MB of embeddings and 12 MB of JSON. The JSON compresses to under 2 MB per table over the wire, so
  Parquet (a WASM reader and a second format to maintain) is not worth it; half precision halves the embeddings.

Build the assets with `scripts/package_data_release.py` (after `npm run prepare:rechtspraak`, `prepare:tweedekamer`,
`scripts/clean_rechtspraak.py` and `tests/eval/embed.mjs`), then upload them with `gh release create data-v1 ...`.

DBRD: Benjamin van der Burgh and Suzan Verberne, *The merits of Universal Language Model
Fine-tuning for Small Datasets – a case with Dutch book reviews* (2019),
[dataset](https://github.com/benjaminvdb/DBRD), [paper](https://arxiv.org/abs/1910.00896).
Bol data: Fieke Middelraad, [DutchABSA](https://github.com/FM12001/DutchABSA), pinned at
`c72597e0806b42c6ef52c27c4d393bff5ac2c126`.


Variable sidecars and demo defaults are documented in [codebook profile](codebook-profile.md).

## Curated example results

Each example opens with a similarity map and a clustering already on screen. They are stored in
`demo-config/<table>/results.json` (about 45–70 KB), copied into the build next to `demo.json`, and loaded by
`src/example-results.js` as ordinary saved results marked `precomputed`. Nothing is fitted when an example opens;
fitting again with New similarity map or New clustering stays an explicit choice, and the shipped results are listed
in Exports with their provenance.

- **Format** (`version` 1): `table`, `records` (must equal the table's row count, or the file is ignored), `provenance`,
  `map` (`name`, `method`, `x` and `y` in table order, `null` where a record has no point) and `clustering` (`name`,
  `method`, `parameters`, `labels` in table order, `groups` with a `name`, an optional `color` and `edited: true` for a name written by hand).
- **Generated by the app itself**: `scripts/curate_example_results.mjs <table> <clusters>` drives a local preview
  build, fits UMAP on the example's shipped embeddings (umap-js, fixed seed, so a refit gives the same map) and k-means
  on the saved feature space, and reads the results back through Exports. Rebuild first with `npm run build`; the
  script refuses to overwrite an existing file without `--force`, in case it holds edits.
- **Names**: the app's own phrase names (four phrases per cluster), as a user's first clustering would get them, so an
  example shows what the app really produces. None are marked edited, so "Rename all" can refresh them.
- **Privacy**: coordinates and labels are derived from public example data only; private fixtures have no results file.

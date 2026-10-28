# Data and offline assets

All records, text, queries, annotations and vectors stay on the user's machine.
Runtime/model downloads are static assets. No model is requested by importing a
file or opening the app; inference requires explicitly creating an embedding map.

## Preparing assets

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

Example attribution: [Crawlfeeds Booking Hotel Reviews Dataset](https://huggingface.co/datasets/crawlfeeds/Booking-Hotel-Reviews-Dataset),
revision `f39ceeede7b9d8a824909ebe88a7723ad31fa6c5`, declared CC BY-NC 4.0. The source CSV
and dataset card are downloaded locally, not committed. Attribution is included in
`public/attribution/crawlfeeds.md` and copied into offline builds. Dutch vectors originate from
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

DBRD: Benjamin van der Burgh and Suzan Verberne, *The merits of Universal Language Model
Fine-tuning for Small Datasets – a case with Dutch book reviews* (2019),
[dataset](https://github.com/benjaminvdb/DBRD), [paper](https://arxiv.org/abs/1910.00896).
Bol data: Fieke Middelraad, [DutchABSA](https://github.com/FM12001/DutchABSA), pinned at
`c72597e0806b42c6ef52c27c4d393bff5ac2c126`.


Variable sidecars and demo defaults are documented in [codebook profile](codebook-profile.md).

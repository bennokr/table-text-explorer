# Table + text explorer

A client-side, four-panel explorer: a fixed Canvas scatter, a virtualized table,
a scrollable stack of linked Bokeh charts, and a full-record viewer. Native controls
provide local import/export, Boolean search, dtype overrides and annotation columns.
See [current behavior](docs/implementation.md), [next stages](docs/plan.md), [the agreed scope](docs/spec.md),
and [initial feasibility evidence](docs/archive/feasibility.md).

Fixtures and user data are never uploaded. Fixtures, downloaded assets and generated
bundles remain excluded from Git. The local build contains fixture copies; do not
publish that build with private examples in it.

Requires Node 22.22+ and uv with Python 3.12+. Install pinned tools:

```sh
npm ci
uv sync
node scripts/prepare_assets.mjs
npm run dev
```

Place private examples in `fixtures/`. Dev/build commands prepare the example picker
from CSV, JSON, SAV and XLSX files in that folder. An empty folder is fine; the file
picker works without examples. Table features and TF-IDF need no pretrained model.

Choose X/Y axes for an immediate view, or select UMAP/PCA/SVD and press ▶ to fit on
all records. Settings chooses table features or one/multiple text columns (TF-IDF),
basic Dutch/English stopwords and UMAP parameters. Brushing highlights; ⏷ explicitly
filters. Table, charts and the record viewer follow the same row IDs.

Validation:

```sh
npm test
npm run check
npm run build
npm run test:browser
npm run test:browser:dev
```

The asset command downloads static runtime packages and optional weights only.
Add `--model` only to prepare the optional transformer feasibility probe.
It verifies Pyodide wheel hashes and records download hashes/sizes in
`public/vendor/manifest.json`. Assets are ignored in source control and copied into
`dist/` by the build. Serve `dist/` over localhost/HTTP; double-clicking an HTML file
does not provide the module/worker environment required by these runtimes.

For the browser check install Chromium with `npx playwright install chromium`, or set
`CHROMIUM_PATH` to an existing Chromium executable. It starts/stops its own loopback
server, disables GPU APIs, blocks external traffic, tests the three fixtures plus a
synthetic JSON import, and exercises both projection workers. Screenshots and exported
test data stay in ignored `.cache/`; tracked diagnostics contain aggregate results only.
`test:browser` checks the production build; `test:browser:dev` runs the same checks
against Vite's development server, including its worker and asset loading behavior.

The original probe is retained at `/feasibility.html`. To rerun its native ReadStat
comparison and optional model test:

```sh
node scripts/prepare_assets.mjs --model
uv run --cache-dir .cache/uv --with pyreadstat==1.3.2 --with pandas==2.3.3 python scripts/sav_reference.py
npm run build
npm run feasibility
```

The probe has an explicit optional-model button. No model file is requested before
that button is clicked. The application CSP limits connections to the local origin.
`unsafe-eval` currently accommodates Bokeh; do not treat CSP alone as proof of privacy.

Ruff/ESLint enforce complexity and function limits. AST checks enforce module and
language budgets without counting comments, blank lines, dependencies or generated
assets. Read [AGENTS.md](AGENTS.md) before extending the implementation.

Subset descriptions: open **N-grams** in the Explore panel, choose text fields and
click **Build index**. Brush records to compare them with the remaining visible rows,
or choose filtered rows versus the rest of the table. Each field shows distinctive
phrases, record coverage, c-TF-IDF, contrast and lift, with representative excerpts.
Click a phrase to inspect examples, then **Highlight matches** to narrow the highlight.
Nested phrases with nearly identical record coverage are reduced by default; the
checkbox restores the unpruned ranking. Collapse **Settings & comparison** to focus
on results, and use each field's **Cloud** switch for tightly packed, log-scaled phrases.
Cloud phrases retain hover scores, keyboard activation, excerpts and highlighting.
Changing subsets reuses the index and preserves fitted projections. Rebuild explicitly
after changing text/index settings. Minimum support counts records, not repetitions.

`npm run test:cloud` checks packed-cloud interactions, resizing and overflow without
loading Python or fixtures.
`npm run test:terms` checks ranking math and a 20,000-record sparse index natively.
`npm run test:terms:browser` and `npm run test:terms:dev` check the actual Pyodide worker,
selection/filter interactions and Dutch examples, with external traffic blocked.

Word vectors and linked comparisons:

```sh
npm run prepare:vectors  # pinned spaCy Dutch + English assets; conversion runs locally
npm run prepare:booking  # public Crawlfeeds example, downloaded into ignored fixtures/
npm run dev
```

Choose `crawlfeeds-booking.csv` for English positive/negative review fields. It selects
English static vectors and English stopwords; nothing is fitted automatically. For other
data, Settings → Input → static word vectors defaults to Dutch. Each language needs
about 33 MB of local assets, including a 24 MB vector table. The browser uses these
assets directly, without spaCy, a server, or external requests. Build copies prepared
assets and examples into `dist/` for offline bundling. `prepare:vectors` needs uv and
network access once; its Python build dependencies are isolated from the app runtime.

Settings controls mean/TF-IDF-weighted word pooling, per-column weights, and averaging
versus concatenation of field vectors. Field vectors are normalized before combining;
concatenation uses square-root weights, and final record vectors are normalized. Empty
text, literal `\N` and unknown words produce no vectors. Records without a usable vector
stay in the table and exports but have no reduced-space point. Plot captions report
unembedded rows and token coverage. Original table values are preserved.

Enable **Compare**, then fit the second view. Both views share highlighting and explicit
filters, while zoom/pan and fitted coordinates stay independent. With unchanged settings,
PCA and UMAP reuse the same prepared features. Change selected fields or aggregation in
Settings and fit either view to compare different text perspectives. Captions retain the
settings used for each fit; editing settings never changes an existing fitted result.
Reduced-space plots omit numeric axes and show the fitted text columns on hover.
Raw data axes show the original field names and values, including category labels.
Both scatter tooltips omit row numbers. The table's **Preview selection** checkbox
temporarily shows the highlighted records intersected with the current filters, without
changing other views or fitting again. Clearing the selection restores all filtered rows.

The bottom status bar reports byte reads, indeterminate parsing/runtime/SVD/PCA stages,
completed embedding records and UMAP epochs. Table parsing runs in a worker, and
cancelling an analysis retains existing projections. Embedding caches are memory-only
and cleared when changing datasets or cancelling; exports remain tables plus annotations.

Additional checks: `npm run test:words` and `npm run test:words:dev` exercise real Dutch
and English vector assets, the full Crawlfeeds example, linked brushing, field modes,
missing text and status progress. Prepare the assets/example before running these checks.

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
  Select it in the picker after running `npm run probe:dutch-data`. Original `text`,
  `pros` and `cons` (aspect-to-similarity-score dictionaries) are retained. Derived
  `pros_text`/`cons_text` columns join their aspect phrases, with counts for exploration.
  These two fields are selected for Dutch embeddings by default. The repository has
  no declared license, so this data remains in ignored local fixtures, not vendored.

`npm run prepare:dbrd` reproduces the vendored JSON from the official v3.0 archive,
checking its pinned SHA-256. It is unnecessary for a normal checkout. The Bol probe
also saves five original test records and exactly a 4 KiB training-file head under
`.cache/acquisition/`, without downloading the 12 MB training file. The server returned
HTTP 206 for that range. Of the 1,000 test records, 493 contain both pros and cons;
product categories, dates and star ratings are absent from this published test file.

Crawlfeeds' bulk download route currently redirects to sign-in. Its public Hugging Face
Booking repository contains the English sample already acquired, so it supplies no
Dutch bulk stream to filter without access. The recorded checks are in
`docs/evidence/dutch-data-acquisition.json`. `npm run test:dutch-examples` checks the actual DBRD
and local Bol imports and Dutch vector projections (run the probe and prepare vectors first).

DBRD: Benjamin van der Burgh and Suzan Verberne, *The merits of Universal Language Model
Fine-tuning for Small Datasets – a case with Dutch book reviews* (2019),
[dataset](https://github.com/benjaminvdb/DBRD), [paper](https://arxiv.org/abs/1910.00896).
Bol data: Fieke Middelraad, [DutchABSA](https://github.com/FM12001/DutchABSA), pinned at
`c72597e0806b42c6ef52c27c4d393bff5ac2c126`.

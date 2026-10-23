# Table + text explorer · v0.1

A client-side, four-panel explorer: a fixed Canvas scatter, a virtualized table,
a scrollable stack of linked Bokeh charts, and a full-record viewer. Native controls
provide local import/export, Boolean search, dtype overrides and annotation columns.
See [v0.1 behavior and validation](docs/v0.1.md), [the agreed scope](docs/spec.md),
and [initial feasibility evidence](docs/feasibility.md).

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
picker works without examples. No pretrained embedding model is needed for v0.1.

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
Reduced-space plots omit numeric axes and coordinate tooltips; raw data axes retain them.

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

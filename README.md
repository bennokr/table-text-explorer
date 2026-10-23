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

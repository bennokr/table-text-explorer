# Table + text explorer

Explore mixed tables and text in a local browser workspace: linked visualization
cards, phrase and metadata descriptions, a virtualized table and full-record viewer.
Create similarity maps, cluster records and edit independent annotation columns.

Records, queries, annotations and embeddings stay on your machine. Rendering uses
Bokeh Canvas and inference uses CPU/WASM, with no GPU requirement or analytics.

## Run locally

Requires Node 22.22+ and [uv](https://docs.astral.sh/uv/) with Python 3.12+.

```sh
npm ci
uv sync
node scripts/prepare_assets.mjs
npm run dev
```

Open the localhost URL printed by Vite. Asset preparation downloads static runtime
files; Python/scikit-learn load locally at startup. Pretrained text models are optional:

```sh
npm run prepare:vectors    # Dutch and English static word vectors
npm run prepare:sentences  # multilingual MiniLM-L12 and Dutch MiniLM-L6
```

See [assets, dataset licenses and offline preparation](docs/data-and-assets.md).

## Explore

1. Import CSV, JSON records, XLSX (first sheet) or SAV, or choose an example.
2. Brush a chart or type a query to highlight records. Click phrases or metadata
   predicates to add conditions. Filtering is always an explicit action.
3. Add visualization cards, resize their dividers, or make a named similarity map
   and clustering. Highlights and filters never silently refit an analysis.
4. Export annotated tables and saved analysis arrays through **Exports** (↧).

The **?** button opens offline help; smaller ? buttons explain individual settings.
Read the [getting-started guide](docs/help/start.md) for the learning path.
Original values are preserved, including when types or cluster names change.
The workspace is held in memory: exports are downloads, not reloadable projects.

## Build and validate

```sh
npm test
npm run check
npm run build
npm run check:bundle
npm run test:browser       # build first; requires Playwright Chromium
```

Serve `dist/` over HTTP. Production builds include approved public examples and
prepared assets; ignored private fixtures are available only in development.
See [maintenance](docs/maintenance.md) for focused tests and browser setup.

## Project documentation

- [Architecture and behavior](docs/implementation.md)
- [Scope](docs/spec.md) and [remaining work](docs/plan.md)
- [Optional JSON/spreadsheet codebooks](docs/codebook-profile.md)
- [Working agreements](AGENTS.md)

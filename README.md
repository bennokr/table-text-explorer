# Table + text explorer

Explore mixed tables and text in a local browser workspace: linked charts,
subset descriptions (phrases and metadata facets), a virtualized table and a full-record viewer.
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

1. Import CSV, JSON or JSON Lines records, XLSX (first sheet) or SAV, or choose an example.
2. Brush a chart or type a query to highlight records. Click phrases or metadata
   predicates to add conditions. Filtering is always an explicit action.
3. Add charts, resize their dividers, or make a named similarity map
   and clustering. The examples open with a precomputed map and clusters. Highlights and filters never silently refit an analysis.
4. Export annotated tables and saved analysis arrays through **Exports** (↧).

The **?** button opens offline help; smaller ? buttons explain individual settings.
Read the [getting-started guide](docs/help/start.md) for the learning path, and
[words and buttons](docs/help/glossary.md) for what the app's terms and glyphs mean.
Original values are preserved, including when types or cluster names change.

When a table is loaded, each text column is checked for its language (`franc-min`, asked through linked-codebook's
`inferLanguage`: only columns of prose, a sample of the cells, and most of them must agree). The stoplist and the vector
model follow it where they exist (Dutch and English); the status line says which language was found, and the
Column types dialog lists it. A language in the table's codebook is used instead of a guess. Short categorical text has
no language, and a column in another language keeps the defaults and is reported as having no stoplist.
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

- [Documentation index](docs/README.md)
- [Architecture and behavior](docs/implementation.md)
- [Scope](docs/spec.md) and [remaining work](docs/plan.md)
- [Optional JSON/spreadsheet codebooks](docs/codebook-profile.md)
- [Working agreements](AGENTS.md)

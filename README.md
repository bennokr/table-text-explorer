# Table + text explorer

Explore mixed tables and text in a local browser workspace: linked charts,
subset descriptions (phrases and metadata facets), a virtualized table and a full-record viewer.
Create similarity maps, cluster records and edit independent annotation columns.

Records, queries, annotations and embeddings stay on your machine. Rendering uses
Bokeh Canvas and inference uses CPU/WASM, with no GPU requirement or analytics.

## Local deployment

Needs Node 22.22+ and an internet connection once; afterwards the app makes no network requests.

```sh
git clone --depth 1 https://github.com/bennokr/table-text-explorer.git
cd table-text-explorer
npm ci --ignore-scripts
npm run setup          # Python/Bokeh/WASM runtime and the examples
npm run dev            # open the printed localhost URL
```

Choose what to download (sizes measured on a fresh clone):

| Command | Adds | Download | On disk |
| --- | --- | --- | --- |
| `npm ci --ignore-scripts` | Build tools (always) | 225 MB | 716 MB (`node_modules`) |
| `SKIP_DATA_RELEASE=1 npm run setup` | Runtime and the tracked DBRD example | 25 MB | 77 MB |
| `npm run setup` | Also the Rechtspraak and Tweede Kamer examples and precomputed Dutch embeddings (release `data-v1`) | +16 MB | +17 MB |
| `npm run setup:models` | Also the multilingual and Dutch sentence models (release `models-v1`) | +130 MB | +186 MB |
| `npm run prepare:vectors` | Dutch and English static word vectors (needs [uv](https://docs.astral.sh/uv/)) | +81 MB | +63 MB |

So the smallest working setup downloads about 250 MB, with all examples about 265 MB, and with sentence models
about 395 MB. Text models are optional and are only used when you explicitly make an embedding map.

The two releases belong to this repository, which is currently private: `gh auth login` (or `GH_TOKEN`) is needed
for them. Without access `npm run setup` says so and continues with the tracked example; `npm run setup:models`
stops instead of falling back to Hugging Face and a local torch export (see [assets](docs/data-and-assets.md)).

To serve a production build instead of the dev server, run `npm run build && npm run preview`, or put `dist/` on any
static host (`BASE_PATH=/sub/path/ npm run build` for a sub-path). It must be served over HTTP, not opened as a file.

## Development

Also install Python tooling with `uv sync` (needs [uv](https://docs.astral.sh/uv/) and Python 3.12+); it is only
used by `npm run check`, the word vectors and the evaluation scripts. See
[assets, dataset licenses and offline preparation](docs/data-and-assets.md).

## Explore

1. Import CSV, JSON records, XLSX (first sheet) or SAV, or choose an example.
2. Brush a chart or type a query to highlight records. Click phrases or metadata
   predicates to add conditions. Filtering is always an explicit action.
3. Add charts, resize their dividers, or make a named similarity map
   and clustering. The examples open with a precomputed map and clusters. Highlights and filters never silently refit an analysis.
4. Export annotated tables and saved analysis arrays through **Exports** (↧).

The **?** button opens offline help; smaller ? buttons explain individual settings.
Read the [getting-started guide](docs/help/start.md) for the learning path, and
[words and buttons](docs/help/glossary.md) for what the app's terms and glyphs mean.
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

- [Documentation index](docs/README.md)
- [Architecture and behavior](docs/implementation.md)
- [Scope](docs/spec.md) and [remaining work](docs/plan.md)
- [Optional JSON/spreadsheet codebooks](docs/codebook-profile.md)
- [Working agreements](AGENTS.md)

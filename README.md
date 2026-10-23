# Data explorer: stage 1 feasibility

This is a local technical harness, not the finished explorer. See
[the agreed scope](docs/spec.md) and [feasibility evidence](docs/feasibility.md).
Fixtures are never uploaded. Do not publish this harness or its generated bundle:
the local test bundle deliberately contains the fixture copies and local references.

Requires Node 22.22+ and uv with Python 3.12+. Install pinned tools:

```sh
npm ci
uv sync
node scripts/prepare_assets.mjs --model
uv run --cache-dir .cache/uv --with pyreadstat==1.3.2 --with pandas==2.3.3 python scripts/sav_reference.py
npm run check
npm run build
npm run feasibility
```

The asset command downloads static runtime packages and optional weights only.
Omit `--model` to prepare the baseline assets without transformer weights.
It verifies Pyodide wheel hashes and records download hashes/sizes in
`public/vendor/manifest.json`. Assets are ignored in source control and copied into
`dist/` by the build. Serve `dist/` over localhost/HTTP; double-clicking an HTML file
does not provide the module/worker environment required by these runtimes.

For the automated browser check install Chromium with `npx playwright install chromium`,
or set `CHROMIUM_PATH` to an existing Chromium executable. The check starts and stops
its own loopback preview server, disables GPU APIs, blocks external requests, performs
a real pointer brush, and writes aggregate diagnostics to `docs/feasibility-results.json`.
It exercises the built static bundle, including the opt-in model. A first run with
`--model` is required for the full suite; the baseline can also be run manually.

Use `npm run dev` for a local interactive preview. The initial page has a separate
baseline button and explicit optional-model button. No model file is requested before
that button is clicked. The harness CSP limits connections to the local origin.
`unsafe-eval` currently accommodates Bokeh; do not treat CSP alone as proof of privacy.

Ruff/ESLint enforce complexity and function limits. AST checks enforce module and
language budgets without counting comments, blank lines, dependencies or generated
assets. Read [AGENTS.md](AGENTS.md) before extending the implementation.

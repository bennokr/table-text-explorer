# Working agreements

- Work in stages. Stop for user feedback after each working stage.
- Keep table data, text, embeddings, queries and annotations on the user's machine.
  Never upload fixtures. Static asset downloads are allowed; bundle them for offline use.
- Public datasets explicitly approved for vendoring live in `examples/` with their
  licenses and provenance. Private/local `fixtures/` remain ignored and uncommitted.
- Bokeh uses Canvas; inference uses WASM. No GPU requirement or analytics.
- Fit on all records initially. Highlight before explicit filtering. Never silently refit.
- Original values are preserved. Annotations are independent columns; cluster/topic names
  are edited through a dictionary and must not be erased by a new analysis.
- Prefer small, named functions and plain data over frameworks and abstraction layers.
  Do not compress statements, hide logic in expressions, or remove useful documentation
  to satisfy size limits. Split modules by responsibility when needed.
- Run `npm run check`, `npm run build` and the relevant checks in docs/maintenance.md before handoff.
- Ruff and ESLint cap complexity at 8 and statements per function at 35.
  AST size checks cap each authored module at 250 statements, Python at 4055 total
  and JavaScript at 13365 total (rationale in docs/maintenance.md).
  Imports, functions and nested bodies count; comments and blank lines do not.
  Vendor/generated files and dependencies are excluded. Raise budgets only with a written
  explanation in docs/maintenance.md; do not add per-file bypasses.
- CI (`.github/workflows/pages.yml`) runs `npm run check` and `npm test` before building, on every branch push; only
  `main` (or a manual run) deploys. Locally, run
  `uv sync --cache-dir .cache/uv` once so the offline `ruff` calls in `npm run check` find the pinned version.
- `linked-codebook` is a URL tarball in `package.json` (currently 0.9.0); bump it there, run `npm test`
  (the shared case fixture is `tests/fixtures/column-kind-cases.json`) and read its `docs/changelog.md`.
- The XLSX codebook is read by `src/codebook-profile.js`, which warns loudly about cells whose type does not match
  their header and hands the cells to linked-codebook; see "Codebook reader" in docs/maintenance.md. The output is
  pinned by `tests/fixtures/codebook-schema.json`.

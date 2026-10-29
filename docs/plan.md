# Plan

- Choose a project license before a public release. Bundled example/model licenses
  remain separate; the DBRD example has noncommercial and share-alike terms.
- Separate background-description activity from explicit fit progress/busy state
  while retaining worker serialization and cancellation guards.
- Add saved column sets and compact record inspection. Preserve source metadata
  and overrides (codebook import is in `docs/codebook-profile.md`).
- Save named brush/query subsets and annotation-label populations, with explicit
  comparison sets and support for describing several subsets together.
- Learn shallow, readable rules from phrase and metadata predicates. Tree paths become ANDs;
  qualifying leaves combine with OR. Show support, precision/recall and held-out
  evaluation; exclude membership-derived predictors and keep selection/evaluation
  data separate. Clicking a rule previews its query before explicit filtering.
- Start with rule covering: show standalone usefulness plus additional coverage of
  records missed by earlier rules. Boosting combines weighted error-correcting
  predictors and is harder to explain or faithfully edit as a short filter; defer it.
- Evaluate result deletion/memory visibility and local workspace save/restore.
  Add further text models only when a demonstrated task needs them.

Work in reviewable stages. Keep all data and computation local; never silently
refit analyses or overwrite edited names/annotations.

# Evaluating survey clusters

How to tell whether clusters of survey respondents mean something, with any table that has a codebook. The distance is
`src/workers/survey_distance.py` (checked by `npm run test:survey`); the harness is `tests/eval/survey_stability.py`.
The app does not use the distance yet.

## Method

1. `node scripts/routing_states.mjs table schema.metadata.json states.json` gives every cell one of `answered`,
   `asked_but_skipped`, `not_shown` or `unknown` from the codebook's `applies_when` rules.
2. `--write-items` lists one text per answered free-text cell (led by its question). Embed them with
   `node tests/eval/embed.mjs items.json text sentences-dutch prefix` and pass `--embeddings prefix`.
3. The harness builds the distance (questions compared only where both answered; `not_shown` is no mismatch; groups
   count equally; a shared common answer counts for little; text only when both have it; low evidence shrinks toward the
   typical distance) and reports, for any `--groups` regex over codebook groups:
   - **missingness leakage**: neighbours shared with a map of the cell states alone (chance is 15 / (n - 1));
   - **stability**: for each cluster, its best Jaccard overlap with a cluster of 20 random 80% subsamples (Hennig);
   - **map agreement**: neighbour overlap between UMAP maps with other seeds, and with other `n_neighbors`;
   - **agreement with known labels** (`--labels`): adjusted Rand index and normalised mutual information.

Methods: `hdbscan`, `average-K` (agglomerative), `spectral-K` (kNN graph) and `mds-K` (classical MDS, then k-means).

## What the synthetic RMC set shows (1,000 respondents, five planted topics)

| Input | Shared neighbours with a missingness-only map (chance 0.015) | Best stability | Agreement with the planted topics |
| --- | ---: | ---: | --- |
| every question | 0.29 | 0.96 (`mds-5`) | none (ARI 0.05, NMI 0.02) |
| experience questions (DEEL_2) | 0.12 | 0.84 (`mds-5`) | weak (ARI 0.23, NMI 0.15) |
| experience questions and text | 0.13 | 0.90 (`mds-5`) | ARI 0.16, NMI 0.15 (`mds-8`: 0.28 and 0.25, stability 0.57) |

- **Stable is not meaningful.** With every question the clusters are the most stable, and the planted topics do not
  appear in them: 91% of a respondent's neighbours are the same cloned seed participant, and the map follows routing.
  Check stability together with agreement to something substantive and independence from missingness.
- **Cluster on what you want to explain, describe by the rest.** Clustering on the experience questions and describing the
  clusters by background columns removes most routing leakage and makes the planted topics partly visible.
- **Prefer a method that suits the shape.** The data is a gradient, not islands: HDBSCAN found two clusters and left
  26% to 93% unassigned. Classical MDS with k-means and spectral clustering gave stable partitions.
- **Choose k by stability.** The rule used for the final map is the largest k whose mean stability is at least 0.75
  (k = 5 here: 0.87; k = 6: 0.73; k = 8: 0.55). Cluster names are only given to stable clusters.
- **Text helps once the input is experience-only** (NMI 0.14 to 0.26 with spectral clustering), but the synthetic text is
  only loosely tied to the answers, so this needs the real text.
- The synthetic set is built from 19 cloned participants and probabilistic topics, so absolute agreement scores say little;
  the comparisons between inputs and methods are what carry over.

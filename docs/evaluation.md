# Evaluating structure discovery and explanations

The harness in `tests/eval/` scores what the app already does (phrase descriptions, clustering,
maps) against known annotations. It runs natively on the same Python modules as the Pyodide
worker, with the app's default settings, and keeps all data local.

## Data: Rechtspraak sample

`npm run prepare:rechtspraak` samples Dutch court rulings from the CC0 open-data API
(`data.rechtspraak.nl`) into the ignored `fixtures/rechtspraak-sample.json`. Raw responses are
cached in `.cache/rechtspraak/`, so reruns are offline. The sample is balanced on purpose:
25 rulings for each of 12 legal sub-areas and each year 2016-2025, drawn at uniformly random
offsets with a fixed seed, keeping only rulings that carry exactly one legal area. Balanced
quotas give a known chance level; they do not represent the real mix of rulings.

Columns: legal area and sub-area (two-level gold hierarchy), court, court type, procedure, year,
ruling date, two text fields (`summary`, `ruling_excerpt`), two length counts and the ECLI
running number.

The API rejects the default Python User-Agent, so the script sends a generic client name.

## Gold manifest

`tests/eval/rechtspraak-gold.json` states, per column, whether the text is expected to vary with
it (strong, moderate, weak, length, uncertain) and why. It was written before the first
evaluation run. Null controls are added by the harness: shuffled copies of real columns and
random noise columns.

## What is measured

1. **Which columns does the text vary with?** Each column is scored by how strongly phrase usage
   differs across its groups, calibrated against label shuffles. Two variants are compared: a
   naive one and one that works inside text-length strata. Graded by whether strong columns
   outrank every null control, AUC against the nulls, the false-positive rate on null controls,
   and whether length columns rank below the strong ones. This screen is a candidate; the app
   has no equivalent yet.
2. **Do phrase descriptions explain a group?** For each group (12 sub-areas, 3 areas) against
   the rest, the app's `describe_terms` ranks phrases on a random half of the records. The top
   10 phrases are judged on the other half: AUC for recovering membership, mean phrase
   precision, member coverage. Random groups of matching sizes give the chance level, and a
   longest-quartile group probes the length confound. Averaged over three random splits.
3. **Do clusters and maps recover the known structure?** The app's text features (TF-IDF, SVD)
   feed its MiniBatch K-means, agglomerative and HDBSCAN. Agreement is ARI and NMI against area,
   sub-area and other columns, with shuffled labels as chance. Maps (PCA, SVD, UMAP with the
   app's defaults) are scored by the share of each record's 10 nearest neighbours that share
   its label, against a shuffled-label baseline.

Both text fields are run. The summary often names the legal area and can leak the label; the
excerpt leaks less.

## Controls on the harness

`npm run test:eval` runs `tests/eval/check_harness.py` on synthetic data with planted structure:
the length-controlled screen must find planted columns and ignore noise, and descriptions must
recover planted groups but not random ones.

## Not covered

- Embedding-based maps and clusters (sentence or word vectors): the model assets are not in a
  plain checkout and the semantic ranking needs saved embeddings.
- Human tasks: time, steps and correctness for real users, and the simulated analyst.
- Other datasets and dtype mixes.

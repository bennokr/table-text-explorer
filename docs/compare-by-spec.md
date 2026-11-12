# Compare by: conditional phrase ranking (spec)

Status: implemented and calibrated on DBRD, Rechtspraak and Tweede Kamer motions ([evaluation](evaluation.md#calibrating-the-column-screen)).
Where the calibration changed the proposal below, the text says so. Items marked *untested* have no measurement.

## Idea

A **column** is any partition of the records into values: a table column, an annotation, a saved
selection, a clustering, the current highlight (two values), a phrase or facet predicate (present or
absent). **By:** colours a phrase cloud by the values of one column and ranks
each phrase by how distinctive it is for one value (the existing c-TF-IDF contrast, one value against
the rest). It generalises the scope, cluster-group and tree-comparison selects, which become columns.

## Control

One select labelled **By:** in the phrase panel, next to **Size:** (the ranking). No extra button.

```
By: [ Auto → sentiment ●●● ▾ ]
  Auto                 highlight if any, else best significant column, else the population's phrases
  Highlighted
  Columns:    sentiment ●●● 100%   rating ●●○ 100%   year ○○○ 100%   region ●○○ 71%
  Clusters / Annotations / Saved selections
```

Each entry shows strength dots and coverage (records with a value). Dots come from the screen below and are
absolute: one dot from 0.01 of the text variation explained, two from 0.03, three from 0.10. "None" means not
significant or below the effect floor. (The first proposal was relative to the strongest entry; calibration showed
that gave a weak 0.015 column three dots.)

## Cloud

- One cloud per text field (separate by default). Colour is the value where the phrase has the highest
  contrast, size is the contrast. A phrase that is not clearly tied to one value is grey.
- The legend lists the values; clicking a value highlights those records.
- Hover shows field, support and share per value. Combined clouds keep colour for the value and
  show the field in hover and outline.
- Ordinal and numeric columns use a diverging scale (low to high). More than 8 values: top 7 and a grey
  "other". Missing values are a separate grey value, hidden unless switched on.

## Click is conditioning (phrases and facet predicates alike)

Clicking an item in any cloud, table or facet list **highlights**; it never filters. The explicit
"Filter to highlighted records" button does that, unchanged. Behaviour:

- Click adds the predicate to the query path with AND; a modifier-click (Alt) adds NOT. Phrase and facet
  predicates behave identically, since both are typed predicates in the query.
- The path is shown as removable chips above the cloud (breadcrumb with undo); the search box text
  stays the source of truth.
- The cloud recomputes. Predicates already on the path, their nested phrases (for example "staande
  voet" after "voet") and zero-support facet values are hidden from it; they appear as chips, not
  as the top result.
- Comparison: the highlight against **the previous step's population** (the records before the last
  click). With no earlier predicate this equals today's "highlighted against the rest". Brush
  selections keep "against the rest of the visible records".
- Auto reruns the screen **inside the highlight**, so the next suggested column is conditional on the
  path. A counter shows records left. Below 30 records the cloud shows counts only.

## Efficient screen

Descriptive statistic, no model fit; computed lazily when the picker opens and cached per
(dataset revision, text field, representation, population). Natively 1.4 s for 45 columns and
2,360 records, about 16 times faster than the cross-validated version.

1. Population P is all visible records, or the current highlight.
2. Take the app's prepared 32-d text vectors for P. Regress out text length, measured in words, not phrase
   counts (one-hot strata plus log length terms), and standardise each dimension. Once per population.
3. For each candidate column c, take the observed set O (records in P with a value), merge groups with
   fewer than 10 records into "(other)", and require 2 to 50 groups.
4. Adjusted R² = 1 - (1 - R²)(n - 1)/(n - k), with R² the between-group share of variance. A number is cut
   into quartiles first (ties stay together) and scored the same way, so every column is on one scale.
   (The first proposal regressed numbers on the vectors, which gave 0.22 against 0.15 for the best category on
   Rechtspraak and a null spread seven times the floor at 120 records.)
5. P-value: shuffle the labels **within O**, 99 times, and take the tail of a gamma curve fitted to the shuffled
   scores (normal tails were too generous; rank p-values cannot go below 0.01 with 99 shuffles, so Holm could
   not pass). Holm-correct across candidates.
6. Strength is the adjusted R²; the effect floor is 0.01 (columns the text predicts out of sample start at
   0.015, ones it cannot end at 0.0075). Order by strength.

Measured: see the calibration in evaluation. Null columns average 0.000 and reach 0.0017; no null column was
flagged; text length itself is never flagged. It ranks by variance explained, so a 22-group column can outrank
a 3-group one; refining the top 3 with cross-validation is optional. Populations under 60 records are not
screened; a real column of 0.015 is found half the time at 60 records and 85% at 120.

## Missingness

- **Complete cases per column.** Each column is scored on the records where it has a value; length is
  regressed out once on all of P, not per column.
- **Coverage is shown** next to the dots. Entries below 50% coverage or with fewer than 5 records
  per value (groups under 10 merge) are not offered. Strength is never inflated by a small observed set: n in the
  adjustment is the observed count.
- **Permutations preserve the missingness pattern** (shuffle within O only).
- **Missing as a column.** "Has value / missing" is a candidate, scored the same way. When it is
  significant (p <= 0.01 and an effect of at least 0.001, since a two-group split explains far less than a column)
  the entry says "missing values differ in text", the warning that values are not missing at random and that
  the column's own strength may be biased. Measured: random missingness is never flagged; 0.6 against 0.2 by a
  group the text separates is always flagged; 0.5 against 0.3 rarely.
- **Conditioning shrinks coverage.** Inside a highlight, coverage and strength are recomputed for the
  subset, so a column that was fine overall can drop out.
- Records with no usable text are outside P already (as in phrase counts today).

## Fallback when nothing passes

Text axes (the main directions of the 32-d vectors, split at the median) were offered here and removed. The
split is arbitrary (the median of a 4% direction, with unnamed sides), Auto chose it by default on tables
where no column explains the text, and the clusters and semantic splits are the named version. When nothing
passes, Auto shows the population's phrases in one colour ("Auto → no column stands out"). Columns that are
not significant stay selectable, with their dots and a legend note that the colours may reflect chance.

Measured earlier: axes beat the null and balanced splits but trailed semantic splits where embeddings are
good (excerpt information about legal area 0.12 to 0.15 against 0.20; null 0.057).

## Even splits (renamed "Balanced splits")

For facet predicates only (the facets and phrases-plus-facets modes). Ranks predicates by how evenly
they split the **current population**, the 20-questions heuristic. For phrases it equals common
phrases whenever no phrase occurs in more than half the records, so it is hidden there.

- One predicate per column; numeric columns pick the decile threshold closest to an even split within
  the population (the current fixed quantiles all tie).
- Both sides need at least 10 records. Missing-versus-present is offered but ranked below value splits.
- Show records left on each side. Clicking highlights as above.
- Caveat: columns balanced by sampling design rank first and mean nothing. *Untested on facets.*
- Phase 2: with a Compare-by column chosen, rank predicates by information about it instead
  ("informative questions"); even splits is the case with no target.

## Removed or folded

Scope select and the cluster-group and tree-comparison selects become entries in Compare by.
Ranking select keeps Auto and Common phrases/predicates, Semantic splits and Even splits. Lift,
c-TF-IDF and balanced-for-phrases stay hidden under Advanced or go.

## Phasing

1. Conditioning click: hide path predicates, NOT modifier, breadcrumb with undo, previous-step
   comparison. Small and independent.
2. Compare by with the screen for table columns, annotations and the highlight; coverage and missingness.
3. Clusters, saved selections and semantic phrase columns as columns; the conditional re-screen.
4. Even splits for facets; target-aware variant.

## Checks before shipping

- Harness: the screen picks the gold column for Rechtspraak, DBRD and, once built, Tweede Kamer; null
  p-values uniform; length-determined columns never offered.
- Missingness: synthetic columns with 40% values missing completely at random keep strength; columns
  whose missingness depends on the text are flagged.
- Calibrate the effect floor and the dot thresholds on three datasets.
- Time the screen in Pyodide (target under 2 s at 2,400 records and 50 columns).
- Browser tests: click highlights without filtering, NOT click, breadcrumb removal, conditioned cloud
  hides path predicates, facet clicks behave like phrase clicks.

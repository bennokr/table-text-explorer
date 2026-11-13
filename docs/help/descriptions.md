# Phrases and metadata facets

Descriptions suggest phrases or field predicates characterizing the highlighted or current records.

## Example

Highlight a map region, inspect its phrases and facets, and click a useful predicate to add it to the query path with AND. Alt-click adds NOT. Clicking only highlights; use the filter button to drop the other records.

## Steps

1. Choose Size (how phrases are scored), Color (what colors them) and, when no column colors them, Contrast (what the highlight is compared with).
2. Open the panel settings for phrases, metadata facets or both, the field display and minimum support.
3. Inspect a cloud or switch it to a table for counts and scores.

## Interpreting the result

Without a highlight, Automatic shows common predicates in the current population. With a comparison, it shows positive distinctiveness. Cluster scopes describe multiple groups; tree branches can be compared with siblings. Scores are descriptive, not held-out prediction quality.

Facet candidates include category values, booleans, missing/not-missing and fixed numeric/date ranges. Identifiers, analysis-derived columns and constant predicates are omitted. Facets work without a phrase index.

## Size, Color and Contrast

**Size** scores the phrases, **Color** colors them, and **Contrast** says what the highlight is compared with. Size sets their size in the cloud. The Size select says what Automatic chose ("Auto → Distinctive phrases"), and the panel heading reads "<size> by <color>". The three are independent: any Size can be combined with any Color.

**Size** lists common phrases, distinctive phrases (a contrast, the Automatic choice when there is something to compare), even splits for metadata, one entry per available embedding for semantic splits (an imported file, a table's shipped embeddings or a saved representation), and the advanced scores.

**Color** is Auto, None, Field (one cloud for several fields, colored by field), a column (a table column, an annotation or a cluster) or a tree's branches. With Automatic or Distinctive Size, a column gives each of its values its own distinctive phrases, in that value's color. With any other Size, one population is scored and each phrase takes the color of the column value where most of its records are (grey when they are spread out); a key above the cloud lists the values. Auto picks the column the text varies with most, beyond text length, but keeps the column the map is colored by (a clustering, say) when that column is significant, so the cloud explains the colors on the map; with semantic splits it tints by the map's column. Values of a clustering keep the cluster legend's colors; other columns use the map's color order. Dots show how much of the text variation the column explains (one dot from 1%, two from 3%, three from 10%), followed by coverage (records with a value). "None" means not detected, which below about 120 records is weaker evidence than it looks. "Missing differs" means the text differs between records with and without a value, so values are probably not missing at random and the column's own strength may be biased. When no column passes, Auto shows the population's phrases in one color ("Auto → no column stands out"). Columns that are not significant stay in the list, since a weak column can still be the one worth looking at: the key notes that its colors may reflect chance.

**Contrast** appears only when no column splits the cloud into values. Previous step compares the highlight with the records before the last condition (the default); Rest of the table compares the filtered records with the records filtered out; Current records and Whole table describe those records with no contrast.

The screen is a descriptive statistic computed on this machine without fitting a model: text length is regressed out of the text vectors, and each column is scored by the share of the remaining variance its values explain (adjusted R²). Numbers are cut into quartiles first, so every column is on one scale. P-values come from 99 label shuffles within the records that have a value, Holm-corrected across columns; an effect below 0.01 never counts. Populations under 60 records are not screened. After a click adds a condition, the screen reruns inside the highlighted records, and the cloud compares them with the records before the last condition. The chips above the cloud show the path; remove one to widen it.

## Phrase counting

Shared phrase settings control text columns, phrase lengths and stoplists. They apply to TF-IDF, static word vectors, descriptions and phrase-based names.

Counts build when needed. Presets save settings, not completed analyses. Unicode words are tokenized; punctuation ends phrases; fields remain separate. Negation is retained by default. Phrase length is Words, Short phrases (1–3 words, the default) or Longer phrases (1–5 words). A phrase never starts or ends with a stopword or a single character such as `c` or `1`. Sentence models keep their own tokenizer. [Text models](text-models.md) explains the distinction.

## Settings

Automatic compares the highlight with the rest when there is a comparison, and lists common phrases otherwise. The comparison is scored by c-TF-IDF contrast. Common phrases finds frequent predicates. Semantic splits use saved embeddings (or imported ones) without fitting a model. They list phrases one after another, each splitting the records in a way the earlier ones do not (after a phrase is chosen, its split is removed from the embeddings, so near-copies such as "onderwijs" and "onderwijs voor" drop out); the size shows what the split adds. Phrases take the color of the value of the Color column where most of their records are (by default the column the map is colored by, a clustering say); grey phrases are spread over several values. They are the largest splits in the data, which may not be the ones you care about. Even splits (facets only) rank one yes/no question per column by how evenly it splits the current records, with at least 10 records on each side; numbers split at the most even threshold, and a column balanced by sampling design ranks first without meaning anything. The Advanced group holds c-TF-IDF and document lift. Distinctive phrases are the contrast score.

Phrase contrast uses c-TF-IDF (the difference between class-based TF-IDF weights of the subset and the comparison); facet contrast is the difference in matching record shares. Lift compares smoothed record coverage. Precision is the share of matching records belonging to the subset; recall is the share of subset records matched. Split support must hold on both sides. Semantic scores only use records present in the chosen embeddings.

## Technical details

Phrase scores and facet scores have different units and remain in separate clouds.

Phrase redundancy reduction prefers longer nested phrases with at least 90% matching-record overlap and similar scores. Numeric/date ranges use fixed whole-dataset quantiles, retaining ties; up to 50 category values and 15 ranked predicates per field are displayed. Clicking uses the original predicate AST, preserving exact query memberships. [Query help](selection.md#settings) documents matching operators.

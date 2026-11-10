# Phrases and metadata facets

Descriptions suggest phrases or field predicates characterizing the highlighted or current records.

## Example

Highlight a map region, inspect its phrases and metadata facets, and click a useful predicate to narrow the query with AND.

## Steps

1. Open the panel settings to choose phrases, metadata facets or both.
2. Choose a population/comparison and minimum support.
3. Inspect a cloud or switch it to a table for counts and scores.

## Interpreting the result

Without a highlight, Automatic shows common predicates in the current population. With a comparison, it shows positive distinctiveness. Cluster scopes describe multiple groups; tree branches can be compared with siblings. Scores are descriptive, not held-out prediction quality.

Facet candidates include category values, booleans, missing/not-missing and fixed numeric/date ranges. Identifiers, analysis-derived columns and constant predicates are omitted. Facets work without a phrase index.

## Phrase counting

Shared phrase settings control text columns, phrase lengths and stoplists for TF-IDF, static word vectors, descriptions and phrase-based names.

Counts build when needed. Presets save settings, not completed analyses. Unicode words are tokenized; punctuation ends phrases; fields remain separate. Negation is retained by default. Phrase length is Words, Short phrases (1–3 words, the default) or Longer phrases (1–5 words). A phrase never starts or ends with a stopword or a single character such as `c` or `1`. Sentence models keep their own tokenizer. [Text models](text-models.md) explains the distinction.

## Settings

Automatic compares your highlighted records with the rest when there is a comparison (c-TF-IDF contrast) and lists common phrases otherwise. Common phrases finds frequent predicates. Semantic splits use saved embeddings without fitting a model and show the largest split in the data, which may not be the one you care about. The Advanced group holds balanced splits (they prefer partitions near half and match common phrases whenever no phrase occurs in more than half the records), c-TF-IDF contrast, c-TF-IDF and document lift.

Phrase contrast uses c-TF-IDF (the difference between class-based TF-IDF weights of the subset and the comparison); facet contrast is the difference in matching record shares. Lift compares smoothed record coverage. Precision is the share of matching records belonging to the subset; recall is the share of subset records matched. Split support must hold on both sides. Semantic scores only use records present in the chosen embeddings.

## Technical details

Phrase scores and facet scores have different units and remain in separate clouds.

Phrase redundancy reduction prefers longer nested phrases with at least 90% matching-record overlap and similar scores. Numeric/date ranges use fixed whole-dataset quantiles, retaining ties; up to 50 category values and 15 ranked predicates per field are displayed. Clicking uses the original predicate AST, preserving exact query memberships. [Query help](selection.md#settings) documents matching operators.

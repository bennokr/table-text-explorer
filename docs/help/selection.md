# Highlight and filter

Highlighting previews records; filtering explicitly restricts the visible population.

## Example

Type `score>=30` to highlight matching visible records. Add `AND category="A"` to narrow the preview.

## Steps

1. Brush a chart, select table rows, or type a query.
2. Inspect the highlight and its [descriptions](descriptions.md).
3. Choose the toolbar filter button to commit the highlighted visible records.

## Interpreting the result

Filtering clears the query and highlight, retaining matching record IDs. The bottom-left count shows the filtered population. Without a highlight, descriptions cover that population. Nothing is refitted.

The × button clears selection and query while keeping filters. The reset-filter button restores all records. A changed brush clears the preview query; moving between records inside the same highlight keeps it. Table selection preview affects only the table.

## The search field

The field holds conditions as removable tokens, then the condition you are typing. Enter turns what you typed into a token; the next one narrows the query with AND, and a token's × (or Backspace on an empty field) widens it again. Clicking a phrase, a value or a cluster does the same. A query with OR or parentheses becomes one token. The × button at the right end clears everything.

Suggestions appear as you type: an empty field lists the columns with their types, then the operators that fit the column, then its values with counts (or frequent words of a text column, and `null` for missing values). Arrow keys and Enter or Tab choose; choosing a value completes the token. A token for a cluster shows the cluster's colour and first phrase while its legend is on screen; hovering it lights up the legend row.

## Settings

Queries support field names, comparisons, parentheses and AND/OR/NOT.

- `field:value` searches substrings; `field:prefix*` searches word prefixes.
- `field="value"` matches an exact value; `field=null` matches metadata-defined missing values.
- `field="null"` matches the literal category named null.
- `notes~"follow up"` matches exact phrases with lexical token/punctuation boundaries.
- Clicking a phrase or facet adds a token (AND) and skips already-required duplicate conditions; Alt-click adds NOT.

## Troubleshooting

An invalid query leaves the last valid highlight intact; correct it or clear the preview before filtering.

Use OR explicitly for alternative values of the same field. Two different exact values joined with AND will usually match nothing.

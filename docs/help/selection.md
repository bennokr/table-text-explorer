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

## Settings

Queries support field names, comparisons, parentheses and AND/OR/NOT.

- `field:value` searches substrings; `field:prefix*` searches word prefixes.
- `field="value"` matches an exact value; `field=null` matches metadata-defined missing values.
- `field="null"` matches the literal category named null.
- `notes~"follow up"` matches exact phrases with lexical token/punctuation boundaries.
- Clicking a phrase or facet adds AND and skips already-required duplicate conditions.

## Troubleshooting

An invalid query leaves the last valid highlight intact; correct it or clear the preview before filtering.

Use OR explicitly for alternative values of the same field. Two different exact values joined with AND will usually match nothing.

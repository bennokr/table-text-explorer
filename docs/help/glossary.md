# Words and buttons

The words the app uses for its parts, and what its buttons mean.

## Example

You can color a chart by any variable, but phrases are always counted in text columns of the original table.

## Words

- **Column**: an original column of the imported table. Its values never change, even when you correct its type.
- **Variable**: anything with one value per record that you can chart, color or query: columns, annotations and cluster columns.
- **Annotation**: a column you make by labeling records. It stays independent of later fits.
- **Embedding** and **coordinates**: vectors and map positions per record. They are results, not variables.
- **Similarity map** (**map**): records placed by how similar their text or values are. **Clustering**: records grouped by similarity; each group is a cluster, with a name you can edit.
- **Chart**: one card in the Charts area: Scatter, Histogram, Bars, Heatmap, Map or Legend (a clustering's names, colors and counts).
- **Highlight**: the records selected by brushing, tapping or a query. It previews; **filter** explicitly restricts the visible records.
- **Subset descriptions**: the panel that describes the highlighted (or current) records with phrases and metadata facets.
- **Size**, **Color**, **Contrast**: how phrases are scored (their size), what colors them, and what the highlight is compared with.
- **Partition**: what a Color column does to the records: it splits them into one subset per value.
- **Stopwords**, **lead words**, **negations**: the lists behind phrase counting; see [phrase counting](descriptions.md#phrase-counting).

## Buttons and hints

- ⚙ opens a modal of settings, with Cancel and Apply. ⋯ shows more controls inline, in the same row or card.
- ＋ adds (a chart); × removes or clears; ⛶ expands a chart; ⠿ drags it; ↥ imports and ↧ exports.
- A small **?** explains one setting in a sentence and opens its help page; a plain tooltip only names the button.
- Dialogs that make something (a map, a clustering) end in Cancel and Make; dialogs of settings end in Cancel and Apply; Exports only closes.

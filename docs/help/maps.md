# Similarity maps

A similarity map places records with similar selected features near one another.

## Example

Choose sentence embeddings and two text columns to explore similar wording or meaning, or numeric and categorical columns to compare records by their values.

## Steps

1. Choose an input type and columns.
2. For text embeddings, choose a model and how to [combine fields](combining.md).
3. Accept the suggested name or enter your own, then choose Make similarity map.

## Interpreting the result

Maps fit all records, including filtered-out records. Records with no usable embedding are excluded from a text map. Nearness suggests similarity under these settings; islands are not proof of meaningful themes. Brushing and filtering preserve the fit.

A new clustering's legend is placed right after its map, and the map is coloured by the clusters. The × next to the + in the Visualizations header removes all cards so a map and its legend get the whole area; importing data brings the default cards back (bars for the main categories and a histogram of one measure). The map and its input representation are saved separately. Choose an existing map with M in a Map card. Removing a card keeps the saved result. [Exports](data.md#exports) include arrays and settings.

## Input columns

Choose which columns contribute; text and static-word modes share their columns with phrase counting.

Their compact summary links to [shared phrase settings](descriptions.md#phrase-counting). Sentence and table inputs have their own column picker. Changes to phrase settings affect future analyses, never saved maps.

## Settings

Keep defaults initially; open advanced settings when you have a concrete comparison to make.

- UMAP emphasizes local neighborhoods. Neighbors changes their scale; epochs changes optimization effort.
- Linear projection is a fast linear summary of the prepared features. The app chooses the method from the input (currently PCA for every input, because it centres the data first) and does not ask.
- Use [field weights](combining.md#field-weights) to change relative influence, not record counts.

## Troubleshooting

If a map mostly separates missingness, inspect which columns/groups are present and compare a shared mean with a smaller identity contribution.

There is no universally best representation. Compare nearest records and representative examples, not only attractive shapes. [Combining fields](combining.md) explains the sparse-data trade-offs.

## Technical details

The saved input feature space is independent of the two-dimensional display.

Clustering can use either a saved input representation or explicitly selected 2D coordinates. Prefer the input representation when discovering groups; [clustering help](clustering.md) explains the distinction.

# Clustering and themes

Clustering proposes groups of similar records for you to inspect, describe and name.

## Example

Cluster a saved sentence-embedding representation, inspect distinctive phrases, then rename useful groups in the legend.

## Steps

1. Choose a named input representation, or explicitly choose current map settings.
2. Choose a clustering method and group count or minimum size.
3. Review the legend, linked map colors and [subset descriptions](descriptions.md).

## Interpreting the result

Clusters are candidate themes or profiles, not validated categories. One cluster per record can hide multiple themes in one text value. Original values and edited names remain intact when new analyses are created.

Saved representations retain semantic/numeric features; a saved similarity map uses only its 2D coordinates. Filters and highlights do not change either fit. Maps follow adjacent legends for colors.

## Methods

K-means is the fast default. Agglomerative clustering builds a hierarchy; HDBSCAN finds density groups and an Other group, and is experimental because on text vectors it often leaves most records in Other.

K-means requires a group count and assigns every usable record. Hierarchical cuts let you explore different granularity. Density selection controls reuse a saved tree. Other is not the same as missing: records without vectors have no cluster.

## Settings

Leave tuning controls collapsed until you have inspected the first result.

Phrase names are suggested by default (untick it to keep numbers) and reuse or build compatible counts. Names avoid function words and negations at their edges and phrases found in over a third of the other records. Every cluster gets a name: if no distinctive phrase is free, a looser one is used, and only a cluster with no usable phrase at all keeps its number. Rename all suggests up to the selected maximum number of phrases; edited names stay locked until cleared. Tree names and descendant colors remain editable. Naming suggestions describe clusters; they do not fit or change membership.

## Troubleshooting

Inspect example records and boundary cases in the table; compare several granularities before accepting a theme.

For sparse data, compare [aggregation strategies](combining.md) and missingness patterns. Cluster labels used as input are categories and discard the underlying semantic distances.

## Technical details

All current clustering methods use Euclidean distance; optional vector normalization changes its interpretation.

K-means is exact up to 5,000 records, with seed 42 and ten restarts, which keeps repeated runs close together; larger data uses MiniBatch K-means. Batch size, iterations and vector normalization are fixed (normalization is on for text inputs and off for 2D maps and table columns). Agglomerative clustering is limited to 5,000 usable records to bound memory. Current prepared features use up to 32 dimensions, independently of the 2D display. Embeddings and results remain local and can be [exported](data.md#exports).

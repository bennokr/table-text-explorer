# Combining columns

Choose how separate text columns contribute to one record vector.

## Example

Average title and summary columns within a Descriptions group, then combine that group with a Notes group.

## Steps

1. Start with Mean across columns.
2. Choose Mean within groups when your codebook defines meaningful variable groups.
3. Adjust Preserve group identity only when needed.

## Interpreting the result

Mean across columns retains a shared semantic space. Keep columns separate preserves column identity but can make sparse data separate by missingness. Grouped means preserve semantic vectors without converting themes into arbitrary category codes.

Grouping does not create observations or guarantee removal of missingness effects. A record with no usable text has no semantic vector. Compare coverage and representative neighbours before interpreting themes.

## Variable groups

Groups come from the codebook's group column, so they are the same in every map; change them in the codebook.

[Survey answers](survey.md) use the same groups, with each group counting equally. Ungrouped columns initially share Other columns. Column vectors are averaged within each group using column weights, then normalized. Available groups have equal influence in the shared mean, so a group with ten columns does not automatically outweigh one with two.

## Preserve group identity

The slider balances shared semantic meaning against keeping separate group positions.

At 0%, only the shared mean is used. At 100%, normalized group vectors are concatenated. Between them, both contribute; 20% identity is an experimental starting point, not a validated optimum. Missing groups have zero identity blocks and can still affect distances. The percentages control squared-distance contributions when both components are nonzero.

## Column weights

Equal column weights are the default; open the collapsed editor only to change relative influence.

Zero excludes a column's vector. Within grouped means, weights act inside each group, not as group weights. Reset restores equal weights. Text length and the number of populated columns are not additional explicit weights.

## Settings

Include column descriptions is a separate sentence-embedding option under advanced combining.

It can be combined with means, grouped means or separate columns. [Text model help](text-models.md#column-descriptions) explains prefixes and their limitations.

## Technical details

Identity blocks and the shared component are normalized before mixing with square-root weights.

The mixed vector is `[sqrt(1-a) × shared, sqrt(a) × separate]`, then normalized. Missing groups are zeros, never invented embeddings. At slider endpoints, unused components are omitted. If semantic vectors cancel exactly, final normalization uses the remaining nonzero component and the nominal distance balance is no longer exact. Exports record groups, weights, identity fraction and dimensions. Changing a slider never silently refits an existing map.

# Survey answers

Compare respondents by what they answered, treating questions they never saw as unknown rather than as differences.

## Example

A respondent who answered no to a screening question was never shown its follow-ups. They should not look different from a respondent who answered the follow-ups the same way as everyone else. Choose Survey answers, pick the question columns, and the map places people by the answers they actually gave.

## Steps

1. In New similarity map, choose Survey answers as the input.
2. Choose the question columns. Every column is listed, free-text columns are embedded and compared as text, and the others are compared by their values. Choosing one group of questions, such as the experience questions, makes a map of that part of the survey.
3. Read the summary of blank answers, change the settings if you need to, and choose Make similarity map.
4. Cluster the saved representation in [New clustering](clustering.md). Groups are named by their distinctive answers, and [stability](clustering.md#group-stability) tells you which ones to trust. Describe them with columns you did not use as input.

## Interpreting the result

Two respondents are close when they gave similar answers to the questions both answered. The map card's description says how many nearest neighbours the map shares with a map of the blank answers alone, next to the share expected by chance. A high share means the map mostly follows who answered what instead of what they said.

Cluster on the questions you want to explain and describe the clusters with the rest. A map of every question mostly separates kinds of respondent, such as birth history, instead of their experiences.

## Missing answers

A blank answer is never a difference: only questions that both respondents answered are compared.

The codebook can say when a question applies (its `applies_when` rule). A blank is then **not shown** when the rule says the question was routed past, **skipped** when it was shown and left blank, and **unknown** when there is no rule or it cannot be decided. All three are left out of the comparison and nothing is imputed. The summary counts them for the chosen columns, so you can see whether routing rules are present. Without rules the map still works, but a map of the blanks alone is less informative.

## Free-text weight

The free-text weight sets how much pooled text counts against the structured answers when both respondents wrote something.

Each answer is embedded with its question in front, then each respondent's answers are averaged. Two respondents are compared on text only if both wrote some; otherwise their structured answers alone decide. At 0% the text is ignored. The default of 35% against 50% for categories and 15% for numbers is a starting point from [one evaluation](#technical-details), not an optimum.

## Group balance

With group balance on, each variable group counts equally, so a large section cannot outvote a small one.

Groups come from the codebook, as for [combining columns](combining.md#variable-groups). Within a group every question counts by its weight. A group counts for a pair only if both answered something in it. With balance off, every question counts equally whatever its group.

## Common answers

When common answers count for little, agreeing on an answer nearly everyone gives does not make two respondents similar.

This applies to a categorical question where one answer is given by at least 80% of the people who answered it, such as a problem most respondents did not have. A pair counts on that question only when at least one of them gave a different answer. Turn it off if agreement on common answers matters for your question.

## Settings

Keep the defaults first; change the weights only when you have a concrete comparison to make.

Column weights work as in other inputs (zero leaves a column out). Records are compared pairwise, so survey answers support up to 3,000 records for now.

## Troubleshooting

If the map shares many neighbours with a map of blanks alone, choose the group of questions you want to explain.

Stable clusters are not necessarily meaningful. When two clusterings look alike, check that the groups differ in the answers you care about and not in who happened to be asked. Respondents who share few answered questions are drawn toward the typical distance, so their positions are less certain.

## Technical details

The distance averages per-group mean differences and shrinks toward the typical distance when evidence is thin.

Each block (categories, numbers, text) is divided by its median over valid pairs before weighting. With evidence `e` (shared answered questions, plus six for shared text) and baseline `D0`, the distance is `r × D + (1 − r) × D0` with `r = e / (e + 8)`. The matrix is turned into at most 32 coordinates by classical multidimensional scaling; clusterings and the linear map method use those coordinates, while a UMAP map uses each respondent's nearest neighbours under the survey distance itself. A question the codebook calls ordinal is compared by its position in the answer list, so neighbouring answers count as close. The saved result records the input columns, groups and settings. The method and its evaluation are in `docs/evaluation-survey.md`.

# Tables, annotations and exports

Keep source values intact while exploring types, adding annotations and exporting results.

## Example

Highlight records, create an annotation column and assign a label, then download the table with its new labels.

## Steps

1. Import CSV, JSON records, XLSX first-sheet data or SAV.
2. Use the table's column picker to show a manageable set of variables.
3. Inspect full records and adjust column types when needed.
4. Export annotations and saved analyses before closing.

## Nested JSON

Nested JSON records can be flattened into one column per path such as `a.b.c`, after you see the columns first.

The import dialog appears only when a record contains objects or lists. Flatten reads every object as dotted paths, so `{"a": {"b": "x"}}` becomes the column `a.b`. The strings found in a list are merged into one text, one value per line, so the phrase cloud and text models read them as a single answer; the lines stay separate in the cell. An object whose keys are themselves data, such as a phrase mapped to a score, with more than 30 different keys across records, becomes the list of its keys. Lists of numbers or mixed values have no flat form and are left out, and a list with a single value is just that value. Skip nested columns imports only the flat columns, and the original file is never changed.

## Column types

Type overrides change interpretation, never the original cell values.

Inference recognizes numeric values, repeated categories, booleans, dates and datetimes. Repeated text is far more likely to be a category than repeated numbers, so Column types sets two limits: text columns are categorical up to 50 distinct values by default (and when those repeat), numeric columns only up to 8. Column metadata such as labels, missing codes and declared types provides additional evidence. Columns identified as IDs are excluded from ordinary feature selection; sequential numeric values otherwise remain numeric. Metadata groups can initialize [grouped text means](combining.md#variable-groups).

## Exports

The export dialog downloads tables and individual saved analysis results; it does not save a reloadable workspace.

Table downloads include original data, independent annotations and cluster name columns. Representations/maps retain embeddings or coordinates, input descriptions, groups and analysis settings. Removing a visualization card does not delete its saved analysis. All data and computation stay on this machine.

## Settings

Use independent annotation columns to preserve human decisions across analyses.

Cluster names are edited through the legend's dictionary; new analyses do not erase them. Copy cluster names to an annotation when you need independent per-record edits. [Clustering help](clustering.md) explains names and memberships.

My leading recommendation is [better-filter-bar](https://github.com/marimo-team/better-filter-bar?utm_source=chatgpt.com) for the editor, or [Liqe](https://github.com/gajus/liqe?utm_source=chatgpt.com) for the query language and AST.

There is a gap in the JS/TS ecosystem for exactly what you're describing: a compact, editable search bar with typed filter pills, arbitrary Boolean nesting, matched brackets, and a structured AST.

Most query-builder libraries render nested forms. Most chip-based search bars support only flat filters.

The closest approach is to use an expression editor with a proper parser, then render recognized filter expressions as pills.

For example, the interface might look like:

title: database\*

AND

(

score ≥ 10

OR

active: true

)

AND NOT

status: archived

That is the interaction model I would optimize for.

## Libraries worth considering

| Library                                                                                            | Strengths                                                                             | Main limitation                                                                          |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [better-filter-bar](https://github.com/marimo-team/better-filter-bar?utm_source=chatgpt.com)       | Single-line editor, autocomplete, `AND/OR/NOT`, parentheses, typed fields, AST output | Syntax highlighting instead of real pills; early-stage v0.1.x                            |
| [garn FilterBar](https://garn.ohuba.com/components/filters?utm_source=chatgpt.com)                 | Editable pills, number ranges, booleans, recursive AND/OR filter model                | Nested groups use a query-builder tree; NOT and inline bracket editing aren't documented |
| [liqe](https://github.com/gajus/liqe?utm_source=chatgpt.com)                                       | Parser, serializer, typed AST, prefix wildcards, ranges, nested Boolean logic         | No UI                                                                                    |
| [react-querybuilder](https://react-querybuilder.js.org/?utm_source=chatgpt.com)                    | Mature query-tree editor, customizable components, NOT, import/export                 | Default layout is a form builder                                                         |
| [Vielzeug Query Bar](https://vielzeug.dev/refine/components/query-bar.html?utm_source=chatgpt.com) | Actual `<ore-query-bar>` web component, removable pills and text search               | Flat filter model; no general nested Boolean expressions                                 |

The first two are the closest UI matches. Liqe is the strongest candidate for reusable query-language functionality.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

+4



## Why better-filter-bar stands out

Its API already covers much of your requirement:

```
import { FilterBar } from "better-filter-bar/react";

<FilterBar
  schema={{
    fields: [
      { name: "title", type: "text" },
      { name: "score", type: "number" },
      { name: "active", type: "boolean" },
      { name: "status", type: "enum",
        options: [{ value: "open" }, { value: "closed" }] }
    ]
  }}
  onChange={(ast, raw) => console.log(ast, raw)}
/>
```

It supports expressions such as:

```
(title:postgres OR title:mysql)
AND score>=10
AND active:true
AND NOT status:closed
```

It produces an AST containing `filter`, `boolean`, `not`, and `free_text` nodes, with explicit operator precedence. Its underlying CodeMirror 6 editor is extensible.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub

+1



Two caveats: prefix matching and genuine FTS semantics are not provided as distinct operators, and the project has a small adoption footprint. I'd prototype with it before adopting it as a core dependency.

## For true pill editing, use CodeMirror 6

If the displayed filter terms need to be actual interactive pills, I would use [CodeMirror 6](https://codemirror.net/?utm_source=chatgpt.com) with the query parser.

CodeMirror supports:

- `Decoration.replace()` and `WidgetType` to display parsed terms as pills.
- `bracketMatching()` for nested parentheses.
- `EditorView.atomicRanges` to handle navigation and deletion of whole pills.
- Autocompletion and validation while editing.

These are supported extension mechanisms, so you don't have to implement cursor movement, text selection, and keyboard behavior from scratch.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://codemirror.net\&sz=32)

codemirror.net

+1



## AST design

I would maintain a small domain-specific AST like this:

```

type Expr =
  | {
      kind: "group";
      op: "and" | "or";
      children: Expr[];
    }
  | {
      kind: "not";
      child: Expr;
    }
  | {
      kind: "text";
      field: string | null;
      mode: "fts" | "prefix" | "exact";
      value: string;
    }
  | {
      kind: "number";
      field: string;
      op: "=" | ">" | ">=" | "<" | "<=" | "between";
      value: number | [number, number];
    }
  | {
      kind: "boolean";
      field: string;
      value: boolean;
    };

```

An important distinction: Lucene-style keyword matching, prefix matching and database FTS are different operations. Liqe supports `title:post*`, numeric ranges like `score:[10 TO 50]`, and Boolean expressions, but the backend compiler must implement the actual FTS and indexing semantics.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub



During editing, preserve the raw input alongside the last valid AST so unfinished expressions don't destroy the query state.

## Final choice

For the least implementation work: Try `better-filter-bar` first. If pills are mandatory, evaluate `garn FilterBar`, particularly its nested-groups demo.

For the best long-term control: CodeMirror 6 + Liqe (or a small custom grammar) + a domain AST. This gives you the exact inline interaction model, proper bracket behavior, keyboard editing, and independent query serialization.

I wouldn't use `react-querybuilder` as the primary UI for this particular requirement. Its query model is solid, but replacing its group-and-rule rendering with an inline expression editor is substantial customization.
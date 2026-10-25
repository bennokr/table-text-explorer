# Packed phrase clouds

Bokeh provides text glyphs but no built-in cloud packing layout. Use pinned d3-cloud
1.2.9 plus d3-dispatch for browser-local Canvas sprite packing, rendered as accessible
SVG text. No full D3 runtime, remote service, WebGL or WebGPU is needed.

Each phrase remains horizontal. Font size compresses the current within-field ranking
with log1p scaling; scores remain available on hover and unchanged in the table.
Layout uses deterministic central starts, responds to panel width, retries with more
space, and lists any unplaced phrases below the cloud. Retained terms never silently
vanish. Removing/replacing results disposes layouts and resize observers.

The authored JavaScript statement ceiling increases from 3500 to 3750 for the dedicated
packing/rendering module and regression coverage of resizing, placement completeness,
keyboard interaction and ranking scales. The preceding stage used 3459 statements.
Module/function/complexity limits and Python's total ceiling remain unchanged. This
keeps layout lifecycle code separate and readable rather than compressing it into the
inspector renderer or weakening per-file checks.

Sources: [d3-cloud API](https://github.com/jasondavies/d3-cloud),
[Bokeh text glyph](https://docs.bokeh.org/en/3.8.0/docs/reference/models/glyphs/text.html).

The bundled application increases by about 8.6 kB minified / 3.7 kB gzip compared
with the preceding build. The runtime dependencies added are d3-cloud and d3-dispatch.
`npm run test:cloud` checks keyboard actions, all 15 phrases retained after narrowing
to 160px, hidden/replaced layouts, and an extreme unplaceable phrase's fallback.
Aggregate renderer evidence: [cloud-results.json](cloud-results.json).

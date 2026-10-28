# Bundled runtime licenses

`onnxruntime.txt` is the MIT license from Microsoft ONNX Runtime commit
`8d85527a010e294a26b274749f74294b2a32cec5`, matching the installed package's
`__commit.txt`. Source:
https://github.com/microsoft/onnxruntime/blob/8d85527a010e294a26b274749f74294b2a32cec5/LICENSE

`prepare:runtime` copies this license alongside the retained WASM runtime assets.
Model, tokenizer, vector and dataset licenses/provenance live with their prepared
assets; see docs/data-and-assets.md.

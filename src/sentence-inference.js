// Exact token IDs avoid decoding/re-tokenizing chunk boundaries. This bundled BERT
// model uses one leading and one trailing special token, both included in pooling.
export function sentenceInputs(windows, tokenizer, Tensor) {
  const special = tokenizer.encode('');
  if (special.length !== 2) { throw new Error('Unexpected local sentence tokenizer format.'); }
  const length = Math.max(...windows.map(tokens => tokens.length)) + 2;
  const shape = [windows.length, length];
  const ids = new BigInt64Array(windows.length * length).fill(BigInt(tokenizer.pad_token_id));
  const mask = new BigInt64Array(ids.length);
  windows.forEach((tokens, row) => {
    ids.set([special[0], ...tokens, special[1]].map(BigInt), row * length);
    mask.fill(1n, row * length, row * length + tokens.length + 2);
  });
  return { input_ids: new Tensor('int64', ids, shape), attention_mask: new Tensor('int64', mask, shape),
    token_type_ids: new Tensor('int64', new BigInt64Array(ids.length), shape) };
}

export async function inferSentences(windows, extractor, runtime) {
  const inputs = sentenceInputs(windows, extractor.tokenizer, runtime.Tensor);
  let outputs = {}, pooled, normalized;
  try {
    outputs = await extractor.model(inputs);
    pooled = runtime.mean_pooling(outputs.last_hidden_state, inputs.attention_mask);
    normalized = pooled.normalize(2, -1);
    const dimensions = normalized.dims[1];
    return windows.map((_, row) => Float32Array.from(normalized.data.subarray(row * dimensions, (row + 1) * dimensions)));
  } finally {
    normalized?.dispose();
    pooled?.dispose();
    for (const tensor of Object.values(outputs)) { tensor.dispose(); }
    for (const tensor of Object.values(inputs)) { tensor.dispose(); }
  }
}

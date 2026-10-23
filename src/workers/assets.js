export async function readBytes(response, report) {
  const total = Number(response.headers.get('content-length'));
  const reader = response.body.getReader();
  const chunks = [];
  let completed = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) { break; }
    chunks.push(value);
    completed += value.length;
    report({ completed, total });
  }
  const bytes = new Uint8Array(completed);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export async function asset(url, report) {
  const response = await fetch(url);
  if (!response.ok) { throw new Error(`Local asset unavailable: ${url}. Run npm run prepare:vectors.`); }
  return readBytes(response, report);
}

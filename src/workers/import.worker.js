import { parseTable } from '../table-readers.js';

self.onmessage = ({ data: { id, payload } }) => {
  try {
    self.postMessage({ id, progress: { message: 'Parsing table locally' } });
    self.postMessage({ id, result: parseTable(payload.bytes, payload.name) });
  } catch (error) { self.postMessage({ id, error: String(error.message ?? error) }); }
};

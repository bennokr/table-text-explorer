// Reads and writes embedding files so vectors made elsewhere (or exported earlier) are not recomputed.
// Two formats: NumPy .npy (float32 or float64, shape records x dimensions) and raw little-endian
// float32 (.f32 or .bin), whose dimension is the file size divided by the record count.
const NPY_MAGIC = [0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59];
const NPY_TYPES = { '<f4': Float32Array, '<f8': Float64Array };

function npyHeader(bytes) {
  const view = new DataView(bytes);
  if (!NPY_MAGIC.every((value, index) => view.getUint8(index) === value)) { throw new Error('Not a NumPy .npy file.'); }
  const version = view.getUint8(6);
  const length = version === 1 ? view.getUint16(8, true) : view.getUint32(8, true);
  const start = version === 1 ? 10 : 12;
  return { text: new TextDecoder().decode(new Uint8Array(bytes, start, length)), offset: start + length };
}

function npyArray(bytes) {
  const { text, offset } = npyHeader(bytes);
  const type = NPY_TYPES[/'descr':\s*'([^']+)'/u.exec(text)?.[1]];
  const shape = /'shape':\s*\((\d+),\s*(\d+)\s*,?\s*\)/u.exec(text);
  if (!type) { throw new Error('Save the .npy vectors as float32 or float64.'); }
  if (!shape || /'fortran_order':\s*True/u.test(text)) { throw new Error('The .npy file must be a C-ordered records x dimensions array.'); }
  const [rows, dimensions] = [Number(shape[1]), Number(shape[2])];
  const values = new type(bytes.slice(offset, offset + rows * dimensions * type.BYTES_PER_ELEMENT));
  return { rows, dimensions, values: Float32Array.from(values) };
}

function rawArray(bytes, rows) {
  const floats = bytes.byteLength / 4;
  if (!Number.isInteger(floats) || !rows || !Number.isInteger(floats / rows)) {
    throw new Error(`A raw float32 file must hold a whole number of values per record; this one has ${floats} values for ${rows} records.`);
  }
  return { rows, dimensions: floats / rows, values: new Float32Array(bytes) };
}

// Unit-length vectors, like the app's own sentence vectors. All-zero rows (no text) are left out, as they are
// when the app encodes the text itself, so rowIds lists the records that have a vector.
function unitRows({ rows, dimensions, values }) {
  const features = new Float32Array(values.length), rowIds = [];
  for (let row = 0; row < rows; row += 1) {
    const vector = values.subarray(row * dimensions, (row + 1) * dimensions);
    const norm = Math.hypot(...vector);
    if (!Number.isFinite(norm)) { throw new Error(`Record ${row + 1} has a vector with missing or infinite values.`); }
    if (norm === 0) { continue; }
    features.set(vector.map(value => value / norm), rowIds.length * dimensions);
    rowIds.push(row);
  }
  return { features: features.slice(0, rowIds.length * dimensions), dimensions, rowIds };
}

export function readEmbeddings(bytes, fileName, rows) {
  const array = fileName.toLowerCase().endsWith('.npy') ? npyArray(bytes) : rawArray(bytes, rows);
  if (array.rows !== rows) {
    throw new Error(`The file holds ${array.rows} vectors but the table has ${rows} records. Vectors must be in table order, one per record.`);
  }
  return unitRows(array);
}

// Writes records x dimensions float32 vectors as .npy version 1.0, padded so the data starts on a 64-byte boundary.
export function npyBlob(features, rows, dimensions) {
  const dictionary = `{'descr': '<f4', 'fortran_order': False, 'shape': (${rows}, ${dimensions}), }`;
  const padding = (64 - ((10 + dictionary.length + 1) % 64)) % 64;
  const header = `${dictionary}${' '.repeat(padding)}\n`;
  const prefix = new Uint8Array(10);
  prefix.set([...NPY_MAGIC, 1, 0]);
  new DataView(prefix.buffer).setUint16(8, header.length, true);
  return new Blob([prefix, new TextEncoder().encode(header), features], { type: 'application/octet-stream' });
}

// One row per table record, zeros for records without a vector, so the file imports back unchanged.
export function npyForRecords(features, rowIds, dimensions, rows) {
  const table = new Float32Array(rows * dimensions);
  rowIds.forEach((id, index) => table.set(features.subarray(index * dimensions, (index + 1) * dimensions), id * dimensions));
  return npyBlob(table, rows, dimensions);
}

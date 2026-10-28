// Reuse the application's XLSX dependency for the local Python synthesis tool.
import XLSX from 'xlsx';
import { readFile, writeFile } from 'node:fs/promises';

const [operation, path] = process.argv.slice(2);
if (operation === 'read') {
  const workbook = XLSX.read(await readFile(path));
  process.stdout.write(JSON.stringify(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: null })));
} else if (operation === 'write') {
  const chunks = [];
  for await (const chunk of process.stdin) { chunks.push(chunk); }
  const rows = JSON.parse(Buffer.concat(chunks).toString());
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Synthetic RMC');
  await writeFile(path, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
} else { throw new Error('Choose read or write and a local workbook path.'); }

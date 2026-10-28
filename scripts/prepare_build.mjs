import { prepareExamples } from './examples.mjs';
import { cp, mkdir, rm } from 'node:fs/promises';

// Explicit allowlist: private fixtures, reference data and unknown public files stay out.
const destination = '.cache/public-build';
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await prepareExamples(destination, false);
await cp('public/vendor', `${destination}/vendor`, { recursive: true });

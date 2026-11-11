import { prepareExamples } from './examples.mjs';
import { restoreDataRelease } from './restore_data_release.mjs';
import { cp, mkdir, rm } from 'node:fs/promises';

// Explicit allowlist: private fixtures, reference data and unknown public files stay out.
const destination = '.cache/public-build';
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
// Released datasets are as approved as tracked ones; private fixtures are still left out.
await prepareExamples(destination, false, await restoreDataRelease());
await cp('public/vendor', `${destination}/vendor`, { recursive: true });

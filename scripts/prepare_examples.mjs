import { prepareExamples } from './examples.mjs';
import { restoreDataRelease } from './restore_data_release.mjs';

await prepareExamples('public', true, await restoreDataRelease());

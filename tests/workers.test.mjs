import assert from 'node:assert/strict';
import test from 'node:test';
import { Workers } from '../src/workers/client.js';

class FakeWorker {
  postMessage({ id }) { this.id = id; }
  send(message) { this.onmessage({ data: { id: this.id, ...message } }); }
  terminate() { this.terminated = true; }
}

async function withWorkers(run) {
  const previous = globalThis.Worker;
  globalThis.Worker = FakeWorker;
  const workers = new Workers();
  try { await run(workers); }
  finally { workers.cancel(); globalThis.Worker = previous; }
}

test('runtime readiness messages keep the analysis pending and persist across jobs', async () => {
  await withWorkers(async workers => {
    assert.deepEqual(workers.runtime, { python: 'idle', sklearn: 'idle' });
    const transitions = [];
    workers.addEventListener('runtime', () => transitions.push({ ...workers.runtime }));
    const pending = workers.run('python', {}, () => {});
    const worker = workers.instances.get('python');
    worker.send({ runtime: { python: 'loaded', sklearn: 'idle' } });
    assert.ok(workers.pending);
    assert.equal(workers.runtime.sklearn, 'idle');
    worker.send({ runtime: { python: 'loaded', sklearn: 'loaded' } });
    assert.ok(workers.pending);
    worker.send({ result: { coordinates: [[1, 2]] } });
    assert.deepEqual(await pending, { coordinates: [[1, 2]] });
    const next = workers.run('python', {}, () => {});
    assert.equal(workers.instances.get('python'), worker);
    assert.equal(workers.runtime.sklearn, 'loaded');
    worker.send({ result: 'done' });
    assert.equal(await next, 'done');
    assert.deepEqual(transitions, [{ python: 'loaded', sklearn: 'idle' }, { python: 'loaded', sklearn: 'loaded' }]);
  });
});

test('cancellation resets loaded indicators and ignores messages from terminated workers', async () => {
  await withWorkers(async workers => {
    const pending = workers.run('python', {}, () => {});
    const rejected = assert.rejects(pending, /cancelled/u);
    const worker = workers.instances.get('python');
    worker.send({ runtime: { python: 'loaded', sklearn: 'loaded' } });
    workers.cancel();
    await rejected;
    assert.equal(worker.terminated, true);
    assert.deepEqual(workers.runtime, { python: 'idle', sklearn: 'idle' });
    worker.send({ runtime: { python: 'loaded', sklearn: 'loaded' } });
    assert.deepEqual(workers.runtime, { python: 'idle', sklearn: 'idle' });
  });
});

test('sentence work remains opt-in and progress renews the inactivity timeout during long fits', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  await withWorkers(async workers => {
    assert.equal(workers.instances.size, 0);
    const pending = workers.run('sentences', {}, () => {});
    const worker = workers.instances.get('sentences');
    context.mock.timers.tick(239000);
    worker.send({ progress: { message: 'Embedding sentences', completed: 10, total: 1000 } });
    context.mock.timers.tick(239000);
    assert.ok(workers.pending);
    assert.notEqual(worker.terminated, true);
    worker.send({ result: 'done' });
    assert.equal(await pending, 'done');
  });
});

test('startup warmup survives import cancellation and queues analysis until ready', async () => {
  await withWorkers(async workers => {
    const warming = workers.warmup();
    const worker = workers.instances.get('python');
    worker.send({ runtime: { python: 'loading', sklearn: 'idle' } });
    workers.cancel();
    assert.notEqual(worker.terminated, true);
    const analysis = workers.run('python', { task: 'cluster' }, () => {});
    worker.send({ runtime: { python: 'loaded', sklearn: 'loaded' } });
    worker.send({ result: true });
    await warming;
    await Promise.resolve();
    worker.send({ result: 'clustered' });
    assert.equal(await analysis, 'clustered');
    assert.equal(workers.instances.get('python'), worker);
  });
});

test('startup worker failure reports failed states and allows retry', async () => {
  await withWorkers(async workers => {
    const warming = workers.warmup();
    const worker = workers.instances.get('python');
    worker.onerror({ message: 'missing local asset' });
    await warming;
    assert.deepEqual(workers.runtime, { python: 'failed', sklearn: 'failed' });
    const retry = workers.warmup();
    const replacement = workers.instances.get('python');
    assert.notEqual(replacement, worker);
    replacement.send({ runtime: { python: 'loaded', sklearn: 'loaded' } });
    replacement.send({ result: true });
    await retry;
    assert.equal(workers.runtime.sklearn, 'loaded');
  });
});

test('stalled startup fails instead of ignoring its timeout, and can be retried', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  await withWorkers(async workers => {
    const warming = workers.warmup();
    const worker = workers.instances.get('python');
    context.mock.timers.tick(240000);
    await warming;
    assert.equal(worker.terminated, true);
    assert.equal(workers.pending, null);
    assert.deepEqual(workers.runtime, { python: 'failed', sklearn: 'failed' });
    const retry = workers.warmup();
    const replacement = workers.instances.get('python');
    worker.onerror({ message: 'late error from terminated worker' });
    assert.notEqual(replacement.terminated, true);
    replacement.send({ runtime: { python: 'loaded', sklearn: 'loaded' } });
    replacement.send({ result: true });
    await retry;
    assert.equal(workers.runtime.sklearn, 'loaded');
  });
});

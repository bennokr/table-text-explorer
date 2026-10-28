const createWorker = {
  import: () => new Worker(new URL('./import.worker.js', import.meta.url), { type: 'module' }),
  sentences: () => new Worker(new URL('./sentences.worker.js', import.meta.url), { type: 'module' }),
  words: () => new Worker(new URL('./words.worker.js', import.meta.url), { type: 'module' }),
  python: () => new Worker(new URL('./analysis.worker.js', import.meta.url), { type: 'module' }),
  umap: () => new Worker(new URL('./umap.worker.js', import.meta.url), { type: 'module' }),
};

export class Workers extends EventTarget {
  instances = new Map();
  sequence = 0;
  pending = null;
  runtime = { python: 'idle', sklearn: 'idle' };
  epoch = 0;

  run(kind, payload, progress) {
    if (this.warming) {
      const epoch = this.epoch;
      return this.warming.then(() => {
        if (epoch !== this.epoch) { throw new Error('Analysis cancelled.'); }
        return this.run(kind, payload, progress);
      });
    }
    if (this.pending) { return Promise.reject(new Error('An analysis is already running.')); }
    if (!this.instances.has(kind)) { this.instances.set(kind, createWorker[kind]()); }
    const worker = this.instances.get(kind);
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending = { reject, kind, warmup: payload.task === 'initialize' };
      const armTimeout = () => {
        clearTimeout(this.pending.timeout);
        this.pending.timeout = setTimeout(() => this.fail('The worker stopped responding. Try fewer features.'), 240000);
      };
      armTimeout();
      worker.onmessage = ({ data }) => {
        if (data.id !== id || this.instances.get(kind) !== worker) { return; }
        if (data.runtime) { this.setRuntime(data.runtime); return; }
        if (data.progress) { armTimeout(); progress(data.progress); return; }
        clearTimeout(this.pending.timeout);
        this.pending = null;
        if (data.error) { reject(new Error(data.error)); } else { resolve(data.result); }
        setTimeout(() => this.dispatchEvent(new Event('idle')), 0);
      };
      worker.onerror = event => {
        if (this.instances.get(kind) !== worker) { return; }
        this.fail(`Worker failed: ${event.message}`);
      };
      worker.postMessage({ id, payload });
    });
  }

  warmup() {
    if (this.warming || this.runtime.sklearn === 'loaded') { return this.warming; }
    this.warming = this.run('python', { task: 'initialize' }, () => {})
      .catch(() => {}).finally(() => { this.warming = null; });
    return this.warming;
  }

  setRuntime(runtime) {
    this.runtime = runtime;
    this.dispatchEvent(new Event('runtime'));
  }

  fail(message) {
    const loading = this.pending?.warmup;
    if (loading) { this.pending.warmup = false; }
    this.cancel(message);
    if (loading) { this.setRuntime({ python: 'failed', sklearn: 'failed' }); }
  }

  cancel(message = 'Analysis cancelled.') {
    this.epoch += 1;
    if (!this.pending || this.pending.warmup) { return; }
    for (const worker of this.instances.values()) { worker.terminate(); }
    this.instances.clear();
    this.setRuntime({ python: 'idle', sklearn: 'idle' });
    clearTimeout(this.pending?.timeout);
    this.pending?.reject(new Error(message));
    this.pending = null;
    this.dispatchEvent(new CustomEvent('reset', { detail: message }));
  }
}

const createWorker = {
  python: () => new Worker(new URL('./analysis.worker.js', import.meta.url), { type: 'module' }),
  umap: () => new Worker(new URL('./umap.worker.js', import.meta.url), { type: 'module' }),
};

export class Workers {
  instances = new Map();
  sequence = 0;
  pending = null;

  run(kind, payload, progress) {
    if (this.pending) { return Promise.reject(new Error('An analysis is already running.')); }
    if (!this.instances.has(kind)) { this.instances.set(kind, createWorker[kind]()); }
    const worker = this.instances.get(kind);
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending = { reject };
      const timeout = setTimeout(() => this.cancel('The worker timed out. Try fewer features.'), 240000);
      this.pending.timeout = timeout;
      worker.onmessage = ({ data }) => {
        if (data.id !== id) { return; }
        if (data.progress) { progress(data.progress); return; }
        clearTimeout(timeout);
        this.pending = null;
        if (data.error) { reject(new Error(data.error)); } else { resolve(data.result); }
      };
      worker.onerror = event => this.cancel(`Worker failed: ${event.message}`);
      worker.postMessage({ id, payload });
    });
  }

  cancel(message = 'Projection cancelled.') {
    for (const worker of this.instances.values()) { worker.terminate(); }
    this.instances.clear();
    clearTimeout(this.pending?.timeout);
    this.pending?.reject(new Error(message));
    this.pending = null;
  }
}

import { featureFields } from './features.js';
import { showMap } from './analysis-views.js';
import { complete } from './status.js';
import { Events } from './events.js';

export class Projection {
  generation = 0;

  constructor(model, analysis) { this.model = model; this.analysis = analysis; }

  cancel() {
    this.generation += 1;
    this.model.fittingViewId = null;
    this.model.fitProgress = null;
    this.analysis.cancel();
    this.analysis.busy(false);
  }

  fitted(request, result, config) {
    const positions = new Map(result.rowIds.map((id, index) => [id, result.coordinates[index]]));
    const axis = d => this.model.rows.map((_, id) => positions.get(id)?.[d] ?? NaN);
    return { fitted: true, method: request.method, mapName: request.name, name: `${request.name}-2d`,
      count: result.rowIds.length, config, coverage: result.coverage, inputFields: result.inputFields,
      aggregation: result.aggregation,
      dimensions: result.dimensions, rowIds: result.rowIds, representationId: result.representationId,
      featureSetId: result.featureSetId,
      x: { values: axis(0), name: `${request.method.toUpperCase()} 1` },
      y: { values: axis(1), name: `${request.method.toUpperCase()} 2` } };
  }

  publish(request, result) {
    this.model.analysisViewId = showMap(this.model, result, request.targetViewId).id;
    this.model.emit(Events.ANALYSIS_CARD);
    this.model.emit(Events.RESULTS);
    this.model.emit(Events.VIEWS);
  }

  feedback(request, message, error = false) {
    this.model.fitProgress = { viewId: request.targetViewId ?? 'new-map', message, error };
    this.model.emit(Events.FIT_PROGRESS);
  }

  async fit(request) {
    if (this.model.analysisBusy) { return; }
    if (!featureFields(this.model).length) {
      this.feedback(request, 'Choose input columns in New similarity map.', true);
      complete('Choose input columns in New similarity map.', true);
      return;
    }
    const generation = this.generation;
    const config = structuredClone(this.model.config);
    this.model.fittingViewId = request.targetViewId ?? 'new-map';
    this.feedback(request, 'Preparing similarity map…');
    this.analysis.busy(true);
    try {
      const result = await this.analysis.project(request.method, request.name);
      if (generation !== this.generation) { return; }
      const saved = this.model.results.add('projection', this.fitted(request, result, config));
      this.publish(request, saved);
      this.feedback(request, `${request.name} saved in Exports.`);
      complete(`${request.name} · ${result.rowIds.length} records · ${this.model.rows.length - result.rowIds.length} without vectors`);
      return saved;
    } catch (error) {
      if (generation === this.generation) {
        this.feedback(request, error.message, true);
        complete(error.message, true);
      }
    } finally {
      if (generation === this.generation) {
        this.model.fittingViewId = null;
        this.analysis.busy(false);
      }
    }
  }
}

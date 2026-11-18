import { phraseSettings } from './phrase-config.js';
import { surveyAnswers } from './survey-input.js';
import { treeMembers, treeParents, treeChildren, treeRoot } from './cluster-tree.js';

function namingGroups(result) {
  const ids = (result.cut ?? Object.keys(result.groups).map(Number)).slice(0, 100);
  const chosen = new Set(ids.map(String));
  const parents = result.tree ? treeParents(result) : [];
  return ids.map(id => {
    const subset = result.tree ? treeMembers(result, id)
      : result.rowIds.filter((_, index) => result.labels[index] === Number(id));
    const members = new Set(subset);
    const siblings = result.tree ? treeChildren(result, parents[id]) : Object.keys(result.groups).map(Number);
    const group = result.groups[id];
    return { id: String(id), name: group.name, subset,
      comparison: result.rowIds.filter(row => !members.has(row)),
      locked: Boolean(group.nameEdited) || Number(id) === -1 || Boolean(result.tree && id === treeRoot(result)),
      blocked: siblings.filter(sibling => !chosen.has(String(sibling))).map(sibling => result.groups[sibling]?.name ?? '') };
  });
}

// A group that re-clustering does not reproduce is a pattern in this sample, so its answers do not name it.
const UNSTABLE = 0.6;

function applyNames(result, output) {
  for (const [id, evidence] of Object.entries(output.labels)) {
    if (result.groups[id].nameEdited) { continue; }
    result.groups[id].name = evidence.phrase;
    result.groups[id].nameEvidence = evidence;
  }
}

// Survey clusters are named by the answers that set them apart; there is no phrase index to consult.
async function nameSurveyGroups(model, analysis, result) {
  const groups = namingGroups(result).map(group => ({ ...group, locked: group.locked || result.groups[group.id].stability < UNSTABLE }));
  if (groups.every(group => group.locked)) { return; }
  applyNames(result, await analysis.workers.run('python', { task: 'survey_names', rows: model.rows.length,
    answers: surveyAnswers(model, result.config), groups, maxPhrases: result.maxNamePhrases ?? 4 }, analysis.progress));
}

export async function nameClusters(model, analysis, result) {
  if (result.config?.mode === 'survey') { return nameSurveyGroups(model, analysis, result); }
  const settings = phraseSettings(model);
  const groups = namingGroups(result);
  if (!settings.fields.length || groups.every(group => group.locked)) { return; }
  const index = await analysis.textIndexes.ensure(settings, analysis.progress);
  applyNames(result, await analysis.workers.run('python', { task: 'cluster_names', indexId: index.indexId,
    groups, maxPhrases: result.maxNamePhrases ?? 4 }, analysis.progress));
}

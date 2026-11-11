import { mountNameLength, nameLength } from './cluster-name-controls.js';
import { syncDensityControls } from './density-controls.js';
import { treeRoot } from './cluster-tree.js';
import { element } from './dom.js';
import { mountTreeLegend, describeBranch, revealTreeCut } from './cluster-tree-legend.js';
import { combineSelection } from './selection.js';
import { legendRows, renameCluster, colorCluster, clusterMembers } from './cluster-legend-data.js';
import { Events } from './events.js';

const nameHelp = 'Name up to 100 active groups from all-record text; preserves edited names. Clear a name to unlock it.';

export class ClusterLegend {
  rows = new Map();

  constructor(model, config, container) {
    this.model = model;
    this.result = model.resultFor(config);
    this.root = element('div', { class: 'cluster-legend' });
    this.nameButton = element('button', { type: 'button', text: 'Rename all',
      title: nameHelp,
      onclick: () => { model.namingResult = this.result; model.emit(Events.NAME_CLUSTERS); } });

    this.absent = element('p', { class: 'legend-absent', hidden: '' });
    if (this.result.tree) { mountTreeLegend(this); }
    else { for (const group of this.groupRows()) { this.add(group); } }
    const naming = element('div', { class: 'cluster-naming' }, [this.nameButton]);
    this.nameLength = mountNameLength(naming, this.result.maxNamePhrases);
    this.nameLength.onchange = () => {
      this.result.maxNamePhrases = nameLength(this.nameLength);
      model.emit(Events.RESULTS);
    };
    this.root.append(this.absent, naming);
    container.replaceChildren(this.root);
    this.cleanup = [Events.VIEW, Events.SELECTION, Events.RESULTS, Events.BUSY].map(type => model.on(type, () => this.paint()));
    this.paint();
  }

  groupRows() { return legendRows(this.model, this.result); }

  add(group, parent = this.root) {
    const name = element('input', { class: 'cluster-name', value: group.name,
      title: `Cluster ID ${group.id} · edit name`, 'aria-label': `Name for cluster ${group.id}` });
    const commit = () => { name.value = renameCluster(this.model, this.result, group.id, name.value); };
    name.onchange = commit;
    name.onkeydown = event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        commit();
        name.blur();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        name.value = this.result.groups[group.id].name;
        name.blur();
      }
    };
    const color = element('input', { type: 'color', value: group.color,
      'aria-label': `Color for cluster ${group.id}`, title: this.result.tree ? 'Change branch color and descendant shades; preserves individually edited branches' : 'Change cluster color',
      onchange: event => colorCluster(this.model, this.result, group.id, event.target.value) });
    const count = element('button', { type: 'button', class: 'cluster-count',
      onclick: event => this.highlight(group.id, event) });
    const fill = element('span', { class: 'cluster-bar-fill' });
    const bar = element('button', { type: 'button', class: 'cluster-bar',
      onclick: event => this.highlight(group.id, event) }, [fill]);
    const row = element('div', { class: 'cluster-row', 'data-cluster-id': group.id }, [color, name, count, bar]);
    this.rows.set(group.id, { row, name, color, count, bar, fill });
    if (this.result.tree && group.id !== '-1') {
      row.append(element('button', { type: 'button', class: 'cluster-describe', text: '≡',
        title: 'Describe this branch', 'aria-label': `Describe branch ${group.id}`,
        onclick: () => describeBranch(this.model, this.result, group.id) }));
    }
    parent.append(row);
  }

  highlight(id, event) {
    const ids = clusterMembers(this.model, this.result, id);
    const mode = event.shiftKey ? 'add' : event.altKey ? 'intersect' : 'replace';
    this.model.select(combineSelection(this.model.selected, ids, mode));
  }

  paint() {
    const groups = this.groupRows();
    this.nameButton.disabled = this.model.analysisBusy;
    this.nameLength.disabled = this.model.analysisBusy;
    this.nameLength.value = String(this.result.maxNamePhrases ?? 4);
    this.nameButton.title = this.result.namingError ?? nameHelp;
    if (this.cutCount) {
      this.cutCount.value = this.result.cut.length;
    }
    if (this.result.tree) { revealTreeCut(this); }
    syncDensityControls(this);
    for (const group of groups) { this.paintRow(group); }
    const assigned = this.result.tree ? groups.find(group => Number(group.id) === treeRoot(this.result)).count
      : groups.reduce((count, group) => count + group.count, 0);
    const absent = this.model.visible.length - assigned;
    this.absent.hidden = !absent;
    this.absent.textContent = `${absent} visible records without cluster membership`;
  }

  paintRow(group) {
    const controls = this.rows.get(group.id);
    if (!controls) { return; }
    controls.row.classList.toggle('active-cut', this.result.cut?.includes(Number(group.id)) ?? false);
    if (document.activeElement !== controls.name) { controls.name.value = group.name; }
    controls.color.value = group.color;
    controls.count.textContent = group.count === group.total ? String(group.count) : `${group.count}/${group.total}`;
    const label = `${group.name}: ${group.count} visible / ${group.total} total · ${group.highlighted} highlighted`;
    controls.row.classList.toggle('highlighted', group.highlighted > 0);
    for (const button of [controls.count, controls.bar]) {
      button.title = `${label} · Click to highlight; Shift adds; Alt intersects`;
      button.setAttribute('aria-label', `Highlight ${group.name} · ${group.count} visible records`);
    }
    controls.fill.style.width = `${group.width}%`;
    controls.fill.style.backgroundColor = group.color;
  }

  description() { return 'Edit cluster names and colors. Bars show visible counts; click a count or bar to highlight records.'; }
  destroy() { this.cleanup.forEach(remove => remove()); this.root.remove(); }
}

/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { App } from 'obsidian';
import { FileOperator } from '../../src/renderer/fileOperator';
import { QuerySyncManager } from '../../src/query/querySyncManager';
import { PositionedObsidianTask } from '../../src/taskModule/task';
import { fireEvent, loadSvelte, render, srcPath, waitFor } from './testUtils';

let QueryDisplay: any;
let QueryEditor: any;
beforeAll(async () => {
  QueryDisplay = await loadSvelte(srcPath('ui/QueryDisplay.svelte'));
  QueryEditor = await loadSvelte(srcPath('ui/QueryEditor.svelte'));
});

function fixture(source = 'editMode: false') {
  const app = new App();
  const tasks = [
    new PositionedObsidianTask({ id: 'tc-org-low', content: 'Low work task', priority: 4, project: { id: 'work', name: 'Work', color: '#dd0000' }, description: 'Unique low-task detail', docPosition: { filePath: 'tasks.md', start: { line: 0, col: 0 }, end: { line: 0, col: 0 } } }),
    new PositionedObsidianTask({ id: 'tc-org-high', content: 'High work task', priority: 1, project: { id: 'work', name: 'Work', color: '#dd0000' }, docPosition: { filePath: 'tasks.md', start: { line: 1, col: 0 }, end: { line: 1, col: 0 } } }),
    new PositionedObsidianTask({ id: 'tc-org-none', content: 'No-project task', completed: true, docPosition: { filePath: 'tasks.md', start: { line: 2, col: 0 }, end: { line: 2, col: 0 } } })
  ];
  const taskSource = '- [ ] Low work task #TaskCard [project:: Work] ^tc-org-low\n- [ ] High work task #TaskCard [project:: Work] ^tc-org-high\n- [x] No-project task #TaskCard ^tc-org-none';
  (app.vault as any).__setFile('tasks.md', taskSource);
  const plugin = { app, settings: { displaySettings: { queryDisplayMode: 'list' } }, cache: { taskCache: { status: { initialized: true }, getLength: () => 122 } }, fileOperator: new FileOperator(null as any, app) } as any;
  const querySyncManager = new QuerySyncManager(plugin, 'taskcard', source, { sectionEl: document.createElement('div'), ctx: { sourcePath: 'query.md', getSectionInfo: () => ({ lineStart: 0, lineEnd: (app.vault as any).__getContent('query.md').split('\n').indexOf('```', 1) }) } as any, sourcePath: 'query.md', lineStart: 0, lineEnd: 8 });
  (app.vault as any).__setFile('query.md', '```taskcard\n'+source+'\n```\n\n# After query\nKeep this paragraph.');
  return { plugin, querySyncManager, taskList: tasks, taskSource };
}

function readQuery(props: ReturnType<typeof fixture>) {
  return (props.plugin.app.vault as any).__getContent('query.md') as string;
}

function reopen(props: ReturnType<typeof fixture>) {
  const source = readQuery(props).split('```taskcard\n')[1].split('\n```')[0];
  return new QuerySyncManager(props.plugin, 'taskcard', source, props.querySyncManager.codeBlockMetadata);
}

function editor(props: ReturnType<typeof fixture>, manager = props.querySyncManager) {
  return render(QueryEditor, { querySyncManager: manager, query: manager.taskQuery, options: { priorityOptions: [], projectOptions: [], labelOptions: [], completedOptions: [] } });
}

test('saved settings render organized tasks and unique totals without organization controls in reading view', () => {
  const props = fixture('groupBy: "project"\nsortBy: "priority"\ncompletedLast: true\neditMode: false');
  const { container } = render(QueryDisplay, props);
  expect([...container.querySelectorAll('.group-label')].map(n => n.textContent)).toEqual(['Work', 'No project']);
  expect([...container.querySelectorAll('.matrix-title')].map(n => n.textContent.trim())).toEqual(['High work task', 'Low work task', 'No-project task']);
  expect(container.querySelector('.query-header')).toHaveTextContent('3 shown / 122 in vault');
  expect(container.querySelector('.query-footer')).toHaveTextContent('1 / 3 done');
  expect(container.querySelectorAll('select,.organize-controls,.rank,.group-toggle')).toHaveLength(0);
});

test('organization choices stay in the editor draft until Save and round-trip without editing task notes', async () => {
  const props = fixture('priority: [1,4]\ncompleted: [false]\nfile: \"tasks.md\"\neditMode: true');
  const before = readQuery(props);
  const { container, unmount } = editor(props);
  await fireEvent.change(container.querySelector('select[aria-label="Group by"]'), { target: { value: 'priority' } });
  await fireEvent.change(container.querySelector('select[aria-label="Sort by"]'), { target: { value: 'title' } });
  await fireEvent.click(container.querySelector('input[aria-label="Completed last"]'));
  expect(readQuery(props)).toBe(before);
  await fireEvent.click(container.querySelector('.save-button'));
  await waitFor(() => expect(readQuery(props)).toContain('editMode: false'));
  expect(readQuery(props)).toContain('groupBy: "priority"\nsortBy: "title"\ncompletedLast: true');
  expect(readQuery(props)).toContain('# After query\nKeep this paragraph.');
  expect((props.plugin.app.vault as any).__getContent('tasks.md')).toBe(props.taskSource);
  unmount();
  const saved = reopen(props);
  expect(saved.taskQuery.priorityQuery).toEqual([1, 4]);
  expect(saved.taskQuery.completedQuery).toEqual([false]);
  expect(saved.taskQuery.filePathQuery).toBe('tasks.md');
  const display = render(QueryDisplay, { ...props, taskList: props.taskList.filter(task => !task.completed), querySyncManager: saved });
  expect([...display.container.querySelectorAll('.group-label')].map(n => n.textContent)).toEqual(['Highest', 'Low']);
  expect(display.container.querySelector('.organize-controls')).toBeNull();
  display.unmount();
  const reopened = editor(props, saved);
  expect(reopened.container.querySelector('[aria-label="Group by"]')).toHaveValue('priority');
  expect(reopened.container.querySelector('[aria-label="Sort by"]')).toHaveValue('title');
  expect(reopened.container.querySelector('[aria-label="Completed last"]')).toBeChecked();
});

test('completion reorders the same task within its section and updates the real source task', async () => {
  const props = fixture('groupBy: "project"\ncompletedLast: true\neditMode: false');
  const { container } = render(QueryDisplay, props);
  await fireEvent.click(container.querySelector('input.task-card-checkbox'));
  await waitFor(() => expect((props.plugin.app.vault as any).__getContent('tasks.md')).toContain('- [x] Low work task'));
  expect([...container.querySelectorAll('.matrix-title')].map(n => n.textContent.trim())).toEqual(['High work task', 'Low work task', 'No-project task']);
  expect(container.querySelector('.query-footer')).toHaveTextContent('2 / 3 done');
});

test('completion keeps an expanded task open when completed-last changes its position', async () => {
  const props = fixture('groupBy: "project"\ncompletedLast: true\neditMode: false');
  const { container } = render(QueryDisplay, props);
  await fireEvent.click(container.querySelector('button[aria-label="Expand Low work task"]'));
  await fireEvent.click(container.querySelector('input.task-card-checkbox'));
  await waitFor(() => expect(container.querySelector('.query-footer')).toHaveTextContent('2 / 3 done'));
  expect(container.querySelector('button[aria-label="Collapse Low work task"]')).not.toBeNull();
  expect(container).toHaveTextContent('Unique low-task detail');
});

test('the editor resets list organization independently of a saved query', async () => {
  const props = fixture('groupBy: "project"\nsortBy: "due"\ncompletedLast: true\neditMode: true');
  const { container } = editor(props);
  expect(container.querySelector('[aria-label="Group by"]')).toHaveValue('project');
  await fireEvent.click(container.querySelector('.save-button'));
  await waitFor(() => expect(readQuery(props)).toContain('editMode: false'));
  await fireEvent.click(container.querySelector('.reset-button'));
  await waitFor(() => expect(readQuery(props)).not.toContain('groupBy:'));
  expect(readQuery(props)).not.toContain('sortBy:');
  expect(readQuery(props)).not.toContain('completedLast:');
});

test('matrix mode keeps its fixed quadrants and no list controls', () => {
  const props = fixture('groupBy: "project"\nsortBy: "priority"\neditMode: false');
  const { container } = render(QueryDisplay, { ...props, displayMode: 'matrix' });
  expect(container.querySelector('.static-task-matrix')).not.toBeNull();
  expect(container.querySelectorAll('.group-label,.organize-controls')).toHaveLength(0);
});

test('Edit opens the query editor while preserving saved organization', async () => {
  const props = fixture('groupBy: "project"\nsortBy: "due"\ncompletedLast: true\neditMode: false');
  const display = render(QueryDisplay, props);
  await fireEvent.click(display.container.querySelector('.edit-link'));
  await waitFor(() => expect(readQuery(props)).toContain('editMode: true'));
  display.unmount();
  const reopened = editor(props, reopen(props));
  expect(reopened.container.querySelector('[aria-label="Group by"]')).toHaveValue('project');
  expect(reopened.container.querySelector('[aria-label="Sort by"]')).toHaveValue('due');
  expect(reopened.container.querySelector('[aria-label="Completed last"]')).toBeChecked();
});

test('matrix editor hides dormant list settings and preserves them when returning to List', async () => {
  const props = fixture('groupBy: "project"\nsortBy: "due"\ncompletedLast: true\neditMode: true');
  const { container, unmount } = editor(props);
  const displayRow = [...container.querySelectorAll('.tc-query-row')].find(row => row.querySelector('.tc-query-name')?.textContent === 'Display');
  await fireEvent.click([...displayRow.querySelectorAll('button')].find(button => button.textContent.trim() === 'Matrix'));
  expect(container.querySelector('.organize-controls')).toBeNull();
  await fireEvent.click(container.querySelector('.save-button'));
  await waitFor(() => expect(readQuery(props)).toContain('display: "matrix"'));
  expect(readQuery(props)).toContain('groupBy: "project"\nsortBy: "due"\ncompletedLast: true');
  unmount();
  const reopened = editor(props, reopen(props));
  const row = [...reopened.container.querySelectorAll('.tc-query-row')].find(node => node.querySelector('.tc-query-name')?.textContent === 'Display');
  await fireEvent.click([...row.querySelectorAll('button')].find(button => button.textContent.trim() === 'List'));
  expect(reopened.container.querySelector('[aria-label="Group by"]')).toHaveValue('project');
  expect(reopened.container.querySelector('[aria-label="Sort by"]')).toHaveValue('due');
  expect(reopened.container.querySelector('[aria-label="Completed last"]')).toBeChecked();
});

/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { App } from 'obsidian';
import { FileOperator } from '../../src/renderer/fileOperator';
import { PositionedObsidianTask } from '../../src/taskModule/task';
import { fireEvent, loadSvelte, render, srcPath, waitFor } from './testUtils';

let QueryDisplay: any;
beforeAll(async () => {
  QueryDisplay = await loadSvelte(srcPath('ui/QueryDisplay.svelte'));
});

function fixture() {
  const taskList = [false, true, false].map((completed, index) => new PositionedObsidianTask({
    id: `tc-summary-${index}`,
    content: `Review task ${index + 1}`,
    completed,
    docPosition: { filePath: 'summary.md', start: { line: index, col: 0 }, end: { line: index, col: 0 } }
  }));
  const plugin = { cache: { taskCache: { status: { initialized: true }, getLength: () => 122 } } };
  return { taskList, plugin, querySyncManager: { plugin } };
}

test.each(['list', 'matrix'])('%s distinguishes shown/vault totals from completed/shown totals', async (displayMode) => {
  const props = fixture();
  const { container, setProps } = render(QueryDisplay, { ...props, displayMode });
  expect(container.querySelector('.query-header')).toHaveTextContent('3 shown / 122 in vault');
  expect(container.querySelector('.query-footer')).toHaveTextContent('1 / 3 done');

  // New query results must update both summaries and use only the shown tasks.
  await setProps({ taskList: [props.taskList[1]] });
  expect(container.querySelector('.query-header')).toHaveTextContent('1 shown / 122 in vault');
  expect(container.querySelector('.query-footer')).toHaveTextContent('1 / 1 done');
});

test.each(['list', 'matrix'])('%s keeps summary meanings visible for an empty query', (displayMode) => {
  const { container } = render(QueryDisplay, { ...fixture(), taskList: [], displayMode });
  expect(container.querySelector('.query-header')).toHaveTextContent('0 shown / 122 in vault');
  expect(container.querySelector('.query-footer')).toHaveTextContent('0 / 0 done');
  expect(container).toHaveTextContent('No Tasks Found');
});

test.each(['list', 'matrix'])('%s refreshes progress and quadrant counts after a checkbox change', async (displayMode) => {
  const props = fixture();
  const app = new App();
  const source = '- [ ] Review task 1 #TaskCard ^tc-summary-0\n- [x] Review task 2 #TaskCard ^tc-summary-1\n- [ ] Review task 3 #TaskCard ^tc-summary-2';
  (app.vault as any).__setFile('summary.md', source);
  const plugin = { ...props.plugin, app, fileOperator: new FileOperator(null as any, app) };
  const { container } = render(QueryDisplay, { ...props, plugin, displayMode });
  await fireEvent.click(container.querySelector('input.task-card-checkbox')!);
  expect(container.querySelector('.query-footer')).toHaveTextContent('2 / 3 done');
  if (displayMode === 'matrix') expect(container.querySelector('.category.delete .category-count')).toHaveTextContent('2/3');
  await waitFor(() => expect((app.vault as any).__getContent('summary.md')).toContain('- [x] Review task 1'));
});

test.each(['list', 'matrix'])('%s restores progress when the query task cannot be located for saving', async (displayMode) => {
  const props = fixture();
  const app = new App();
  // Stale result: the original task was removed from its source note.
  (app.vault as any).__setFile('summary.md', '# No tasks remain here');
  const plugin = { ...props.plugin, app, fileOperator: new FileOperator(null as any, app) };
  const { container } = render(QueryDisplay, { ...props, plugin, displayMode });
  await fireEvent.click(container.querySelector('input.task-card-checkbox')!);
  await waitFor(() => expect(container.querySelector('input.task-card-checkbox')).not.toBeChecked());
  expect(container.querySelector('.query-footer')).toHaveTextContent('1 / 3 done');
});

/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { PositionedObsidianTask } from '../../src/taskModule/task';
import { fireEvent, loadSvelte, render, srcPath } from './testUtils';

let Matrix: any;
let List: any;
beforeAll(async () => {
  Matrix = await loadSvelte(srcPath('ui/StaticTaskMatrix.svelte'));
  List = await loadSvelte(srcPath('ui/StaticTaskList.svelte'));
});

function fixture() {
  const task = new PositionedObsidianTask({
    id: 'tc-compact',
    content: 'Reserve a riverside ryokan for the long weekend in Kyoto',
    project: { id: 'trip', name: 'Japan Trip', color: '#e6788c' },
    description: '- [ ] Review the details\n- [x] Save the train tickets',
    labels: ['#travel'],
    docPosition: { filePath: 'plan.md', start: { line: 0, col: 0 }, end: { line: 3, col: 0 } }
  });
  const plugin = {
    app: { workspace: { activeLeaf: { view: { getState: () => ({ mode: 'preview' }) } }, openLinkText: jest.fn() } },
    fileOperator: { updateLineInFile: jest.fn(), updateFile: jest.fn() }
  };
  return { task, plugin };
}

test.each(['matrix', 'list'])('%s exposes the full compact title and expands/collapses without a file write', async (presentation) => {
  const { task, plugin } = fixture();
  const { container } = render(presentation === 'matrix' ? Matrix : List, { taskList: [task], plugin });
  const title = container.querySelector('.static-task-card-content')!;
  expect(title).toHaveAttribute('title', task.content);
  const expand = container.querySelector('button[aria-label^="Expand "]')!;
  expect(expand).toHaveAttribute('aria-expanded', 'false');
  expect(container.querySelector('.matrix-project')).toHaveAttribute('title', 'Japan Trip');
  await fireEvent.click(expand);
  expect(container.querySelector('.task-card-content')!.textContent).toBe(task.content);
  expect(container.textContent).toContain('Review the details');
  await fireEvent.click(container.querySelector('button[aria-label^="Collapse "]')!);
  expect(container.querySelector('.static-task-card-content')).toHaveAttribute('title', task.content);
  expect(plugin.fileOperator.updateFile).not.toHaveBeenCalled();
  expect(plugin.fileOperator.updateLineInFile).not.toHaveBeenCalled();
});

test('query lists expand individual tasks while other rows stay compact', async () => {
  const { task, plugin } = fixture();
  const other = new PositionedObsidianTask({ ...task, id: 'tc-other', content: 'Map a quiet morning walk' });
  const { container } = render(List, { taskList: [task, other], plugin });
  expect(container.querySelectorAll('.compact-matrix-row')).toHaveLength(2);
  await fireEvent.click(container.querySelector('button[aria-label^="Expand "]')!);
  expect(container.querySelectorAll('.task-card-major-block')).toHaveLength(1);
  expect(container.querySelectorAll('.compact-matrix-row')).toHaveLength(1);
  expect(container.querySelector('.static-task-card-content')).toHaveAttribute('title', other.content);
  await fireEvent.click(container.querySelector('button[aria-label^="Collapse "]')!);
  expect(container.querySelectorAll('.compact-matrix-row')).toHaveLength(2);
});

/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { PositionedObsidianTask } from '../../src/taskModule/task';
import { fireEvent, loadSvelte, render, srcPath, tick } from './testUtils';

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
  const openGlobalSearch = jest.fn();
  const plugin = {
    app: { internalPlugins: { getPluginById: () => ({ instance: { openGlobalSearch } }) }, workspace: { activeLeaf: { view: { getState: () => ({ mode: 'preview' }) } }, openLinkText: jest.fn() } },
    fileOperator: { updateLineInFile: jest.fn(), updateFile: jest.fn() }
  };
  return { task, plugin, openGlobalSearch };
}

test.each(['matrix', 'list'])('%s exposes the full compact title and expands/collapses without a file write', async (presentation) => {
  const { task, plugin } = fixture();
  const { container } = render(presentation === 'matrix' ? Matrix : List, { taskList: [task], plugin });
  const title = container.querySelector('.static-task-card-content')!;
  expect(title).toHaveTextContent(task.content);
  expect(title).not.toHaveAttribute('title');
  const expand = container.querySelector('button[aria-label^="Expand "]')!;
  expect(expand).toHaveAttribute('aria-expanded', 'false');
  expect(container.querySelector('.matrix-project button')).toHaveAttribute('aria-label', 'Project: Japan Trip');
  await fireEvent.click(expand);
  expect(container.querySelector('.task-card-content')!.textContent).toBe(task.content);
  expect(container.textContent).toContain('Review the details');
  await fireEvent.click(container.querySelector('button[aria-label^="Collapse "]')!);
  expect(container.querySelector('.static-task-card-content')).toHaveTextContent(task.content);
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
  expect(container.querySelector('.static-task-card-content')).toHaveTextContent(other.content);
  await fireEvent.click(container.querySelector('button[aria-label^="Collapse "]')!);
  expect(container.querySelectorAll('.compact-matrix-row')).toHaveLength(2);
});

test('a clipped query title reveals the full title on hover and Escape only dismisses it', async () => {
  jest.useFakeTimers();
  try {
    const { task, plugin } = fixture();
    const { container } = render(List, { taskList: [task], plugin });
    const title = container.querySelector('.static-task-card-content')!;
    Object.defineProperties(title, { clientWidth: { value: 120 }, scrollWidth: { value: 600 } });
    await fireEvent.mouseEnter(title);
    jest.advanceTimersByTime(139);
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    jest.advanceTimersByTime(1);
    expect(document.querySelector('[role="tooltip"]')).toHaveTextContent(task.content);
    await fireEvent.keyDown(title, { key: 'Escape' });
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    expect(plugin.app.workspace.openLinkText).not.toHaveBeenCalled();
    await fireEvent.click(title);
    expect(plugin.app.workspace.openLinkText).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});


// A project action must keep the query in place and reach native search only
// after its explicit menu choice, without opening or editing a task.
test.each(['matrix', 'list'])('%s project dot reveals its name and opens project search only from its menu action', async (presentation) => {
  const { task, plugin, openGlobalSearch } = fixture();
  const { container } = render(presentation === 'matrix' ? Matrix : List, { taskList: [task], plugin });
  const button = container.querySelector('.matrix-project button') as HTMLButtonElement;
  expect(button).not.toBeNull();
  const dot = button.querySelector('.query-project-dot');
  expect(dot).not.toBeNull();
  button.focus();
  await tick();
  expect(button).toHaveTextContent('Japan Trip');
  expect(button.querySelector('.query-project-dot')).toBe(dot);
  expect(document.querySelectorAll('.query-project-dot')).toHaveLength(1);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  await fireEvent.click(button);
  expect(openGlobalSearch).not.toHaveBeenCalled();
  const action = document.querySelector('[role="dialog"] button') as HTMLButtonElement;
  expect(action).toHaveTextContent('Show project tasks');
  expect(action).toHaveFocus();
  expect(button).toHaveAttribute('aria-expanded', 'true');
  await fireEvent.click(action);
  expect(openGlobalSearch).toHaveBeenCalledWith('task:"project:: Japan Trip"');
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(container.querySelector('.compact-matrix-row')).toBeInTheDocument();
  expect(container.querySelector('.matrix-project button')).toBe(button);
  expect(plugin.app.workspace.openLinkText).not.toHaveBeenCalled();
  expect(plugin.fileOperator.updateFile).not.toHaveBeenCalled();
  expect(plugin.fileOperator.updateLineInFile).not.toHaveBeenCalled();
});

test('project action escapes quotes and backslashes in the native search phrase', async () => {
  const { task, plugin, openGlobalSearch } = fixture();
  task.project.name = 'Client "A" \\ Archive';
  const { container } = render(List, { taskList: [task], plugin });
  const button = container.querySelector('.matrix-project button');
  expect(button).not.toBeNull();
  await fireEvent.click(button);
  await fireEvent.click(document.querySelector('[role="dialog"] button'));
  expect(openGlobalSearch).toHaveBeenCalledWith('task:"project:: Client \\"A\\" \\\\ Archive"');
});

test('project Escape restores focus and a second menu replaces the first', async () => {
  const { task, plugin, openGlobalSearch } = fixture();
  const other = new PositionedObsidianTask({ ...task, id: 'tc-other', project: { id: 'home', name: 'Home', color: '#ff0000' } });
  const { container, unmount } = render(List, { taskList: [task, other], plugin });
  const [first, second] = Array.from(container.querySelectorAll('.matrix-project button')) as HTMLButtonElement[];
  expect(first).not.toBeUndefined();
  await fireEvent.click(first);
  await fireEvent.keyDown(document.activeElement, { key: 'Escape' });
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(first).toHaveFocus();
  expect(first).not.toHaveTextContent('Japan Trip');
  await fireEvent.click(first);
  await fireEvent.click(second);
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  expect(document.querySelector('[role="dialog"]')).toHaveAttribute('aria-label', 'Actions for Home');
  expect(first).not.toHaveTextContent('Japan Trip');
  await fireEvent.pointerDown(document.body);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(openGlobalSearch).not.toHaveBeenCalled();
  await fireEvent.click(second);
  unmount();
  await tick();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.querySelector('.query-project-button')).toBeNull();
});


test('pointer focus keeps the project control in its row until click so a quick click is not lost', async () => {
  const { task, plugin } = fixture();
  const { container } = render(List, { taskList: [task], plugin });
  const button = container.querySelector('.matrix-project button') as HTMLButtonElement;
  await fireEvent.pointerDown(button);
  button.focus();
  await tick();
  // Moving the focused button during pointer-down makes Chromium cancel the
  // following native click. Keyboard focus still reveals immediately.
  expect(container.querySelector('.matrix-project button')).toBe(button);
  await fireEvent.pointerUp(button);
  await fireEvent.click(button);
  expect(document.querySelector('[role="dialog"] button')).toHaveTextContent('Show project tasks');
});


test.each(['matrix', 'list'])('%s project keeps forward and backward Tab in row order', async (presentation) => {
  const user = userEvent.setup();
  const { task, plugin } = fixture();
  const { container } = render(presentation === 'matrix' ? Matrix : List, { taskList: [task], plugin });
  const project = container.querySelector('.matrix-project button') as HTMLButtonElement;
  const title = container.querySelector('.matrix-title')!;
  const expand = container.querySelector('.matrix-toggle')!;
  project.focus();
  await tick();
  await user.tab();
  expect(expand).toHaveFocus();
  await user.tab({ shift: true });
  expect(project).toHaveFocus();
  await user.tab({ shift: true });
  expect(title).toHaveFocus();
});

test.each(['scroll', 'resize', 'blur'])('project %s dismissal returns focus from its action to the original trigger', async (eventName) => {
  const { task, plugin } = fixture();
  const { container } = render(List, { taskList: [task], plugin });
  const project = container.querySelector('.matrix-project button') as HTMLButtonElement;
  await fireEvent.click(project);
  expect(document.querySelector('.query-project-open')).toHaveFocus();
  (eventName === 'scroll' ? document : window).dispatchEvent(new Event(eventName));
  await tick();
  expect(document.querySelector('.query-project-menu')).toBeNull();
  expect(project).toHaveFocus();
  expect(container.querySelector('.matrix-project button')).toBe(project);
  expect(project).not.toHaveTextContent('Japan Trip');
});

test('project menu Tab restores its row anchor and Shift-Tab returns to its trigger', async () => {
  const user = userEvent.setup();
  const { task, plugin } = fixture();
  const { container } = render(List, { taskList: [task], plugin });
  const project = container.querySelector('.matrix-project button') as HTMLButtonElement;
  await fireEvent.click(project);
  // user-event computes forward Tab from the original event target even
  // after focus changes. Chromium uses the restored active trigger; the
  // native verification covers its continuation to the next row control.
  const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.activeElement!.dispatchEvent(event);
  await tick();
  expect(project).toHaveFocus();
  expect(event.defaultPrevented).toBe(false);
  expect(document.querySelector('.query-project-menu')).toBeNull();
  await fireEvent.click(project);
  await user.tab({ shift: true });
  expect(project).toHaveFocus();
  expect(document.querySelector('.query-project-menu')).toBeNull();
});

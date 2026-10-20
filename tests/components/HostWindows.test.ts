/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { DefaultSettings, SettingStore } from '../../src/settings';
import { ObsidianTask } from '../../src/taskModule/task';
import { loadSvelte, srcPath, tick } from './testUtils';

const WORK = { id: 'work', name: 'Work', color: '#f00' };
const HOME = { id: 'home', name: 'Home', color: '#0f0' };
const mounted: any[] = [];
const frames: HTMLIFrameElement[] = [];

beforeEach(() => {
  SettingStore.set({ ...DefaultSettings, userMetadata: {
    ...DefaultSettings.userMetadata, projects: [WORK, HOME]
  } });
});
afterEach(() => {
  mounted.splice(0).forEach(component => component.$destroy());
  frames.splice(0).forEach(frame => frame.remove());
});

async function mount(name: string, props: Record<string, any>) {
  const frame = document.body.appendChild(document.createElement('iframe'));
  frames.push(frame);
  const doc = frame.contentDocument!;
  const win = frame.contentWindow! as any;
  const Component = await loadSvelte(srcPath(`ui/${name}.svelte`));
  const component = new Component({ target: doc.body, props });
  mounted.push(component);
  await tick();
  return { doc, win, component };
}

function manager() {
  return {
    obsidianTask: new ObsidianTask({ content: 'Plan the day', description: 'Read the plan', project: WORK, due: { date: '2026-10-21', time: '', isRecurring: false, string: '2026-10-21' }, schedule: { date: '2026-10-21', time: '', isRecurring: false, string: '2026-10-21' }, duration: { hours: 1, minutes: 0 }, recurrence: 'every week' }),
    taskCardStatus: { projectStatus: 'done', descriptionStatus: 'done', durationStatus: 'done', dueStatus: 'done', scheduleStatus: 'done', recurrenceStatus: 'done' },
    getTaskCardStatus(key: string) { return (this.taskCardStatus as any)[key]; },
    updateObsidianTaskAttribute: jest.fn()
  };
}

// Retaining main-window instanceof checks would leave all these controls inert.
test.each(['click', 'Enter', ' '])('popout title edits on %s', async action => {
  const { doc, win } = await mount('Content', { taskSyncManager: manager() });
  const event = action === 'click' ? new win.MouseEvent('click', { bubbles: true }) :
    new win.KeyboardEvent('keydown', { key: action, bubbles: true, cancelable: true });
  expect(event instanceof MouseEvent || event instanceof KeyboardEvent).toBe(false);
  doc.querySelector('.task-card-content')!.dispatchEvent(event);
  await tick();
  expect(doc.querySelector('[contenteditable="true"]')).not.toBeNull();
});

test.each(['click', 'Enter', ' '])('popout description edits on %s', async action => {
  const { doc, win } = await mount('Description', { taskSyncManager: manager(), displayDescription: true });
  doc.querySelector('.task-card-description')!.dispatchEvent(action === 'click' ?
    new win.MouseEvent('click', { bubbles: true }) : new win.KeyboardEvent('keydown', { key: action, bubbles: true }));
  await tick();
  expect(doc.querySelector('textarea')).not.toBeNull();
});

test.each(['FixedOptionsSelect', 'FixedOptionsMultiSelect', 'TagSelect', 'ProjectSelection'])(
  'popout %s honors primary click, Enter and Space only', async name => {
    const choices = name === 'TagSelect' ? ['work'] : name === 'ProjectSelection' ? [WORK] : [{ value: 'work', displayText: 'Work' }];
    const { doc, win } = await mount(`selections/${name}`, { choices });
    const button = doc.querySelector('button')!;
    for (const event of [new win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }), new win.MouseEvent('click', { button: 2, bubbles: true })]) {
      button.dispatchEvent(event);
      await tick();
      expect(button.classList.contains('selected')).toBe(false);
    }
    for (const event of [new win.MouseEvent('click', { button: 0, bubbles: true }), new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }), new win.KeyboardEvent('keydown', { key: ' ', bubbles: true })]) {
      button.dispatchEvent(event);
      await tick();
      expect(button.classList.contains('selected')).toBe(true);
      if (name !== 'FixedOptionsSelect') {
        button.dispatchEvent(new win.MouseEvent('click', { button: 0, bubbles: true }));
        await tick();
      }
    }
  }
);

test.each(['Due', 'Schedule', 'Duration', 'Recurrence'])('popout %s ignores unrelated keys before editing', async name => {
  const sync = manager();
  const { doc, win } = await mount(name, { taskSyncManager: sync, params: { mode: 'multi-line' }, [`display${name}`]: true });
  doc.querySelector('[role="button"]')!.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await tick();
  expect(doc.querySelector('input')).toBeNull();
  doc.querySelector('[role="button"]')!.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await tick();
  expect(doc.querySelector('input')).not.toBeNull();
});

test('popout project search and picker use its own document', async () => {
  const openGlobalSearch = jest.fn();
  const sync = { ...manager(), plugin: { app: { internalPlugins: { getPluginById: () => ({ instance: { openGlobalSearch } }) } } } };
  const { doc, win } = await mount('Project', { taskSyncManager: sync, params: { mode: 'multi-line' } });
  doc.querySelector('.project-name')!.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  expect(openGlobalSearch).toHaveBeenCalledWith('task:"project:: Work"');
  const open = async () => {
    doc.querySelector('.clickable-icon')!.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    await tick();
  };
  await open();
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await tick();
  expect(doc.querySelector('.project-popup')).not.toBeNull();
  doc.querySelector('.project-popup')!.dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true }));
  await tick();
  expect(doc.querySelector('.project-popup')).not.toBeNull();
  doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await tick();
  expect(doc.querySelector('.project-popup')).toBeNull();
  await open();
  doc.body.dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true }));
  await tick();
  expect(doc.querySelector('.project-popup')).toBeNull();
});

test('popout add-attribute picker keeps inside presses and dismisses on owner-document interactions', async () => {
  const { doc, win } = await mount('AddAttributePopover', { task: new ObsidianTask({ content: 'Plan the day' }), onStartEditing: jest.fn(), onSetPriority: jest.fn(), onOpenProjectPicker: jest.fn(), onAddLabel: jest.fn() });
  const open = async () => {
    doc.querySelector('button')!.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    await tick();
  };
  await open();
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await tick();
  expect(doc.querySelector('.task-card-add-attribute-popover')).not.toBeNull();
  doc.querySelector('.task-card-add-attribute-row')!.dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true }));
  await tick();
  expect(doc.querySelector('.task-card-add-attribute-popover')).not.toBeNull();
  doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await tick();
  expect(doc.querySelector('.task-card-add-attribute-popover')).toBeNull();
  await open();
  doc.body.dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true }));
  await tick();
  expect(doc.querySelector('.task-card-add-attribute-popover')).toBeNull();
});

test('popout title paste uses its owner document to insert plain text', async () => {
  const { doc, win } = await mount('Content', { taskSyncManager: manager() });
  doc.querySelector('.task-card-content')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await tick();
  // execCommand is provided by the host; jsdom supplies neither text insertion
  // nor this API, so model the insertion at that browser boundary.
  (doc as any).execCommand = (_command: string, _showUI: boolean, value: string) => {
    doc.querySelector('[contenteditable]')!.textContent = value;
  };
  const paste = new win.Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(paste, 'clipboardData', { value: { getData: () => 'First line\nsecond line' } });
  doc.querySelector('[contenteditable]')!.dispatchEvent(paste);
  expect(doc.querySelector('[contenteditable]')!.textContent).toBe('First line second line');
});

test.each(['Due', 'Schedule'])('popout %s measures input text in its own document', async name => {
  const { doc, win } = await mount(name, { taskSyncManager: manager(), params: { mode: 'multi-line' }, [`display${name}`]: true });
  // A physical layout is a browser boundary; supply distinct popout metrics.
  const measure = jest.spyOn(win.HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 100 } as DOMRect);
  try {
    doc.querySelector('[role="button"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await tick();
    const input = doc.querySelector('input')!;
    input.dispatchEvent(new win.Event('input', { bubbles: true }));
    await tick();
    expect(parseFloat(input.style.width)).toBeCloseTo(115);
    expect(doc.querySelector('span[style*="-9999px"]')).toBeNull();
  } finally {
    measure.mockRestore();
  }
});

test('popout card expansion ignores unrelated keyboard events', async () => {
  const sync = { ...manager(), taskItemEl: document.createElement('div'), updateObsidianTaskDisplayParams: jest.fn() };
  sync.obsidianTask.metadata.taskDisplayParams = { mode: 'single-line' };
  const { doc, win } = await mount('TaskItem', { taskSyncManager: sync, plugin: {} });
  doc.querySelector('.obsidian-taskcard-hitbox')!.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await tick();
  expect(doc.querySelector('.obsidian-taskcard')!.classList.contains('mode-single-line')).toBe(true);
  doc.querySelector('.obsidian-taskcard-hitbox')!.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await tick();
  expect(doc.querySelector('.obsidian-taskcard')!.classList.contains('mode-multi-line')).toBe(true);
});

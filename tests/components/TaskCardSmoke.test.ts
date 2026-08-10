/** @jest-environment jsdom */

/**
 * Smoke tests for src/ui/TaskCard.svelte and src/ui/TaskItem.svelte.
 *
 * Both mount without the real plugin: they use a real ObsidianTask +
 * ObsidianTaskSyncManager, with the plugin reduced to the three surfaces the
 * write-back path touches (taskFormatter, fileOperator, externalAPIManager).
 * SettingStore keeps its defaults (defaultMode: 'single-line', no projects).
 */
import '@testing-library/jest-dom';

import { DefaultSettings, SettingStore } from '../../src/settings';
import { ObsidianTask } from '../../src/taskModule/task';
import { ObsidianTaskSyncManager } from '../../src/taskModule/taskSyncManager';
import { fireEvent, loadSvelte, render, srcPath, waitFor } from './testUtils';

let TaskCard: any;
let TaskItem: any;

beforeAll(async () => {
  TaskCard = await loadSvelte(srcPath('ui/TaskCard.svelte'));
  TaskItem = await loadSvelte(srcPath('ui/TaskItem.svelte'));
});

function makePluginStub() {
  return {
    taskFormatter: {
      taskToMarkdown: jest.fn(() => '- [ ] formatted #TaskCard')
    },
    fileOperator: {
      updateFile: jest.fn(async () => undefined),
      getMarkdownBetweenLines: jest.fn(async () => ''),
      // write-time position verification reads the file; null -> the sync
      // manager trusts the cached render-time span
      getFileLines: jest.fn(async () => null)
    },
    externalAPIManager: {
      updateTask: jest.fn(async () => undefined),
      deleteTask: jest.fn()
    },
    storeSyncMappings: jest.fn(async () => undefined),
    removeSyncMappings: jest.fn(async () => undefined)
  } as any;
}

function makeTaskMetadata() {
  return {
    sectionEl: document.createElement('div'),
    ctx: {
      getSectionInfo: () => ({ lineStart: 0, lineEnd: 5, text: '' })
    } as any,
    sourcePath: 'notes/test.md',
    mdSectionInfo: null,
    lineStartInSection: 1,
    lineEndsInSection: 1
  };
}

function makeSyncManager(
  taskProps: Partial<ObsidianTask>,
  plugin = makePluginStub()
) {
  const task = new ObsidianTask(taskProps);
  const taskItemEl = document.createElement('div');
  taskItemEl.innerHTML =
    '<input class="task-list-item-checkbox" data-line="2" type="checkbox">';
  const syncManager = new ObsidianTaskSyncManager(plugin, {
    obsidianTask: task,
    taskItemEl,
    taskMetadata: makeTaskMetadata() as any
  });
  return { task, plugin, syncManager };
}

describe('TaskCard (smoke)', () => {
  test('single-line mode renders checkbox, content and priority class', () => {
    const { syncManager } = makeSyncManager({
      content: 'Write tests',
      priority: 2,
      description: '- [ ] a\n- [x] b'
    });

    const { container } = render(TaskCard, {
      props: {
        taskSyncManager: syncManager,
        plugin: syncManager.plugin,
        params: { mode: 'single-line' }
      }
    });

    expect(container.querySelector('.task-card-single-line')).not.toBeNull();
    expect(
      container.querySelector('.task-card-content')!.textContent
    ).toContain('Write tests');
    const checkbox = container.querySelector(
      'input.task-card-checkbox'
    ) as HTMLInputElement;
    expect(checkbox.classList.contains('priority-2')).toBe(true);
    expect(checkbox.checked).toBe(false);
    // uncompleted task with 1/2 sub-tasks -> quiet progress count
    expect(container.querySelector('.single-line-progress')!.textContent).toBe(
      '1/2'
    );
  });

  test('multi-line mode renders content, description, duration and labels', () => {
    const { syncManager } = makeSyncManager({
      content: 'Write tests',
      description: '- [ ] a\n- [x] b',
      duration: { hours: 1, minutes: 30 },
      labels: ['#alpha']
    });

    const { container } = render(TaskCard, {
      props: {
        taskSyncManager: syncManager,
        plugin: syncManager.plugin,
        params: { mode: 'multi-line' }
      }
    });

    expect(container.querySelector('.task-card-major-block')).not.toBeNull();
    expect(container.textContent).toContain('Write tests');
    expect(container.querySelectorAll('li')).toHaveLength(2); // description list
    expect(container.querySelector('.duration-display')!.textContent).toContain(
      '1h 30m'
    );
    expect(container.querySelector('a.tag')!.textContent).toContain('#alpha');
    expect(container.querySelector('.task-card-menu-button')).not.toBeNull();
  });

  test('mode-toggle button dispatches switchMode with the target mode', async () => {
    const { syncManager } = makeSyncManager({ content: 'Write tests' });
    const { container, component } = render(TaskCard, {
      props: {
        taskSyncManager: syncManager,
        plugin: syncManager.plugin,
        params: { mode: 'multi-line' }
      }
    });

    const events: CustomEvent[] = [];
    component.$on('switchMode', (event) => events.push(event));

    await fireEvent.click(container.querySelector('button.mode-toggle-button')!);

    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ mode: 'single-line' });
  });

  test('checkbox click writes the completion back through the plugin', async () => {
    const { syncManager, plugin } = makeSyncManager({ content: 'Write tests' });
    const { container } = render(TaskCard, {
      props: {
        taskSyncManager: syncManager,
        plugin: syncManager.plugin,
        params: { mode: 'single-line' }
      }
    });

    await fireEvent.click(container.querySelector('input.task-card-checkbox')!);

    await waitFor(() => {
      expect(plugin.externalAPIManager.updateTask).toHaveBeenCalledTimes(1);
      expect(plugin.fileOperator.updateFile).toHaveBeenCalledWith(
        'notes/test.md',
        '- [ ] formatted #TaskCard',
        1, // lineStartInSection + section lineStart
        1
      );
    });
    expect(syncManager.obsidianTask.completed).toBe(true);
  });

  // Reset SettingStore for tests below that need projects; keeps the "no
  // projects" default intact for every other test in this file.
  afterEach(() => {
    SettingStore.set(DefaultSettings);
  });

  test('add-attribute popover: a set priority drops out of the missing-attribute list on reopen', async () => {
    const { syncManager } = makeSyncManager({ content: 'Write tests' });
    const { container } = render(TaskCard, {
      props: {
        taskSyncManager: syncManager,
        plugin: syncManager.plugin,
        params: { mode: 'multi-line' }
      }
    });

    const findRow = (label: string) =>
      Array.from(
        container.querySelectorAll('.task-card-add-attribute-row')
      ).find((row) => row.textContent?.trim() === label);

    await fireEvent.click(
      container.querySelector('.task-card-add-attribute-button')!
    );
    expect(findRow('Priority')).toBeTruthy();

    await fireEvent.click(findRow('Priority')!);
    const highRow = Array.from(
      container.querySelectorAll('.task-card-add-attribute-submenu-row')
    ).find((row) => row.textContent?.includes('High'))!;
    await fireEvent.click(highRow);

    // updateTaskAttribute's write-back chain (external API + file write) has
    // more async hops than the model mutation itself, so wait for the
    // DOM-visible effect (the checkbox's priority class) rather than the
    // underlying task field, or the popover's `task` prop may not have
    // re-rendered yet by the time we reopen it below.
    await waitFor(() => {
      expect(
        container.querySelector('input.task-card-checkbox')?.className
      ).toContain('priority-1');
    });

    // popover closes on selection; reopen it and check the stale-list bug
    await fireEvent.click(
      container.querySelector('.task-card-add-attribute-button')!
    );
    expect(findRow('Priority')).toBeUndefined();
  });

  test('add-attribute popover: Project opens the project picker and assigning a project renders its chip', async () => {
    SettingStore.set({
      ...DefaultSettings,
      userMetadata: {
        ...DefaultSettings.userMetadata,
        projects: [{ id: 'work', name: 'Work', color: '#5b8def' }]
      }
    });

    const { syncManager } = makeSyncManager({ content: 'Write tests' });
    const { container } = render(TaskCard, {
      props: {
        taskSyncManager: syncManager,
        plugin: syncManager.plugin,
        params: { mode: 'multi-line' }
      }
    });

    await fireEvent.click(
      container.querySelector('.task-card-add-attribute-button')!
    );
    const projectRow = Array.from(
      container.querySelectorAll('.task-card-add-attribute-row')
    ).find((row) => row.textContent?.trim() === 'Project')!;
    await fireEvent.click(projectRow);

    expect(syncManager.getTaskCardStatus('projectStatus')).toBe('selecting');
    const popup = container.querySelector('.project-popup');
    expect(popup).not.toBeNull();

    const workOption = Array.from(
      popup!.querySelectorAll('.project-option')
    ).find((el) => el.textContent?.includes('Work'))!;
    await fireEvent.click(workOption);

    await waitFor(() => {
      expect(syncManager.obsidianTask.project?.name).toBe('Work');
    });
    expect(container.querySelector('.project-name')!.textContent).toContain(
      'Work'
    );
  });
});

describe('TaskItem (smoke)', () => {
  test('renders a single-line task-list item with the data-line of its checkbox', () => {
    const { syncManager } = makeSyncManager({ content: 'Write tests' });

    const { container } = render(TaskItem, {
      props: { taskSyncManager: syncManager, plugin: syncManager.plugin }
    });

    const li = container.querySelector('li.obsidian-taskcard')!;
    expect(li).not.toBeNull();
    expect(li.classList.contains('mode-single-line')).toBe(true); // default mode
    expect(li.getAttribute('data-line')).toBe('2');
    expect(li.textContent).toContain('Write tests');
  });

  test('clicking the hitbox switches to multi-line mode in memory without a file write', async () => {
    const { syncManager, plugin } = makeSyncManager({ content: 'Write tests' });

    const { container } = render(TaskItem, {
      props: { taskSyncManager: syncManager, plugin: syncManager.plugin }
    });

    await fireEvent.click(container.querySelector('.obsidian-taskcard-hitbox')!);

    const li = container.querySelector('li.obsidian-taskcard')!;
    expect(li.classList.contains('mode-multi-line')).toBe(true);
    expect(
      syncManager.obsidianTask.metadata!.taskDisplayParams
    ).toEqual({ mode: 'multi-line' });
    // v2: display state is ephemeral UI state, never written to the note
    expect(plugin.fileOperator.updateFile).not.toHaveBeenCalled();
  });

  test('honors a persisted multi-line display param on mount', () => {
    const { syncManager } = makeSyncManager({
      content: 'Write tests',
      metadata: { taskDisplayParams: { mode: 'multi-line' } }
    });

    const { container } = render(TaskItem, {
      props: { taskSyncManager: syncManager, plugin: syncManager.plugin }
    });

    expect(
      container
        .querySelector('li.obsidian-taskcard')!
        .classList.contains('mode-multi-line')
    ).toBe(true);
  });
});

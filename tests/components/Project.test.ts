/** @jest-environment jsdom */

/**
 * Component tests for src/ui/Project.svelte
 *
 * Project.svelte imports SettingStore from src/settings, which is a plain
 * svelte writable store -- set it directly.
 */
import '@testing-library/jest-dom';

import { DefaultSettings, SettingStore, TaskCardSettings } from '../../src/settings';
import { fireEvent, loadSvelte, render, srcPath } from './testUtils';

let Project: any;

const WORK = { id: 'p1', name: 'Work', color: '#ff0000' };
const HOME = { id: 'p2', name: 'Home', color: '#00ff00' };

beforeAll(async () => {
  Project = await loadSvelte(srcPath('ui/Project.svelte'));
});

beforeEach(() => {
  const settings: TaskCardSettings = {
    ...DefaultSettings,
    userMetadata: {
      projects: [WORK, HOME],
      defaultProject: { id: '', name: '' }
    }
  };
  SettingStore.set(settings);
});

function makeSyncManager(project: any) {
  const openGlobalSearch = jest.fn();
  return {
    obsidianTask: {
      project,
      hasProject() {
        return this.project !== null && this.project.name.length > 0;
      }
    },
    taskCardStatus: { projectStatus: 'done' },
    getTaskCardStatus(key: string) {
      return (this.taskCardStatus as any)[key];
    },
    updateObsidianTaskAttribute: jest.fn(),
    openGlobalSearch,
    plugin: {
      app: {
        internalPlugins: {
          getPluginById: jest.fn(() => ({
            instance: { openGlobalSearch }
          }))
        }
      }
    }
  };
}

describe('Project', () => {
  test('single-line mode renders only the colored dot', () => {
    const { container } = render(Project, {
      props: {
        taskSyncManager: makeSyncManager(WORK),
        params: { mode: 'single-line' }
      }
    });

    const dot = container.querySelector('span.project-color') as HTMLElement;
    expect(dot).not.toBeNull();
    // jsdom normalizes the hex color to rgb()
    expect(dot.style.backgroundColor).toBe('rgb(255, 0, 0)');
    // no project name in single-line mode
    expect(container.querySelector('.project-name')).toBeNull();
  });

  test('single-line mode renders an empty block when the task has no project', () => {
    const { container } = render(Project, {
      props: {
        taskSyncManager: makeSyncManager(null),
        params: { mode: 'single-line' }
      }
    });

    expect(container.querySelector('span.project-color')).toBeNull();
  });

  test('multi-line mode renders the project name and dot', () => {
    const { container } = render(Project, {
      props: {
        taskSyncManager: makeSyncManager(WORK),
        params: { mode: 'multi-line' }
      }
    });

    const name = container.querySelector('.project-name') as HTMLElement;
    expect(name.textContent!.trim()).toBe('Work');
    expect(name.getAttribute('aria-label')).toBe('Project - Work');
    expect(
      container.querySelector('span.project-color.clickable-icon')
    ).not.toBeNull();
  });

  test('clicking the project name opens a readable native v2 task search', async () => {
    const syncManager = makeSyncManager(WORK);
    const { container } = render(Project, {
      props: { taskSyncManager: syncManager, params: { mode: 'multi-line' } }
    });

    await fireEvent.click(container.querySelector('.project-name')!);

    expect(syncManager.openGlobalSearch).toHaveBeenCalledWith(
      'task:"project:: Work"'
    );
  });

  test('project search escapes quotes and backslashes for an exact phrase', async () => {
    const quotedProject = {
      id: 'p3',
      name: 'Client "A" \\ Archive',
      color: '#0000ff'
    };
    const syncManager = makeSyncManager(quotedProject);
    const { container } = render(Project, {
      props: { taskSyncManager: syncManager, params: { mode: 'multi-line' } }
    });

    await fireEvent.click(container.querySelector('.project-name')!);

    expect(syncManager.openGlobalSearch).toHaveBeenCalledWith(
      'task:"project:: Client \\"A\\" \\\\ Archive"'
    );
  });

  test('clicking the dot opens the picker popup listing the other projects', async () => {
    const { container } = render(Project, {
      props: {
        taskSyncManager: makeSyncManager(WORK),
        params: { mode: 'multi-line' }
      }
    });

    await fireEvent.click(
      container.querySelector('span.project-color.clickable-icon')!
    );

    const popup = container.querySelector('.project-popup')!;
    expect(popup).not.toBeNull();
    // current project rendered as plain name, others as tag links
    expect(popup.textContent).toContain('Work');
    const optionLinks = Array.from(popup.querySelectorAll('a.tag')).map((a) =>
      a.textContent!.trim()
    );
    expect(optionLinks).toEqual(['Home']);
  });

  test('selecting a project commits it and closes the popup', async () => {
    const syncManager = makeSyncManager(WORK);
    const { container } = render(Project, {
      props: { taskSyncManager: syncManager, params: { mode: 'multi-line' } }
    });

    await fireEvent.click(
      container.querySelector('span.project-color.clickable-icon')!
    );
    const homeOption = Array.from(
      container.querySelectorAll('.project-option')
    ).find((el) => el.textContent!.includes('Home'))!;
    await fireEvent.click(homeOption);

    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledWith(
      'project',
      HOME
    );
    expect(container.querySelector('.project-popup')).toBeNull();
    // the displayed project is now Home
    expect(
      (container.querySelector('.project-name') as HTMLElement).textContent!.trim()
    ).toBe('Home');
  });

  test('clicking outside the popup dismisses it without selecting', async () => {
    const syncManager = makeSyncManager(WORK);
    const { container } = render(Project, {
      props: { taskSyncManager: syncManager, params: { mode: 'multi-line' } }
    });

    await fireEvent.click(
      container.querySelector('span.project-color.clickable-icon')!
    );
    expect(container.querySelector('.project-popup')).not.toBeNull();

    await fireEvent.mouseDown(document.body);

    expect(container.querySelector('.project-popup')).toBeNull();
    expect(syncManager.updateObsidianTaskAttribute).not.toHaveBeenCalled();
    // the original project is still displayed
    expect(
      (container.querySelector('.project-name') as HTMLElement).textContent!.trim()
    ).toBe('Work');
  });

  test('Escape dismisses the popup without selecting', async () => {
    const syncManager = makeSyncManager(WORK);
    const { container } = render(Project, {
      props: { taskSyncManager: syncManager, params: { mode: 'multi-line' } }
    });

    await fireEvent.click(
      container.querySelector('span.project-color.clickable-icon')!
    );
    expect(container.querySelector('.project-popup')).not.toBeNull();

    await fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(container.querySelector('.project-popup')).toBeNull();
    expect(syncManager.updateObsidianTaskAttribute).not.toHaveBeenCalled();
  });

  test('multi-line mode renders nothing without a project', () => {
    const { container } = render(Project, {
      props: {
        taskSyncManager: makeSyncManager(null),
        params: { mode: 'multi-line' }
      }
    });

    expect(container.querySelector('.project-name')).toBeNull();
    expect(container.querySelector('.project-popup')).toBeNull();
  });
});

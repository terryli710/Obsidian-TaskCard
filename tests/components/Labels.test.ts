/** @jest-environment jsdom */

/**
 * Component tests for src/ui/Labels.svelte
 *
 * Mounted with a hand-rolled ObsidianTaskSyncManager stub: Labels only reads
 * `obsidianTask.labels` and calls `updateObsidianTaskAttribute`, so no plugin
 * instance is needed. Context-menu flows are asserted through the obsidian
 * Menu mock (tests/__mocks__/obsidian.ts).
 */
import '@testing-library/jest-dom';
import { App, Menu } from 'obsidian';
import { fireEvent, loadSvelte, render, srcPath, tick } from './testUtils';

let Labels: any;

beforeAll(async () => {
  Labels = await loadSvelte(srcPath('ui/Labels.svelte'));
});

interface SyncManagerStub {
  obsidianTask: { labels: string[] };
  updateObsidianTaskAttribute: jest.Mock;
}

function makeSyncManager(labels: string[]): SyncManagerStub {
  return {
    obsidianTask: { labels },
    updateObsidianTaskAttribute: jest.fn()
  };
}

function labelAnchors(container: HTMLElement): HTMLAnchorElement[] {
  return Array.from(container.querySelectorAll('a.tag'));
}

describe('Labels', () => {
  test('renders one anchor per label plus the add button', () => {
    const { container } = render(Labels, {
      props: { taskSyncManager: makeSyncManager(['#dev', '#urgent']) }
    });

    const anchors = labelAnchors(container);
    expect(anchors.map((a) => a.textContent!.trim())).toEqual([
      '#dev',
      '#urgent'
    ]);
    expect(anchors.map((a) => a.getAttribute('href'))).toEqual([
      '#dev',
      '#urgent'
    ]);
    expect(
      container.querySelector('button.label-plus-button')
    ).not.toBeNull();
    // no input until the add button is clicked
    expect(container.querySelector('input.task-card-label-input')).toBeNull();
  });

  test('renders no anchors for a task without labels', () => {
    const { container } = render(Labels, {
      props: { taskSyncManager: makeSyncManager([]) }
    });

    expect(labelAnchors(container)).toHaveLength(0);
    expect(container.querySelector('button.label-plus-button')).not.toBeNull();
  });

  test('add flow: plus button -> input -> Enter submits the new label list', async () => {
    const syncManager = makeSyncManager(['#dev']);
    const { container } = render(Labels, { props: { taskSyncManager: syncManager } });

    await fireEvent.click(container.querySelector('button.label-plus-button')!);
    const input = container.querySelector(
      'input.task-card-label-input'
    ) as HTMLInputElement;
    expect(input).not.toBeNull();

    await fireEvent.input(input, { target: { value: 'newLabel' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledTimes(1);
    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledWith(
      'labels',
      ['#dev', '#newLabel']
    );
    // input closes again after submit
    expect(container.querySelector('input.task-card-label-input')).toBeNull();
  });

  test('detailed-card add flow suggests vault labels that are not already applied', async () => {
    const syncManager = makeSyncManager(['#dev']);
    const app = new App();
    (app.vault as any).__setFile('notes.md', '#dev #writing');
    jest.spyOn(app.metadataCache, 'getFileCache').mockReturnValue({
      tags: [{ tag: '#dev' }, { tag: '#writing' }]
    } as any);
    const { container } = render(Labels, {
      props: {
        taskSyncManager: syncManager,
        enableSuggestions: true,
        plugin: { app }
      }
    });

    await fireEvent.click(container.querySelector('button.label-plus-button')!);
    const menu = container.querySelector('.task-card-value-suggestions')!;
    expect(menu).not.toBeNull();
    expect(menu.textContent).toContain('#writing');
    expect(menu.textContent).not.toContain('#dev');

    const writing = Array.from(
      menu.querySelectorAll('button.task-card-value-suggestion')
    ).find((button) => button.textContent?.includes('#writing'))!;
    await fireEvent.mouseDown(writing);
    const input = container.querySelector('input.task-card-label-input') as HTMLInputElement;
    expect(input.value).toBe('writing');
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledWith(
      'labels',
      ['#dev', '#writing']
    );
  });

  test('uses the maintained TaskCard label index without scanning vault files', async () => {
    const syncManager = makeSyncManager(['#dev']);
    const getMarkdownFiles = jest.fn(() => []);
    const { container } = render(Labels, {
      props: {
        taskSyncManager: syncManager,
        enableSuggestions: true,
        plugin: {
          app: {
            vault: { getMarkdownFiles },
            metadataCache: { getFileCache: jest.fn() }
          },
          cache: {
            taskCache: {
              database: {
                getAllIndexValues: () => ['#dev,#writing', '#errand']
              }
            }
          }
        }
      }
    });

    await fireEvent.click(container.querySelector('button.label-plus-button')!);
    const menuText = container.querySelector('.task-card-value-suggestions')!.textContent!;
    expect(menuText).toContain('#writing');
    expect(menuText).toContain('#errand');
    expect(menuText).not.toContain('#dev');
    expect(getMarkdownFiles).not.toHaveBeenCalled();
  });

  test('add flow: Escape cancels without writing', async () => {
    const syncManager = makeSyncManager(['#dev']);
    const { container } = render(Labels, { props: { taskSyncManager: syncManager } });

    await fireEvent.click(container.querySelector('button.label-plus-button')!);
    const input = container.querySelector(
      'input.task-card-label-input'
    ) as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'abandoned' } });
    await fireEvent.keyDown(input, { key: 'Escape' });

    expect(syncManager.updateObsidianTaskAttribute).not.toHaveBeenCalled();
    expect(container.querySelector('input.task-card-label-input')).toBeNull();
  });

  test('add flow: losing focus (clicking elsewhere) commits the typed label', async () => {
    const syncManager = makeSyncManager(['#dev']);
    const { container } = render(Labels, { props: { taskSyncManager: syncManager } });

    await fireEvent.click(container.querySelector('button.label-plus-button')!);
    const input = container.querySelector(
      'input.task-card-label-input'
    ) as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'newLabel' } });
    await fireEvent.blur(input);

    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledWith(
      'labels',
      ['#dev', '#newLabel']
    );
    expect(container.querySelector('input.task-card-label-input')).toBeNull();
  });

  test('add flow: losing focus with an empty input cancels without writing', async () => {
    const syncManager = makeSyncManager(['#dev']);
    const { container } = render(Labels, { props: { taskSyncManager: syncManager } });

    await fireEvent.click(container.querySelector('button.label-plus-button')!);
    const input = container.querySelector(
      'input.task-card-label-input'
    ) as HTMLInputElement;
    await fireEvent.blur(input);

    expect(syncManager.updateObsidianTaskAttribute).not.toHaveBeenCalled();
    expect(container.querySelector('input.task-card-label-input')).toBeNull();
  });

  test('context menu Delete removes the right label', async () => {
    const showAtPosition = jest.spyOn(Menu.prototype, 'showAtPosition');
    const syncManager = makeSyncManager(['#dev', '#urgent']);
    const { container } = render(Labels, { props: { taskSyncManager: syncManager } });

    await fireEvent.contextMenu(labelAnchors(container)[0]);

    expect(showAtPosition).toHaveBeenCalledTimes(1);
    const menu = (showAtPosition.mock as any).contexts[0] as any;
    const titles = menu.__items.map((item: any) => item.__title);
    expect(titles).toEqual(['Edit', 'Delete']);

    const deleteItem = menu.__items.find((i: any) => i.__title === 'Delete');
    deleteItem.__onClick(new MouseEvent('click'));
    await tick();

    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledWith(
      'labels',
      ['#urgent']
    );
  });

  test('context menu Edit opens an input seeded with the label and saves the edit', async () => {
    const showAtPosition = jest.spyOn(Menu.prototype, 'showAtPosition');
    const syncManager = makeSyncManager(['#dev', '#urgent']);
    const { container } = render(Labels, { props: { taskSyncManager: syncManager } });

    await fireEvent.contextMenu(labelAnchors(container)[1]);
    const menu = (showAtPosition.mock as any).contexts[0] as any;
    const editItem = menu.__items.find((i: any) => i.__title === 'Edit');
    editItem.__onClick(new MouseEvent('click'));
    await tick();

    const input = container.querySelector(
      'input.task-card-label-input'
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('urgent'); // seeded without the leading '#'

    await fireEvent.input(input, { target: { value: 'renamed' } });
    await fireEvent.keyDown(input, { key: 'Enter' });

    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledWith(
      'labels',
      ['#dev', '#renamed']
    );
  });
});

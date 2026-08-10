/** @jest-environment jsdom */

/**
 * Component tests for src/ui/Content.svelte (interactive mode).
 *
 * Content is the card's title line: click-to-edit (a contenteditable div,
 * so the card's height never changes on entering edit mode) with the uniform
 * edit-mode contract (Enter/blur commit, Escape cancels, unchanged values
 * don't write). The sync-manager stub mirrors the real manager's behavior of
 * updating obsidianTask synchronously.
 */
import '@testing-library/jest-dom';
import { fireEvent, loadSvelte, render, srcPath } from './testUtils';

let Content: any;

beforeAll(async () => {
  Content = await loadSvelte(srcPath('ui/Content.svelte'));
});

function makeSyncManager(content: string) {
  const obsidianTask = { content };
  return {
    obsidianTask,
    updateObsidianTaskAttribute: jest.fn((key: string, value: any) => {
      (obsidianTask as any)[key] = value;
      return Promise.resolve();
    })
  };
}

function renderContent(content: string) {
  const syncManager = makeSyncManager(content);
  const result = render(Content, {
    props: { taskSyncManager: syncManager }
  });
  return { syncManager, ...result };
}

const EDITOR_SELECTOR = '.task-card-content.editing[contenteditable]';

async function openEditor(container: HTMLElement): Promise<HTMLElement> {
  await fireEvent.click(container.querySelector('div.task-card-content')!);
  const editor = container.querySelector(EDITOR_SELECTOR) as HTMLElement;
  expect(editor).not.toBeNull();
  return editor;
}

async function typeInto(editor: HTMLElement, text: string) {
  await fireEvent.input(editor, { target: { textContent: text } });
}

describe('Content (interactive)', () => {
  test('clicking the content opens an editor seeded with the current text', async () => {
    const { container } = renderContent('buy milk');

    const editor = await openEditor(container);
    expect(editor.textContent).toBe('buy milk');
  });

  test('Enter commits the change and closes the editor', async () => {
    const { container, syncManager } = renderContent('buy milk');

    const editor = await openEditor(container);
    await typeInto(editor, 'buy oat milk');
    await fireEvent.keyDown(editor, { key: 'Enter' });

    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledWith(
      'content',
      'buy oat milk'
    );
    expect(container.querySelector(EDITOR_SELECTOR)).toBeNull();
    expect(container.textContent).toContain('buy oat milk');
  });

  test('losing focus (clicking elsewhere) commits like Enter', async () => {
    const { container, syncManager } = renderContent('buy milk');

    const editor = await openEditor(container);
    await typeInto(editor, 'buy oat milk');
    await fireEvent.blur(editor);

    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledWith(
      'content',
      'buy oat milk'
    );
    expect(container.querySelector(EDITOR_SELECTOR)).toBeNull();
  });

  test('losing focus without a change closes the editor without writing', async () => {
    const { container, syncManager } = renderContent('buy milk');

    const editor = await openEditor(container);
    await fireEvent.blur(editor);

    expect(syncManager.updateObsidianTaskAttribute).not.toHaveBeenCalled();
    expect(container.querySelector(EDITOR_SELECTOR)).toBeNull();
  });

  test('Escape cancels the edit and restores the saved content', async () => {
    const { container, syncManager } = renderContent('buy milk');

    const editor = await openEditor(container);
    await typeInto(editor, 'scratch that');
    await fireEvent.keyDown(editor, { key: 'Escape' });

    expect(syncManager.updateObsidianTaskAttribute).not.toHaveBeenCalled();
    expect(container.querySelector(EDITOR_SELECTOR)).toBeNull();
    expect(container.textContent).toContain('buy milk');
  });

  test('committing an emptied editor reverts instead of writing an empty title', async () => {
    const { container, syncManager } = renderContent('buy milk');

    const editor = await openEditor(container);
    await typeInto(editor, '   ');
    await fireEvent.keyDown(editor, { key: 'Enter' });

    expect(syncManager.updateObsidianTaskAttribute).not.toHaveBeenCalled();
    expect(container.textContent).toContain('buy milk');
  });
});

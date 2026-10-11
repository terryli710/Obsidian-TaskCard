/** @jest-environment jsdom */

/**
 * Component tests for src/ui/Description.svelte (interactive mode).
 *
 * Description Markdown uses Obsidian's renderer (mocked at that boundary);
 * subtask checkboxes are re-enabled and toggle the
 * underlying markdown via updateObsidianTaskAttribute. The sync-manager stub
 * mirrors the real manager's behavior of updating obsidianTask synchronously
 * (the component's reactive block resets `description` from
 * obsidianTask.description otherwise).
 *
 * Query cards use this same renderer with disabled subtask checkboxes.
 */
import '@testing-library/jest-dom';
import { App, MarkdownRenderer } from 'obsidian';
import { fireEvent, loadSvelte, render, srcPath, waitFor } from './testUtils';

let Description: any;

beforeAll(async () => {
  Description = await loadSvelte(srcPath('ui/Description.svelte'));
});

function makeSyncManager(description: string) {
  const obsidianTask = { description };
  const stub = {
    obsidianTask,
    plugin: { app: new App() },
    taskMetadata: { sourcePath: 'Plans/Week.md' },
    taskCardStatus: { descriptionStatus: 'done' },
    getTaskCardStatus(key: string) {
      return (this.taskCardStatus as any)[key];
    },
    updateObsidianTaskAttribute: jest.fn((key: string, value: any) => {
      (obsidianTask as any)[key] = value;
      return Promise.resolve();
    })
  };
  return stub;
}

async function renderDescription(description: string) {
  const syncManager = makeSyncManager(description);
  const result = render(Description, {
    props: { taskSyncManager: syncManager, displayDescription: false }
  });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  return { syncManager, ...result };
}

describe('Description (interactive)', () => {
  test('renders markdown checklists with progress digits', async () => {
    const { container } = await renderDescription('- [ ] step one\n- [x] step two');

    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('step one');
    expect(items[1].textContent).toContain('step two');

    const checkboxes = container.querySelectorAll<HTMLInputElement>(
      'input.task-list-item-checkbox'
    );
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(true);
    // checkboxes are re-enabled for interaction
    expect(checkboxes[0].disabled).toBe(false);

    // progress row: 1 of 2 sub-tasks done
    expect(
      container.querySelector('.task-card-progress-text')!.textContent
    ).toContain('1/2');
    // compact count (issue #7); the long form stays as the tooltip
    expect(
      container.querySelector('.task-card-progress-row')!.getAttribute('title')
    ).toBe('1 of 2 subtasks');
  });

  test('renders nothing for an empty description', async () => {
    const { container } = await renderDescription('');
    expect(container.querySelector('.task-card-description-wrapper')).toBeNull();
  });

  test('plain text description renders without a progress bar', async () => {
    const { container } = await renderDescription('just some notes');

    expect(container.textContent).toContain('just some notes');
    expect(container.querySelector('.task-card-progress-row')).toBeNull();
  });

  test('clicking a sub-task checkbox toggles its markdown line and saves', async () => {
    const { container, syncManager } = await renderDescription(
      '- [ ] step one\n- [x] step two'
    );

    const checkbox = container.querySelector<HTMLInputElement>(
      'input.task-list-item-checkbox'
    )!;
    await fireEvent.click(checkbox);

    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledWith(
      'description',
      '- [x] step one\n- [x] step two'
    );
    // progress count updates reactively
    expect(
      container.querySelector('.task-card-progress-text')!.textContent
    ).toContain('2/2');
    // compact count (issue #7); the long form stays as the tooltip
    expect(
      container.querySelector('.task-card-progress-row')!.getAttribute('title')
    ).toBe('2 of 2 subtasks');
  });

  test('maps native checkboxes without data-line through plain lines and code to their original subtask source', async () => {
    const source = '- Plain note\n\n```text\n- [ ] literal #TaskCard\n```\n\n- [ ] Follow **up** [[Note#Details]] #TaskCard ^tc-abcdef\n    - [x] Nested #TaskCard ^tc-ghijkl';
    const { container, syncManager } = await renderDescription(source);
    const checkboxes = container.querySelectorAll<HTMLInputElement>('input.task-list-item-checkbox');
    expect(checkboxes).toHaveLength(2);
    container.querySelectorAll('li').forEach(li => li.removeAttribute('data-line'));
    await fireEvent.click(checkboxes[0]);
    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledWith('description',
      source.replace('- [ ] Follow **up**', '- [x] Follow **up**'));
  });

  test('maps checkboxes in blockquotes and alternate list markers without changing the marker', async () => {
    const source = '> * [ ] Quoted #TaskCard ^tc-abcdef\n\n1. [ ] Ordered #TaskCard ^tc-ghijkl';
    const { container, syncManager } = await renderDescription(source);
    const checkboxes = container.querySelectorAll<HTMLInputElement>('input.task-list-item-checkbox');
    expect(checkboxes).toHaveLength(2);
    await fireEvent.click(checkboxes[1]);
    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledWith('description',
      source.replace('1. [ ] Ordered', '1. [x] Ordered'));
  });

  test('code-processor checkboxes keep their native owner and cannot consume a source subtask mapping', async () => {
    (MarkdownRenderer.render as jest.Mock).mockImplementationOnce(async (_app, _markdown, host) => {
      host.innerHTML = '<div class="block-language-dataview"><ul><li class="task-list-item"><input class="task-list-item-checkbox" type="checkbox">Generated</li></ul></div><ul><li class="task-list-item"><input class="task-list-item-checkbox" type="checkbox">Actual</li></ul>';
    });
    const source = '```dataview\nTASK FROM "Other"\n```\n\n- [ ] Actual #TaskCard ^tc-abcdef';
    const { container, syncManager } = await renderDescription(source);
    const checkboxes = container.querySelectorAll<HTMLInputElement>('input.task-list-item-checkbox');
    await fireEvent.click(checkboxes[0]);
    expect(syncManager.updateObsidianTaskAttribute).not.toHaveBeenCalled();
    await fireEvent.click(checkboxes[1]);
    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledWith('description',
      source.replace('- [ ] Actual', '- [x] Actual'));
  });

  test('a bare checkbox marker cannot shift the following real subtask mapping', async () => {
    const source = '- [ ]\n- [ ] Actual #TaskCard ^tc-abcdef';
    const { container, syncManager } = await renderDescription(source);
    const checkboxes = container.querySelectorAll<HTMLInputElement>('input.task-list-item-checkbox');
    expect(checkboxes).toHaveLength(1);
    await fireEvent.click(checkboxes[0]);
    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledWith('description',
      source.replace('- [ ] Actual', '- [x] Actual'));
  });

  test('unexpected rendered checkboxes cannot write a guessed source line', async () => {
    (MarkdownRenderer.render as jest.Mock).mockImplementationOnce(async (_app, _markdown, host) => {
      host.innerHTML = '<ul><li><input class="task-list-item-checkbox" type="checkbox">Injected</li><li><input class="task-list-item-checkbox" type="checkbox">Actual</li></ul>';
    });
    const { container, syncManager } = await renderDescription('- [ ] Actual #TaskCard ^tc-abcdef');
    const checkboxes = container.querySelectorAll<HTMLInputElement>('input.task-list-item-checkbox');
    expect([...checkboxes].every(cb => cb.disabled)).toBe(true);
    await fireEvent.click(checkboxes[0]);
    expect(syncManager.updateObsidianTaskAttribute).not.toHaveBeenCalled();
  });

  test('clicking the description opens the editor; Shift+Enter saves the edit', async () => {
    const { container, syncManager } = await renderDescription('- [ ] step one');

    await fireEvent.click(container.querySelector('div.task-card-description')!);

    const textarea = container.querySelector(
      'textarea.task-card-description'
    ) as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.value).toBe('- [ ] step one');

    await fireEvent.input(textarea, {
      target: { value: '- [ ] step one\n- [ ] step two' }
    });
    await fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledWith(
      'description',
      '- [ ] step one\n- [ ] step two'
    );
    // editor closes and the new sub-task is rendered
    expect(container.querySelector('textarea.task-card-description')).toBeNull();
    await waitFor(() => expect(container.querySelectorAll('li')).toHaveLength(2));
  });

  test('losing focus (clicking elsewhere) commits like Shift+Enter', async () => {
    const { container, syncManager } = await renderDescription('- [ ] step one');

    await fireEvent.click(container.querySelector('div.task-card-description')!);
    const textarea = container.querySelector(
      'textarea.task-card-description'
    ) as HTMLTextAreaElement;
    await fireEvent.input(textarea, {
      target: { value: '- [ ] step one\n- [ ] step two' }
    });
    await fireEvent.blur(textarea);

    expect(syncManager.updateObsidianTaskAttribute).toHaveBeenCalledWith(
      'description',
      '- [ ] step one\n- [ ] step two'
    );
    expect(container.querySelector('textarea.task-card-description')).toBeNull();
  });

  test('losing focus without a change closes the editor without writing', async () => {
    const { container, syncManager } = await renderDescription('- [ ] step one');

    await fireEvent.click(container.querySelector('div.task-card-description')!);
    const textarea = container.querySelector(
      'textarea.task-card-description'
    ) as HTMLTextAreaElement;
    await fireEvent.blur(textarea);

    expect(syncManager.updateObsidianTaskAttribute).not.toHaveBeenCalled();
    expect(container.querySelector('textarea.task-card-description')).toBeNull();
  });

  test('Escape cancels the edit and restores the saved description', async () => {
    const { container, syncManager } = await renderDescription('- [ ] step one');

    await fireEvent.click(container.querySelector('div.task-card-description')!);
    const textarea = container.querySelector(
      'textarea.task-card-description'
    ) as HTMLTextAreaElement;
    await fireEvent.input(textarea, { target: { value: 'scratch that' } });
    await fireEvent.keyDown(textarea, { key: 'Escape' });

    expect(syncManager.updateObsidianTaskAttribute).not.toHaveBeenCalled();
    expect(container.querySelector('textarea.task-card-description')).toBeNull();
    expect(container.textContent).toContain('step one');
  });
});

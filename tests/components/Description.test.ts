/** @jest-environment jsdom */

/**
 * Component tests for src/ui/Description.svelte (interactive mode).
 *
 * The description markdown is rendered through markdown-it +
 * markdown-it-task-lists; sub-task checkboxes are re-enabled and toggle the
 * underlying markdown via updateObsidianTaskAttribute. The sync-manager stub
 * mirrors the real manager's behavior of updating obsidianTask synchronously
 * (the component's reactive block resets `description` from
 * obsidianTask.description otherwise).
 *
 * Note: non-interactive mode (interactive: false + taskItem) is NOT mountable
 * when a description exists -- the template calls
 * taskSyncManager.getTaskCardStatus(...) unguarded, which throws with an
 * undefined taskSyncManager. Static rendering uses StaticTaskCard.svelte
 * instead, so only the interactive path is tested here.
 */
import '@testing-library/jest-dom';
import { fireEvent, loadSvelte, render, srcPath } from './testUtils';

let Description: any;

beforeAll(async () => {
  Description = await loadSvelte(srcPath('ui/Description.svelte'));
});

function makeSyncManager(description: string) {
  const obsidianTask = { description };
  const stub = {
    obsidianTask,
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

function renderDescription(description: string) {
  const syncManager = makeSyncManager(description);
  const result = render(Description, {
    props: { taskSyncManager: syncManager, displayDescription: false }
  });
  return { syncManager, ...result };
}

describe('Description (interactive)', () => {
  test('renders markdown checklists with progress digits', () => {
    const { container } = renderDescription('- [ ] step one\n- [x] step two');

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
    ).toContain('1 of 2 subtasks');
  });

  test('renders nothing for an empty description', () => {
    const { container } = renderDescription('');
    expect(container.querySelector('.task-card-description-wrapper')).toBeNull();
  });

  test('plain text description renders without a progress bar', () => {
    const { container } = renderDescription('just some notes');

    expect(container.textContent).toContain('just some notes');
    expect(container.querySelector('.task-card-progress-row')).toBeNull();
  });

  test('clicking a sub-task checkbox toggles its markdown line and saves', async () => {
    const { container, syncManager } = renderDescription(
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
    ).toContain('2 of 2 subtasks');
  });

  test('clicking the description opens the editor; Shift+Enter saves the edit', async () => {
    const { container, syncManager } = renderDescription('- [ ] step one');

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
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  test('losing focus (clicking elsewhere) commits like Shift+Enter', async () => {
    const { container, syncManager } = renderDescription('- [ ] step one');

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
    const { container, syncManager } = renderDescription('- [ ] step one');

    await fireEvent.click(container.querySelector('div.task-card-description')!);
    const textarea = container.querySelector(
      'textarea.task-card-description'
    ) as HTMLTextAreaElement;
    await fireEvent.blur(textarea);

    expect(syncManager.updateObsidianTaskAttribute).not.toHaveBeenCalled();
    expect(container.querySelector('textarea.task-card-description')).toBeNull();
  });

  test('Escape cancels the edit and restores the saved description', async () => {
    const { container, syncManager } = renderDescription('- [ ] step one');

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

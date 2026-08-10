/** @jest-environment jsdom */

/**
 * Covers two code-review fixes on the quick-add modal:
 *  - computeQuickAddInsertion: the pure helper that decides where a
 *    quick-added task line lands in the active editor (never spliced
 *    mid-line into existing text).
 *  - chip removal: clicking a chip's ✕ must strip the token's source text
 *    from the input (not just the chip), collapse doubled whitespace, and
 *    re-render the highlight/chip/preview trio.
 *
 * Uses jsdom (docblock above) so the obsidian mock's DOM prototype helpers
 * (createEl/createDiv/addClass/...) are installed on real HTMLElements and
 * `.click()` dispatches a real event, matching tests/components' pattern.
 */
import { writable } from 'svelte/store';
import { App, MarkdownView, WorkspaceLeaf } from 'obsidian';
import {
  computeQuickAddInsertion,
  QuickAddTaskModal
} from '../src/modal/quickAddTaskModal';
import { TaskFormatter } from '../src/taskModule/taskFormatter';

describe('computeQuickAddInsertion', () => {
  it('splices a mid-line cursor onto its own new line, after the existing text', () => {
    const plan = computeQuickAddInsertion(0, 'Hello world', '- [ ] Review PR #TaskCard');
    expect(plan.insertFrom).toEqual({ line: 0, ch: 'Hello world'.length });
    expect(plan.insertText).toBe('\n- [ ] Review PR #TaskCard');
    expect(plan.cursor).toEqual({ line: 1, ch: '- [ ] Review PR #TaskCard'.length });
  });

  it('fills an empty line in place, without prepending a blank line', () => {
    const plan = computeQuickAddInsertion(3, '', '- [ ] Review PR #TaskCard');
    expect(plan.insertFrom).toEqual({ line: 3, ch: 0 });
    expect(plan.insertText).toBe('- [ ] Review PR #TaskCard');
    expect(plan.insertText.startsWith('\n')).toBe(false);
    expect(plan.cursor).toEqual({ line: 3, ch: '- [ ] Review PR #TaskCard'.length });
  });

  it('appends a new line at EOF when the last line has no trailing newline', () => {
    const plan = computeQuickAddInsertion(2, 'no trailing newline', '- [ ] Task #TaskCard');
    expect(plan.insertFrom).toEqual({ line: 2, ch: 'no trailing newline'.length });
    expect(plan.insertText).toBe('\n- [ ] Task #TaskCard');
    expect(plan.cursor).toEqual({ line: 3, ch: '- [ ] Task #TaskCard'.length });
  });

  it('fills the blank last line Obsidian shows at EOF when the file already ends with a trailing newline', () => {
    // Files ending in "\n" surface an extra empty final line in the editor;
    // that's just the empty-line case again — no double blank line results.
    const plan = computeQuickAddInsertion(4, '', '- [ ] Task #TaskCard');
    expect(plan.insertFrom).toEqual({ line: 4, ch: 0 });
    expect(plan.insertText).toBe('- [ ] Task #TaskCard');
    expect(plan.cursor).toEqual({ line: 4, ch: '- [ ] Task #TaskCard'.length });
  });
});

function makePluginStub() {
  const settingsStore = writable({
    parsingSettings: {
      indicatorTag: 'TaskCard',
      markdownSuffix: ' .',
      writeCompletionDate: true
    },
    displaySettings: { defaultMode: 'single-line' },
    userMetadata: { projects: [] }
  });

  return {
    settings: {
      parsingSettings: { indicatorTag: 'TaskCard' },
      userMetadata: { projects: [] }
    },
    taskFormatter: new TaskFormatter(settingsStore as any),
    quickAddLastTargetPath: null as string | null
  };
}

describe('QuickAddTaskModal', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-09T10:00:00'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('removing a chip strips the token text from the input, collapses whitespace, and re-parses the preview', () => {
    const app = new App();
    const plugin = makePluginStub();
    const modal = new QuickAddTaskModal(app as any, plugin as any) as any;
    modal.open();

    modal.inputEl.value = 'Review PR tomorrow 3pm #code';
    modal.inputEl.dispatchEvent(new Event('input'));
    expect(modal.input).toBe('Review PR tomorrow 3pm #code');

    const chips: HTMLElement[] = Array.from(modal.chipsEl.children);
    const dueChip = chips.find((chip) => chip.classList.contains('taskcard-quick-add-token-due'));
    expect(dueChip).toBeDefined();
    const removeButton = dueChip!.querySelector(
      '.taskcard-quick-add-chip-remove'
    ) as HTMLElement;
    expect(removeButton).not.toBeNull();

    removeButton.click();

    // Token text removed, not just the chip; doubled whitespace collapsed.
    expect(modal.input).toBe('Review PR #code');
    expect(modal.inputEl.value).toBe('Review PR #code');

    // Re-parsed: the due chip is gone and the preview line reflects the new input.
    const remainingChips: HTMLElement[] = Array.from(modal.chipsEl.children);
    expect(
      remainingChips.some((chip) => chip.classList.contains('taskcard-quick-add-token-due'))
    ).toBe(false);
    expect(modal.previewEl.textContent).toBe('- [ ] Review PR #code #TaskCard');
  });

  it('preview line omits the block id (id is minted on submit, not on preview)', () => {
    const app = new App();
    const plugin = makePluginStub();
    const modal = new QuickAddTaskModal(app as any, plugin as any) as any;
    modal.open();

    modal.inputEl.value = 'Review PR #code';
    modal.inputEl.dispatchEvent(new Event('input'));

    expect(modal.previewEl.textContent).toBe('- [ ] Review PR #code #TaskCard');
    expect(modal.previewEl.textContent).not.toMatch(/\^tc-/);
  });

  it('inserting into an active editor with a mid-line cursor lands the task on its own new line', async () => {
    const app = new App();
    const plugin = makePluginStub();
    const target = (app.vault as any).__setFile('note.md', 'Hello world');

    const editorLines = ['Hello world'];
    const fakeEditor = {
      getCursor: jest.fn(() => ({ line: 0, ch: 5 })),
      getLine: jest.fn((line: number) => editorLines[line] ?? ''),
      replaceRange: jest.fn((text: string, from: { line: number; ch: number }) => {
        const existing = editorLines[from.line] ?? '';
        const before = existing.slice(0, from.ch);
        const after = existing.slice(from.ch);
        const inserted = (before + text + after).split('\n');
        editorLines.splice(from.line, 1, ...inserted);
      }),
      setCursor: jest.fn()
    };

    const leaf: any = new (WorkspaceLeaf as any)();
    const view: any = new (MarkdownView as any)();
    view.file = target;
    view.editor = fakeEditor;
    leaf.view = view;
    (app.workspace as any).activeLeaf = leaf;
    (app.workspace as any).getActiveFile = () => target;

    const modal = new QuickAddTaskModal(app as any, plugin as any) as any;
    modal.open();
    modal.inputEl.value = 'Review PR #code';
    modal.inputEl.dispatchEvent(new Event('input'));

    await modal.submit();

    // The original sentence must survive untouched, on its own line, with
    // the task appended as a new line rather than spliced mid-sentence.
    expect(editorLines).toHaveLength(2);
    expect(editorLines[0]).toBe('Hello world');
    expect(editorLines[1]).toMatch(/^- \[ \] Review PR #code #TaskCard \^tc-[a-z0-9]{6}$/);
    expect(fakeEditor.setCursor).toHaveBeenCalledWith({ line: 1, ch: editorLines[1].length });
  });
});

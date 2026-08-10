/** @jest-environment jsdom */

// TaskCardRenderer imports the Svelte adapter (and through it TaskItem.svelte),
// which only compiles in the jsdom component-test setup; stub it out here.
jest.mock('../src/renderer/postProcessor', () => ({
  TaskItemSvelteAdapter: class {
    taskSync: any;
    constructor(taskSync: any) {
      this.taskSync = taskSync;
    }
  }
}));

import { TaskCardRenderManager } from '../src/renderer/TaskCardRenderer';

/**
 * Anti-blink contract of the post processor (see hideTaskItemsPendingMount):
 *
 * - Task items are hidden synchronously — before the first await — so a
 *   re-render never paints the raw checkbox line while the section markdown
 *   is read and parsed.
 * - Items that get a card keep the hide class; the adapter owns its removal
 *   on load (unhiding here would re-flash the raw item before mount).
 * - Items that do NOT get a card (detached section, unreadable file, parse
 *   throw) are always un-hidden, or tasks would vanish from the note.
 */

const PENDING_CLS = 'obsidian-taskcard-mount-pending';

const SECTION_MD = ['- [ ] task one #TaskCard', '- [ ] task two #TaskCard'].join(
  '\n'
);

function buildSection(taskTexts: string[]): {
  sectionDiv: HTMLElement;
  items: HTMLElement[];
} {
  const sectionDiv = document.createElement('div');
  const ul = document.createElement('ul');
  ul.classList.add('contains-task-list', 'has-list-bullet');
  const items = taskTexts.map((text) => {
    const li = document.createElement('li');
    li.className = 'task-list-item';
    // isTaskItemEl requires a child element
    const p = document.createElement('p');
    p.textContent = text;
    li.appendChild(p);
    ul.appendChild(li);
    return li;
  });
  sectionDiv.appendChild(ul);
  return { sectionDiv, items };
}

function makePlugin(sectionMarkdown: string | null) {
  return {
    taskValidator: { isValidTaskElement: jest.fn(() => true) },
    fileOperator: {
      getMarkdownBetweenLinesForDisplay: jest.fn(async () => sectionMarkdown)
    },
    taskParser: {
      parseAnyTaskFromFileLines: jest.fn((lines: string[]) => ({
        content: lines[0]
      }))
    },
    hydrateSyncMappings: jest.fn()
  } as any;
}

function makeCtx(overrides?: Partial<any>) {
  return {
    sourcePath: 'notes/tasks.md',
    getSectionInfo: jest.fn(() => ({
      text: SECTION_MD,
      lineStart: 0,
      lineEnd: 1
    })),
    addChild: jest.fn(),
    ...overrides
  } as any;
}

describe('TaskCardRenderManager post processor (anti-blink hide)', () => {
  it('hides task items synchronously, before any await', () => {
    const { sectionDiv, items } = buildSection(['task one', 'task two']);
    const manager = new TaskCardRenderManager(makePlugin(SECTION_MD));
    const promise = manager.getPostProcessor()(sectionDiv, makeCtx());

    // not awaited yet: the hide must already be in place
    for (const item of items) {
      expect(item.classList.contains(PENDING_CLS)).toBe(true);
    }
    return promise;
  });

  it('keeps mounted items hidden (the adapter unhides on load) and registers a card per item', async () => {
    const { sectionDiv, items } = buildSection(['task one', 'task two']);
    const ctx = makeCtx();
    const manager = new TaskCardRenderManager(makePlugin(SECTION_MD));
    await manager.getPostProcessor()(sectionDiv, ctx);

    expect(ctx.addChild).toHaveBeenCalledTimes(2);
    for (const item of items) {
      expect(item.classList.contains(PENDING_CLS)).toBe(true);
    }
  });

  it('un-hides all items when the section is already detached (getSectionInfo → null)', async () => {
    const { sectionDiv, items } = buildSection(['task one', 'task two']);
    const ctx = makeCtx({ getSectionInfo: jest.fn(() => null) });
    const manager = new TaskCardRenderManager(makePlugin(SECTION_MD));
    await manager.getPostProcessor()(sectionDiv, ctx);

    expect(ctx.addChild).not.toHaveBeenCalled();
    for (const item of items) {
      expect(item.classList.contains(PENDING_CLS)).toBe(false);
    }
  });

  it('un-hides all items when the section markdown cannot be read', async () => {
    const { sectionDiv, items } = buildSection(['task one', 'task two']);
    const ctx = makeCtx();
    const manager = new TaskCardRenderManager(makePlugin(null));
    await manager.getPostProcessor()(sectionDiv, ctx);

    expect(ctx.addChild).not.toHaveBeenCalled();
    for (const item of items) {
      expect(item.classList.contains(PENDING_CLS)).toBe(false);
    }
  });

  it('un-hides all items even when task construction throws', async () => {
    const { sectionDiv, items } = buildSection(['task one', 'task two']);
    const plugin = makePlugin(SECTION_MD);
    plugin.taskParser.parseAnyTaskFromFileLines.mockImplementation(() => {
      throw new Error('parse exploded');
    });
    const manager = new TaskCardRenderManager(plugin);

    await expect(
      manager.getPostProcessor()(sectionDiv, makeCtx())
    ).rejects.toThrow('parse exploded');
    for (const item of items) {
      expect(item.classList.contains(PENDING_CLS)).toBe(false);
    }
  });

  it('leaves non-task-list sections untouched', async () => {
    const sectionDiv = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = 'just a paragraph';
    sectionDiv.appendChild(p);
    const ctx = makeCtx();
    const manager = new TaskCardRenderManager(makePlugin(SECTION_MD));
    await manager.getPostProcessor()(sectionDiv, ctx);

    expect(ctx.addChild).not.toHaveBeenCalled();
    expect(p.classList.contains(PENDING_CLS)).toBe(false);
  });
});

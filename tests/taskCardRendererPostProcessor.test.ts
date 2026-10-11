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
import { App } from 'obsidian';
import { writable } from 'svelte/store';
import { DefaultSettings } from '../src/settings';
import { TaskValidator } from '../src/taskModule/taskValidator';
import { TaskParser } from '../src/taskModule/taskParser';
import { TaskFormatter } from '../src/taskModule/taskFormatter';
import { ProjectModule } from '../src/taskModule/project';
import { FileOperator } from '../src/renderer/fileOperator';
import { ObsidianTaskSyncManager } from '../src/taskModule/taskSyncManager';

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
    taskValidator: {
      isValidTaskElement: jest.fn(() => true),
      isTaskCardTaskMarkdown: jest.fn(() => true)
    },
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

describe('Reading view tasks in weekly-plan lists', () => {
  const markdown = [
    '- **Monday**:',
    '- Deepwork',
    '\t<!-- stages:start -->',
    '\t- [ ] First task #TaskCard [project:: Work] ^fu-first',
    '\t\tA detail',
    '\t- [ ] Second task #TaskCard ^fu-second',
    '\t<!-- stages:end -->',
    '- [ ] Quick Tasks',
    '\t- [ ] Third task #TaskCard ^fu-third'
  ].join('\n');

  function setup() {
    const sectionDiv = document.createElement('div');
    // Obsidian Reading view supplies section-relative data-line positions.
    // HTML comments are absent, and Dataview can transform the field markup.
    sectionDiv.innerHTML = `<ul class="contains-task-list">
      <li>Monday:</li>
      <li>Deepwork<ul class="contains-task-list">
        <li class="task-list-item" data-line="3"><input class="task-list-item-checkbox"><a class="tag">#TaskCard</a> First task<span>Work</span><p>A detail</p></li>
        <li class="task-list-item" data-line="5"><input class="task-list-item-checkbox"><a class="tag">#TaskCard</a> Second task</li>
      </ul></li>
      <li class="task-list-item" data-line="7"><input class="task-list-item-checkbox">Quick Tasks<ul class="contains-task-list">
        <li class="task-list-item" data-line="8"><input class="task-list-item-checkbox"><a class="tag">#TaskCard</a> Third task</li>
      </ul></li>
    </ul>`;
    const app = new App();
    const settings = writable(JSON.parse(JSON.stringify(DefaultSettings)));
    const plugin: any = {
      app,
      taskValidator: new TaskValidator(settings),
      taskParser: new TaskParser(settings, new ProjectModule()),
      taskFormatter: new TaskFormatter(settings),
      hydrateSyncMappings: () => {},
      storeSyncMappings: async () => {}
    };
    plugin.fileOperator = new FileOperator(plugin, app);
    const sourcePath = 'weekly.md';
    (app.vault as any).__setFile(sourcePath, '# Week\n\n' + markdown + '\n\nAfter the list.');
    const ctx = makeCtx({
      sourcePath,
      getSectionInfo: () => ({ text: markdown, lineStart: 2, lineEnd: 10 })
    });
    return { sectionDiv, plugin, ctx, app };
  }

  it('mounts nested tagged tasks without taking over their plain or untagged parents', async () => {
    const { sectionDiv, plugin, ctx } = setup();
    await new TaskCardRenderManager(plugin).getPostProcessor()(sectionDiv, ctx);
    const tasks = ctx.addChild.mock.calls.map(([child]) => child.taskSync);
    expect(tasks.map((sync) => sync.obsidianTask.content)).toEqual([
      'First task', 'Second task', 'Third task'
    ]);
    expect(tasks.map((sync) => sync.obsidianTask.id)).toEqual(['fu-first', 'fu-second', 'fu-third']);
    expect(tasks.map((sync) => [sync.taskMetadata.lineStartInSection, sync.taskMetadata.lineEndsInSection]))
      .toEqual([[3, 5], [5, 6], [8, 9]]);
    expect(tasks[0].obsidianTask.description).toBe('A detail');
  });

  it('an edit patches only the nested task while preserving stage markers and siblings', async () => {
    const { sectionDiv, plugin, ctx, app } = setup();
    const tasks = await new TaskCardRenderManager(plugin).constructTaskSync(sectionDiv, ctx);
    expect(tasks).toHaveLength(3);
    const manager = new ObsidianTaskSyncManager(plugin, tasks[1]);
    await manager.updateObsidianTaskAttribute('content', 'Edited second task');
    expect((app.vault as any).__getContent('weekly.md')).toBe(
      '# Week\n\n' + markdown.replace('Second task', 'Edited second task') + '\n\nAfter the list.'
    );
  });

  it('keeps tagged subtasks inside their tagged parent card instead of mounting them twice', async () => {
    const { sectionDiv, plugin, ctx } = setup();
    const first = sectionDiv.querySelector('[data-line="3"]')!;
    const childList = document.createElement('ul');
    childList.className = 'contains-task-list';
    childList.innerHTML = '<li class="task-list-item" data-line="4"><input class="task-list-item-checkbox"><a class="tag">#TaskCard</a> Tagged subtask</li>';
    first.appendChild(childList);
    const source = markdown.replace('\t\tA detail', '\t\t- [ ] Tagged subtask #TaskCard');
    (plugin.app.vault as any).__setFile('weekly.md', '# Week\n\n' + source);
    const tasks = await new TaskCardRenderManager(plugin).constructTaskSync(sectionDiv, ctx);
    expect(tasks.map((sync) => sync.obsidianTask.id)).toEqual(['fu-first', 'fu-second', 'fu-third']);
    expect(tasks[0].obsidianTask.description).toBe('- [ ] Tagged subtask #TaskCard');
  });

  it('relocates an existing native block ID when source lines move after rendering', async () => {
    const { sectionDiv, plugin, ctx, app } = setup();
    const tasks = await new TaskCardRenderManager(plugin).constructTaskSync(sectionDiv, ctx);
    const original = (app.vault as any).__getContent('weekly.md');
    (app.vault as any).__setFile('weekly.md', 'Inserted above the week\n' + original);
    const manager = new ObsidianTaskSyncManager(plugin, tasks[1]);
    expect(await manager.resolveDocLineStartEnd()).toEqual([8, 9]);
  });

  it('mounts on the surviving DOM after Dataview replaces a parent containing inline fields', async () => {
    const { sectionDiv, plugin, ctx } = setup();
    const taskcard = new TaskCardRenderManager(plugin).getPostProcessor();
    // Dataview 0.5.68 runs at priority 100 and replaces the containing LI's
    // children from a template before rendering inline-field values.
    const dataview = {
      sortOrder: 100,
      run: async () => {
        // Obsidian starts processors concurrently. Dataview awaits each
        // preceding text container before reaching this parent list item.
        for (let i = 0; i < 5; i++) await Promise.resolve();
        const parent = sectionDiv.querySelector('[data-line="3"]')!.parentElement!.parentElement!;
        const template = document.createElement('template');
        template.innerHTML = parent.innerHTML;
        parent.replaceChildren(...Array.from(template.content.childNodes));
      }
    };
    const processors = [
      { sortOrder: taskcard.sortOrder ?? 0, run: () => taskcard(sectionDiv, ctx) },
      dataview
    ].sort((a, b) => a.sortOrder - b.sortOrder);
    await Promise.all(processors.map((processor) => processor.run()));
    const tasks = ctx.addChild.mock.calls.map(([child]) => child.taskSync);
    expect(tasks).toHaveLength(3);
    expect(tasks.every((sync) => sectionDiv.contains(sync.taskItemEl))).toBe(true);
  });
});

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

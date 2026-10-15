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
    docId: 'preview-one',
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
      getSectionInfo: () => ({ text: '# Week\n\n' + markdown + '\n\nAfter the list.', lineStart: 2, lineEnd: 10 })
    });
    return { sectionDiv, plugin, ctx, app };
  }

  function sourceSection(source: string, lineStart = 0, lineEnd = source.split('\n').length - 1) {
    const lines = source.split('\n');
    const taskLines = lines.slice(lineStart, lineEnd + 1)
      .map((text, index) => ({ text, index })).filter(line => line.text.startsWith('- [ ]'));
    const { sectionDiv, items } = buildSection(taskLines.map(line => line.text));
    items.forEach((item, index) => {
      item.dataset.line = String(taskLines[index].index);
      const checkbox = document.createElement('input');
      checkbox.className = 'task-list-item-checkbox';
      item.prepend(checkbox);
      const tag = document.createElement('a');
      tag.className = 'tag';
      tag.textContent = '#TaskCard';
      item.appendChild(tag);
    });
    const ctx = makeCtx({
      sourcePath: 'weekly.md',
      getSectionInfo: () => ({ text: source, lineStart, lineEnd })
    });
    return { sectionDiv, ctx };
  }

  function mountVisuals(tasks: ReturnType<TaskCardRenderManager['constructTaskSync']>) {
    for (const sync of tasks) {
      const card = document.createElement('li');
      card.className = `obsidian-taskcard-live mode-${sync.obsidianTask.metadata.taskDisplayParams?.mode ?? 'multi-line'}`;
      card.textContent = sync.obsidianTask.content;
      sync.taskItemEl.before(card);
      sync.taskItemEl.classList.add('obsidian-taskcard-source-hidden');
    }
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
    ctx.getSectionInfo = () => ({ text: '# Week\n\n' + source, lineStart: 2, lineEnd: 10 });
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

  it('renders the source snapshot belonging to the section, even if the vault has changed', async () => {
    const { sectionDiv, plugin, ctx, app } = setup();
    (app.vault as any).__setFile('weekly.md', '# A newer, unrelated document');
    const tasks = await new TaskCardRenderManager(plugin).constructTaskSync(sectionDiv, ctx);
    expect(tasks.map(sync => sync.obsidianTask.content)).toEqual(['First task', 'Second task', 'Third task']);
    expect(tasks[0].taskMetadata.lineStartInSection).toBe(3);
  });

  it('keeps expanded cards expanded when the section is replaced after a save', async () => {
    const { sectionDiv, plugin, ctx } = setup();
    const preview = document.createElement('div');
    preview.className = 'markdown-preview-view';
    preview.appendChild(sectionDiv);
    const manager = new TaskCardRenderManager(plugin);
    plugin.taskCardRenderManager = manager;
    const tasks = await manager.constructTaskSync(sectionDiv, ctx);
    new ObsidianTaskSyncManager(plugin, tasks[0]).updateObsidianTaskDisplayParams('mode', 'multi-line');
    new ObsidianTaskSyncManager(plugin, tasks[1]).updateObsidianTaskDisplayParams('mode', 'single-line');

    const replacement = sectionDiv.cloneNode(true) as HTMLElement;
    preview.replaceChildren(replacement);
    const refreshed = await manager.constructTaskSync(replacement, ctx);
    expect(refreshed[0].obsidianTask.metadata.taskDisplayParams).toEqual({ mode: 'multi-line' });
    expect(refreshed[1].obsidianTask.metadata.taskDisplayParams).toEqual({ mode: 'single-line' });

    const otherPreview = document.createElement('div');
    otherPreview.className = 'markdown-preview-view';
    const otherSection = sectionDiv.cloneNode(true) as HTMLElement;
    otherPreview.appendChild(otherSection);
    const otherPane = await manager.constructTaskSync(otherSection, ctx);
    expect(otherPane[0].obsidianTask.metadata.taskDisplayParams?.mode).toBeUndefined();
    const otherFile = await manager.constructTaskSync(replacement, { ...ctx, sourcePath: 'other.md' });
    expect(otherFile[0].obsidianTask.metadata.taskDisplayParams?.mode).toBeUndefined();
    new ObsidianTaskSyncManager(plugin, refreshed[0]).clearObsidianTaskDisplayParams();
    const cleared = await manager.constructTaskSync(replacement, ctx);
    expect(cleared[0].obsidianTask.metadata.taskDisplayParams?.mode).toBeUndefined();
  });

  it('keeps the previous card visuals visible until their replacements mount after a write', async () => {
    const { sectionDiv, plugin, ctx } = setup();
    const preview = document.createElement('div');
    preview.className = 'markdown-preview-view';
    preview.appendChild(sectionDiv);
    const manager = new TaskCardRenderManager(plugin);
    plugin.taskCardRenderManager = manager;
    const tasks = await manager.constructTaskSync(sectionDiv, ctx);
    // Model the mounted card/source siblings; the adapter is stubbed in this
    // suite. Real Svelte card interaction is covered by the native smoke test.
    for (const sync of tasks) {
      const card = document.createElement('li');
      card.className = 'obsidian-taskcard-live mode-multi-line';
      card.textContent = sync.obsidianTask.content;
      sync.taskItemEl.before(card);
      sync.taskItemEl.classList.add('obsidian-taskcard-source-hidden');
    }
    await new ObsidianTaskSyncManager(plugin, tasks[0]).updateObsidianTaskAttribute('completed', true);
    const otherPaneSection = setup().sectionDiv;
    const otherPanePending = manager.getPostProcessor()(otherPaneSection, { ...ctx, docId: 'other-preview' });
    expect(otherPaneSection.querySelector('.obsidian-taskcard-render-placeholder')).toBeNull();
    await otherPanePending;
    const replacement = setup().sectionDiv;
    // Obsidian supplies a new context for the same document and starts its
    // processors while the replacement section is still detached.
    const pending = manager.getPostProcessor()(replacement, { ...ctx });
    try {
      expect(Array.from(replacement.querySelectorAll('.obsidian-taskcard-render-placeholder'))
        .map(card => card.textContent)).toEqual(['First task', 'Second task', 'Third task']);
    } finally {
      preview.replaceChildren(replacement);
      await pending;
    }
    expect(replacement.querySelector('.obsidian-taskcard-render-placeholder')).toBeNull();
  });

  it('preserves distinct idless siblings when a save changes their source positions', async () => {
    const { plugin, app } = setup();
    const source = '- [ ] Saved task #TaskCard ^tc-saved1\n- [ ] New task #TaskCard\n- [ ] New task #TaskCard';
    (app.vault as any).__setFile('weekly.md', source);
    const { sectionDiv, ctx } = sourceSection(source);
    const preview = document.createElement('div');
    preview.className = 'markdown-preview-view';
    preview.appendChild(sectionDiv);
    const manager = new TaskCardRenderManager(plugin);
    plugin.taskCardRenderManager = manager;
    const tasks = manager.constructTaskSync(sectionDiv, ctx);
    new ObsidianTaskSyncManager(plugin, tasks[1]).updateObsidianTaskDisplayParams('mode', 'multi-line');
    new ObsidianTaskSyncManager(plugin, tasks[2]).updateObsidianTaskDisplayParams('mode', 'single-line');
    mountVisuals(tasks);
    await new ObsidianTaskSyncManager(plugin, tasks[0]).updateObsidianTaskAttribute('description', 'Inserted detail');
    const saved = (app.vault as any).__getContent('weekly.md');
    const replacement = sourceSection(saved);
    const pending = manager.getPostProcessor()(replacement.sectionDiv, replacement.ctx);
    try {
      const snapshots = replacement.sectionDiv.querySelectorAll('.obsidian-taskcard-render-placeholder');
      expect(Array.from(snapshots).map(card => card.textContent)).toEqual(['Saved task', 'New task', 'New task']);
      expect(snapshots[1].classList.contains('mode-multi-line')).toBe(true);
      expect(snapshots[2].classList.contains('mode-single-line')).toBe(true);
    } finally {
      preview.replaceChildren(replacement.sectionDiv);
      await pending;
    }
    const refreshed = replacement.ctx.addChild.mock.calls.map(([child]) => child.taskSync);
    expect(refreshed[1].obsidianTask.id).not.toBe(tasks[1].obsidianTask.id);
    expect(refreshed[1].obsidianTask.metadata.taskDisplayParams?.mode).toBe('multi-line');
    expect(refreshed[2].obsidianTask.metadata.taskDisplayParams?.mode).toBe('single-line');
    const newTask = new ObsidianTaskSyncManager(plugin, refreshed[1]);
    await newTask.updateObsidianTaskAttribute('content', 'Renamed new task');
    const afterFirstWrite = sourceSection((app.vault as any).__getContent('weekly.md'));
    preview.replaceChildren(afterFirstWrite.sectionDiv);
    const withId = manager.constructTaskSync(afterFirstWrite.sectionDiv, afterFirstWrite.ctx);
    expect(withId[1].obsidianTask.id).toMatch(/^tc-/);
    expect(withId[1].obsidianTask.metadata.taskDisplayParams?.mode).toBe('multi-line');
    expect(withId[2].obsidianTask.metadata.taskDisplayParams?.mode).toBe('single-line');
  });

  it('retains pending visuals for overlapping saves in separate sections of one document', async () => {
    const { plugin } = setup();
    const source = '- [ ] First section #TaskCard ^tc-first1\n\nDivider\n\n- [ ] Second section #TaskCard ^tc-second1';
    const first = sourceSection(source, 0, 0);
    const second = sourceSection(source, 4, 4);
    const preview = document.createElement('div');
    preview.className = 'markdown-preview-view';
    preview.append(first.sectionDiv, second.sectionDiv);
    const manager = new TaskCardRenderManager(plugin);
    const tasks = [manager.constructTaskSync(first.sectionDiv, first.ctx)[0],
      manager.constructTaskSync(second.sectionDiv, second.ctx)[0]];
    mountVisuals(tasks);
    manager.prepareTaskWrite(tasks[0]);
    manager.prepareTaskWrite(tasks[1]);
    const replacements = [sourceSection(source, 0, 0), sourceSection(source, 4, 4)];
    const pending = replacements.map(section => manager.getPostProcessor()(section.sectionDiv, section.ctx));
    try {
      expect(replacements.map(section => section.sectionDiv.querySelector('.obsidian-taskcard-render-placeholder')?.textContent))
        .toEqual(['First section', 'Second section']);
    } finally {
      preview.replaceChildren(...replacements.map(section => section.sectionDiv));
      await Promise.all(pending);
    }
  });

  it('leaves idless display state at its actual position when a file write rejects', async () => {
    const { plugin, app } = setup();
    const source = '- [ ] Saved task #TaskCard ^tc-saved1\n- [ ] New task #TaskCard\n- [ ] Other task #TaskCard ^tc-other1';
    (app.vault as any).__setFile('weekly.md', source);
    const section = sourceSection(source);
    const preview = document.createElement('div');
    preview.className = 'markdown-preview-view';
    preview.appendChild(section.sectionDiv);
    const manager = new TaskCardRenderManager(plugin);
    plugin.taskCardRenderManager = manager;
    const tasks = manager.constructTaskSync(section.sectionDiv, section.ctx);
    new ObsidianTaskSyncManager(plugin, tasks[1]).updateObsidianTaskDisplayParams('mode', 'multi-line');
    const failedWrite = jest.spyOn(plugin.fileOperator, 'updateFile').mockRejectedValueOnce(new Error('Disk write rejected'));
    await expect(new ObsidianTaskSyncManager(plugin, tasks[0]).updateObsidianTaskAttribute('description', 'Inserted detail'))
      .rejects.toThrow('Disk write rejected');
    failedWrite.mockRestore();
    await new ObsidianTaskSyncManager(plugin, tasks[2]).updateObsidianTaskAttribute('content', 'Other task renamed');
    const replacement = sourceSection((app.vault as any).__getContent('weekly.md'));
    preview.replaceChildren(replacement.sectionDiv);
    const refreshed = manager.constructTaskSync(replacement.sectionDiv, replacement.ctx);
    expect(refreshed[1].obsidianTask.metadata.taskDisplayParams?.mode).toBe('multi-line');
  });

  it('keeps surviving cards visible and in their modes when another card is deleted', async () => {
    const { plugin, app } = setup();
    plugin.removeSyncMappings = async () => {};
    const source = '- [ ] Deleted task #TaskCard ^tc-deleted1\n    Deleted detail\n- [ ] Surviving task #TaskCard ^tc-surviving1\n- [ ] New sibling #TaskCard';
    (app.vault as any).__setFile('weekly.md', source);
    const section = sourceSection(source);
    const preview = document.createElement('div');
    preview.className = 'markdown-preview-view';
    preview.appendChild(section.sectionDiv);
    const manager = new TaskCardRenderManager(plugin);
    plugin.taskCardRenderManager = manager;
    const tasks = manager.constructTaskSync(section.sectionDiv, section.ctx);
    new ObsidianTaskSyncManager(plugin, tasks[1]).updateObsidianTaskDisplayParams('mode', 'multi-line');
    new ObsidianTaskSyncManager(plugin, tasks[2]).updateObsidianTaskDisplayParams('mode', 'single-line');
    mountVisuals(tasks);
    await new ObsidianTaskSyncManager(plugin, tasks[0]).deleteTask();
    const saved = (app.vault as any).__getContent('weekly.md');
    expect(saved).toBe('\n- [ ] Surviving task #TaskCard ^tc-surviving1\n- [ ] New sibling #TaskCard');
    const replacement = sourceSection(saved);
    const pending = manager.getPostProcessor()(replacement.sectionDiv, replacement.ctx);
    try {
      expect(Array.from(replacement.sectionDiv.querySelectorAll('.obsidian-taskcard-render-placeholder'))
        .map(card => card.textContent)).toEqual(['Surviving task', 'New sibling']);
    } finally {
      preview.replaceChildren(replacement.sectionDiv);
      await pending;
    }
    const refreshed = replacement.ctx.addChild.mock.calls.map(([child]) => child.taskSync);
    expect(refreshed[0].obsidianTask.metadata.taskDisplayParams?.mode).toBe('multi-line');
    expect(refreshed[1].obsidianTask.metadata.taskDisplayParams?.mode).toBe('single-line');
  });
});

describe('TaskCardRenderManager post processor (anti-blink hide)', () => {
  it('finishes mounting in the next animation frame without waiting on a file read', async () => {
    jest.useFakeTimers();
    const originalRaf = window.requestAnimationFrame;
    const frames: FrameRequestCallback[] = [];
    window.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    const { sectionDiv } = buildSection(['task one', 'task two']);
    const ctx = makeCtx();
    const manager = new TaskCardRenderManager(makePlugin(SECTION_MD));
    const pending = manager.getPostProcessor()(sectionDiv, ctx);
    try {
      frames.forEach(frame => frame(16));
      await Promise.resolve();
      expect(ctx.addChild.mock.calls.map(([child]) => child.taskSync.obsidianTask.content))
        .toEqual(['- [ ] task one #TaskCard', '- [ ] task two #TaskCard']);
    } finally {
      await jest.runAllTimersAsync();
      await pending;
      window.requestAnimationFrame = originalRaf;
      jest.useRealTimers();
    }
  });

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

  it('mounts from the renderer source even when the vault file cannot be read', async () => {
    const { sectionDiv, items } = buildSection(['task one', 'task two']);
    const ctx = makeCtx();
    const manager = new TaskCardRenderManager(makePlugin(null));
    await manager.getPostProcessor()(sectionDiv, ctx);

    expect(ctx.addChild.mock.calls.map(([child]) => child.taskSync.obsidianTask.content))
      .toEqual(['- [ ] task one #TaskCard', '- [ ] task two #TaskCard']);
    for (const item of items) {
      expect(item.classList.contains(PENDING_CLS)).toBe(true);
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

import { writable } from 'svelte/store';
import { App } from 'obsidian';
import { TaskParser } from '../src/taskModule/taskParser';
import { TaskFormatter } from '../src/taskModule/taskFormatter';
import { Project, ProjectModule } from '../src/taskModule/project';
import { ObsidianTask } from '../src/taskModule/task';
import { FileOperator } from '../src/renderer/fileOperator';
import {
  parseRecurrenceRule,
  nextOccurrenceDate,
  advanceRecurringTask,
  resetDescriptionCheckboxes,
  stripRecurrenceFromLine,
  completeRecurringTaskInFile
} from '../src/taskModule/recurrence';
import { logger } from '../src/utils/log';

describe('recurrence module', () => {
  describe('parseRecurrenceRule', () => {
    it('normalizes valid natural-language rules', () => {
      expect(parseRecurrenceRule('every week')).toBe('every week');
      expect(parseRecurrenceRule('  every 2 weeks on Monday ')).toBe(
        'every 2 weeks on Monday'
      );
      expect(parseRecurrenceRule('every month on the 15th')).toBe(
        'every month on the 15th'
      );
      expect(parseRecurrenceRule('every weekday')).toBe('every weekday');
    });

    it('rejects invalid rules', () => {
      expect(parseRecurrenceRule('garbage text')).toBeNull();
      expect(parseRecurrenceRule('every')).toBeNull();
      expect(parseRecurrenceRule('')).toBeNull();
      expect(parseRecurrenceRule('   ')).toBeNull();
    });
  });

  describe('nextOccurrenceDate', () => {
    it('computes the next weekly occurrence', () => {
      expect(nextOccurrenceDate('every week', '2026-07-06')).toBe('2026-07-13');
    });

    it('respects byweekday rules', () => {
      // 2026-07-06 is a Monday; every 2 weeks on Monday -> two weeks later
      expect(nextOccurrenceDate('every 2 weeks on Monday', '2026-07-06')).toBe(
        '2026-07-20'
      );
    });

    it('computes monthly bymonthday occurrences', () => {
      expect(nextOccurrenceDate('every month on the 15th', '2026-07-06')).toBe(
        '2026-07-15'
      );
    });

    it('returns null for invalid rules', () => {
      expect(nextOccurrenceDate('garbage text', '2026-07-06')).toBeNull();
    });
  });

  describe('resetDescriptionCheckboxes', () => {
    it('unchecks completed subtasks and keeps everything else', () => {
      const description = '- [x] step one\n- [ ] step two\n- plain note';
      expect(resetDescriptionCheckboxes(description)).toBe(
        '- [ ] step one\n- [ ] step two\n- plain note'
      );
    });

    it('resets actual descendants while preserving fenced checkbox examples', () => {
      const description = '- [X] actual step\n\n```md\n- [x] literal checkbox\n```';
      expect(resetDescriptionCheckboxes(description)).toBe(
        '- [ ] actual step\n\n```md\n- [x] literal checkbox\n```'
      );
    });
  });

  describe('advanceRecurringTask', () => {
    const makeTask = () =>
      new ObsidianTask({
        id: 'task-1',
        content: 'Water the plants',
        recurrence: 'every week',
        schedule: {
          isRecurring: false,
          date: '2026-07-06',
          time: '09:00',
          string: 'today 9am'
        },
        due: { isRecurring: false, date: '2026-07-08', string: 'in 2 days' },
        description: '- [x] fill the can\n- [ ] mist the ferns',
        completed: true,
        metadata: {
          taskDisplayParams: { mode: 'multi-line' },
          syncMappings: { googleSyncSetting: { id: 'evt-1' } } as any
        }
      });

    it('advances schedule to the next occurrence and shifts due by the same offset', () => {
      const next = advanceRecurringTask(makeTask());
      expect(next).not.toBeNull();
      expect(next.schedule.date).toBe('2026-07-13');
      expect(next.schedule.time).toBe('09:00');
      expect(next.due.date).toBe('2026-07-15');
    });

    it('resets completion, description checkboxes, id, and sync mappings', () => {
      const orig = makeTask();
      const next = advanceRecurringTask(orig);
      expect(next.completed).toBe(false);
      expect(next.id).not.toBe(orig.id);
      expect(next.description).toBe('- [ ] fill the can\n- [ ] mist the ferns');
      expect(next.metadata.syncMappings).toBeUndefined();
      expect(next.metadata.taskDisplayParams).toEqual({ mode: 'multi-line' });
      expect(next.recurrence).toBe('every week');
      // the original task object is untouched
      expect(orig.completed).toBe(true);
      expect(orig.schedule.date).toBe('2026-07-06');
    });

    it('advances due when there is no schedule', () => {
      const task = makeTask();
      task.schedule = null;
      const next = advanceRecurringTask(task);
      expect(next.schedule).toBeNull();
      expect(next.due.date).toBe('2026-07-15');
    });

    it('returns null when the task has no recurrence', () => {
      const task = makeTask();
      task.recurrence = null;
      expect(advanceRecurringTask(task)).toBeNull();
    });
  });
});

describe('recurrence in parser and formatter', () => {
  let warnSpy, errorSpy, debugSpy, infoSpy;
  let taskParser: TaskParser;
  let taskFormatter: TaskFormatter;

  beforeEach(() => {
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    debugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {});
    infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});

    const mockSettingStore = writable({
      parsingSettings: {
        indicatorTag: 'TaskCard',
        markdownStartingNotation: '%%*',
        markdownEndingNotation: '*%%',
        markdownSuffix: ' .'
      },
      displaySettings: {
        defaultMode: 'single-line',
        upcomingMinutes: 15,
        queryDisplayMode: 'line',
        styleMetadataInLivePreview: true
      }
    });
    const mockProjectModule = new ProjectModule();
    mockProjectModule.updateProjects([
      { id: 'project-123', name: 'Project Name' } as Project
    ]);
    taskParser = new TaskParser(mockSettingStore as any, mockProjectModule);
    taskFormatter = new TaskFormatter(mockSettingStore as any);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    debugSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it('parses a %%* recurrence: ... *%% attribute and normalizes it', () => {
    const parsed = taskParser.parseTaskMarkdown(
      '- [ ] Water the plants #TaskCard %%*recurrence: every 2 weeks on Monday*%%'
    );
    expect(parsed.recurrence).toBe('every 2 weeks on Monday');
    expect(parsed.content).toBe('Water the plants');
  });

  it('parses Tasks-style inline 🔁 syntax and strips it from the content', () => {
    const parsed = taskParser.parseTaskMarkdown(
      '- [ ] Water the plants 🔁 every week #TaskCard'
    );
    expect(parsed.recurrence).toBe('every week');
    expect(parsed.content).toBe('Water the plants');
  });

  it('leaves content untouched when the 🔁 trailing text is not a valid rule', () => {
    const parsed = taskParser.parseTaskMarkdown(
      '- [ ] Buy the 🔁 emoji sticker pack #TaskCard'
    );
    expect(parsed.recurrence).toBeNull();
    expect(parsed.content).toBe('Buy the 🔁 emoji sticker pack');
  });

  it('reports an error for an invalid recurrence attribute', () => {
    const notices: string[] = [];
    const parsed = taskParser.parseTaskMarkdown(
      '- [ ] Water the plants #TaskCard %%*recurrence: whenever I feel like*%%',
      (msg) => notices.push(msg)
    );
    expect(parsed.recurrence).toBeNull();
    expect(notices.some((msg) => msg.includes('recurrence'))).toBe(true);
  });

  it('serializes recurrence as a [repeat:: ...] field and round-trips it', () => {
    const task = new ObsidianTask({
      content: 'Water the plants',
      recurrence: 'every week',
      schedule: { isRecurring: false, date: '2026-07-06', string: '2026-07-06' }
    });
    const markdown = taskFormatter.taskToMarkdown(task);
    expect(markdown).toContain('[repeat:: every week]');

    const reparsed = taskParser.parseAnyTaskMarkdown(markdown);
    expect(reparsed.recurrence).toBe('every week');
    expect(reparsed.content).toBe('Water the plants');
    expect(reparsed.schedule.date).toBe('2026-07-06');
  });
});

describe('stripRecurrenceFromLine', () => {
  it('removes a v2 [repeat:: ...] inline field', () => {
    expect(
      stripRecurrenceFromLine(
        '- [x] Water the plants #TaskCard [scheduled:: 2026-07-06] [repeat:: every week] ^tc-abc123'
      )
    ).toBe('- [x] Water the plants #TaskCard [scheduled:: 2026-07-06] ^tc-abc123');
  });

  it('removes real recurrence fields while retaining literal examples in code and links', () => {
    const line = '- [x] Read `[repeat:: literal]` and [guide](https://example.com/[repeat::literal]) #TaskCard [repeat:: every week] ^tc-abc123';
    expect(stripRecurrenceFromLine(line)).toBe(
      '- [x] Read `[repeat:: literal]` and [guide](https://example.com/[repeat::literal]) #TaskCard ^tc-abc123'
    );
  });

  it('removes parenthesized recurrence aliases without changing other fields', () => {
    expect(stripRecurrenceFromLine('- [x] Read #TaskCard (recurrence:: every week) [due:: 2026-07-06] ^tc-abc123')).toBe(
      '- [x] Read #TaskCard [due:: 2026-07-06] ^tc-abc123'
    );
  });

  it('nulls a legacy v1 hidden-span recurrence', () => {
    expect(
      stripRecurrenceFromLine(
        '- [x] Water plants #TaskCard<span style="display:none">{"id":"u-1","recurrence":"every week"}</span> .'
      )
    ).toBe(
      '- [x] Water plants #TaskCard<span style="display:none">{"id":"u-1","recurrence":null}</span> .'
    );
  });

  it.each([
    '`{"recurrence":"every day"}`',
    '`<span style="display:none">{"recurrence":"every day"}</span>`',
    '[guide](https://example.com/<span style="display:none">{"recurrence":"every day"}</span>)'
  ])('nulls only real legacy recurrence while preserving %s', literal => {
    const real = '<span style="display:none">{"id":"u-1","recurrence":"every week"}</span>';
    const line = '- [x] Read ' + literal + ' #TaskCard' + real + ' .';
    expect(stripRecurrenceFromLine(line)).toBe(
      '- [x] Read ' + literal + ' #TaskCard<span style="display:none">{"id":"u-1","recurrence":null}</span> .'
    );
  });

  it('leaves a line without recurrence untouched', () => {
    const line = '- [x] Plain task #TaskCard ^tc-def456';
    expect(stripRecurrenceFromLine(line)).toBe(line);
  });
});

describe('completeRecurringTaskInFile (query-block completion path)', () => {
  // Same placement contract as the live-card path: the clicked line completes
  // in place (minus its rule) and the next instance is inserted below it.
  const FILE_PATH = 'notes/recurring.md';
  let plugin: any;
  let vault: any;
  let formatter: TaskFormatter;

  beforeEach(() => {
    const app = new App();
    vault = app.vault;
    const settingsStore = writable({
      parsingSettings: {
        indicatorTag: 'TaskCard',
        markdownStartingNotation: '%%*',
        markdownEndingNotation: '*%%',
        markdownSuffix: ' .'
      },
      displaySettings: {
        defaultMode: 'single-line',
        upcomingMinutes: 15,
        queryDisplayMode: 'line',
        styleMetadataInLivePreview: true
      }
    });
    formatter = new TaskFormatter(settingsStore as any);
    plugin = { app };
    plugin.fileOperator = new FileOperator(plugin, app);
    plugin.taskFormatter = formatter;
  });

  const makeTask = () =>
    new ObsidianTask({
      content: 'Water the plants',
      recurrence: 'every week',
      schedule: { isRecurring: false, date: '2026-07-06', string: '2026-07-06' }
    });

  const sourceTask = (source: string, id = 'tc-source') => {
    const task = makeTask();
    task.id = id;
    task.metadata.sourceMarkdown = source;
    return task;
  };

  it.each(['* [ ] ', '+ [ ] ', '  12) [/]  ', '> - [X] ', '> > 2. [?] '])(
    'keeps the native prefix %j on both completed and next instances', async prefix => {
      const line = prefix + 'Water the plants #TaskCard [scheduled:: 2026-07-06] [repeat:: every week] ^tc-source';
      const task = sourceTask(line);
      vault.__setFile(FILE_PATH, line);
      await expect(completeRecurringTaskInFile(plugin, task, FILE_PATH, 0)).resolves.toBe(true);
      const lines = vault.__getContent(FILE_PATH).split('\n');
      const status = prefix.indexOf('[') + 1;
      expect(lines[0]).toBe(prefix.slice(0, status) + 'x' + prefix.slice(status + 1) +
        'Water the plants #TaskCard [scheduled:: 2026-07-06] ^tc-source');
      expect(lines[1].startsWith(prefix.slice(0, status) + ' ' + prefix.slice(status + 1))).toBe(true);
      expect(lines[1]).toContain('[scheduled:: 2026-07-13] [repeat:: every week]');
      expect(lines[1]).not.toContain('^tc-source');
    }
  );

  it('keeps the original description with the completed task and inserts reset descendants after it', async () => {
    const source = ['+ [ ] Water the plants #TaskCard [repeat:: every week] ^tc-source',
      '  + [X] fill the can', '  keep this note'].join('\n');
    const task = sourceTask(source);
    const sibling = '* [ ] untouched sibling #TaskCard';
    vault.__setFile(FILE_PATH, source + '\n' + sibling);
    await completeRecurringTaskInFile(plugin, task, FILE_PATH, 0);
    const lines = vault.__getContent(FILE_PATH).split('\n');
    expect(lines).toHaveLength(7);
    expect(lines.slice(0, 3)).toEqual([
      '+ [x] Water the plants #TaskCard ^tc-source', '  + [X] fill the can', '  keep this note'
    ]);
    expect(lines[3]).toMatch(/^\+ \[ \] Water the plants .*\[repeat:: every week\] \^tc-/);
    expect(lines.slice(4)).toEqual(['  + [ ] fill the can', '  keep this note', sibling]);
  });

  it('preserves quoted description source and resets alternative child markers', async () => {
    const source = ['> > 2. [?] Water the plants #TaskCard [repeat:: every week] ^tc-source',
      '> >     1) [X] fill the can', '> >     + [x] mist the ferns'].join('\n');
    vault.__setFile(FILE_PATH, source);
    await completeRecurringTaskInFile(plugin, sourceTask(source), FILE_PATH, 0);
    const lines = vault.__getContent(FILE_PATH).split('\n');
    expect(lines.slice(1, 3)).toEqual(['> >     1) [X] fill the can', '> >     + [x] mist the ferns']);
    expect(lines[3]).toMatch(/^> > 2\. \[ \] Water the plants/);
    expect(lines.slice(4)).toEqual(['> >     1) [ ] fill the can', '> >     + [ ] mist the ferns']);
  });

  it('copies fenced description examples literally while resetting real descendants', async () => {
    const description = ['    ```md', '    - [x] literal checkbox', '    ```', '    + [X] actual step'];
    const source = ['- [ ] Water the plants #TaskCard [repeat:: every week] ^tc-source', ...description].join('\n');
    vault.__setFile(FILE_PATH, source);
    await completeRecurringTaskInFile(plugin, sourceTask(source), FILE_PATH, 0);
    const lines = vault.__getContent(FILE_PATH).split('\n');
    expect(lines.slice(1, 5)).toEqual(description);
    expect(lines.slice(6)).toEqual(['    ```md', '    - [x] literal checkbox', '    ```', '    + [ ] actual step']);
  });

  it('relocates a unique persisted task rather than completing the cached row', async () => {
    const line = '- [ ] Water the plants #TaskCard [repeat:: every week] ^tc-source';
    const different = '- [ ] Different #TaskCard ^tc-other';
    vault.__setFile(FILE_PATH, ['# inserted', different, line, 'tail'].join('\n'));
    await completeRecurringTaskInFile(plugin, sourceTask(line), FILE_PATH, 1);
    const lines = vault.__getContent(FILE_PATH).split('\n');
    expect(lines[1]).toBe(different);
    expect(lines[2]).toBe('- [x] Water the plants #TaskCard ^tc-source');
    expect(lines[4]).toBe('tail');
  });

  it('relocates the task inside the atomic callback after a concurrent move', async () => {
    const source = '- [ ] Water the plants #TaskCard [repeat:: every week] ^tc-source\n    - [X] fill the can';
    const file = vault.__setFile(FILE_PATH, source + '\ntail');
    const process = vault.process.bind(vault);
    vault.process = async (_file, transform) => {
      await vault.modify(file, '# concurrent heading\n' + vault.__getContent(FILE_PATH));
      return process(file, transform);
    };
    await expect(completeRecurringTaskInFile(plugin, sourceTask(source), FILE_PATH, 0)).resolves.toBe(true);
    const lines = vault.__getContent(FILE_PATH).split('\n');
    expect(lines[0]).toBe('# concurrent heading');
    expect(lines[1]).toBe('- [x] Water the plants #TaskCard ^tc-source');
    expect(lines[2]).toBe('    - [X] fill the can');
    expect(lines[4]).toBe('    - [ ] fill the can');
    expect(lines[5]).toBe('tail');
  });

  it.each(['title', 'description', 'description extent', 'duplicate identity'])(
    'rejects a concurrent %s edit without changing the external source', async change => {
      const source = '- [ ] Water the plants #TaskCard [repeat:: every week] ^tc-source\n    - [x] fill the can';
      const file = vault.__setFile(FILE_PATH, source + '\ntail');
      const concurrent = change === 'title' ? source.replace('Water the plants', 'Externally renamed') + '\ntail'
        : change === 'description' ? source.replace('fill the can', 'external description') + '\ntail'
        : change === 'description extent' ? source + '\n    external new detail\ntail'
        : source + '\n' + source + '\ntail';
      const process = vault.process.bind(vault);
      vault.process = async (_file, transform) => {
        await vault.modify(file, concurrent);
        return process(file, transform);
      };
      await expect(completeRecurringTaskInFile(plugin, sourceTask(source), FILE_PATH, 0)).rejects.toThrow();
      expect(vault.__getContent(FILE_PATH)).toBe(concurrent);
    }
  );

  it.each(['missing identity', 'duplicate identity', 'changed snapshot', 'missing file'])(
    'rejects %s instead of falling back to the cached row', async scenario => {
      const source = '- [ ] Water the plants #TaskCard [repeat:: every week] ^tc-source';
      const current = scenario === 'missing identity' ? '- [ ] Different #TaskCard ^tc-other'
        : scenario === 'duplicate identity' ? source + '\n' + source
        : source.replace('Water the plants', 'Changed');
      if (scenario !== 'missing file') vault.__setFile(FILE_PATH, current);
      await expect(completeRecurringTaskInFile(plugin, sourceTask(source), FILE_PATH, 0)).rejects.toThrow();
      if (scenario !== 'missing file') expect(vault.__getContent(FILE_PATH)).toBe(current);
    }
  );

  it.each(['changed', 'duplicate'])(
    'refuses an ID-less %s source snapshot', async scenario => {
      const source = '- [ ] Water the plants #TaskCard [repeat:: every week]';
      const current = scenario === 'changed' ? source.replace('Water the plants', 'Different') : source + '\n' + source;
      vault.__setFile(FILE_PATH, current);
      await expect(completeRecurringTaskInFile(plugin, sourceTask(source, 'ephemeral-uuid'), FILE_PATH, 0)).rejects.toThrow();
      expect(vault.__getContent(FILE_PATH)).toBe(current);
    }
  );

  it('refuses an ID-less task without an original snapshot', async () => {
    const current = '- [ ] Different #TaskCard [repeat:: every week]';
    vault.__setFile(FILE_PATH, current);
    await expect(completeRecurringTaskInFile(plugin, makeTask(), FILE_PATH, 0)).rejects.toThrow();
    expect(vault.__getContent(FILE_PATH)).toBe(current);
  });

  it('refuses a source span with a multiline comment instead of inserting inside the comment', async () => {
    const task = makeTask();
    task.id = 'legacy-source';
    const current = '- [ ] Water the plants #TaskCard<span style="display:none">{"id":"legacy-source","recurrence":"every week"}</span> %% open comment\ncontinued comment\n%%';
    vault.__setFile(FILE_PATH, current);
    await expect(completeRecurringTaskInFile(plugin, task, FILE_PATH, 0)).rejects.toThrow();
    expect(vault.__getContent(FILE_PATH)).toBe(current);
  });

  it('refuses a description span with a multiline comment during recurrence insertion', async () => {
    const source = '- [ ] Water the plants #TaskCard [repeat:: every week] ^tc-source\n    %% note\n    hidden details\n    %%';
    vault.__setFile(FILE_PATH, source);
    await expect(completeRecurringTaskInFile(plugin, sourceTask(source), FILE_PATH, 0)).rejects.toThrow();
    expect(vault.__getContent(FILE_PATH)).toBe(source);
  });

  it('keeps a short-indented sibling outside a long ordered task description', async () => {
    const source = '123. [ ] Water the plants #TaskCard [repeat:: every week] ^tc-source\n     - [x] child';
    const sibling = '  - [ ] sibling #TaskCard';
    vault.__setFile(FILE_PATH, source + '\n' + sibling);
    await completeRecurringTaskInFile(plugin, sourceTask(source), FILE_PATH, 0);
    const lines = vault.__getContent(FILE_PATH).split('\n');
    expect(lines).toHaveLength(5);
    expect(lines[1]).toBe('     - [x] child');
    expect(lines[2]).toMatch(/^123\. \[ \] Water the plants/);
    expect(lines[3]).toBe('     - [ ] child');
    expect(lines[4]).toBe(sibling);
  });

  it('relocates an ID-less unique exact snapshot after a source move', async () => {
    const source = '- [ ] Water the plants #TaskCard [repeat:: every week]\n    - [x] fill the can';
    vault.__setFile(FILE_PATH, 'new heading\n' + source + '\ntail');
    await completeRecurringTaskInFile(plugin, sourceTask(source, 'ephemeral-uuid'), FILE_PATH, 0);
    expect(vault.__getContent(FILE_PATH).split('\n').slice(0, 3)).toEqual([
      'new heading', '- [x] Water the plants #TaskCard', '    - [x] fill the can'
    ]);
  });

  it.each(['metadata', 'snapshot'])(
    'resolves a native block ID from %s without requiring a tc ID', async identitySource => {
      const source = '- [ ] Water the plants #TaskCard [repeat:: every week] ^native-id';
      const task = sourceTask(source, 'ephemeral-uuid');
      if (identitySource === 'metadata') {
        delete task.metadata.sourceMarkdown;
        task.metadata.sourceBlockId = 'native-id';
      }
      vault.__setFile(FILE_PATH, 'heading\n' + source);
      await completeRecurringTaskInFile(plugin, task, FILE_PATH, 0);
      expect(vault.__getContent(FILE_PATH).split('\n')[1]).toBe('- [x] Water the plants #TaskCard ^native-id');
    }
  );

  it('finds unique legacy JSON identity when a constructed task has no snapshot', async () => {
    const source = '- [ ] Water the plants #TaskCard<span style="display:none">{"id":"legacy-source","recurrence":"every week"}</span> .';
    const task = makeTask();
    task.id = 'legacy-source';
    vault.__setFile(FILE_PATH, 'heading\n' + source);
    await completeRecurringTaskInFile(plugin, task, FILE_PATH, 0);
    expect(vault.__getContent(FILE_PATH).split('\n')[1]).toBe(
      '- [x] Water the plants #TaskCard<span style="display:none">{"id":"legacy-source","recurrence":null}</span> .'
    );
  });

  it('refuses duplicate persisted legacy IDs even when only one has the original text', async () => {
    const source = '- [ ] Water the plants #TaskCard<span style="display:none">{"id":"legacy-source","recurrence":"every week"}</span> .';
    const current = source + '\n' + source.replace('Water the plants', 'Different title');
    const task = sourceTask(source, 'legacy-source');
    vault.__setFile(FILE_PATH, current);
    await expect(completeRecurringTaskInFile(plugin, task, FILE_PATH, 0)).rejects.toThrow();
    expect(vault.__getContent(FILE_PATH)).toBe(current);
  });

  it('refuses a missing legacy identity even when another task quotes that ID in code', async () => {
    const task = makeTask();
    task.id = 'legacy-source';
    const literal = '- [ ] Read `<span style="display:none">{"id":"legacy-source","recurrence":"every week"}</span>` #TaskCard';
    vault.__setFile(FILE_PATH, literal);
    await expect(completeRecurringTaskInFile(plugin, task, FILE_PATH, 0)).rejects.toThrow();
    expect(vault.__getContent(FILE_PATH)).toBe(literal);
  });

  it('ignores quoted legacy IDs while resolving one real hidden-span identity', async () => {
    const task = makeTask();
    task.id = 'legacy-source';
    const literal = '- [ ] Read `<span style="display:none">{"id":"legacy-source","recurrence":"every week"}</span>` #TaskCard';
    const actual = '- [ ] Water the plants #TaskCard<span style="display:none">{"id":"legacy-source","recurrence":"every week"}</span> .';
    vault.__setFile(FILE_PATH, literal + '\n' + actual);
    await expect(completeRecurringTaskInFile(plugin, task, FILE_PATH, 0)).resolves.toBe(true);
    const lines = vault.__getContent(FILE_PATH).split('\n');
    expect(lines[0]).toBe(literal);
    expect(lines[1]).toBe('- [x] Water the plants #TaskCard<span style="display:none">{"id":"legacy-source","recurrence":null}</span> .');
  });

  it('completes the clicked line in place and inserts the next instance below', async () => {
    const task = makeTask();
    const line = formatter.taskToMarkdown(task);
    vault.__setFile(FILE_PATH, ['# Notes', '', line, 'tail text'].join('\n'));

    const handled = await completeRecurringTaskInFile(plugin, task, FILE_PATH, 2);
    expect(handled).toBe(true);

    const lines = vault.__getContent(FILE_PATH).split('\n');
    expect(lines).toHaveLength(5);
    // line 2: the task the user clicked, now checked, rule removed
    expect(lines[2]).toContain('- [x]');
    expect(lines[2]).toContain('2026-07-06');
    expect(lines[2]).not.toContain('every week');
    // line 3: the fresh unchecked instance with advanced dates and the rule
    expect(lines[3]).toContain('- [ ]');
    expect(lines[3]).toContain('2026-07-13');
    expect(lines[3]).toContain('every week');
    expect(lines[4]).toBe('tail text');
  });

  it('returns false (caller falls back to a plain toggle) for a non-recurring task', async () => {
    const task = makeTask();
    task.recurrence = null;
    const line = formatter.taskToMarkdown(task);
    vault.__setFile(FILE_PATH, [line].join('\n'));

    const handled = await completeRecurringTaskInFile(plugin, task, FILE_PATH, 0);
    expect(handled).toBe(false);
    // file untouched — no duplicate, no completion
    expect(vault.__getContent(FILE_PATH)).toBe(line);
  });
});

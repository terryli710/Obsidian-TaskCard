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

  it('nulls a legacy v1 hidden-span recurrence', () => {
    expect(
      stripRecurrenceFromLine(
        '- [x] Water plants #TaskCard<span style="display:none">{"id":"u-1","recurrence":"every week"}</span> .'
      )
    ).toBe(
      '- [x] Water plants #TaskCard<span style="display:none">{"id":"u-1","recurrence":null}</span> .'
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

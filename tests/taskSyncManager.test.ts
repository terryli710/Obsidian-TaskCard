import { writable } from 'svelte/store';
import { App } from 'obsidian';
import { ObsidianTaskSyncManager } from '../src/taskModule/taskSyncManager';
import { ObsidianTask } from '../src/taskModule/task';
import { TaskFormatter } from '../src/taskModule/taskFormatter';
import { TaskParser } from '../src/taskModule/taskParser';
import { ProjectModule } from '../src/taskModule/project';
import { FileOperator } from '../src/renderer/fileOperator';
import { logger } from '../src/utils/log';

/**
 * ObsidianTaskSyncManager write-back tests.
 *
 * Uses the real TaskFormatter + FileOperator on the in-memory mock Vault, and a
 * minimal plugin stub providing only the fields the sync manager touches:
 * plugin.fileOperator, plugin.taskFormatter, plugin.externalAPIManager.
 *
 * Line-span model: a task's doc span is
 *   [lineStartInSection + section.lineStart, lineEndsInSection + section.lineStart)
 * i.e. 0-based, end-exclusive; a task with an N-line description spans N+1 lines.
 */

const FILE_PATH = 'projects/tasks.md';
const SECTION_START = 2; // the task list section begins at doc line 2

const makeSettingsStore = () =>
  writable({
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

// let the unawaited promise chain inside updateTaskToFile/deleteTask settle
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('ObsidianTaskSyncManager', () => {
  let app: App;
  let vault: any;
  let plugin: any;
  let formatter: TaskFormatter;
  let alphaTask: ObsidianTask;
  let betaTask: ObsidianTask;
  let alphaLine: string; // single-line formatted task (no description)
  let betaMarkdown: string; // 3-line formatted task (2-line description)
  let fileLines: string[];
  let loggerSpies: jest.SpyInstance[];

  beforeEach(() => {
    loggerSpies = (['info', 'warn', 'error', 'debug'] as const).map((level) =>
      jest.spyOn(logger, level).mockImplementation(() => logger)
    );

    app = new App();
    vault = app.vault;
    formatter = new TaskFormatter(makeSettingsStore() as any);
    plugin = { app };
    plugin.fileOperator = new FileOperator(plugin, app);
    plugin.taskFormatter = formatter;
    plugin.externalAPIManager = {
      createTask: jest.fn(async () => undefined),
      updateTask: jest.fn(async () => ({ googleCalendarSync: { id: 'evt-1' } })),
      deleteTask: jest.fn()
    };
    plugin.storeSyncMappings = jest.fn(async () => undefined);
    plugin.removeSyncMappings = jest.fn(async () => undefined);

    alphaTask = new ObsidianTask({ id: 'task-alpha', content: 'Alpha task' });
    betaTask = new ObsidianTask({
      id: 'task-beta',
      content: 'Beta task',
      description: 'step one\nstep two'
    });
    alphaLine = formatter.taskToMarkdown(alphaTask);
    betaMarkdown = formatter.taskToMarkdown(betaTask);
    expect(alphaLine.split('\n')).toHaveLength(1);
    expect(betaMarkdown.split('\n')).toHaveLength(3);

    // doc lines: 0 '# Projects', 1 '', 2 alpha, 3-5 beta, 6 'tail text'
    fileLines = [
      '# Projects',
      '',
      alphaLine,
      ...betaMarkdown.split('\n'),
      'tail text'
    ];
    vault.__setFile(FILE_PATH, fileLines.join('\n'));
  });

  afterEach(() => {
    loggerSpies.forEach((spy) => spy.mockRestore());
  });

  function makeManager(
    task: ObsidianTask,
    lineStartInSection: number,
    lineEndsInSection: number,
    getSectionInfo?: jest.Mock
  ) {
    const sectionEl = {} as any;
    const ctx = {
      getSectionInfo:
        getSectionInfo ??
        jest.fn(() => ({ text: '', lineStart: SECTION_START, lineEnd: 6 }))
    };
    const manager = new ObsidianTaskSyncManager(plugin, {
      obsidianTask: task,
      taskMetadata: {
        sectionEl,
        ctx: ctx as any,
        sourcePath: FILE_PATH,
        mdSectionInfo: null,
        lineStartInSection,
        lineEndsInSection
      }
    });
    return { manager, ctx, sectionEl };
  }

  describe('getDocLineStartEnd (task line-span computation)', () => {
    it('offsets the in-section span by the section start line', () => {
      const { manager, ctx, sectionEl } = makeManager(alphaTask, 0, 1);
      expect(manager.getDocLineStartEnd()).toEqual([2, 3]);
      expect(ctx.getSectionInfo).toHaveBeenCalledWith(sectionEl);
      expect(manager.taskMetadata.mdSectionInfo).toEqual({
        text: '',
        lineStart: SECTION_START,
        lineEnd: 6
      });
    });

    it('spans description lines: a task with a 2-line description occupies 3 lines', () => {
      const { manager } = makeManager(betaTask, 1, 4);
      const [start, end] = manager.getDocLineStartEnd();
      expect([start, end]).toEqual([3, 6]);
      expect(end - start).toBe(3); // task line + 2 description lines
    });

    it('re-reads the section info each call, tracking a moved section (stale position)', () => {
      const getSectionInfo = jest
        .fn()
        .mockReturnValueOnce({ text: '', lineStart: 2, lineEnd: 6 })
        .mockReturnValueOnce({ text: '', lineStart: 4, lineEnd: 8 });
      const { manager } = makeManager(alphaTask, 0, 1, getSectionInfo);
      expect(manager.getDocLineStartEnd()).toEqual([2, 3]);
      // section shifted down by 2 lines (e.g. lines inserted above it)
      expect(manager.getDocLineStartEnd()).toEqual([4, 5]);
      expect(getSectionInfo).toHaveBeenCalledTimes(2);
    });

    it('returns null when the section is gone (getSectionInfo returns null)', () => {
      // ctx.getSectionInfo legitimately returns null once the section element
      // is detached from the rendered document (an edit racing a re-render);
      // the caller falls back to locating the task by its hidden-span id.
      const { manager } = makeManager(alphaTask, 0, 1, jest.fn(() => null));
      expect(manager.getDocLineStartEnd()).toBeNull();
    });
  });

  describe('resolveDocLineStartEnd (write-time span verification)', () => {
    it('keeps the cached span while the task id is still on its start line', async () => {
      const { manager } = makeManager(alphaTask, 0, 1);
      await expect(manager.resolveDocLineStartEnd()).resolves.toEqual([2, 3]);
    });

    it('relocates the span when lines were inserted above the task', async () => {
      // two lines inserted above the section shift alpha from line 2 to 4,
      // but the cached section info still claims lineStart 2
      vault.__setFile(
        FILE_PATH,
        ['# Projects', 'new line', 'another', '', alphaLine, 'tail text'].join('\n')
      );
      const { manager } = makeManager(alphaTask, 0, 1);
      await expect(manager.resolveDocLineStartEnd()).resolves.toEqual([4, 5]);
    });

    it('locates a multi-line task by id when the section info is gone', async () => {
      const { manager } = makeManager(betaTask, 1, 4, jest.fn(() => null));
      // beta occupies lines 3-5 (task line + 2 indented description lines);
      // the unindented 'tail text' line below is not part of the span
      await expect(manager.resolveDocLineStartEnd()).resolves.toEqual([3, 6]);
    });

    it('returns null when the task cannot be found and no section info exists', async () => {
      const ghost = new ObsidianTask({ id: 'task-ghost', content: 'Ghost' });
      const { manager } = makeManager(ghost, 0, 1, jest.fn(() => null));
      await expect(manager.resolveDocLineStartEnd()).resolves.toBeNull();
    });
  });

  describe('stale-position write-back protection', () => {
    it('writes to the relocated line, not the stale cached one', async () => {
      vault.__setFile(
        FILE_PATH,
        ['# Projects', 'new line', 'another', '', alphaLine, 'tail text'].join('\n')
      );
      const { manager } = makeManager(alphaTask, 0, 1);
      await manager.updateMarkdownTaskToFile('- [x] moved #TaskCard');
      const newLines = vault.__getContent(FILE_PATH).split('\n');
      expect(newLines).toEqual([
        '# Projects',
        'new line',
        'another',
        '',
        '- [x] moved #TaskCard',
        'tail text'
      ]);
    });

    it('skips the write entirely when the task is gone from the file', async () => {
      const ghost = new ObsidianTask({ id: 'task-ghost', content: 'Ghost' });
      const { manager } = makeManager(ghost, 0, 1, jest.fn(() => null));
      const before = vault.__getContent(FILE_PATH);
      await manager.updateMarkdownTaskToFile('- [x] ghost #TaskCard');
      expect(vault.__getContent(FILE_PATH)).toBe(before);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('deleteTask skips the splice when the task cannot be located', async () => {
      const ghost = new ObsidianTask({ id: 'task-ghost', content: 'Ghost' });
      const { manager } = makeManager(ghost, 0, 1, jest.fn(() => null));
      const before = vault.__getContent(FILE_PATH);
      await manager.deleteTask();
      expect(vault.__getContent(FILE_PATH)).toBe(before);
      expect(plugin.externalAPIManager.deleteTask).not.toHaveBeenCalled();
    });
  });

  describe('getMarkdownTaskFromFile', () => {
    it('returns exactly the task line for a task without description', async () => {
      const { manager } = makeManager(alphaTask, 0, 1);
      await expect(manager.getMarkdownTaskFromFile()).resolves.toBe(alphaLine);
    });

    it('returns the task line plus indented description lines for a multi-line task', async () => {
      const { manager } = makeManager(betaTask, 1, 4);
      await expect(manager.getMarkdownTaskFromFile()).resolves.toBe(
        betaMarkdown
      );
    });
  });

  describe('updateMarkdownTaskToFile', () => {
    it('patches only the task span, leaving the rest of the file untouched', async () => {
      const { manager } = makeManager(alphaTask, 0, 1);
      await manager.updateMarkdownTaskToFile('- [x] replaced #TaskCard');
      const newLines = vault.__getContent(FILE_PATH).split('\n');
      expect(newLines[2]).toBe('- [x] replaced #TaskCard');
      expect(newLines.slice(0, 2)).toEqual(fileLines.slice(0, 2));
      expect(newLines.slice(3)).toEqual(fileLines.slice(3));
    });

    it('can shrink a multi-line span to a single line', async () => {
      const { manager } = makeManager(betaTask, 1, 4);
      await manager.updateMarkdownTaskToFile('- [ ] shrunk #TaskCard');
      const newLines = vault.__getContent(FILE_PATH).split('\n');
      expect(newLines).toEqual([
        ...fileLines.slice(0, 3),
        '- [ ] shrunk #TaskCard',
        ...fileLines.slice(6)
      ]);
    });
  });

  describe('updateTaskToFile', () => {
    it('writes the formatted current task over its span', async () => {
      const { manager } = makeManager(alphaTask, 0, 1);
      manager.obsidianTask.content = 'Alpha task edited';
      manager.updateTaskToFile();
      await flush();
      const newLines = vault.__getContent(FILE_PATH).split('\n');
      expect(newLines[2]).toBe(formatter.taskToMarkdown(manager.obsidianTask));
      expect(newLines[2]).toContain('Alpha task edited');
      expect(newLines[2]).not.toContain('<span');
      expect(newLines[2]).toMatch(/ \^tc-[a-z0-9]{6}$/);
      expect(newLines.slice(0, 2)).toEqual(fileLines.slice(0, 2));
      expect(newLines.slice(3)).toEqual(fileLines.slice(3));
    });

    it('grows a single-line task into task + indented description lines', async () => {
      const { manager } = makeManager(alphaTask, 0, 1);
      manager.obsidianTask.description = 'first detail\nsecond detail';
      manager.updateTaskToFile();
      await flush();
      const newLines = vault.__getContent(FILE_PATH).split('\n');
      expect(newLines).toHaveLength(fileLines.length + 2);
      expect(newLines[3]).toBe('    first detail');
      expect(newLines[4]).toBe('    second detail');
      // neighbors preserved around the grown span
      expect(newLines.slice(0, 2)).toEqual(fileLines.slice(0, 2));
      expect(newLines.slice(5)).toEqual(fileLines.slice(3));
    });
  });

  describe('updateObsidianTaskAttribute', () => {
    it('mutates the task, notifies the external API, stores syncMappings, and rewrites the file', async () => {
      const { manager } = makeManager(alphaTask, 0, 1);
      await manager.updateObsidianTaskAttribute('content', 'Renamed task');
      await flush();

      expect(manager.obsidianTask.content).toBe('Renamed task');
      expect(plugin.externalAPIManager.updateTask).toHaveBeenCalledTimes(1);
      const [newTask, origTask] =
        plugin.externalAPIManager.updateTask.mock.calls[0];
      expect(newTask.content).toBe('Renamed task');
      expect(origTask.content).toBe('Alpha task');
      expect(manager.obsidianTask.metadata.syncMappings).toEqual({
        googleCalendarSync: { id: 'evt-1' }
      });

      const newLines = vault.__getContent(FILE_PATH).split('\n');
      expect(newLines[2]).toContain('Renamed task');
      // v2: sync mappings never touch the note — they go to the data store
      expect(newLines[2]).not.toContain('syncMappings');
      expect(plugin.storeSyncMappings).toHaveBeenCalledWith(
        manager.obsidianTask.id,
        { googleCalendarSync: { id: 'evt-1' } }
      );
      expect(newLines.slice(3)).toEqual(fileLines.slice(3));
    });
  });

  describe('display params (v2: ephemeral, never written to the note)', () => {
    it('updateObsidianTaskDisplayParams updates memory without touching the file', async () => {
      const { manager } = makeManager(alphaTask, 0, 1);
      const before = vault.__getContent(FILE_PATH);
      manager.updateObsidianTaskDisplayParams('mode', 'multi-line');
      await flush();
      expect(manager.obsidianTask.metadata.taskDisplayParams).toEqual({
        mode: 'multi-line'
      });
      expect(vault.__getContent(FILE_PATH)).toBe(before);
    });

    it('clearObsidianTaskDisplayParams clears memory without touching the file', async () => {
      alphaTask.metadata.taskDisplayParams = { mode: 'multi-line' };
      const { manager } = makeManager(alphaTask, 0, 1);
      const before = vault.__getContent(FILE_PATH);
      manager.clearObsidianTaskDisplayParams();
      await flush();
      expect(manager.obsidianTask.metadata.taskDisplayParams).toBeNull();
      expect(vault.__getContent(FILE_PATH)).toBe(before);
    });
  });

  describe('deleteTask', () => {
    it('blanks the task span (leaving one empty line) and notifies the external API', async () => {
      const { manager } = makeManager(betaTask, 1, 4);
      await manager.deleteTask();
      await flush();
      const newLines = vault.__getContent(FILE_PATH).split('\n');
      // Documents current behavior: the 3-line span is replaced by '' — an
      // empty line remains where the task was, rather than the lines being
      // removed outright.
      expect(newLines).toEqual([...fileLines.slice(0, 3), '', ...fileLines.slice(6)]);
      expect(plugin.externalAPIManager.deleteTask).toHaveBeenCalledWith(
        manager.obsidianTask
      );
    });
  });

  describe('task card status', () => {
    it('sets and gets a valid status', () => {
      const { manager } = makeManager(alphaTask, 0, 1);
      manager.setTaskCardStatus('descriptionStatus', 'editing');
      expect(manager.getTaskCardStatus('descriptionStatus')).toBe('editing');
    });

    it('ignores an invalid status value', () => {
      const { manager } = makeManager(alphaTask, 0, 1);
      manager.setTaskCardStatus('projectStatus', 'bogus');
      expect(manager.getTaskCardStatus('projectStatus')).toBe('done');
    });

    it('isValidStatus distinguishes allowed values per key', () => {
      const { manager } = makeManager(alphaTask, 0, 1);
      expect(manager.isValidStatus('projectStatus', 'selecting')).toBe(true);
      expect(manager.isValidStatus('projectStatus', 'editing')).toBe(false);
      expect(manager.isValidStatus('dueStatus', 'editing')).toBe(true);
    });
  });

  describe('recurring task completion', () => {
    // Regression guard for the "click complete duplicates my task" report:
    // the clicked line must complete IN PLACE; the next instance goes on the
    // line BELOW. Writing the fresh unchecked instance onto the clicked line
    // read as "completion didn't take, and a duplicate appeared below".
    const makeRecurring = () =>
      new ObsidianTask({
        content: 'Recurring task',
        recurrence: 'every week',
        schedule: { isRecurring: false, date: '2026-07-06', string: '2026-07-06' }
      });

    const seedFile = (task: ObsidianTask) => {
      const line = formatter.taskToMarkdown(task);
      expect(line.split('\n')).toHaveLength(1);
      vault.__setFile(
        FILE_PATH,
        ['# Projects', '', line, 'tail text'].join('\n')
      );
    };

    const fileLinesNow = async () =>
      (await plugin.fileOperator.getFileContent(FILE_PATH)).split('\n');

    it('completes the clicked line in place and inserts the next instance below it', async () => {
      const recurringTask = makeRecurring();
      seedFile(recurringTask);
      const { manager } = makeManager(recurringTask, 0, 1);

      await manager.updateObsidianTaskAttribute('completed', true);
      await flush();

      const lines = await fileLinesNow();
      // line 2 (where the user clicked): the completed original, checked
      expect(lines[2]).toContain('- [x]');
      expect(lines[2]).toContain('Recurring task');
      expect(lines[2]).toContain('2026-07-06');
      // line 3: the fresh instance, unchecked, dates advanced, rule attached
      expect(lines[3]).toContain('- [ ]');
      expect(lines[3]).toContain('Recurring task');
      expect(lines[3]).toContain('2026-07-13');
      expect(lines[3]).toContain('every week');
      // neighbors untouched
      expect(lines[4]).toBe('tail text');
      // completion is still reported to external providers
      expect(plugin.externalAPIManager.updateTask).toHaveBeenCalled();
    });

    it('moves the recurrence rule to the new instance so the done copy cannot spawn again', async () => {
      const recurringTask = makeRecurring();
      seedFile(recurringTask);
      const { manager } = makeManager(recurringTask, 0, 1);

      await manager.updateObsidianTaskAttribute('completed', true);
      await flush();

      const lines = await fileLinesNow();
      // the completed copy has no recurrence any more; only the new instance does
      expect(lines[2]).not.toContain('every week');
      expect(lines[3]).toContain('every week');
      expect(manager.obsidianTask.hasRecurrence()).toBe(false);
    });

    it('unchecking and re-checking the completed copy does not spawn another instance', async () => {
      const recurringTask = makeRecurring();
      seedFile(recurringTask);
      const { manager } = makeManager(recurringTask, 0, 1);

      await manager.updateObsidianTaskAttribute('completed', true);
      await flush();
      const linesAfterComplete = await fileLinesNow();
      expect(linesAfterComplete).toHaveLength(5); // header, blank, done, next, tail

      // mis-click undo: uncheck the (in-place) completed copy, then re-check it
      await manager.updateObsidianTaskAttribute('completed', false);
      await flush();
      await manager.updateObsidianTaskAttribute('completed', true);
      await flush();

      const lines = await fileLinesNow();
      expect(lines).toHaveLength(5); // no growth
      expect(lines[2]).toContain('- [x]');
      // still exactly one instance carrying the rule
      expect(lines.filter((l) => l.includes('every week'))).toHaveLength(1);
      expect(lines[4]).toBe('tail text');
    });

    it('un-completing a recurring task stays a plain single-line update', async () => {
      const recurringTask = makeRecurring();
      recurringTask.completed = true;
      seedFile(recurringTask);
      const { manager } = makeManager(recurringTask, 0, 1);

      await manager.updateObsidianTaskAttribute('completed', false);
      await flush();

      const lines = await fileLinesNow();
      expect(lines).toHaveLength(4); // no lines added or removed
      expect(lines[2]).toContain('- [ ]');
      expect(lines[2]).toContain('every week'); // rule kept on a plain uncheck
      expect(lines[3]).toBe('tail text');
    });
  });

  describe('completion never duplicates a plain task', () => {
    // Direct regression tests for the reported bug: completing a task must
    // replace its line, never insert one.
    it('completing a non-recurring task rewrites its line in place', async () => {
      const { manager } = makeManager(alphaTask, 0, 1);
      const before = (await plugin.fileOperator.getFileContent(FILE_PATH)).split('\n');

      await manager.updateObsidianTaskAttribute('completed', true);
      await flush();

      const lines = (await plugin.fileOperator.getFileContent(FILE_PATH)).split('\n');
      expect(lines).toHaveLength(before.length); // no inserted line
      expect(lines[2]).toContain('- [x]');
      expect(lines[2]).toContain('Alpha task');
      // exactly one occurrence of the task in the whole file
      expect(lines.filter((l) => l.includes('Alpha task'))).toHaveLength(1);
      expect(lines.slice(3)).toEqual(before.slice(3));
    });

    it('two rapid completion clicks do not duplicate the task', async () => {
      const { manager } = makeManager(alphaTask, 0, 1);
      const before = (await plugin.fileOperator.getFileContent(FILE_PATH)).split('\n');

      // fire both updates without waiting in between (double-click race)
      await Promise.all([
        manager.updateObsidianTaskAttribute('completed', true),
        manager.updateObsidianTaskAttribute('completed', true)
      ]);
      await flush();

      const lines = (await plugin.fileOperator.getFileContent(FILE_PATH)).split('\n');
      expect(lines).toHaveLength(before.length);
      expect(lines.filter((l) => l.includes('Alpha task'))).toHaveLength(1);
      expect(lines[2]).toContain('- [x]');
    });

    it('completing a multi-line task keeps its description without duplicating it', async () => {
      const { manager } = makeManager(betaTask, 1, 4);
      const before = (await plugin.fileOperator.getFileContent(FILE_PATH)).split('\n');

      await manager.updateObsidianTaskAttribute('completed', true);
      await flush();

      const lines = (await plugin.fileOperator.getFileContent(FILE_PATH)).split('\n');
      expect(lines).toHaveLength(before.length);
      expect(lines[3]).toContain('- [x]');
      expect(lines.filter((l) => l.includes('step one'))).toHaveLength(1);
      expect(lines.filter((l) => l.includes('step two'))).toHaveLength(1);
      expect(lines[6]).toBe('tail text');
    });
  });
});

describe('TaskParser.determineDescriptionLineNumber (description line-span counting)', () => {
  let parser: TaskParser;

  beforeEach(() => {
    parser = new TaskParser(makeSettingsStore() as any, new ProjectModule());
  });

  it('returns 0 when the first line is not a task', () => {
    expect(
      parser.determineDescriptionLineNumber(['just some text', '    indented'])
    ).toBe(0);
  });

  it('returns 0 for a task with no following lines', () => {
    expect(parser.determineDescriptionLineNumber(['- [ ] lone task'])).toBe(0);
  });

  it('counts indented description lines under the task', () => {
    expect(
      parser.determineDescriptionLineNumber([
        '- [ ] task line',
        '    first description line',
        '    second description line'
      ])
    ).toBe(2);
  });

  it('counts even deeper-indented continuation lines', () => {
    expect(
      parser.determineDescriptionLineNumber([
        '- [ ] task line',
        '    - bullet',
        '        - nested bullet'
      ])
    ).toBe(2);
  });

  it('stops at a blank line', () => {
    expect(
      parser.determineDescriptionLineNumber([
        '- [ ] task line',
        '    description',
        '',
        '    after the gap'
      ])
    ).toBe(1);
  });

  it('stops at a following task with the same indentation', () => {
    expect(
      parser.determineDescriptionLineNumber([
        '- [ ] task line',
        '    description',
        '- [ ] next task'
      ])
    ).toBe(1);
  });

  it('counts a deeper-indented task (subtask) as description', () => {
    expect(
      parser.determineDescriptionLineNumber([
        '- [ ] task line',
        '    - [ ] deeper subtask'
      ])
    ).toBe(1);
  });

  it('counts non-indented plain text as description (documented rule 5b)', () => {
    // Only blank lines and same-or-less-indented *tasks* terminate the
    // description; a plain unindented paragraph right under the task is
    // counted as description.
    expect(
      parser.determineDescriptionLineNumber([
        '- [ ] task line',
        'plain unindented text'
      ])
    ).toBe(1);
  });
});

describe('TaskParser.parseAnyTaskFromFileLines', () => {
  it('parses the task plus only its own description lines from a lines window', () => {
    const settingsStore = makeSettingsStore();
    const parser = new TaskParser(settingsStore as any, new ProjectModule());
    const formatter = new TaskFormatter(settingsStore as any);
    const beta = new ObsidianTask({
      id: 'tc-beta01',
      content: 'Beta task',
      description: 'step one\nstep two'
    });
    const alpha = new ObsidianTask({ id: 'tc-alpha1', content: 'Alpha task' });
    const lines = [
      ...formatter.taskToMarkdown(beta).split('\n'),
      formatter.taskToMarkdown(alpha)
    ];

    const parsed = parser.parseAnyTaskFromFileLines(lines);
    expect(parsed.content).toBe('Beta task');
    expect(parsed.description).toBe('step one\nstep two');
    expect(parsed.id).toBe('tc-beta01');
    // the indicator tag is stripped from labels
    expect(parsed.labels).toEqual([]);
  });
});

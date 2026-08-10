import { writable } from 'svelte/store';
import { App, Notice, TFile } from 'obsidian';
import { TaskMonitor } from '../src/taskModule/taskMonitor';
import { TaskParser } from '../src/taskModule/taskParser';
import { TaskFormatter } from '../src/taskModule/taskFormatter';
import { TaskValidator } from '../src/taskModule/taskValidator';
import { ObsidianTask } from '../src/taskModule/task';
import { ProjectModule } from '../src/taskModule/project';
import { FileOperator } from '../src/renderer/fileOperator';
import { logger } from '../src/utils/log';

/**
 * TaskMonitor tests: the line-transforming helpers plus the file-level
 * monitors, driven through the mock Vault with real parser / formatter /
 * validator instances and a minimal plugin stub.
 *
 * Not covered: layoutChangeHandler (needs a real MarkdownView with getMode()
 * and a live workspace).
 */

const FILE_PATH = 'notes/monitor.md';
const DEFAULT_PROJECT = { id: 'proj-default', name: 'Default Project' };

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
    },
    userMetadata: { defaultProject: DEFAULT_PROJECT }
  });

// let fire-and-forget promise chains (vault reads/writes) settle
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('TaskMonitor', () => {
  let app: App;
  let vault: any;
  let plugin: any;
  let monitor: TaskMonitor;
  let formatter: TaskFormatter;
  let loggerSpies: jest.SpyInstance[];

  const formattedLine = (props: Partial<ObsidianTask>): string =>
    formatter.taskToMarkdown(new ObsidianTask(props)).split('\n')[0];

  beforeEach(() => {
    loggerSpies = (['info', 'warn', 'error', 'debug'] as const).map((level) =>
      jest.spyOn(logger, level).mockImplementation(() => logger)
    );
    (Notice as any).__notices = [];

    const settingsStore = makeSettingsStore();
    app = new App();
    vault = app.vault;
    plugin = { app };
    plugin.fileOperator = new FileOperator(plugin, app);
    plugin.taskParser = new TaskParser(settingsStore as any, new ProjectModule());
    plugin.taskFormatter = new TaskFormatter(settingsStore as any);
    plugin.taskValidator = new TaskValidator(settingsStore as any);
    plugin.externalAPIManager = {
      createTask: jest.fn(async () => undefined),
      updateTask: jest.fn(),
      deleteTask: jest.fn()
    };
    plugin.storeSyncMappings = jest.fn(async () => undefined);
    formatter = plugin.taskFormatter;
    monitor = new TaskMonitor(plugin, app, settingsStore as any);
  });

  afterEach(() => {
    loggerSpies.forEach((spy) => spy.mockRestore());
  });

  describe('countDescriptionLines', () => {
    it('counts deeper-indented bullet lines as description', () => {
      expect(
        monitor.countDescriptionLines('- [ ] task #TaskCard', [
          '    - detail one',
          '    - detail two',
          'unrelated line'
        ])
      ).toBe(2);
    });

    it('does NOT count deeper-indented plain text (bullet/numbered/task syntax required)', () => {
      // Contrast with TaskParser.determineDescriptionLineNumber, which counts
      // any non-blank non-task line: here a line must start with '- ',
      // '- [ ] ', or 'N. ' to be treated as description.
      expect(
        monitor.countDescriptionLines('- [ ] task #TaskCard', [
          '    plain indented text'
        ])
      ).toBe(0);
    });

    it('stops at a blank line', () => {
      expect(
        monitor.countDescriptionLines('- [ ] task #TaskCard', [
          '    - detail one',
          '',
          '    - after gap'
        ])
      ).toBe(1);
    });

    it('does not count a same-indentation bullet', () => {
      expect(
        monitor.countDescriptionLines('- [ ] task #TaskCard', ['- sibling'])
      ).toBe(0);
    });
  });

  describe('detectTasksFromLines', () => {
    it('detects an unformatted task with its description span', () => {
      const lines = [
        '# Heading',
        '- [ ] water plants #TaskCard',
        '    - use the green can',
        '    - back porch too',
        'trailing text'
      ];
      const details = monitor.detectTasksFromLines(lines);
      expect(details).toHaveLength(1);
      expect(details[0]).toEqual({
        taskMarkdown:
          '- [ ] water plants #TaskCard\n    - use the green can\n    - back porch too',
        startLine: 1,
        endLine: 4
      });
    });

    it('ignores registered v2 tasks and plain lines', () => {
      const lines = [
        formattedLine({ id: 'tc-done01', content: 'Already formatted' }),
        'plain text',
        '- [ ] no indicator tag here'
      ];
      expect(monitor.detectTasksFromLines(lines)).toHaveLength(0);
    });

    it('detects legacy v1 lines even when they carry a block id', () => {
      const legacy =
        '- [ ] old #TaskCard<span style="display:none">{"id":"x"}</span> . ^tc-abc123';
      expect(monitor.detectTasksFromLines([legacy])).toHaveLength(1);
    });

    it('detects multiple tasks with independent spans', () => {
      const lines = [
        '- [ ] first #TaskCard',
        '- [ ] second #TaskCard',
        '    - second desc',
        'text'
      ];
      const details = monitor.detectTasksFromLines(lines);
      expect(details).toHaveLength(2);
      expect(details[0]).toMatchObject({ startLine: 0, endLine: 1 });
      expect(details[1]).toMatchObject({ startLine: 1, endLine: 3 });
    });
  });

  describe('parseTaskWithLines', () => {
    it('parses a valid unformatted task and applies the default project', () => {
      const task = monitor.parseTaskWithLines([
        '- [ ] water plants #gardening #TaskCard'
      ]);
      expect(task).not.toBeNull();
      expect(task.content).toBe('water plants');
      expect(task.labels).toEqual(['#gardening']);
      // task had no project, so the settings-store default is injected
      expect(task.project).toEqual(DEFAULT_PROJECT);
    });

    it('returns null and raises a Notice for an invalid line', () => {
      const task = monitor.parseTaskWithLines(['not a task at all']);
      expect(task).toBeNull();
      expect((Notice as any).__notices.length).toBeGreaterThan(0);
      expect(String((Notice as any).__notices[0])).toContain(
        'Failed to parse task'
      );
    });
  });

  describe('formatTaskWithLines', () => {
    it('formats a valid task into v2 markdown lines', () => {
      const lines = monitor.formatTaskWithLines([
        '- [ ] water plants #TaskCard',
        '    - use the green can'
      ]);
      expect(lines[0]).toContain('- [ ] water plants #TaskCard');
      expect(lines[0]).not.toContain('<span');
      expect(lines[0]).toMatch(/ \^tc-[a-z0-9]{6}$/);
      expect(lines[1]).toBe('    - use the green can');
    });

    it("returns [''] for an unparseable task", () => {
      expect(monitor.formatTaskWithLines(['garbage'])).toEqual(['']);
    });
  });

  describe('changeIndicatorTagForLine', () => {
    it('replaces the indicator tag on a formatted task line', () => {
      const line = formattedLine({ id: 'tag-task', content: 'Retag me' });
      const updated = monitor.changeIndicatorTagForLine(
        line,
        'NewTag',
        'TaskCard'
      );
      expect(updated).toContain('#NewTag');
      expect(updated).not.toContain('#TaskCard');
    });

    it('renames the tag on plain (v2) task lines too', () => {
      const line = '- [ ] unformatted #TaskCard';
      expect(monitor.changeIndicatorTagForLine(line, 'NewTag', 'TaskCard')).toBe(
        '- [ ] unformatted #NewTag'
      );
    });

    it('replaces only the tag token, leaving content that mentions the tag text intact', () => {
      // content "Discuss TaskCard redesign" tagged #TaskCard, renaming
      // TaskCard -> NewTag: the #TaskCard token becomes #NewTag while the
      // plain word "TaskCard" in the content is untouched.
      const line = formattedLine({
        id: 'tricky-task',
        content: 'Discuss TaskCard redesign'
      });
      const updated = monitor.changeIndicatorTagForLine(
        line,
        'NewTag',
        'TaskCard'
      );
      expect(updated).toContain('Discuss TaskCard redesign');
      expect(updated).toContain('#NewTag');
      expect(updated).not.toContain('#TaskCard');
    });

    it('does not rename a longer tag that merely starts with the old tag', () => {
      const line = '- [ ] other #TaskCardX task #TaskCard <span style="display:none">{"id":"x"}</span>';
      const updated = monitor.changeIndicatorTagForLine(
        line,
        'NewTag',
        'TaskCard'
      );
      expect(updated).toContain('#TaskCardX');
      expect(updated).toContain('#NewTag');
    });
  });

  describe('changeProjectForLine', () => {
    const oldProject = { id: 'proj-1', name: 'Old Project' };
    const newProject = { id: 'proj-2', name: 'New Project' };

    it('swaps the project when the ids match', () => {
      const line = formattedLine({
        id: 'tc-proj01',
        content: 'Move me',
        project: oldProject
      });
      const updated = monitor.changeProjectForLine(line, newProject, oldProject);
      expect(updated).toContain('[project:: New Project]');
      expect(updated).not.toContain('Old Project');
      expect(updated).toContain('Move me');
    });

    it('leaves tasks of other projects untouched', () => {
      const line = formattedLine({
        id: 'tc-other1',
        content: 'Stay put',
        project: { id: 'proj-3', name: 'Third Project' }
      });
      expect(monitor.changeProjectForLine(line, newProject, oldProject)).toBe(
        line
      );
    });

    it('leaves non-task lines untouched', () => {
      expect(monitor.changeProjectForLine('plain', newProject, oldProject)).toBe(
        'plain'
      );
    });
  });

  describe('monitorFileToFormatTasks', () => {
    it('formats an unformatted task in place, preserving surroundings and description', async () => {
      const file: TFile = vault.__setFile(
        FILE_PATH,
        [
          '# Garden notes',
          '- [ ] water plants #TaskCard',
          '    - use the green can',
          'closing line'
        ].join('\n')
      );

      await monitor.monitorFileToFormatTasks(file);

      const lines = vault.__getContent(FILE_PATH).split('\n');
      expect(lines).toHaveLength(4); // same line count: formatted in place
      expect(lines[0]).toBe('# Garden notes');
      expect(lines[1]).toContain('- [ ] water plants #TaskCard');
      expect(lines[1]).not.toContain('<span');
      expect(lines[1]).toMatch(/ \^tc-[a-z0-9]{6}$/);
      // default project injected during formatting
      expect(lines[1]).toContain('[project:: Default Project]');
      expect(lines[2]).toBe('    - use the green can');
      expect(lines[3]).toBe('closing line');

      expect(plugin.externalAPIManager.createTask).toHaveBeenCalledTimes(1);
      const created = plugin.externalAPIManager.createTask.mock.calls[0][0];
      expect(created.content).toBe('water plants');
    });

    it('formats multiple tasks in one pass', async () => {
      const file: TFile = vault.__setFile(
        FILE_PATH,
        [
          '- [ ] first #TaskCard',
          'between',
          '- [ ] second #TaskCard',
          '    - second desc'
        ].join('\n')
      );

      await monitor.monitorFileToFormatTasks(file);

      const lines = vault.__getContent(FILE_PATH).split('\n');
      expect(lines).toHaveLength(4);
      expect(lines[0]).toContain('- [ ] first #TaskCard');
      expect(lines[0]).toMatch(/ \^tc-[a-z0-9]{6}$/);
      expect(lines[1]).toBe('between');
      expect(lines[2]).toContain('- [ ] second #TaskCard');
      expect(lines[2]).toMatch(/ \^tc-[a-z0-9]{6}$/);
      expect(lines[3]).toBe('    - second desc');
      expect(plugin.externalAPIManager.createTask).toHaveBeenCalledTimes(2);
    });

    it('leaves a file without unregistered tasks untouched', async () => {
      const content = ['# Nothing here', 'plain line'].join('\n');
      const file: TFile = vault.__setFile(FILE_PATH, content);
      await monitor.monitorFileToFormatTasks(file);
      expect(vault.__getContent(FILE_PATH)).toBe(content);
      expect(plugin.externalAPIManager.createTask).not.toHaveBeenCalled();
    });

    it('converts a legacy v1 span line to v2 without re-creating it externally', async () => {
      const legacy =
        '- [ ] Old task #TaskCard<span style="display:none">{"id":"legacy-1","priority":2,"order":0,"project":{"id":"proj-1","name":"Old Project"},"sectionID":"","schedule":null,"due":null,"duration":null,"recurrence":null,"metadata":{"syncMappings":{"googleSyncSetting":{"id":"evt-9"}}}}</span> .';
      const file: TFile = vault.__setFile(FILE_PATH, legacy);

      await monitor.monitorFileToFormatTasks(file);

      const line = vault.__getContent(FILE_PATH);
      expect(line).not.toContain('<span');
      expect(line).toContain('[priority:: high]');
      expect(line).toMatch(/ \^tc-[a-z0-9]{6}$/);
      // already-registered task: no duplicate external creation
      expect(plugin.externalAPIManager.createTask).not.toHaveBeenCalled();
      // its sync mappings move to the plugin data store under the new id
      expect(plugin.storeSyncMappings).toHaveBeenCalledWith(
        expect.stringMatching(/^tc-/),
        { googleSyncSetting: { id: 'evt-9' } }
      );
    });

    it('only appends a block id to a Tasks-emoji dialect line', async () => {
      const emojiLine = '- [ ] Pay rent #TaskCard \u23eb \ud83d\udcc5 2026-08-01';
      const file: TFile = vault.__setFile(FILE_PATH, emojiLine);

      await monitor.monitorFileToFormatTasks(file);

      const line = vault.__getContent(FILE_PATH);
      expect(line).toMatch(/ \^tc-[a-z0-9]{6}$/);
      // the dialect is preserved: no field rewrite happened
      expect(line).toContain('\u23eb');
      expect(line).toContain('\ud83d\udcc5 2026-08-01');
      expect(line).not.toContain('[due::');
      // but the task is registered externally
      expect(plugin.externalAPIManager.createTask).toHaveBeenCalledTimes(1);
    });
  });

  describe('monitorVaultToChangeIndicatorTags', () => {
    it('renames the indicator tag in every markdown file of the vault', async () => {
      const lineA = formattedLine({ id: 'a', content: 'Task A' });
      const lineB = formattedLine({ id: 'b', content: 'Task B' });
      vault.__setFile('a.md', lineA);
      vault.__setFile('b.md', ['intro', lineB].join('\n'));

      await monitor.monitorVaultToChangeIndicatorTags(
        vault,
        'NewTag',
        'TaskCard'
      );
      await flush(); // per-file updates are fire-and-forget inside the loop

      expect(vault.__getContent('a.md')).toContain('#NewTag');
      expect(vault.__getContent('a.md')).not.toContain('#TaskCard');
      const bLines = vault.__getContent('b.md').split('\n');
      expect(bLines[0]).toBe('intro');
      expect(bLines[1]).toContain('#NewTag');
    });
  });
});

import { writable } from 'svelte/store';
import { ObsidianTask } from '../src/taskModule/task';
import { TaskParser } from '../src/taskModule/taskParser';
import { TaskFormatter } from '../src/taskModule/taskFormatter';
import { Project, ProjectModule } from '../src/taskModule/project';
import { logger } from '../src/utils/log';

/**
 * Round-trip invariant (v2 field format): for a task written by
 * TaskFormatter, TaskParser.parseAnyTaskMarkdown must reproduce the semantic
 * fields. v2 normalizes on write: date strings become the canonical
 * `YYYY-MM-DD[THH:mm]` value, machine bookkeeping (order, sectionID,
 * metadata) is never persisted, and ids are always `tc-` block ids.
 */
describe('parser/formatter round trip', () => {
  let warnSpy, errorSpy, debugSpy, infoSpy;
  let mockSettingStore;
  let mockProjectModule: ProjectModule;
  let taskParser: TaskParser;
  let taskFormatter: TaskFormatter;

  beforeAll(() => {
    // pin "now" so sugar-based natural language dates are deterministic
    jest.useFakeTimers().setSystemTime(new Date('2026-07-06T10:00:00'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    debugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {});
    infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});

    mockSettingStore = writable({
      parsingSettings: {
        indicatorTag: 'TaskCard',
        markdownStartingNotation: '%%*',
        markdownEndingNotation: '*%%',
        markdownSuffix: ' .',
        writeCompletionDate: true
      },
      displaySettings: {
        defaultMode: 'single-line',
        upcomingMinutes: 15,
        queryDisplayMode: 'line',
        styleMetadataInLivePreview: true
      }
    });

    const projects: Project[] = [
      { id: 'project-123', name: 'Project Name', color: '#f1f1f1' },
      { id: 'project-456', name: 'ProjectX', color: '#f45fe3' }
    ];
    mockProjectModule = new ProjectModule();
    mockProjectModule.updateProjects(projects);

    taskParser = new TaskParser(mockSettingStore, mockProjectModule);
    taskFormatter = new TaskFormatter(mockSettingStore);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    debugSpy.mockRestore();
    infoSpy.mockRestore();
  });

  const roundTrip = (task: ObsidianTask): ObsidianTask =>
    taskParser.parseAnyTaskMarkdown(taskFormatter.taskToMarkdown(task));

  const normalizeDate = (sd) =>
    sd ? { date: sd.date, time: sd.time ?? null } : null;
  const normalizeDuration = (d) =>
    d && (d.hours > 0 || d.minutes > 0) ? d : null;

  // the semantic surface both sides must agree on (v2: normalized values;
  // order/sectionID/metadata are machine state and never round-trip)
  const semanticFields = (task: ObsidianTask) => ({
    content: task.content,
    completed: task.completed,
    priority: task.priority,
    description: task.description,
    projectName: task.project?.name ?? '',
    labels: task.labels,
    schedule: normalizeDate(task.schedule),
    due: normalizeDate(task.due),
    duration: normalizeDuration(task.duration),
    recurrence: task.recurrence
  });

  const expectRoundTrip = (task: ObsidianTask) => {
    expect(semanticFields(roundTrip(task))).toEqual(semanticFields(task));
  };

  describe('content variations', () => {
    it('should round-trip a minimal task', () => {
      expectRoundTrip(new ObsidianTask({ content: 'A simple task' }));
    });

    it('should round-trip a completed task', () => {
      expectRoundTrip(
        new ObsidianTask({ content: 'Done deal', completed: true })
      );
    });

    it('should round-trip quotes and braces in content', () => {
      expectRoundTrip(
        new ObsidianTask({
          content: `Say "hello" and 'goodbye' to {braces} & <angles>`
        })
      );
    });

    it('should round-trip a numeric hash in content (not a valid tag)', () => {
      // '#123' cannot start a tag, so it survives inside the content
      expectRoundTrip(new ObsidianTask({ content: 'Fix #123 before Friday' }));
    });

    it('should move a word-like hashtag from content into labels (current behavior)', () => {
      // BUG: round-trip break. TaskFormatter writes the raw content
      // ("Deploy #backend service"), and on re-parse TaskParser's
      // extractTags() lifts any valid tag out of the content line.
      // Expected: content unchanged, labels []. Actual:
      // content 'Deploy service', labels ['#backend'].
      const task = new ObsidianTask({
        content: 'Deploy #backend service',
        labels: []
      });
      const parsed = roundTrip(task);
      expect(parsed.content).toBe('Deploy service');
      expect(parsed.labels).toEqual(['#backend']);
    });

    it('should round-trip an empty content with labels', () => {
      expectRoundTrip(
        new ObsidianTask({ content: '', labels: ['#only-label'] })
      );
    });
  });

  describe('attribute variations', () => {
    it('should round-trip each priority level', () => {
      for (const priority of [1, 2, 3, 4] as const) {
        expectRoundTrip(new ObsidianTask({ content: 'Prioritized', priority }));
      }
    });

    it('should round-trip labels', () => {
      expectRoundTrip(
        new ObsidianTask({
          content: 'Labeled task',
          labels: ['#label1', '#label2', '#nested/label']
        })
      );
    });

    it('should round-trip a registered project including its color', () => {
      const task = new ObsidianTask({
        content: 'Project task',
        project: { id: 'project-123', name: 'Project Name', color: '#f1f1f1' }
      });
      const parsed = roundTrip(task);
      // the line stores the name; id/color resolve via the project registry
      expect(parsed.project).toEqual({
        id: 'project-123',
        name: 'Project Name',
        color: '#f1f1f1'
      });
    });

    it('should preserve an unregistered project name', () => {
      const task = new ObsidianTask({
        content: 'Orphan project task',
        project: { id: '', name: 'Not In Registry' }
      });
      const parsed = roundTrip(task);
      expect(parsed.project?.name).toBe('Not In Registry');
    });

    it('should round-trip a schedule without time', () => {
      const schedule = taskParser.parseSchedule('2024-08-15');
      expect(schedule).toEqual({
        isRecurring: false,
        date: '2024-08-15',
        string: '2024-08-15'
      });
      expectRoundTrip(new ObsidianTask({ content: 'Scheduled', schedule }));
    });

    it('should round-trip a schedule with time', () => {
      const schedule = taskParser.parseSchedule('2024-08-15 14:30');
      expect(schedule).toEqual({
        isRecurring: false,
        date: '2024-08-15',
        time: '14:30',
        string: '2024-08-15 14:30'
      });
      expectRoundTrip(new ObsidianTask({ content: 'Timed', schedule }));
    });

    it('should normalize a natural language schedule to the canonical value', () => {
      const schedule = taskParser.parseSchedule('tomorrow at 3pm');
      // natural language resolves against "now" exactly once, at parse time:
      // even the in-memory `string` is the resolved date, so no later
      // re-parse (editor round-trip, re-index) can shift it
      expect(schedule).toEqual({
        isRecurring: false,
        date: '2026-07-07',
        time: '15:00',
        string: '2026-07-07T15:00'
      });
      const parsed = roundTrip(new ObsidianTask({ content: 'Soon', schedule }));
      expect(parsed.schedule.date).toBe('2026-07-07');
      expect(parsed.schedule.time).toBe('15:00');
      // the on-disk value is the canonical form, not the input phrase
      expect(parsed.schedule.string).toBe('2026-07-07T15:00');
    });

    it('should round-trip a due date', () => {
      expectRoundTrip(
        new ObsidianTask({
          content: 'Due task',
          due: { isRecurring: false, date: '2026-07-20', string: '2026-07-20' }
        })
      );
    });

    it('should round-trip a parsed duration', () => {
      const duration = taskParser.parseDuration('1h30m');
      expect(duration).toEqual({ hours: 1, minutes: 30 });
      expectRoundTrip(new ObsidianTask({ content: 'Long task', duration }));
    });

    it('should drop a zero duration (empty value, omitted on disk)', () => {
      const parsed = roundTrip(
        new ObsidianTask({
          content: 'Instant',
          duration: { hours: 0, minutes: 0 }
        })
      );
      expect(parsed.duration).toBeNull();
    });

    it('should round-trip a recurrence rule', () => {
      expectRoundTrip(
        new ObsidianTask({ content: 'Recurring', recurrence: 'every week' })
      );
    });

    it('should round-trip a completion date on a completed task', () => {
      const parsed = roundTrip(
        new ObsidianTask({
          content: 'Finished',
          completed: true,
          completionDate: '2026-07-06'
        })
      );
      expect(parsed.completionDate).toBe('2026-07-06');
    });

    it('should not round-trip machine bookkeeping (order/sectionID/metadata)', () => {
      const parsed = roundTrip(
        new ObsidianTask({
          content: 'Meta task',
          order: 5,
          sectionID: 'section-9',
          metadata: { filePath: '/path/to/file.md' }
        })
      );
      expect(parsed.order).toBe(0);
      expect(parsed.sectionID).toBe('');
      expect(parsed.metadata).toEqual({});
    });

    it('should round-trip foreign fields verbatim', () => {
      const parsed = roundTrip(
        new ObsidianTask({
          content: 'Interop task',
          metadata: { foreignFields: ['[start:: 2026-07-01]', '[custom:: v]'] }
        })
      );
      expect(parsed.metadata.foreignFields).toEqual([
        '[start:: 2026-07-01]',
        '[custom:: v]'
      ]);
    });
  });

  describe('description variations', () => {
    it('should round-trip a single-line description', () => {
      expectRoundTrip(
        new ObsidianTask({
          content: 'Described',
          description: 'One helpful line'
        })
      );
    });

    it('should round-trip a multi-line description with nested checkboxes', () => {
      expectRoundTrip(
        new ObsidianTask({
          content: 'Checklist owner',
          description: '- [ ] step one\n- [x] step two\n  - [ ] nested step'
        })
      );
    });

    it('should round-trip a description containing a blank line', () => {
      expectRoundTrip(
        new ObsidianTask({
          content: 'Spaced out',
          description: 'first paragraph\n\nsecond paragraph'
        })
      );
    });
  });

  describe('identity', () => {
    it('should preserve a v2 block id through the round trip', () => {
      const task = new ObsidianTask({ id: 'tc-abc123', content: 'Keep my id' });
      expect(roundTrip(task).id).toBe('tc-abc123');
    });

    it('should replace a legacy uuid id with a minted tc- id', () => {
      const task = new ObsidianTask({ content: 'Fresh identity' });
      const legacyId = task.id; // constructor uuid
      const parsed = roundTrip(task);
      expect(parsed.id).not.toBe(legacyId);
      expect(parsed.id).toMatch(/^tc-[a-z0-9]{6}$/);
      // the formatter records the minted id back onto the task it wrote
      expect(task.id).toBe(parsed.id);
    });
  });

  describe('kitchen sink', () => {
    it('should round-trip a task combining all attributes', () => {
      expectRoundTrip(
        new ObsidianTask({
          id: 'tc-sink42',
          content: `Finish the "big" launch`,
          completed: false,
          priority: 2,
          labels: ['#launch', '#q3'],
          project: { id: 'project-456', name: 'ProjectX', color: '#f45fe3' },
          schedule: {
            isRecurring: false,
            date: '2026-07-08',
            time: '09:00',
            string: '2026-07-08 09:00'
          },
          due: { isRecurring: false, date: '2026-07-15', string: '2026-07-15' },
          duration: { hours: 2, minutes: 15 },
          recurrence: 'every week',
          description: '- [x] draft plan\n- [ ] review plan\nnotes: be bold'
        })
      );
    });
  });

  describe('foreign dialect parsing (read-side interop)', () => {
    it('should parse a Tasks-emoji task line', () => {
      const parsed = taskParser.parseAnyTaskMarkdown(
        '- [ ] Pay rent #TaskCard ⏫ 📅 2026-08-01 🔁 every month'
      );
      expect(parsed.content).toBe('Pay rent');
      expect(parsed.priority).toBe(2);
      expect(parsed.due?.date).toBe('2026-08-01');
      expect(parsed.recurrence).toBe('every month');
    });

    it('should parse a Tasks-dataview-dialect line and keep unknown fields', () => {
      const parsed = taskParser.parseAnyTaskMarkdown(
        '- [ ] Review PR #TaskCard [due:: 2026-07-10] [start:: 2026-07-08] [priority:: high]'
      );
      expect(parsed.content).toBe('Review PR');
      expect(parsed.due?.date).toBe('2026-07-10');
      expect(parsed.priority).toBe(2);
      expect(parsed.metadata.foreignFields).toEqual(['[start:: 2026-07-08]']);
    });

    it('should parse a legacy v1 hidden-span line', () => {
      const line =
        '- [ ] Old task #TaskCard<span style="display:none">{"id":"legacy-1","priority":2,"order":0,"project":{"id":"project-123","name":"Project Name"},"sectionID":"","schedule":null,"due":null,"duration":null,"recurrence":null,"metadata":{}}</span> .';
      const parsed = taskParser.parseAnyTaskMarkdown(line);
      expect(parsed.content).toBe('Old task');
      expect(parsed.priority).toBe(2);
      expect(parsed.id).toBe('legacy-1');
      expect(parsed.project?.name).toBe('Project Name');
    });
  });
});

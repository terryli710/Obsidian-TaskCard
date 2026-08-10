import {
  DateOnly,
  TimeOnly,
  ObsidianTask,
  PositionedObsidianTask
} from '../src/taskModule/task';
import type { DocPosition, ScheduleDate } from '../src/taskModule/task';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('DateOnly / TimeOnly runtypes', () => {
  it('should accept valid YYYY-MM-DD dates', () => {
    expect(DateOnly.guard('2024-08-15')).toBe(true);
    expect(DateOnly.guard('1999-01-01')).toBe(true);
  });

  it('should reject malformed dates', () => {
    expect(DateOnly.guard('2024-8-15')).toBe(false);
    expect(DateOnly.guard('15-08-2024')).toBe(false);
    expect(DateOnly.guard('2024-08-15T10:00')).toBe(false);
    expect(DateOnly.guard('not a date')).toBe(false);
    expect(DateOnly.guard('')).toBe(false);
  });

  it('should accept valid HH:MM times', () => {
    expect(TimeOnly.guard('09:30')).toBe(true);
    expect(TimeOnly.guard('23:59')).toBe(true);
  });

  it('should reject malformed times', () => {
    expect(TimeOnly.guard('9:30')).toBe(false);
    expect(TimeOnly.guard('09:30:00')).toBe(false);
    expect(TimeOnly.guard('')).toBe(false);
  });

  it('should only validate format, not semantic range (current behavior)', () => {
    // the constraints are pure format regexes; out-of-range values pass
    expect(DateOnly.guard('2024-99-99')).toBe(true);
    expect(TimeOnly.guard('99:99')).toBe(true);
  });
});

describe('ObsidianTask', () => {
  describe('constructor defaults', () => {
    it('should populate all defaults when constructed without props', () => {
      const task = new ObsidianTask();
      expect(task.id).toMatch(UUID_REGEX);
      expect(task.content).toBe('');
      expect(task.priority).toBe(4);
      expect(task.description).toBe('');
      expect(task.order).toBe(0);
      expect(task.project).toEqual({ id: '', name: '' });
      expect(task.sectionID).toBe('');
      expect(task.labels).toEqual([]);
      expect(task.completed).toBe(false);
      expect(task.parent).toBeNull();
      expect(task.children).toEqual([]);
      expect(task.schedule).toBeNull();
      expect(task.due).toBeNull();
      expect(task.duration).toBeNull();
      expect(task.metadata).toEqual({});
    });

    it('should generate a fresh unique id per instance', () => {
      const a = new ObsidianTask();
      const b = new ObsidianTask();
      expect(a.id).not.toBe(b.id);
    });

    it('should keep provided props', () => {
      const schedule: ScheduleDate = {
        isRecurring: false,
        date: '2026-07-10',
        time: '14:30',
        string: '2026-07-10 14:30'
      };
      const task = new ObsidianTask({
        id: 'fixed-id',
        content: 'Do the thing',
        priority: 1,
        description: 'line one\nline two',
        order: 3,
        project: { id: 'p-1', name: 'Proj', color: '#123456' },
        sectionID: 'sec-1',
        labels: ['#a', '#b'],
        completed: true,
        schedule,
        due: { isRecurring: false, date: '2026-07-11', string: 'next week' },
        duration: { hours: 1, minutes: 30 },
        metadata: { foo: 'bar' }
      });
      expect(task.id).toBe('fixed-id');
      expect(task.content).toBe('Do the thing');
      expect(task.priority).toBe(1);
      expect(task.description).toBe('line one\nline two');
      expect(task.order).toBe(3);
      expect(task.project).toEqual({ id: 'p-1', name: 'Proj', color: '#123456' });
      expect(task.sectionID).toBe('sec-1');
      expect(task.labels).toEqual(['#a', '#b']);
      expect(task.completed).toBe(true);
      expect(task.schedule).toEqual(schedule);
      expect(task.due).toEqual({
        isRecurring: false,
        date: '2026-07-11',
        string: 'next week'
      });
      expect(task.duration).toEqual({ hours: 1, minutes: 30 });
      expect(task.metadata).toEqual({ foo: 'bar' });
    });

    it('should coerce explicit null priority/project to defaults (current behavior)', () => {
      // the constructor uses `props?.x || default`, so null-ish values fall
      // back to the default rather than being kept as null
      const task = new ObsidianTask({
        priority: null,
        project: null,
        order: null
      });
      expect(task.priority).toBe(4);
      expect(task.project).toEqual({ id: '', name: '' });
      expect(task.order).toBe(0);
    });
  });

  describe('getCopy', () => {
    it('should copy every field including the id', () => {
      const task = new ObsidianTask({
        id: 'copy-id',
        content: 'Copy me',
        priority: 2,
        labels: ['#keep'],
        completed: true,
        duration: { hours: 0, minutes: 45 },
        metadata: { k: 'v' }
      });
      const copy = task.getCopy();
      expect(copy).not.toBe(task);
      expect(copy).toBeInstanceOf(ObsidianTask);
      expect(copy).toEqual(task);
      expect(copy.id).toBe('copy-id');
    });

    it('should be a shallow copy: nested objects are shared (current behavior)', () => {
      const task = new ObsidianTask({
        labels: ['#shared'],
        project: { id: 'p-1', name: 'Proj' },
        metadata: { nested: { a: 1 } }
      });
      const copy = task.getCopy();
      expect(copy.labels).toBe(task.labels);
      expect(copy.project).toBe(task.project);
      expect(copy.metadata).toBe(task.metadata);
    });
  });

  describe('has* predicates', () => {
    it('hasDescription should reflect description length', () => {
      expect(new ObsidianTask().hasDescription()).toBe(false);
      expect(new ObsidianTask({ description: 'x' }).hasDescription()).toBe(true);
    });

    it('hasProject should require a non-empty project name', () => {
      expect(new ObsidianTask().hasProject()).toBe(false); // default {id:'',name:''}
      const task = new ObsidianTask();
      task.project = null;
      expect(task.hasProject()).toBe(false);
      expect(
        new ObsidianTask({ project: { id: 'p', name: 'Named' } }).hasProject()
      ).toBe(true);
    });

    it('hasAnyLabels should reflect the labels array', () => {
      expect(new ObsidianTask().hasAnyLabels()).toBe(false);
      expect(new ObsidianTask({ labels: ['#l'] }).hasAnyLabels()).toBe(true);
    });

    it('isCompleted should reflect the completed flag', () => {
      expect(new ObsidianTask().isCompleted()).toBe(false);
      expect(new ObsidianTask({ completed: true }).isCompleted()).toBe(true);
    });

    it('hasParent / hasChildren should reflect the tree fields', () => {
      const task = new ObsidianTask();
      expect(task.hasParent()).toBe(false);
      expect(task.hasChildren()).toBe(false);
      const parent = new ObsidianTask({ content: 'parent' });
      const child = new ObsidianTask({ content: 'child', parent });
      expect(child.hasParent()).toBe(true);
      const withChildren = new ObsidianTask({ children: [child] });
      expect(withChildren.hasChildren()).toBe(true);
    });

    it('hasSchedule should be false for a null schedule, or blank string with no date', () => {
      expect(new ObsidianTask().hasSchedule()).toBe(false);
      const blankNoDate = new ObsidianTask({
        schedule: { isRecurring: false, date: '', string: '   ' } as any
      });
      expect(blankNoDate.hasSchedule()).toBe(false);
    });

    it('hasSchedule should be true when the schedule string is non-empty', () => {
      const task = new ObsidianTask({
        schedule: { isRecurring: false, date: '2026-07-10', string: 'tomorrow' }
      });
      expect(task.hasSchedule()).toBe(true);
    });

    it('hasSchedule should fall back to the date when string is missing or blank', () => {
      const noString = new ObsidianTask({
        schedule: { isRecurring: false, date: '2026-07-10' }
      });
      expect(noString.hasSchedule()).toBe(true);

      const blankStringWithDate = new ObsidianTask({
        schedule: { isRecurring: false, date: '2026-07-10', string: '   ' }
      });
      expect(blankStringWithDate.hasSchedule()).toBe(true);
    });

    it('hasDue should mirror hasSchedule semantics', () => {
      expect(new ObsidianTask().hasDue()).toBe(false);
      const due = new ObsidianTask({
        due: { isRecurring: false, date: '2026-07-12', string: '2026-07-12' }
      });
      expect(due.hasDue()).toBe(true);
      // a due date without a `string` field falls back to the date
      const noString = new ObsidianTask({
        due: { isRecurring: false, date: '2026-07-12' }
      });
      expect(noString.hasDue()).toBe(true);
    });

    it('hasDuration should be true only for a non-zero duration', () => {
      expect(new ObsidianTask().hasDuration()).toBe(false);
      expect(
        new ObsidianTask({ duration: { hours: 0, minutes: 0 } }).hasDuration()
      ).toBe(false);
      expect(
        new ObsidianTask({ duration: { hours: 1, minutes: 0 } }).hasDuration()
      ).toBe(true);
      expect(
        new ObsidianTask({ duration: { hours: 0, minutes: 45 } }).hasDuration()
      ).toBe(true);
    });
  });

  describe('task display params', () => {
    it('setTaskDisplayParams should merge keys into metadata.taskDisplayParams', () => {
      const task = new ObsidianTask();
      task.setTaskDisplayParams('mode', 'multi-line');
      expect(task.metadata.taskDisplayParams).toEqual({ mode: 'multi-line' });
      task.setTaskDisplayParams('other', 1);
      expect(task.metadata.taskDisplayParams).toEqual({
        mode: 'multi-line',
        other: 1
      });
      // overwriting an existing key
      task.setTaskDisplayParams('mode', 'single-line');
      expect(task.metadata.taskDisplayParams).toEqual({
        mode: 'single-line',
        other: 1
      });
    });

    it('clearTaskDisplayParams should reset the params to null', () => {
      const task = new ObsidianTask();
      task.setTaskDisplayParams('mode', 'multi-line');
      task.clearTaskDisplayParams();
      expect(task.metadata.taskDisplayParams).toBeNull();
    });
  });

  describe('toTaskProps', () => {
    it('should return the task instance itself', () => {
      const task = new ObsidianTask({ content: 'self' });
      expect(task.toTaskProps()).toBe(task);
    });
  });
});

describe('PositionedObsidianTask', () => {
  const position: DocPosition = {
    filePath: 'folder/note.md',
    start: { line: 4, col: 0 },
    end: { line: 6, col: 12 }
  };

  it('should default docPosition when not provided', () => {
    const task = new PositionedObsidianTask();
    expect(task.docPosition).toEqual({
      filePath: '',
      start: { line: 0, col: 0 },
      end: { line: 0, col: 0 }
    });
    // still a full ObsidianTask underneath
    expect(task).toBeInstanceOf(ObsidianTask);
    expect(task.priority).toBe(4);
  });

  it('should keep provided task props and docPosition', () => {
    const task = new PositionedObsidianTask({
      content: 'Positioned',
      completed: true,
      docPosition: position
    });
    expect(task.content).toBe('Positioned');
    expect(task.completed).toBe(true);
    expect(task.docPosition).toEqual(position);
  });

  it('toPositionedTaskProps should include all task fields plus docPosition', () => {
    const task = new PositionedObsidianTask({
      id: 'pos-id',
      content: 'Props',
      labels: ['#l'],
      docPosition: position
    });
    const props = task.toPositionedTaskProps();
    expect(props.docPosition).toEqual(position);
    expect(props.id).toBe('pos-id');
    expect(props.content).toBe('Props');
    expect(props.labels).toEqual(['#l']);
  });

  it('fromObsidianTaskAndDocPosition should attach a position to a plain task', () => {
    const plain = new ObsidianTask({
      id: 'plain-id',
      content: 'Plain task',
      priority: 2
    });
    const positioned = PositionedObsidianTask.fromObsidianTaskAndDocPosition(
      plain,
      position
    );
    expect(positioned).toBeInstanceOf(PositionedObsidianTask);
    expect(positioned.id).toBe('plain-id');
    expect(positioned.content).toBe('Plain task');
    expect(positioned.priority).toBe(2);
    expect(positioned.docPosition).toEqual(position);
  });

  it('toObsidianTask should strip the position and preserve task fields', () => {
    const positioned = new PositionedObsidianTask({
      id: 'strip-id',
      content: 'Strip me',
      labels: ['#x'],
      completed: true,
      docPosition: position
    });
    const plain = positioned.toObsidianTask();
    expect(plain).toBeInstanceOf(ObsidianTask);
    expect(plain).not.toBeInstanceOf(PositionedObsidianTask);
    expect((plain as any).docPosition).toBeUndefined();
    expect(plain.id).toBe('strip-id');
    expect(plain.content).toBe('Strip me');
    expect(plain.labels).toEqual(['#x']);
    expect(plain.completed).toBe(true);
  });

  it('toDocPosition should return the position object', () => {
    const task = new PositionedObsidianTask({ docPosition: position });
    expect(task.toDocPosition()).toBe(task.docPosition);
    expect(task.toDocPosition()).toEqual(position);
  });
});

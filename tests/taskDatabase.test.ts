/**
 * Tests for TaskDatabase (src/query/cache.ts): the PositionedTaskProperties
 * database with per-attribute indices and multi-attribute querying.
 *
 * obsidian-dataview is mocked so importing cache.ts never touches the real
 * Dataview plugin package.
 */
jest.mock('obsidian-dataview', () => ({ getAPI: jest.fn() }));

import { TaskDatabase } from '../src/query/cache';
import {
  PositionedObsidianTask,
  PositionedTaskProperties
} from '../src/taskModule/task';

/** Expose the protected indices for direct index assertions. */
class InspectableTaskDatabase extends TaskDatabase {
  getIndexEntries(fieldName: string): Map<any, Set<string>> {
    return this.indices[fieldName];
  }
}

interface TaskSpec {
  id: string;
  content: string;
  priority?: 1 | 2 | 3 | 4;
  projectName?: string;
  labels?: string[];
  completed?: boolean;
  scheduleString?: string | null;
  scheduleDate?: string;
  scheduleTime?: string | null;
  filePath?: string;
  line?: number;
}

function makeTask(spec: TaskSpec): PositionedObsidianTask {
  return new PositionedObsidianTask({
    id: spec.id,
    content: spec.content,
    priority: spec.priority ?? 4,
    project: {
      id: `prj-${spec.projectName ?? 'none'}`,
      name: spec.projectName ?? ''
    },
    labels: spec.labels ?? [],
    completed: spec.completed ?? false,
    schedule: spec.scheduleString
      ? {
          isRecurring: false,
          date: spec.scheduleDate ?? spec.scheduleString.slice(0, 10),
          time: spec.scheduleTime ?? null,
          string: spec.scheduleString
        }
      : null,
    docPosition: {
      filePath: spec.filePath ?? 'inbox.md',
      start: { line: spec.line ?? 0, col: 0 },
      end: { line: spec.line ?? 0, col: 40 }
    }
  });
}

const ids = (tasks: PositionedTaskProperties[]) =>
  tasks.map((t) => t.id).sort();

describe('TaskDatabase', () => {
  let db: InspectableTaskDatabase;

  // t1: p1, Work,  [urgent, home], open,  2026-07-04, work/tasks.md
  // t2: p2, Work,  [errand],       done,  2026-07-08, work/tasks.md
  // t3: p1, Home,  [home],         open,  no schedule, personal/home.md
  // t4: p4, Home,  [],             done,  2026-07-06 09:00, personal/home.md
  const t1 = makeTask({
    id: 't1',
    content: 'write report',
    priority: 1,
    projectName: 'Work',
    labels: ['urgent', 'home'],
    completed: false,
    scheduleString: '2026-07-04',
    filePath: 'work/tasks.md',
    line: 2
  });
  const t2 = makeTask({
    id: 't2',
    content: 'send invoices',
    priority: 2,
    projectName: 'Work',
    labels: ['errand'],
    completed: true,
    scheduleString: '2026-07-08',
    filePath: 'work/tasks.md',
    line: 5
  });
  const t3 = makeTask({
    id: 't3',
    content: 'water plants',
    priority: 1,
    projectName: 'Home',
    labels: ['home'],
    completed: false,
    scheduleString: null,
    filePath: 'personal/home.md',
    line: 1
  });
  const t4 = makeTask({
    id: 't4',
    content: 'morning workout',
    priority: 4,
    projectName: 'Home',
    labels: [],
    completed: true,
    scheduleString: '2026-07-06 09:00',
    scheduleDate: '2026-07-06',
    scheduleTime: '09:00',
    filePath: 'personal/home.md',
    line: 8
  });

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-06T10:00:00'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    db = new InspectableTaskDatabase();
    db.bulkStore([t1, t2, t3, t4].map((t) => ({ id: t.id, item: t })));
  });

  describe('queryTasksByMultipleAttributes', () => {
    it('empty query returns every task', () => {
      expect(ids(db.queryTasksByMultipleAttributes({}))).toEqual([
        't1',
        't2',
        't3',
        't4'
      ]);
    });

    it('filters by priority', () => {
      expect(
        ids(db.queryTasksByMultipleAttributes({ priorityQuery: [1] }))
      ).toEqual(['t1', 't3']);
      expect(
        ids(db.queryTasksByMultipleAttributes({ priorityQuery: [2, 4] }))
      ).toEqual(['t2', 't4']);
      expect(
        db.queryTasksByMultipleAttributes({ priorityQuery: [3] })
      ).toEqual([]);
    });

    it('filters by project name', () => {
      expect(
        ids(db.queryTasksByMultipleAttributes({ projectQuery: ['Work'] }))
      ).toEqual(['t1', 't2']);
      expect(
        ids(
          db.queryTasksByMultipleAttributes({
            projectQuery: ['Work', 'Home']
          })
        )
      ).toEqual(['t1', 't2', 't3', 't4']);
      expect(
        db.queryTasksByMultipleAttributes({ projectQuery: ['Nope'] })
      ).toEqual([]);
    });

    it('filters by label with ANY-of semantics', () => {
      expect(
        ids(db.queryTasksByMultipleAttributes({ labelQuery: ['home'] }))
      ).toEqual(['t1', 't3']);
      expect(
        ids(
          db.queryTasksByMultipleAttributes({
            labelQuery: ['errand', 'urgent']
          })
        )
      ).toEqual(['t1', 't2']);
      expect(
        db.queryTasksByMultipleAttributes({ labelQuery: ['missing'] })
      ).toEqual([]);
    });

    it('filters by completed state', () => {
      expect(
        ids(db.queryTasksByMultipleAttributes({ completedQuery: [true] }))
      ).toEqual(['t2', 't4']);
      expect(
        ids(db.queryTasksByMultipleAttributes({ completedQuery: [false] }))
      ).toEqual(['t1', 't3']);
      expect(
        ids(
          db.queryTasksByMultipleAttributes({ completedQuery: [true, false] })
        )
      ).toEqual(['t1', 't2', 't3', 't4']);
    });

    it('filters by file path prefix', () => {
      expect(
        ids(db.queryTasksByMultipleAttributes({ filePathQuery: 'work/' }))
      ).toEqual(['t1', 't2']);
      expect(
        ids(db.queryTasksByMultipleAttributes({ filePathQuery: 'personal/' }))
      ).toEqual(['t3', 't4']);
      expect(
        db.queryTasksByMultipleAttributes({ filePathQuery: 'archive/' })
      ).toEqual([]);
    });

    describe('schedule date-time range (clock pinned to 2026-07-06T10:00)', () => {
      it('["", ""] (no bounds) keeps every task, scheduled or not', () => {
        expect(
          ids(
            db.queryTasksByMultipleAttributes({
              scheduleDateTimeQuery: ['', '']
            })
          )
        ).toEqual(['t1', 't2', 't3', 't4']);
      });

      it('start+end keeps only tasks scheduled inside the range', () => {
        expect(
          ids(
            db.queryTasksByMultipleAttributes({
              scheduleDateTimeQuery: ['2026-07-03', '2026-07-05']
            })
          )
        ).toEqual(['t1']);
      });

      it('range bounds are inclusive', () => {
        expect(
          ids(
            db.queryTasksByMultipleAttributes({
              scheduleDateTimeQuery: ['2026-07-04', '2026-07-08']
            })
          )
        ).toEqual(['t1', 't2', 't4']);
      });

      it('start-only keeps tasks scheduled on/after the start', () => {
        expect(
          ids(
            db.queryTasksByMultipleAttributes({
              scheduleDateTimeQuery: ['2026-07-07', '']
            })
          )
        ).toEqual(['t2']);
      });

      it('end-only keeps tasks scheduled on/before the end', () => {
        expect(
          ids(
            db.queryTasksByMultipleAttributes({
              scheduleDateTimeQuery: ['', '2026-07-05']
            })
          )
        ).toEqual(['t1']);
      });

      it('any non-empty range excludes tasks without a schedule', () => {
        expect(
          ids(
            db.queryTasksByMultipleAttributes({
              scheduleDateTimeQuery: ['2026-01-01', '2026-12-31']
            })
          )
        ).toEqual(['t1', 't2', 't4']); // t3 has no schedule
      });
    });

    it('combines dimensions with AND semantics', () => {
      expect(
        ids(
          db.queryTasksByMultipleAttributes({
            priorityQuery: [1, 2],
            projectQuery: ['Work'],
            completedQuery: [false]
          })
        )
      ).toEqual(['t1']);

      expect(
        ids(
          db.queryTasksByMultipleAttributes({
            labelQuery: ['home'],
            filePathQuery: 'personal/'
          })
        )
      ).toEqual(['t3']);

      // conflicting dimensions intersect to nothing
      expect(
        db.queryTasksByMultipleAttributes({
          projectQuery: ['Work'],
          filePathQuery: 'personal/'
        })
      ).toEqual([]);
    });

    it('returns [] on an empty database regardless of query', () => {
      const empty = new TaskDatabase();
      expect(empty.queryTasksByMultipleAttributes({})).toEqual([]);
      expect(
        empty.queryTasksByMultipleAttributes({ priorityQuery: [1] })
      ).toEqual([]);
    });
  });

  describe('indices', () => {
    it('maintains every constructor-declared index on store', () => {
      expect(db.getAllIndexValues('priority')!.sort()).toEqual([1, 2, 4]);
      expect(db.getAllIndexValues('project')!.sort()).toEqual([
        'Home',
        'Work'
      ]);
      // labels are indexed as the joined string of the label array
      expect(db.getAllIndexValues('labels')!.sort()).toEqual([
        '',
        'errand',
        'home',
        'urgent,home'
      ]);
      expect(db.getAllIndexValues('completed')!.sort()).toEqual([false, true]);
      expect(db.getAllIndexValues('schedule.date')!.sort()).toEqual([
        '2026-07-04',
        '2026-07-06',
        '2026-07-08',
        null
      ]);
      expect(db.getAllIndexValues('filePath')!.sort()).toEqual([
        'personal/home.md',
        'work/tasks.md'
      ]);
    });

    it('groups task ids under their filePath index bucket', () => {
      const index = db.getIndexEntries('filePath');
      expect(index.get('work/tasks.md')).toEqual(new Set(['t1', 't2']));
      expect(index.get('personal/home.md')).toEqual(new Set(['t3', 't4']));
    });

    it('indexes tasks without a schedule under null', () => {
      const index = db.getIndexEntries('schedule.date');
      expect(index.get(null)).toEqual(new Set(['t3']));
    });
  });

  describe('refreshTasksByFileList', () => {
    const t5 = makeTask({
      id: 't5',
      content: 'new work task',
      priority: 3,
      projectName: 'Work',
      labels: ['fresh'],
      filePath: 'work/tasks.md',
      line: 2
    });

    it('replaces tasks of the listed files and keeps the others', () => {
      db.refreshTasksByFileList(['work/tasks.md'], [{ id: 't5', item: t5 }]);

      expect(ids(db.queryTasksByMultipleAttributes({}))).toEqual([
        't3',
        't4',
        't5'
      ]);
      expect(db.getLength()).toBe(3);
      expect(db.getIndexEntries('filePath').get('work/tasks.md')).toEqual(
        new Set(['t5'])
      );
      expect(db.getIndexEntries('filePath').get('personal/home.md')).toEqual(
        new Set(['t3', 't4'])
      );
    });

    it('with no new tasks simply drops the file contents', () => {
      db.refreshTasksByFileList(['work/tasks.md', 'personal/home.md'], []);
      expect(db.getLength()).toBe(0);
      expect(db.queryTasksByMultipleAttributes({})).toEqual([]);
    });

    it('handles a file that has no tasks in the database', () => {
      db.refreshTasksByFileList(['unknown/file.md'], [{ id: 't5', item: t5 }]);
      expect(ids(db.queryTasksByMultipleAttributes({}))).toEqual([
        't1',
        't2',
        't3',
        't4',
        't5'
      ]);
    });

    it('removes deleted task ids from every index, not just filePath', () => {
      // refreshTasksByFileList delegates to refreshTasksByAttribute, which
      // cleans the deleted ids out of all indices, so index consumers (e.g.
      // getAllIndexValues used for label options) never see dead values.
      db.refreshTasksByFileList(['work/tasks.md'], []);

      // t1/t2 are gone from the data...
      expect(ids(db.queryTasksByMultipleAttributes({}))).toEqual(['t3', 't4']);
      // ...and the priority index no longer advertises t2's value 2.
      expect(db.getIndexEntries('priority').get(2)).toBeUndefined();
      expect(db.getAllIndexValues('priority')!.sort()).toEqual([1, 4]);
      // t2's label bucket is gone as well.
      expect(db.getAllIndexValues('labels')).not.toContain('errand');
    });
  });
});

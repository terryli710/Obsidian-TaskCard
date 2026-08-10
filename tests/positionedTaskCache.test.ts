/**
 * Tests for PositionedTaskCache (src/query/cache.ts).
 *
 * The Dataview dependency is mocked at the module boundary: getAPI() returns a
 * fake api whose tryQuery() resolves canned QueryResult-shaped task arrays
 * (values[].path / .status / .text / .position.start|end.line|col), matching
 * what parseQueryResult consumes. The plugin surface used by the cache
 * (taskValidator / taskParser / fileOperator) is stubbed minimally.
 */
jest.mock('obsidian-dataview', () => ({ getAPI: jest.fn() }));

import { getAPI } from 'obsidian-dataview';
import { PositionedTaskCache } from '../src/query/cache';
import { ObsidianTask } from '../src/taskModule/task';

const mockGetAPI = getAPI as unknown as jest.Mock;

const FILE_LINES = [
  '# heading',
  '',
  '- [ ] not a taskcard task',
  '- [ ] write report #TaskCard <span style="display:none">{}</span>',
  'trailing line'
];

interface DataviewTaskSpec {
  path?: string;
  status?: string;
  text?: string;
  startLine?: number;
  endLine?: number;
  startCol?: number;
  endCol?: number;
}

function dataviewTask(spec: DataviewTaskSpec = {}) {
  const startLine = spec.startLine ?? 3;
  return {
    path: spec.path ?? 'work/tasks.md',
    status: spec.status ?? ' ',
    text:
      spec.text ??
      'write report #TaskCard <span style="display:none">{}</span>',
    position: {
      start: { line: startLine, col: spec.startCol ?? 0 },
      end: { line: spec.endLine ?? startLine, col: spec.endCol ?? 62 }
    }
  };
}

function makePlugin() {
  return {
    taskValidator: {
      isTaskCardTaskMarkdown: jest.fn(() => true)
    },
    taskParser: {
      parseAnyTaskFromFileLines: jest.fn(
        () => new ObsidianTask({ content: 'write report', priority: 2 })
      )
    },
    fileOperator: {
      getFileLines: jest.fn(async () => FILE_LINES)
    },
    hydrateSyncMappings: jest.fn()
  } as any;
}

function makeCache(plugin = makePlugin()) {
  return { cache: new PositionedTaskCache(plugin), plugin };
}

function installApi(values: any[]) {
  const api = { tryQuery: jest.fn(async () => ({ values })) };
  mockGetAPI.mockReturnValue(api);
  return api;
}

describe('PositionedTaskCache', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-06T10:00:00'));
    mockGetAPI.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('parseQueryResult', () => {
    it('converts dataview rows into positioned tasks', async () => {
      const { cache, plugin } = makeCache();
      const row = dataviewTask();

      const tasks = await cache.parseQueryResult({ values: [row] } as any);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].content).toBe('write report');
      expect(tasks[0].priority).toBe(2);
      expect(tasks[0].docPosition).toEqual({
        filePath: 'work/tasks.md',
        start: { line: 3, col: 0 },
        end: { line: 3, col: 62 }
      });
      // the validator sees the reconstructed markdown line
      expect(
        plugin.taskValidator.isTaskCardTaskMarkdown
      ).toHaveBeenCalledWith(`- [ ] ${row.text}`);
    });

    it('feeds the parser the file lines starting at the task line', async () => {
      const { cache, plugin } = makeCache();

      await cache.parseQueryResult({
        values: [dataviewTask({ startLine: 3 })]
      } as any);

      expect(plugin.fileOperator.getFileLines).toHaveBeenCalledWith(
        'work/tasks.md'
      );
      expect(
        plugin.taskParser.parseAnyTaskFromFileLines
      ).toHaveBeenCalledWith(FILE_LINES.slice(3));
    });

    it('skips rows that fail formatted-markdown validation', async () => {
      const { cache, plugin } = makeCache();
      plugin.taskValidator.isTaskCardTaskMarkdown
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const tasks = await cache.parseQueryResult({
        values: [
          dataviewTask({ text: 'no metadata span #TaskCard' }),
          dataviewTask()
        ]
      } as any);

      expect(tasks).toHaveLength(1);
      // invalid row is skipped before any file read
      expect(plugin.fileOperator.getFileLines).toHaveBeenCalledTimes(1);
    });

    it('skips rows whose parsed content is empty', async () => {
      const { cache, plugin } = makeCache();
      plugin.taskParser.parseAnyTaskFromFileLines.mockReturnValueOnce(
        new ObsidianTask({ content: '' })
      );

      const tasks = await cache.parseQueryResult({
        values: [dataviewTask(), dataviewTask({ startLine: 3 })]
      } as any);

      expect(tasks).toHaveLength(1);
    });

    it('returns [] for an empty query result', async () => {
      const { cache } = makeCache();
      expect(await cache.parseQueryResult({ values: [] } as any)).toEqual([]);
    });
  });

  describe('initializeAndRefreshAllTasks', () => {
    it('queries dataview by the indicator tag and fills the database', async () => {
      const { cache } = makeCache();
      const api = installApi([dataviewTask()]);

      await cache.initializeAndRefreshAllTasks();

      expect(api.tryQuery).toHaveBeenCalledWith(
        'TASK FROM #TaskCard WHERE contains(text, "#TaskCard")'
      );
      expect(cache.getLength()).toBe(1);
      expect(cache.status.initialized).toBe(true);
      expect(cache.status.refreshTimeStamp).toBe(
        new Date('2026-07-06T10:00:00').getTime()
      );
    });

    it('leaves the database empty (but still marks status) when dataview never appears', async () => {
      const { cache } = makeCache();
      mockGetAPI.mockReturnValue(null);

      const pending = cache.initializeAndRefreshAllTasks();
      await jest.advanceTimersByTimeAsync(1200); // exhaust the 1000ms retry budget
      await pending;

      expect(cache.getLength()).toBe(0);
      expect(cache.status.initialized).toBe(true);
    });
  });

  describe('refreshTasksByFileList', () => {
    it('scopes the dataview query to the given files (without .md)', async () => {
      const { cache } = makeCache();
      const api = installApi([dataviewTask()]);

      await cache.refreshTasksByFileList(['work/tasks.md', 'notes/b.md']);

      expect(api.tryQuery).toHaveBeenCalledWith(
        'TASK FROM #TaskCard AND ("work/tasks" OR "notes/b") WHERE contains(text, "#TaskCard")'
      );
      expect(cache.getLength()).toBe(1);
    });
  });

  describe('queryTasks', () => {
    it('delegates attribute queries to the database', async () => {
      const { cache } = makeCache();
      installApi([dataviewTask()]);
      await cache.initializeAndRefreshAllTasks();

      const hits = await cache.queryTasks({ priorityQuery: [2] });
      expect(hits).toHaveLength(1);
      expect(hits[0].content).toBe('write report');

      const misses = await cache.queryTasks({ priorityQuery: [1] });
      expect(misses).toEqual([]);
    });
  });

  describe('getDataviewAPI', () => {
    it('resolves immediately when the API is available', async () => {
      const { cache } = makeCache();
      const api = installApi([]);

      await expect(cache.getDataviewAPI()).resolves.toBe(api);
      expect(mockGetAPI).toHaveBeenCalledTimes(1);
    });

    it('retries on an interval and rejects after the time budget', async () => {
      const { cache } = makeCache();
      mockGetAPI.mockReturnValue(null);

      const promise = cache.getDataviewAPI(300, 100);
      const expectation = expect(promise).rejects.toThrow(
        'Timed out while fetching dataviewAPI'
      );
      await jest.advanceTimersByTimeAsync(400);
      await expectation;

      // initial attempt + retries until elapsed >= totalTime
      expect(mockGetAPI.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });
});

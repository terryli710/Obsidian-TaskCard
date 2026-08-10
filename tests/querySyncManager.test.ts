/**
 * Tests for QuerySyncManager (src/query/querySyncManager.ts): the
 * serialization/parsing of `taskcard` code-block content (query options <->
 * code block text) and the editor-independent update helpers.
 */
import {
  normalizeQueryDisplayMode,
  QuerySyncManager
} from '../src/query/querySyncManager';
import { MultipleAttributeTaskQuery } from '../src/query/cache';

function makePlugin() {
  return {
    fileOperator: { updateFile: jest.fn() },
    cache: {
      taskCache: {
        database: {
          // real index keys are each task's labels joined with ','
          // (cache.ts createIndex('labels', ...)): '' = no labels
          getAllIndexValues: jest.fn(() => [
            '#work,#urgent',
            '#urgent',
            ''
          ])
        },
        queryTasks: jest.fn(async () => [])
      }
    }
  } as any;
}

function makeCodeBlockMetadata(overrides: Partial<any> = {}) {
  const sectionEl = {} as HTMLElement;
  return {
    sectionEl,
    ctx: {
      sourcePath: 'notes/board.md',
      getSectionInfo: jest.fn(() => ({
        text: '',
        lineStart: 10,
        lineEnd: 14
      }))
    } as any,
    sourcePath: 'notes/board.md',
    lineStart: 10,
    lineEnd: 14,
    ...overrides
  };
}

function makeManager(source = '', plugin = makePlugin()) {
  return new QuerySyncManager(
    plugin,
    'taskcard',
    source,
    makeCodeBlockMetadata()
  );
}

const fullSource = [
  'priority: [1,2]',
  'project: ["Work"]',
  'label: ["urgent"]',
  'completed: [false]',
  'schedule: ["2026-07-01","2026-07-31"]',
  'file: "work/tasks.md"',
  'display: "matrix"',
  'editMode: false'
].join('\n');

describe('QuerySyncManager.queryParser', () => {
  it('parses every supported key from the code block source', () => {
    const manager = makeManager(fullSource);

    expect(manager.taskQuery).toEqual({
      priorityQuery: [1, 2],
      projectQuery: ['Work'],
      labelQuery: ['urgent'],
      completedQuery: [false],
      scheduleDateTimeQuery: ['2026-07-01', '2026-07-31'],
      filePathQuery: 'work/tasks.md'
    });
  });

  it('sets editMode as a side effect of parsing', () => {
    expect(makeManager(fullSource).editMode).toBe(false);
    expect(makeManager('editMode: true').editMode).toBe(true);
    // no editMode line -> constructor default stands
    expect(makeManager('priority: [1]').editMode).toBe(true);
  });

  it('stores the parsed display mode separately from the task filters', () => {
    expect(makeManager(fullSource).displayMode).toBe('matrix');
  });

  it('strips single and double quotes from the file value', () => {
    expect(makeManager("file: 'quoted/path.md'").taskQuery.filePathQuery).toBe(
      'quoted/path.md'
    );
    expect(makeManager('file: "quoted/path.md"').taskQuery.filePathQuery).toBe(
      'quoted/path.md'
    );
    expect(makeManager('file: bare/path.md').taskQuery.filePathQuery).toBe(
      'bare/path.md'
    );
  });

  it('returns empty defaults for an empty source', () => {
    expect(makeManager('').taskQuery).toEqual({
      priorityQuery: [],
      projectQuery: [],
      labelQuery: [],
      completedQuery: [],
      scheduleDateTimeQuery: ['', ''],
      filePathQuery: ''
    });
  });

  it('ignores unknown keys and lines without a colon', () => {
    const manager = makeManager(
      'banana: [1]\njust some text\npriority: [3]'
    );
    expect(manager.taskQuery.priorityQuery).toEqual([3]);
    expect(manager.taskQuery.projectQuery).toEqual([]);
  });

  it('only splits on the first colon (values may contain colons)', () => {
    const manager = makeManager('file: "folder/name: odd.md"');
    expect(manager.taskQuery.filePathQuery).toBe('folder/name: odd.md');
  });
});

describe('QuerySyncManager.queryFormatter', () => {
  it('serializes a full query including the current editMode', () => {
    const manager = makeManager(fullSource);
    const formatted = manager.queryFormatter(manager.taskQuery);

    expect(formatted).toBe(
      [
        'priority: [1,2]',
        'project: ["Work"]',
        'label: ["urgent"]',
        'completed: [false]',
        'schedule: ["2026-07-01","2026-07-31"]',
        'file: "work/tasks.md"',
        'display: "matrix"',
        'editMode: false'
      ].join('\n')
    );
  });

  it('omits keys whose value is undefined (except editMode)', () => {
    const manager = makeManager('');
    const formatted = manager.queryFormatter({
      priorityQuery: [4]
    } as MultipleAttributeTaskQuery);

    expect(formatted).toBe('priority: [4]\neditMode: true');
  });

  it('round-trips: format -> parse yields the same query object', () => {
    const manager = makeManager(fullSource);
    const reparsed = manager.queryParser(
      manager.queryFormatter(manager.taskQuery)
    );
    expect(reparsed).toEqual(manager.taskQuery);
  });

  it('round-trips the empty/default query too', () => {
    const manager = makeManager('');
    const reparsed = manager.queryParser(
      manager.queryFormatter(manager.taskQuery)
    );
    expect(reparsed).toEqual(manager.taskQuery);
  });
});

describe('QuerySyncManager display mode serialization', () => {
  it('round-trips a quoted list display mode', () => {
    const manager = makeManager('display: "list"');

    expect(manager.displayMode).toBe('list');
    const formatted = manager.queryFormatter(manager.taskQuery);
    expect(formatted).toContain('display: "list"');
    expect(makeManager(formatted).displayMode).toBe('list');
  });

  it('round-trips a quoted matrix display mode', () => {
    const manager = makeManager('display: "matrix"');

    expect(manager.displayMode).toBe('matrix');
    const formatted = manager.queryFormatter(manager.taskQuery);
    expect(formatted).toContain('display: "matrix"');
    expect(makeManager(formatted).displayMode).toBe('matrix');
  });

  it('keeps an absent display mode null and omits it when formatting', () => {
    const manager = makeManager('priority: [1]');

    expect(manager.displayMode).toBeNull();
    const formatted = manager.queryFormatter(manager.taskQuery);
    expect(formatted).not.toContain('display:');
    expect(makeManager(formatted).displayMode).toBeNull();
  });

  it('accepts a bare display token and formats it as JSON-quoted', () => {
    const manager = makeManager('display: matrix');

    expect(manager.displayMode).toBe('matrix');
    const formatted = manager.queryFormatter(manager.taskQuery);
    expect(formatted).toContain('display: "matrix"');
    expect(makeManager(formatted).displayMode).toBe('matrix');
  });

  it('treats an invalid display value as null and does not persist it', () => {
    const manager = makeManager('display: "line"');

    expect(manager.displayMode).toBeNull();
    const formatted = manager.queryFormatter(manager.taskQuery);
    expect(formatted).not.toContain('display:');
    expect(makeManager(formatted).displayMode).toBeNull();
  });
});

describe('normalizeQueryDisplayMode', () => {
  it('preserves matrix and maps every other value to list', () => {
    expect(normalizeQueryDisplayMode('matrix')).toBe('matrix');
    expect(normalizeQueryDisplayMode('list')).toBe('list');
    expect(normalizeQueryDisplayMode('line')).toBe('list');
    expect(normalizeQueryDisplayMode(undefined)).toBe('list');
    expect(normalizeQueryDisplayMode('unknown')).toBe('list');
  });
});

describe('QuerySyncManager.setDefaultQueryValues', () => {
  it('fills null/undefined fields with defaults and keeps provided ones', () => {
    const manager = makeManager('');
    const filled = manager.setDefaultQueryValues({
      priorityQuery: [1],
      projectQuery: null,
      labelQuery: undefined
    } as any);

    expect(filled).toEqual({
      priorityQuery: [1],
      projectQuery: [],
      labelQuery: [],
      completedQuery: [],
      scheduleDateTimeQuery: ['', ''],
      filePathQuery: ''
    });
  });

  it('does not overwrite falsy-but-set values like empty strings', () => {
    const manager = makeManager('');
    const filled = manager.setDefaultQueryValues({
      filePathQuery: '',
      scheduleDateTimeQuery: ['2026-07-01', '']
    } as any);
    expect(filled.filePathQuery).toBe('');
    expect(filled.scheduleDateTimeQuery).toEqual(['2026-07-01', '']);
  });
});

describe('QuerySyncManager.formatCodeBlock', () => {
  it('wraps the query in a fenced block of the configured language', () => {
    const manager = makeManager('');
    expect(manager.formatCodeBlock('priority: [1]')).toBe(
      '```taskcard\npriority: [1]\n```'
    );
  });
});

describe('QuerySyncManager.updateTaskQueryToFile', () => {
  it('writes the formatted block over the code block line span', () => {
    const plugin = makePlugin();
    const manager = makeManager('priority: [1]', plugin);

    manager.updateTaskQueryToFile(
      {
        priorityQuery: [2],
        projectQuery: ['Work'],
        labelQuery: [],
        completedQuery: [],
        scheduleDateTimeQuery: ['', ''],
        filePathQuery: ''
      },
      false
    );

    expect(plugin.fileOperator.updateFile).toHaveBeenCalledTimes(1);
    const [path, content, start, end] =
      plugin.fileOperator.updateFile.mock.calls[0];
    expect(path).toBe('notes/board.md');
    expect(content).toBe(
      [
        '```taskcard',
        'priority: [2]',
        'project: ["Work"]',
        'label: []',
        'completed: []',
        'schedule: ["",""]',
        'file: ""',
        'editMode: false',
        '```'
      ].join('\n')
    );
    // section info from ctx: lineStart 10, lineEnd 14 -> patch [10, 15)
    expect(start).toBe(10);
    expect(end).toBe(15);
  });

  it('refreshes the code block position from the post-processor context', () => {
    const plugin = makePlugin();
    const metadata = makeCodeBlockMetadata({
      lineStart: 0,
      lineEnd: 0,
      sourcePath: 'stale.md'
    });
    metadata.ctx.getSectionInfo = jest.fn(() => ({
      text: '',
      lineStart: 3,
      lineEnd: 7
    }));
    metadata.ctx.sourcePath = 'notes/fresh.md';
    const manager = new QuerySyncManager(plugin, 'taskcard', '', metadata);

    manager.updateTaskQueryToFile(manager.taskQuery, true);

    expect(manager.codeBlockMetadata.sourcePath).toBe('notes/fresh.md');
    expect(manager.codeBlockMetadata.lineStart).toBe(3);
    expect(manager.codeBlockMetadata.lineEnd).toBe(7);
    const [path, , start, end] = plugin.fileOperator.updateFile.mock.calls[0];
    expect(path).toBe('notes/fresh.md');
    expect(start).toBe(3);
    expect(end).toBe(8);
  });

  it('toEditMode rewrites the current query with editMode: true', () => {
    const plugin = makePlugin();
    const manager = makeManager('priority: [1]\neditMode: false', plugin);
    expect(manager.editMode).toBe(false);

    manager.toEditMode();

    expect(manager.editMode).toBe(true);
    const [, content] = plugin.fileOperator.updateFile.mock.calls[0];
    expect(content).toContain('editMode: true');
    expect(content).toContain('priority: [1]');
  });
});

describe('QuerySyncManager.getOptions', () => {
  it('exposes static priority/completed options plus labels from the database', () => {
    const plugin = makePlugin();
    const manager = makeManager('', plugin);

    const options = manager.getOptions();

    expect(options.priorityOptions).toEqual([1, 2, 3, 4]);
    expect(options.completedOptions).toEqual(['true', 'false']);
    // comma-joined index keys are split, de-duplicated, and the empty key
    // (tasks with no labels) is dropped
    expect(options.labelOptions).toEqual(['#work', '#urgent']);
    // projects come from the settings store (defaults are an empty array)
    expect(options.projectOptions).toEqual([]);
  });

  it('refreshOptions re-reads label values from the database', () => {
    const plugin = makePlugin();
    const manager = makeManager('', plugin);
    manager.getOptions();

    plugin.cache.taskCache.database.getAllIndexValues.mockReturnValue([
      '#new-label'
    ]);
    manager.refreshOptions();

    expect(manager.options.labelOptions).toEqual(['#new-label']);
  });
});

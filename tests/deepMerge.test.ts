import { deepMerge } from '../src/utils/deepMerge';
import { DefaultSettings } from '../src/settings';

describe('deepMerge', () => {
  it('merges nested plain objects instead of replacing them', () => {
    const result = deepMerge(
      {},
      { a: { x: 1, y: 2 }, b: 1 },
      { a: { y: 99 } }
    );
    expect(result).toEqual({ a: { x: 1, y: 99 }, b: 1 });
  });

  it('skips undefined source values so defaults survive', () => {
    const result = deepMerge({}, { keep: 'default' }, { keep: undefined });
    expect(result).toEqual({ keep: 'default' });
  });

  it('lets null overwrite, since null is a meaningful settings value', () => {
    const result = deepMerge({}, { defaultProject: { id: 'x' } }, {
      defaultProject: null
    });
    expect(result).toEqual({ defaultProject: null });
  });

  it('takes arrays wholesale from the source rather than merging by index', () => {
    const result = deepMerge({}, { list: ['a', 'b', 'c'] }, { list: ['z'] });
    expect(result).toEqual({ list: ['z'] });
  });

  it('does not mutate its inputs', () => {
    const defaults = { nested: { a: 1 } };
    const stored = { nested: { b: 2 } };
    deepMerge({}, defaults, stored);
    expect(defaults).toEqual({ nested: { a: 1 } });
    expect(stored).toEqual({ nested: { b: 2 } });
  });

  it('deep-copies rather than aliasing nested default objects', () => {
    const defaults = { nested: { a: 1 } };
    const merged = deepMerge<{ nested: { a: number } }>({}, defaults, {});
    merged.nested.a = 42;
    expect(defaults.nested.a).toBe(1);
  });

  it('skips a non-object source instead of letting it replace the result', () => {
    expect(deepMerge({}, { a: 1 }, 'scalar')).toEqual({ a: 1 });
  });

  // loadData() resolves to null when no data.json exists yet, which is every
  // fresh install. A null source must not wipe out the defaults.
  it.each([null, undefined])('ignores a %p source', (source) => {
    expect(deepMerge({}, { a: 1 }, source)).toEqual({ a: 1 });
  });

  it('copies arrays rather than aliasing the source array', () => {
    const stored = { list: [{ id: 'a' }] };
    const merged = deepMerge<{ list: { id: string }[] }>({}, stored);
    merged.list[0].id = 'mutated';
    merged.list.push({ id: 'extra' });
    expect(stored.list).toEqual([{ id: 'a' }]);
  });
});

describe('deepMerge over the real settings shape', () => {
  const freshDefaults = () =>
    JSON.parse(JSON.stringify(DefaultSettings)) as typeof DefaultSettings;

  it('returns the defaults untouched when nothing is stored', () => {
    const merged = deepMerge<typeof DefaultSettings>(
      {},
      freshDefaults(),
      null
    );
    expect(merged).toEqual(DefaultSettings);
  });

  it('keeps stored user values while filling in newly added defaults', () => {
    // A data.json written by an older version: it predates
    // displaySettings.queryDisplayMode and has one saved project.
    const stored = {
      parsingSettings: { indicatorTag: 'MyTasks' },
      displaySettings: { defaultMode: 'multi-line' },
      userMetadata: {
        projects: [{ id: 'p1', name: 'Work', color: '#fff' }]
      }
    };

    const merged = deepMerge<typeof DefaultSettings>(
      {},
      freshDefaults(),
      stored
    );

    // stored values win
    expect(merged.parsingSettings.indicatorTag).toBe('MyTasks');
    expect(merged.displaySettings.defaultMode).toBe('multi-line');
    expect(merged.userMetadata.projects).toEqual([
      { id: 'p1', name: 'Work', color: '#fff' }
    ]);

    // untouched siblings keep their defaults rather than vanishing
    expect(merged.parsingSettings.markdownSuffix).toBe(
      DefaultSettings.parsingSettings.markdownSuffix
    );
    expect(merged.parsingSettings.blockLanguage).toBe(
      DefaultSettings.parsingSettings.blockLanguage
    );

    // a key the old data.json never knew about is populated from defaults
    expect(merged.displaySettings.queryDisplayMode).toBe(
      DefaultSettings.displaySettings.queryDisplayMode
    );
    expect(merged.displaySettings.upcomingMinutes).toBe(
      DefaultSettings.displaySettings.upcomingMinutes
    );
  });

  it('preserves the sync mappings record keyed by block id', () => {
    const stored = {
      userMetadata: {
        syncMappingsById: {
          'tc-4f2a1b': { google: { eventId: 'evt1', calendarId: 'cal1' } }
        }
      }
    };
    const merged = deepMerge<typeof DefaultSettings>(
      {},
      freshDefaults(),
      stored
    );
    expect(merged.userMetadata.syncMappingsById['tc-4f2a1b']).toEqual({
      google: { eventId: 'evt1', calendarId: 'cal1' }
    });
  });

  it('drops a project the user deleted rather than resurrecting it', () => {
    const defaults = freshDefaults();
    // simulate a default that ships with entries
    defaults.userMetadata.projects = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' }
    ] as typeof defaults.userMetadata.projects;

    const merged = deepMerge<typeof DefaultSettings>({}, defaults, {
      userMetadata: { projects: [{ id: 'a', name: 'A' }] }
    });

    expect(merged.userMetadata.projects).toEqual([{ id: 'a', name: 'A' }]);
  });
});

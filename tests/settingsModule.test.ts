/** @jest-environment jsdom */
import { get } from 'svelte/store';
import { App, Setting } from 'obsidian';
import {
  DefaultSettings,
  SettingStore,
  SettingsTab,
  emptyProject,
  TaskCardSettings
} from '../src/settings';

/**
 * WORKAROUND (env gap, same as tests/components/testUtils.ts): jest-environment-jsdom
 * strips Node's setImmediate, but winston's Console transport (src/utils/log.ts
 * logger) calls it at log time, so exercising a settings onChange handler that
 * logs would throw "ReferenceError: setImmediate is not defined". Polyfill it here.
 */
if (typeof (globalThis as any).setImmediate === 'undefined') {
  (globalThis as any).setImmediate = (
    fn: (...args: any[]) => void,
    ...args: any[]
  ) => setTimeout(fn, 0, ...args);
  (globalThis as any).clearImmediate = (id: any) => clearTimeout(id);
}

describe('DefaultSettings shape', () => {
  it('carries the documented parsing defaults', () => {
    expect(DefaultSettings.parsingSettings).toEqual({
      markdownStartingNotation: '%%*',
      markdownEndingNotation: '*%%',
      indicatorTag: 'TaskCard',
      markdownSuffix: ' .',
      blockLanguage: 'taskcard',
      writeCompletionDate: true
    });
  });

  it('carries the documented display defaults', () => {
    expect(DefaultSettings.displaySettings).toEqual({
      defaultMode: 'single-line',
      upcomingMinutes: 15,
      queryDisplayMode: 'list',
      styleMetadataInLivePreview: true
    });
  });

  it('defaults user metadata to no projects and the empty project', () => {
    expect(DefaultSettings.userMetadata.projects).toEqual([]);
    expect(Array.isArray(DefaultSettings.userMetadata.projects)).toBe(true);
    expect(DefaultSettings.userMetadata.defaultProject).toBe(emptyProject);
    expect(emptyProject).toEqual({ id: '', name: '' });
  });

  it('defaults Google sync to a logged-out, unfiltered state', () => {
    expect(DefaultSettings.syncSettings.googleSyncSetting).toEqual({
      clientID: '',
      clientSecret: '',
      isLogin: false,
      doesNeedFilters: false,
      filterTag: '',
      filterProject: '',
      defaultCalendarId: ''
    });
  });
});

describe('SettingStore semantics', () => {
  afterEach(() => {
    // restore the store to its pristine module-level state
    SettingStore.set(DefaultSettings);
  });

  it('is initialized with the DefaultSettings object itself (shared reference)', () => {
    // NOTE: the store holds DefaultSettings by reference, so any subscriber
    // that mutates the settings object it receives also corrupts
    // DefaultSettings. Documented here as a hazard for refactoring.
    expect(get(SettingStore)).toBe(DefaultSettings);
  });

  it('notifies subscribers immediately with the current value', () => {
    const seen: TaskCardSettings[] = [];
    const unsubscribe = SettingStore.subscribe((v) => seen.push(v));
    expect(seen).toHaveLength(1);
    expect(seen[0].parsingSettings.indicatorTag).toBe('TaskCard');
    unsubscribe();
  });

  it('update() replaces the value and notifies subscribers; unsubscribe stops notifications', () => {
    const seen: string[] = [];
    const unsubscribe = SettingStore.subscribe((v) =>
      seen.push(v.parsingSettings.indicatorTag)
    );

    SettingStore.update((old) => ({
      ...old,
      parsingSettings: { ...old.parsingSettings, indicatorTag: 'MyTag' }
    }));

    expect(seen).toEqual(['TaskCard', 'MyTag']);
    expect(get(SettingStore).parsingSettings.indicatorTag).toBe('MyTag');
    // the non-mutating update left DefaultSettings untouched
    expect(DefaultSettings.parsingSettings.indicatorTag).toBe('TaskCard');

    unsubscribe();
    SettingStore.set(DefaultSettings);
    expect(seen).toHaveLength(2); // no notification after unsubscribe
  });

  it('set() replaces the whole value for late subscribers', () => {
    const replacement = JSON.parse(JSON.stringify(DefaultSettings));
    replacement.displaySettings.upcomingMinutes = 42;
    SettingStore.set(replacement);
    expect(get(SettingStore).displaySettings.upcomingMinutes).toBe(42);
    expect(DefaultSettings.displaySettings.upcomingMinutes).toBe(15);
  });
});

describe('SettingsTab.display() smoke test', () => {
  /**
   * MOCK GAP workaround: Obsidian's global `createFragment` helper does not
   * exist in jsdom.
   */
  beforeAll(() => {
    (globalThis as any).createFragment = (
      cb?: (frag: any) => void
    ): DocumentFragment => {
      const frag = document.createDocumentFragment() as any;
      frag.appendText = (text: string) =>
        frag.appendChild(document.createTextNode(text));
      frag.createEl = (tag: string, info?: any, cb2?: (el: any) => void) => {
        const el = document.createElement(tag);
        if (info && typeof info === 'object') {
          if (info.text != null) el.textContent = String(info.text);
          if (info.href) el.setAttribute('href', info.href);
        }
        frag.appendChild(el);
        cb2?.(el);
        return el;
      };
      cb?.(frag);
      return frag;
    };
  });

  afterAll(() => {
    delete (globalThis as any).createFragment;
  });

  function makeTab(projects: any[] = []) {
    const fakePlugin: any = {
      projectModule: {
        getProjectsData: jest.fn(() => projects),
        getProjectById: jest.fn(),
        updateProject: jest.fn(),
        deleteProjectById: jest.fn(),
        addProject: jest.fn(() => true)
      },
      settings: JSON.parse(JSON.stringify(DefaultSettings)),
      writeSettings: jest.fn(),
      taskMonitor: {
        monitorVaultToChangeIndicatorTags: jest.fn(),
        monitorVaultToChangeProjects: jest.fn()
      },
      // calendar sync is suspended — the settings tab renders no sync section
      externalAPIManager: null,
      googleCalendarPull: null
    };
    const app = new App() as any;
    return { tab: new SettingsTab(app, fakePlugin), fakePlugin, app };
  }

  it('renders without throwing and registers the expected setting names', () => {
    const { tab } = makeTab();
    const setNameSpy = jest.spyOn(Setting.prototype, 'setName');

    expect(() => tab.display()).not.toThrow();

    const names = setNameSpy.mock.calls.map((call) => call[0]);
    expect(names).toEqual([
      'Indicator tag',
      'Update existing tasks',
      'Write completion date',
      'Display',
      'Default display mode',
      'Upcoming window',
      'Query display mode',
      'Style task metadata in Live Preview',
      'Projects',
      'Add a project',
      'Default project'
    ]);
    expect(tab.containerEl.textContent).toContain(
      'No projects yet — add one above.'
    );
    setNameSpy.mockRestore();
  });

  it('renders a per-project edit row when projects exist', () => {
    const { tab } = makeTab([
      { id: 'p1', name: 'Alpha', color: '#111111' },
      { id: 'p2', name: 'Beta', color: '#222222' }
    ]);
    const setNameSpy = jest.spyOn(Setting.prototype, 'setName');

    expect(() => tab.display()).not.toThrow();

    const names = setNameSpy.mock.calls.map((call) => call[0]);
    expect(names).toEqual(expect.arrayContaining(['Alpha', 'Beta']));
    expect(names).not.toContain('Project name');
    setNameSpy.mockRestore();
  });

  it('Style task metadata in Live Preview toggle calls workspace.updateOptions() on change, so open editors update immediately', async () => {
    const { tab, fakePlugin, app } = makeTab();

    let toggleComponent: any = null;
    const originalAddToggle = Setting.prototype.addToggle;
    const addToggleSpy = jest
      .spyOn(Setting.prototype, 'addToggle')
      .mockImplementation(function (this: any, cb) {
        const result = originalAddToggle.call(this, cb);
        if (this.__name === 'Style task metadata in Live Preview') {
          toggleComponent = this.__components[this.__components.length - 1];
        }
        return result;
      });

    tab.display();
    addToggleSpy.mockRestore();

    expect(toggleComponent).not.toBeNull();
    await toggleComponent.__triggerChange(false);

    expect(fakePlugin.writeSettings).toHaveBeenCalled();
    expect(app.workspace.updateOptions).toHaveBeenCalled();
  });
});

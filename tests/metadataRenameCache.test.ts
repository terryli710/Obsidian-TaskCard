/** @jest-environment jsdom */
// UI rendering is outside this event/cache test. Keep the plugin registration,
// cache, parser and indexed database real; stub only UI adapter boundaries.
jest.mock('../src/renderer/index', () => ({ TaskCardRenderManager: class {}, StaticTaskListRenderManager: class {} }));
jest.mock('../src/renderer/StaticTaskListRenderer', () => ({}));
jest.mock('obsidian-dataview', () => ({ getAPI: jest.fn() }));
import { App, TFile } from 'obsidian';
import { getAPI } from 'obsidian-dataview';
import TaskCardPlugin from '../src/index';

const row = (path: string, text: string) => ({ path, status: ' ', text,
  position: { start: { line: 0, col: 0 }, end: { line: 0, col: text.length + 6 } }
});

// Refreshing just file.path leaves the previous ephemeral-id row behind.
test.each(['', ' ^tc-stable'])('rename event removes old-path query rows for task identity %j', async suffix => {
  const app = new App() as any;
  const plugin = new TaskCardPlugin(app, {} as any);
  const text = `Plan the day #TaskCard${suffix}`;
  const oldPath = 'plans/old.md';
  const newPath = 'archive/new.md';
  const oldFile = app.vault.__setFile(oldPath, `- [ ] ${text}`);
  let values = [row(oldPath, text)];
  (getAPI as jest.Mock).mockReturnValue({ tryQuery: async () => ({ values }) });
  await plugin.cache.taskCache.initializeAndRefreshAllTasks();
  const before = await plugin.cache.taskCache.queryTasks({});
  expect(before).toHaveLength(1);
  expect(before[0].docPosition.filePath).toBe(oldPath);
  plugin.registerEvents();
  await app.vault.delete(oldFile);
  app.vault.__setFile(newPath, `- [ ] ${text}`);
  // Dataview updates the page path before the nested task.path payload.
  values = [row(oldPath, text)];
  const read = jest.spyOn(plugin.fileOperator, 'getFileLines');
  app.metadataCache.trigger('dataview:metadata-change', 'rename', Object.assign(new TFile(), { path: newPath }), oldPath);
  // Dataview emits synchronously, but cache refresh reads/parses asynchronously.
  for (let attempt = 0; attempt < 30; attempt++) {
    await Promise.resolve();
    if ((await plugin.cache.taskCache.queryTasks({ filePathQuery: newPath })).length) break;
  }
  expect(await plugin.cache.taskCache.queryTasks({ filePathQuery: oldPath })).toEqual([]);
  const after = await plugin.cache.taskCache.queryTasks({});
  expect(after).toHaveLength(1);
  expect(after[0].docPosition.filePath).toBe(newPath);
  expect(after[0].content).toBe('Plan the day');
  expect(app.vault.getAbstractFileByPath(oldPath)).toBeNull();
  expect(read).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledWith(newPath);
});

test('a delayed refresh cannot revive the old path and still commits unrelated files from its batch', async () => {
  const app = new App() as any;
  const plugin = new TaskCardPlugin(app, {} as any);
  const oldPath = 'plans/old.md';
  const newPath = 'archive/new.md';
  const otherPath = 'notes/other.md';
  const text = 'Plan the day #TaskCard';
  const otherText = 'Background update #TaskCard';
  const oldFile = app.vault.__setFile(oldPath, `- [ ] ${text}`);
  app.vault.__setFile(otherPath, `- [ ] ${otherText}`);
  let values = [row(oldPath, text)];
  (getAPI as jest.Mock).mockReturnValue({ tryQuery: async () => ({ values }) });
  await plugin.cache.taskCache.initializeAndRefreshAllTasks();

  let releaseRead: (lines: string[]) => void;
  let startedRead: () => void;
  const started = new Promise<void>(resolve => { startedRead = resolve; });
  const delayed = new Promise<string[]>(resolve => { releaseRead = resolve; });
  const read = plugin.fileOperator.getFileLines.bind(plugin.fileOperator);
  plugin.fileOperator.getFileLines = async path => {
    const lines = await read(path);
    if (path === oldPath) {
      startedRead();
      return delayed;
    }
    return lines;
  };
  values = [row(oldPath, text), row(otherPath, otherText)];
  const pending = plugin.cache.taskCache.refreshTasksByFileList([oldPath, otherPath]);
  await started;
  await app.vault.delete(oldFile);
  app.vault.__setFile(newPath, `- [ ] ${text}`);
  values = [row(newPath, text)];
  await plugin.cache.taskCache.refreshTasksByFileList([newPath], [oldPath]);
  releaseRead([`- [ ] ${text}`]);
  await pending;
  const tasks = await plugin.cache.taskCache.queryTasks({});
  expect(tasks.map(task => task.docPosition.filePath).sort()).toEqual([newPath, otherPath]);
  expect(tasks.find(task => task.docPosition.filePath === otherPath)?.content).toBe('Background update');
});

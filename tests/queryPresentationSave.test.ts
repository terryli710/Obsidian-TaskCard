/** @jest-environment jsdom */
import { App, Notice } from 'obsidian';
import { FileOperator } from '../src/renderer/fileOperator';
import { QuerySyncManager } from '../src/query/querySyncManager';

function fixture(content = '```taskcard\neditMode: false\n```\n\n- [ ] Keep this following task #TaskCard ^tc-neighbor') {
  const app = new App();
  (app.vault as any).__setFile('query.md', content);
  const plugin = { app, fileOperator: new FileOperator(null as any, app) } as any;
  // The old rendered section deliberately stays alive with its original span.
  const manager = new QuerySyncManager(plugin, 'taskcard', 'editMode: false', { sectionEl: document.createElement('div'), ctx: { sourcePath: 'query.md', getSectionInfo: () => ({ lineStart: 0, lineEnd: 2 }) } as any, sourcePath: 'query.md', lineStart: 0, lineEnd: 2 });
  return { app, manager, read: () => (app.vault as any).__getContent('query.md') as string };
}

test('rapid option saves replace exactly one current fence and preserve the following task with stale renderer metadata', async () => {
  const { manager, read } = fixture();
  manager.listPresentation = { groupBy: 'project', sortBy: 'original', completedLast: false };
  const first = manager.updateTaskQueryToFile(manager.taskQuery, false);
  await first;
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  manager.listPresentation = { groupBy: 'project', sortBy: 'priority', completedLast: true };
  const second = manager.updateTaskQueryToFile(manager.taskQuery, false);
  await Promise.all([first, second]);
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  expect(read().split('\n').filter(line => line.startsWith('```'))).toHaveLength(2);
  expect(read()).toContain('groupBy: "project"\nsortBy: "priority"\ncompletedLast: true');
  expect(read()).toMatch(/editMode: false\n```\n\n- \[ \] Keep this following task #TaskCard \^tc-neighbor$/);
});

test('a query edited outside the current renderer is left intact and the save failure is reported', async () => {
  const { app, manager, read } = fixture();
  const external = '```taskcard\npriority: [1]\neditMode: false\n```\n\n# Keep this section';
  (app.vault as any).__setFile('query.md', external);
  const notices = (Notice as any).__notices.length;
  manager.listPresentation = { groupBy: 'project', sortBy: 'original', completedLast: false };
  await manager.updateTaskQueryToFile(manager.taskQuery, false);
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  expect(read()).toBe(external);
  expect((Notice as any).__notices.length).toBeGreaterThan(notices);
});

test('a relocated query is found without editing an identical example inside an outer Markdown fence', async () => {
  const example = '````markdown\n```taskcard\neditMode: false\n```\n````';
  const { manager, read } = fixture(example+'\n\n```taskcard\neditMode: false\n```\n\n# After query');
  manager.listPresentation = { groupBy: 'priority', sortBy: 'original', completedLast: false };
  await manager.updateTaskQueryToFile(manager.taskQuery, false);
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  expect(read().startsWith(example+'\n\n')).toBe(true);
  expect(read()).toContain('groupBy: "priority"');
  expect(read()).toMatch(/```\n\n# After query$/);
});


test('overlapping control saves keep the latest settings and an unrelated edit made during disk delay', async () => {
  const { app, manager, read } = fixture();
  const process = app.vault.process.bind(app.vault);
  let resume!: () => void;
  const diskReady = new Promise<void>(resolve => { resume = resolve; });
  jest.spyOn(app.vault, 'process').mockImplementationOnce(async (file, update) => {
    await diskReady;
    return process(file, update);
  });
  manager.listPresentation = { groupBy: 'project', sortBy: 'original', completedLast: false };
  const first = manager.updateTaskQueryToFile(manager.taskQuery, false);
  manager.listPresentation = { groupBy: 'project', sortBy: 'priority', completedLast: true };
  const second = manager.updateTaskQueryToFile(manager.taskQuery, false);
  (app.vault as any).__setFile('query.md', read()+'\n\nAn unrelated appended note.');
  resume();
  await Promise.all([first, second]);
  expect(read()).toContain('groupBy: \"project\"\nsortBy: \"priority\"\ncompletedLast: true');
  expect(read()).toContain('- [ ] Keep this following task #TaskCard ^tc-neighbor');
  expect(read()).toMatch(/An unrelated appended note\.$/);
  expect(read().split('\n').filter(line => line.startsWith('```'))).toHaveLength(2);
});

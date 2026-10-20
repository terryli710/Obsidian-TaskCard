/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { App, Notice } from 'obsidian';
import { writable } from 'svelte/store';
import { TaskFormatter } from '../../src/taskModule/taskFormatter';
import { PositionedObsidianTask } from '../../src/taskModule/task';
import { FileOperator } from '../../src/renderer/fileOperator';
import { fireEvent, loadSvelte, render, srcPath, waitFor } from './testUtils';

let StaticTaskCard: any;
beforeAll(async () => {
  StaticTaskCard = await loadSvelte(srcPath('ui/StaticTaskCard.svelte'));
});

describe.each([true, false])('query completion with persisted identity %s', registered => {
  test.each(['- [ ] ', '* [ ] ', '+ [/] ', '  12. [-]\t', '> > 3) [ ] '])('preserves native prefix %j', async prefix => {
    const app = new App() as any;
    const suffix = registered ? ' ^tc-native01' : '';
    const source = `${prefix}Plan the day #TaskCard${suffix}`;
    app.vault.__setFile('tasks.md', source);
    const plugin = { app } as any;
    plugin.fileOperator = new FileOperator(plugin, app);
    const task = new PositionedObsidianTask({
      id: registered ? 'tc-native01' : 'ephemeral-task', content: 'Plan the day', metadata: { sourceMarkdown: source },
      docPosition: { filePath: 'tasks.md', start: { line: 0, col: 0 }, end: { line: 0, col: source.length } }
    });
    const { container } = render(StaticTaskCard, { taskItem: task, plugin, compact: true });
    await fireEvent.click(container.querySelector('.task-card-checkbox')!);
    const expected = source.replace(/\[[ /-]\]/, '[x]');
    await waitFor(() => expect(app.vault.__getContent('tasks.md')).toBe(expected));
    await fireEvent.click(container.querySelector('.task-card-checkbox')!);
    await waitFor(() => expect(app.vault.__getContent('tasks.md')).toBe(expected.replace('[x]', '[ ]')));
  });
});

async function completionFixture(source: string, current: string, options: { id?: string; sourceBlockId?: string; snapshot?: boolean } = {}) {
  const app = new App() as any;
  app.vault.__setFile('tasks.md', current);
  const plugin = { app } as any;
  plugin.fileOperator = new FileOperator(plugin, app);
  const task = new PositionedObsidianTask({
    id: options.id ?? 'tc-native01', content: 'Plan the day',
    metadata: { sourceMarkdown: options.snapshot === false ? undefined : source, sourceBlockId: options.sourceBlockId },
    docPosition: { filePath: 'tasks.md', start: { line: 0, col: 0 }, end: { line: 0, col: source.length } }
  });
  const { container } = render(StaticTaskCard, { taskItem: task, plugin, compact: true });
  return { app, plugin, task, container };
}

beforeEach(() => { (Notice as any).__notices.length = 0; });

test.each([
  ['missing durable identity', '- [ ] Plan the day #TaskCard ^tc-native01', '- [ ] Another task #TaskCard ^tc-other01', 'tc-native01', undefined, true],
  ['duplicate durable identity', '- [ ] Plan the day #TaskCard ^tc-native01', '- [ ] Plan the day #TaskCard ^tc-native01\n- [ ] Copy #TaskCard ^tc-native01', 'tc-native01', undefined, true],
  ['missing native foreign block identity', '- [ ] Plan the day #TaskCard ^native-block', '- [ ] Another task #TaskCard', 'native-block', 'native-block', true],
  ['changed unregistered source', '* [ ] Plan the day #TaskCard', '* [ ] Another task #TaskCard', 'ephemeral-task', undefined, true],
  ['unregistered source without a snapshot', '* [ ] Plan the day #TaskCard', '* [ ] Plan the day #TaskCard', 'ephemeral-task', undefined, false]
])('completion rejects %s and restores its checkbox', async (_case, source, current, id, sourceBlockId, snapshot) => {
  const fixture = await completionFixture(source as string, current as string, { id: id as string, sourceBlockId: sourceBlockId as string, snapshot: snapshot as boolean });
  await fireEvent.click(fixture.container.querySelector('.task-card-checkbox')!);
  await waitFor(() => expect((Notice as any).__notices.length).toBeGreaterThan(0));
  expect(fixture.app.vault.__getContent('tasks.md')).toBe(current);
  expect(fixture.task.completed).toBe(false);
  expect((fixture.container.querySelector('.task-card-checkbox') as HTMLInputElement).checked).toBe(false);
});

test('completion follows a moved native block ID instead of the cached row', async () => {
  const source = '> 2) [ ] Plan the day #TaskCard ^native-block';
  const first = '- [ ] Another task #TaskCard';
  const { app, container } = await completionFixture(source, `${first}\n${source}`, { id: 'native-block', sourceBlockId: 'native-block' });
  await fireEvent.click(container.querySelector('.task-card-checkbox')!);
  await waitFor(() => expect(app.vault.__getContent('tasks.md')).toBe(`${first}\n> 2) [x] Plan the day #TaskCard ^native-block`));
});

test.each(['source edit', 'duplicate identity'])('completion rejects a concurrent %s after reading the source', async race => {
  const source = '- [ ] Plan the day #TaskCard ^tc-native01';
  const { app, plugin, task, container } = await completionFixture(source, source);
  const current = race === 'source edit' ? '- [ ] Concurrent user edit #TaskCard ^tc-native01' : `${source}\n${source}`;
  const read = plugin.fileOperator.getLineFromFile.bind(plugin.fileOperator);
  plugin.fileOperator.getLineFromFile = async (...args: any[]) => {
    const original = await read(...args);
    app.vault.__setFile('tasks.md', current);
    return original;
  };
  await fireEvent.click(container.querySelector('.task-card-checkbox')!);
  await waitFor(() => expect((Notice as any).__notices.length).toBeGreaterThan(0));
  expect(app.vault.__getContent('tasks.md')).toBe(current);
  expect(task.completed).toBe(false);
  expect((container.querySelector('.task-card-checkbox') as HTMLInputElement).checked).toBe(false);
});


test.each([
  ['longer ID', '- [ ] Other #TaskCard ^tc-native010', 'tc-native01'],
  ['code JSON', '- [ ] Example `{"id":"legacy-id"}` #TaskCard', 'legacy-id'],
  ['fence', '```md\n- [ ] Plan the day #TaskCard ^tc-native01\n```', 'tc-native01'],
  ['comment', '%%\n- [ ] Plan the day #TaskCard ^tc-native01\n%%', 'tc-native01'],
  ['frontmatter', '---\n- [ ] Plan the day #TaskCard ^tc-native01\n---', 'tc-native01']
])('static completion rejects %s', async (_name, current, id) => {
  const source = id === 'legacy-id'
    ? '- [ ] Plan the day #TaskCard <span style="display:none">{"id":"legacy-id"}</span>'
    : '- [ ] Plan the day #TaskCard ^tc-native01';
  const { app, task, container } = await completionFixture(source, current, { id });
  await fireEvent.click(container.querySelector('.task-card-checkbox')!);
  await waitFor(() => expect((Notice as any).__notices.length).toBeGreaterThan(0));
  expect(app.vault.__getContent('tasks.md')).toBe(current);
  expect(task.completed).toBe(false);
  expect(container.querySelector('input')).not.toBeChecked();
});

test('a successful static recurring completion clears the original rule for repeated toggles', async () => {
  const source = '- [ ] Plan the day #TaskCard [scheduled:: 2026-07-06] [repeat:: every week] ^tc-native01';
  const { app, plugin, task, container } = await completionFixture(source, source);
  plugin.taskFormatter = new TaskFormatter(writable({ parsingSettings: { indicatorTag: 'TaskCard' } }) as any);
  task.recurrence = 'every week';
  task.schedule = { isRecurring: false, date: '2026-07-06', string: '2026-07-06' };
  await fireEvent.click(container.querySelector('.task-card-checkbox')!);
  await waitFor(() => expect(app.vault.__getContent('tasks.md').split('\n')).toHaveLength(2));
  expect(task.recurrence).toBeNull();
  expect(task.metadata.sourceMarkdown).not.toContain('[repeat::');
  await fireEvent.click(container.querySelector('.task-card-checkbox')!);
  await waitFor(() => expect(app.vault.__getContent('tasks.md')).toMatch(/^- \[ \]/));
  await fireEvent.click(container.querySelector('.task-card-checkbox')!);
  await waitFor(() => expect(app.vault.__getContent('tasks.md')).toMatch(/^- \[x\]/));
  expect(app.vault.__getContent('tasks.md').split('\n')).toHaveLength(2);
  expect((app.vault.__getContent('tasks.md').match(/every week/g) ?? []).length).toBe(1);
});


test('static completion revalidates context inside the atomic callback', async () => {
  const source = '- [ ] Plan the day #TaskCard ^tc-native01';
  const { app, task, container } = await completionFixture(source, source);
  const current = '```md\n' + source + '\n```';
  app.vault.process = async (_file: any, transform: (source: string) => string) => {
    app.vault.__setFile('tasks.md', current);
    return transform(current);
  };
  await fireEvent.click(container.querySelector('.task-card-checkbox')!);
  await waitFor(() => expect((Notice as any).__notices.length).toBeGreaterThan(0));
  expect(app.vault.__getContent('tasks.md')).toBe(current);
  expect(task.completed).toBe(false);
});

test('static completion refuses an unchanged ID-less cached row in a fence', async () => {
  const source = '- [ ] Plan the day #TaskCard';
  const current = '```md\n' + source + '\n```';
  const { app, task, container } = await completionFixture(source, current, { id: 'ephemeral-task' });
  task.docPosition.start.line = 1;
  await fireEvent.click(container.querySelector('.task-card-checkbox')!);
  await waitFor(() => expect((Notice as any).__notices.length).toBeGreaterThan(0));
  expect(app.vault.__getContent('tasks.md')).toBe(current);
  expect(task.completed).toBe(false);
});

test('static completion relocates a real legacy hidden-span identity', async () => {
  const source = '- [ ] Plan the day #TaskCard <span style="display:none">{"id":"legacy-id"}</span>';
  const { app, container } = await completionFixture(source, 'Intro\n\n' + source, { id: 'legacy-id' });
  await fireEvent.click(container.querySelector('.task-card-checkbox')!);
  await waitFor(() => expect(app.vault.__getContent('tasks.md')).toBe('Intro\n\n' + source.replace('[ ]', '[x]')));
});

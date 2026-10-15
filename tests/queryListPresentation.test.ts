import { PositionedObsidianTask } from '../src/taskModule/task';
import { organizeTaskList } from '../src/query/listPresentation';

function task(id: string, props: any = {}) {
  return new PositionedObsidianTask({ id, content: id, ...props });
}

test('default presentation preserves incoming task order, references, and empty results', () => {
  const low = task('low', { priority: 4 });
  const high = task('high', { priority: 1, completed: true });
  const incoming = [low, high];
  const groups = organizeTaskList(incoming);
  expect(groups).toHaveLength(1);
  expect(groups[0].tasks).toEqual([low, high]);
  expect(groups[0].tasks[0]).toBe(low);
  expect(incoming).toEqual([low, high]);
  expect(organizeTaskList([])).toEqual([]);
});

test('importance order uses the canonical scale, keeps ties stable, and never mutates input', () => {
  const incoming = [task('low'), task('high-a', { priority: 2 }), task('highest', { priority: 1 }), task('high-b', { priority: 2 }), task('medium', { priority: 3 })];
  const before = [...incoming];
  expect(organizeTaskList(incoming, { sortBy: 'priority' })[0].tasks.map(t => t.id)).toEqual(['highest', 'high-a', 'high-b', 'medium', 'low']);
  expect(incoming).toEqual(before);
});

test('due dates sort by calendar day, with invalid and absent dates last and stable', () => {
  const incoming = [task('no-date'), task('later', { due: { date: '2026-10-20', isRecurring: false } }), task('first', { due: { date: '2026-10-16', isRecurring: false } }), task('invalid', { due: { date: '2026-02-30', isRecurring: false } }), task('tie', { due: { date: '2026-10-16', time: '09:00', isRecurring: false } })];
  expect(organizeTaskList(incoming, { sortBy: 'due' })[0].tasks.map(t => t.id)).toEqual(['first', 'tie', 'later', 'no-date', 'invalid']);
});

test('project groups use names, keep unassigned last, and never merge a real No project project', () => {
  const incoming = [task('none'), task('b', { project: { id: 'b', name: 'Beta' } }), task('named-none', { project: { id: 'n', name: 'No project' } }), task('a1', { project: { id: 'a1', name: 'Alpha' } }), task('a2', { project: { id: 'a2', name: 'Alpha' } })];
  const groups = organizeTaskList(incoming, { groupBy: 'project' });
  expect(groups.map(g => g.label)).toEqual(['Alpha', 'Beta', 'No project', 'No project']);
  expect(groups.map(g => g.tasks.map(t => t.id))).toEqual([['a1', 'a2'], ['b'], ['named-none'], ['none']]);
  expect(new Set(groups.map(g => g.key)).size).toBe(4);
});

test('importance groups sort from Highest to Low and completed-last applies within each group', () => {
  const incoming = [task('low'), task('high-done', { priority: 2, completed: true }), task('highest', { priority: 1 }), task('high', { priority: 2 })];
  const groups = organizeTaskList(incoming, { groupBy: 'priority', completedLast: true });
  expect(groups.map(g => g.label)).toEqual(['Highest', 'High', 'Low']);
  expect(groups.map(g => g.tasks.map(t => t.id))).toEqual([['highest'], ['high', 'high-done'], ['low']]);
});

test('title sorting can be combined with completed-last without moving tasks between projects', () => {
  const project = { id: 'work', name: 'Work' };
  const incoming = [task('z', { content: 'Zebra', project }), task('done', { content: 'Apple', completed: true, project }), task('a', { content: 'Alpha', project })];
  expect(organizeTaskList(incoming, { groupBy: 'project', sortBy: 'title', completedLast: true })[0].tasks.map(t => t.id)).toEqual(['a', 'z', 'done']);
});

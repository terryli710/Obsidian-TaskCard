import type { PositionedObsidianTask } from '../taskModule/task';

export type ListGroupBy = 'none' | 'project' | 'priority';
export type ListSortBy = 'original' | 'priority' | 'due' | 'title';

export interface ListPresentation {
  groupBy: ListGroupBy;
  sortBy: ListSortBy;
  completedLast: boolean;
}

export interface TaskListGroup {
  key: string;
  label: string;
  tasks: PositionedObsidianTask[];
}

export function normalizeListPresentation(value?: unknown): ListPresentation {
  const options = value && typeof value === 'object'
    ? value as Partial<ListPresentation> : {};
  return {
    groupBy: options.groupBy === 'project' || options.groupBy === 'priority'
      ? options.groupBy : 'none',
    sortBy: options.sortBy === 'priority' || options.sortBy === 'due' || options.sortBy === 'title'
      ? options.sortBy : 'original',
    completedLast: options.completedLast === true
  };
}

const importanceNames = ['Highest', 'High', 'Medium', 'Low'];

function priority(task: PositionedObsidianTask): number {
  return Number.isInteger(task.priority) && task.priority >= 1 && task.priority <= 4
    ? task.priority : 4;
}

function dueDay(task: PositionedObsidianTask): string {
  const date = task.due?.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : '';
}

/** Arrange existing task references for display without changing source order. */
export function organizeTaskList(
  taskList: PositionedObsidianTask[],
  options?: Partial<ListPresentation>
): TaskListGroup[] {
  const { groupBy, sortBy, completedLast } = normalizeListPresentation(options);
  const groups = new Map<string, TaskListGroup>();
  for (const task of taskList) {
    let key = 'all';
    let label = '';
    if (groupBy === 'project') {
      const name = task.project?.name?.trim();
      key = name ? `project:${name}` : 'unassigned';
      label = name || 'No project';
    } else if (groupBy === 'priority') {
      key = String(priority(task));
      label = importanceNames[priority(task) - 1];
    }
    if (!groups.has(key)) groups.set(key, { key, label, tasks: [] });
    groups.get(key)!.tasks.push(task);
  }

  const result = [...groups.values()];
  if (groupBy === 'project') {
    result.sort((a, b) => a.key === 'unassigned' ? 1 : b.key === 'unassigned' ? -1 : a.label.localeCompare(b.label));
  } else if (groupBy === 'priority') {
    result.sort((a, b) => Number(a.key) - Number(b.key));
  }

  for (const group of result) {
    group.tasks = group.tasks.map((task, index) => ({ task, index })).sort((a, b) => {
      if (completedLast && a.task.completed !== b.task.completed) return a.task.completed ? 1 : -1;
      let order = 0;
      if (sortBy === 'priority') order = priority(a.task) - priority(b.task);
      else if (sortBy === 'title') order = a.task.content.localeCompare(b.task.content);
      else if (sortBy === 'due') {
        const left = dueDay(a.task), right = dueDay(b.task);
        order = left && right ? left.localeCompare(right) : left ? -1 : right ? 1 : 0;
      }
      return order || a.index - b.index;
    }).map(({ task }) => task);
  }
  return result;
}

import { writable } from 'svelte/store';
import { ObsidianTask } from '../src/taskModule/task';
import { TaskFormatter } from '../src/taskModule/taskFormatter';

describe('taskToMarkdown (v2 field format)', () => {
  let mockSettingStore;
  let taskFormatter: TaskFormatter;

  beforeEach(() => {
    // Mock the SettingStore with controlled settings
    mockSettingStore = writable({
      parsingSettings: {
        indicatorTag: 'TaskCard',
        markdownSuffix: ' .',
        writeCompletionDate: true
      },
      displaySettings: {
        defaultMode: 'single-line',
        upcomingMinutes: 15,
        queryDisplayMode: 'line',
        styleMetadataInLivePreview: true,
      }
    });
    taskFormatter = new TaskFormatter(mockSettingStore);
  });

  it('should format a basic task with content and completion status', () => {
    const task = new ObsidianTask({
      content: 'An example task',
      completed: false
    });
    const result = taskFormatter.taskToMarkdown(task);
    expect(result).toContain('- [ ] An example task');
  });

  it('should never write hidden HTML or the legacy suffix', () => {
    const task = new ObsidianTask({
      content: 'An example task',
      completed: false,
      priority: 1,
      project: { id: 'project-123', name: 'Project Name' }
    });
    const result = taskFormatter.taskToMarkdown(task);
    expect(result).not.toContain('<span');
    expect(result).not.toContain('display:none');
    expect(result).not.toMatch(/ \.$/);
  });

  it('should end the line with a minted tc- block id and mutate the task id', () => {
    const task = new ObsidianTask({ content: 'An example task' });
    const result = taskFormatter.taskToMarkdown(task);
    expect(result).toMatch(/ \^tc-[a-z0-9]{6}$/);
    expect(result).toContain(`^${task.id}`);
  });

  it('should keep an existing v2 id instead of minting a new one', () => {
    const task = new ObsidianTask({ content: 'An example task', id: 'tc-abc123' });
    const result = taskFormatter.taskToMarkdown(task);
    expect(result).toMatch(/ \^tc-abc123$/);
  });

  it('taskToLine({ mintId: false }) should omit the block id and leave the task without a v2 id', () => {
    const task = new ObsidianTask({ content: 'An example task' });
    const result = taskFormatter.taskToLine(task, { mintId: false });
    expect(result).not.toContain('^');
    expect(task.id).not.toMatch(/^tc-/);
  });

  it('taskToLine({ mintId: false }) should still show an already-minted v2 id', () => {
    const task = new ObsidianTask({ content: 'An example task', id: 'tc-abc123' });
    const result = taskFormatter.taskToLine(task, { mintId: false });
    expect(result).toMatch(/ \^tc-abc123$/);
  });

  it('should write priority as the Tasks vocabulary and omit the default', () => {
    const p1 = taskFormatter.taskToMarkdown(new ObsidianTask({ content: 'x', priority: 1 }));
    const p2 = taskFormatter.taskToMarkdown(new ObsidianTask({ content: 'x', priority: 2 }));
    const p3 = taskFormatter.taskToMarkdown(new ObsidianTask({ content: 'x', priority: 3 }));
    const p4 = taskFormatter.taskToMarkdown(new ObsidianTask({ content: 'x', priority: 4 }));
    expect(p1).toContain('[priority:: highest]');
    expect(p2).toContain('[priority:: high]');
    expect(p3).toContain('[priority:: medium]');
    expect(p4).not.toContain('[priority::');
  });

  it('should format a task with description', () => {
    const task = new ObsidianTask({
      content: 'An example task',
      completed: false,
      description: '- A multi line description.\n- the second line.'
    });
    const result = taskFormatter.taskToMarkdown(task);
    // description lines are written indented by 4 spaces under the task line
    expect(result).toContain(
      '    - A multi line description.\n    - the second line.'
    );
  });

  it('should not persist machine bookkeeping (order/sectionID/metadata)', () => {
    const task = new ObsidianTask({
      content: 'An example task',
      order: 1,
      sectionID: 'section-456',
      metadata: { filePath: '/path/to/file' }
    });
    const result = taskFormatter.taskToMarkdown(task);
    expect(result).not.toContain('order');
    expect(result).not.toContain('section-456');
    expect(result).not.toContain('filePath');
  });

  it('should format a task with project as a name-only field', () => {
    const task = new ObsidianTask({
      content: 'An example task',
      completed: false,
      project: { id: 'project-123', name: 'Project Name' }
    });
    const result = taskFormatter.taskToMarkdown(task);
    expect(result).toContain('[project:: Project Name]');
    expect(result).not.toContain('project-123');
  });

  it('should format a task with labels', () => {
    const task = new ObsidianTask({
      content: 'An example task',
      completed: false,
      labels: ['#label1', '#label2']
    });
    const result = taskFormatter.taskToMarkdown(task);
    expect(result).toContain('#label1 #label2');
  });

  it('should format schedule and due dates as Tasks-compatible fields', () => {
    const task = new ObsidianTask({
      content: 'An example task',
      completed: false,
      schedule: {
        isRecurring: false,
        date: '2024-08-15',
        string: '2023-08-15',
        timezone: null
      },
      due: {
        isRecurring: false,
        date: '2024-08-20',
        time: '14:30',
        string: '2024-08-20 14:30'
      }
    });
    const result = taskFormatter.taskToMarkdown(task);
    expect(result).toContain('[scheduled:: 2024-08-15]');
    expect(result).toContain('[due:: 2024-08-20T14:30]');
  });

  it('should format duration and recurrence fields', () => {
    const task = new ObsidianTask({
      content: 'An example task',
      duration: { hours: 1, minutes: 30 },
      recurrence: 'every week'
    });
    const result = taskFormatter.taskToMarkdown(task);
    expect(result).toContain('[duration:: 1h30m]');
    expect(result).toContain('[repeat:: every week]');
  });

  it('should stamp completion date for completed tasks when enabled', () => {
    const task = new ObsidianTask({
      content: 'An example task',
      completed: true,
      completionDate: '2026-07-07'
    });
    const result = taskFormatter.taskToMarkdown(task);
    expect(result).toContain('- [x]');
    expect(result).toContain('[completion:: 2026-07-07]');
  });

  it('should omit the completion stamp when the setting is off', () => {
    mockSettingStore.update((old) => {
      old.parsingSettings.writeCompletionDate = false;
      return old;
    });
    const task = new ObsidianTask({
      content: 'An example task',
      completed: true,
      completionDate: '2026-07-07'
    });
    const result = taskFormatter.taskToMarkdown(task);
    expect(result).not.toContain('[completion::');
  });

  it('should re-emit preserved foreign fields verbatim', () => {
    const task = new ObsidianTask({
      content: 'An example task',
      metadata: { foreignFields: ['[start:: 2024-08-01]', '[custom:: value]'] }
    });
    const result = taskFormatter.taskToMarkdown(task);
    expect(result).toContain('[start:: 2024-08-01] [custom:: value]');
  });
});

import { writable } from 'svelte/store';
import { ObsidianTask } from '../src/taskModule/task';
import { TaskFormatter } from '../src/taskModule/taskFormatter';

describe('taskToMarkdown', () => {
  let mockSettingStore;
  let taskFormatter: TaskFormatter;

  beforeEach(() => {
    // Mock the SettingStore with controlled settings
    mockSettingStore = writable({
      parsingSettings: {
        indicatorTag: 'TaskCard',
        markdownSuffix: ' .',
      },
      displaySettings: {
        defaultMode: 'single-line',
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
    expect(result).toContain('- [ ] An example task #TaskCard\n<span style="display:none">{}</span>\n');
  });

  it('should format a task with priority', () => {
    const task = new ObsidianTask({
      content: 'An example task',
      completed: false,
      priority: 4
    });
    const result = taskFormatter.taskToMarkdown(task);
    expect(result).toContain('<span style="display:none">{"priority":4}</span>\n');
  });

  it('should format a task with description', () => {
    const task = new ObsidianTask({
      content: 'An example task',
      completed: false,
      description: '- A multi line description.\n- the second line.'
    });
    const result = taskFormatter.taskToMarkdown(task);
    expect(result).toContain('<span style="display:none">{"description":"- A multi line description.\\n- the second line."}</span>\n');
  });

  it('should format a task with order', () => {
    const task = new ObsidianTask({
      content: 'An example task',
      completed: false,
      order: 1
    });
    const result = taskFormatter.taskToMarkdown(task);
    expect(result).toContain('<span style="display:none">{"order":1}</span>\n');
  });

  it('should format a task with project', () => {
    const task = new ObsidianTask({
      content: 'An example task',
      completed: false,
      project: { id: 'project-123', name: 'Project Name' }
    });
    const result = taskFormatter.taskToMarkdown(task);
    expect(result).toContain('<span style="display:none">{"project":{"id":"project-123","name":"Project Name"}}</span>\n');
  });

  it('should format a task with sectionID', () => {
    const task = new ObsidianTask({
      content: 'An example task',
      completed: false,
      sectionID: 'section-456'
    });
    const result = taskFormatter.taskToMarkdown(task);
    expect(result).toContain('<span style="display:none">{"sectionID":"section-456"}</span>\n');
  });

  it('should format a task with labels', () => {
    const task = new ObsidianTask({
      content: 'An example task',
      completed: false,
      labels: ['#label1', '#label2']
    });
    const result = taskFormatter.taskToMarkdown(task);
    expect(result).toContain('#label1 #label2 #TaskCard\n<span style="display:none">{}</span>\n');
  });

  it('should format a task with due date', () => {
    const task = new ObsidianTask({
      content: 'An example task',
      completed: false,
      due: {
        isRecurring: false,
        date: '2024-08-15',
        string: '2023-08-15',
        timezone: null
      }
    });
    const result = taskFormatter.taskToMarkdown(task);
    expect(result).toContain('<span style="display:none">{"due":{"isRecurring":false,"date":"2024-08-15","string":"2023-08-15","timezone":null}}</span>\n');
  });

  it('should format a task with metadata', () => {
    const task = new ObsidianTask({
      content: 'An example task',
      completed: false,
      metadata: { filePath: '/path/to/file' }
    });
    const result = taskFormatter.taskToMarkdown(task);
    expect(result).toContain('<span style="display:none">{"metadata":{"filePath":"/path/to/file"}}</span>\n');
  });
});

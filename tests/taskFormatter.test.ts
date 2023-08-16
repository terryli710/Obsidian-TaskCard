


import { writable } from 'svelte/store';
import { ObsidianTask } from '../src/taskModule/task';
import { TaskFormatter } from '../src/taskModule/taskFormatter';


describe('taskToMarkdown', () => {

    let mockSettingStore;
    let taskFormatter;

    beforeEach(() => {
        // Mock the SettingStore with controlled settings
        mockSettingStore = writable({
            parsingSettings: {
                indicatorTag: 'TaskCard',
            }
        });
        taskFormatter = new TaskFormatter(mockSettingStore);
    });

    it('should format a basic task with content and completion status', () => {
        const task = new ObsidianTask({
            content: 'An example task',
            completed: false,
        });
        const result = taskFormatter.taskToMarkdown(task);
        expect(result).toContain('- [ ] An example task #TaskCard\n');
    });

    it('should format a task with priority', () => {
        const task = new ObsidianTask({
            content: 'An example task',
            completed: false,
            priority: 4,
        });
        const result = taskFormatter.taskToMarkdown(task);
        expect(result).toContain('<span class="priority" style="display:none;">"4"</span>\n');
    });

    it('should format a task with description', () => {
        const task = new ObsidianTask({
            content: 'An example task',
            completed: false,
            description: '- A multi line description.\n- the second line.',
        });
        const result = taskFormatter.taskToMarkdown(task);
        expect(result).toContain('<span class="description" style="display:none;">"- A multi line description.\\n- the second line."</span>\n');
    });

    it('should format a task with order', () => {
        const task = new ObsidianTask({
            content: 'An example task',
            completed: false,
            order: 1,
        });
        const result = taskFormatter.taskToMarkdown(task);
        expect(result).toContain('<span class="order" style="display:none;">"1"</span>\n');
    });

    it('should format a task with project', () => {
        const task = new ObsidianTask({
            content: 'An example task',
            completed: false,
            project: { id: 'project-123', name: 'Project Name' },
        });
        const result = taskFormatter.taskToMarkdown(task);
        expect(result).toContain('<span class="project" style="display:none;">{"id":"project-123","name":"Project Name"}</span>\n');
    });

    it('should format a task with sectionID', () => {
        const task = new ObsidianTask({
            content: 'An example task',
            completed: false,
            sectionID: 'section-456',
        });
        const result = taskFormatter.taskToMarkdown(task);
        expect(result).toContain('<span class="section-id" style="display:none;">"section-456"</span>\n');
    });

    it('should format a task with labels', () => {
        const task = new ObsidianTask({
            content: 'An example task',
            completed: false,
            labels: ['label1', 'label2'],
        });
        const result = taskFormatter.taskToMarkdown(task);
        expect(result).toContain('<span class="labels" style="display:none;">["label1","label2"]</span>\n');
    });

    it('should format a task with due date', () => {
        const task = new ObsidianTask({
            content: 'An example task',
            completed: false,
            due: {
            isRecurring: false,
            date: '2024-08-15',
            string: '2023-08-15',
            timezone: null,
            },
        });
        const result = taskFormatter.taskToMarkdown(task);
        expect(result).toContain('<span class="due" style="display:none;">{"isRecurring":false,"date":"2024-08-15","string":"2023-08-15","timezone":null}</span>\n');
    });

    it('should format a task with metadata', () => {
        const task = new ObsidianTask({
            content: 'An example task',
            completed: false,
            metadata: { filePath: '/path/to/file' },
        });
        const result = taskFormatter.taskToMarkdown(task);
        expect(result).toContain('<span class="metadata" style="display:none;">{"filePath":"/path/to/file"}</span>\n');
    });
});

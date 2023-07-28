
import { ObsidianTask, DueDate } from '../src/taskModule/task';

describe('ObsidianTask', () => {
    it('should correctly convert to and from Markdown', () => {
        // Create a new ObsidianTask instance
        const originalTask = new ObsidianTask();
        originalTask.content = 'Test task';
        originalTask.priority = 1;
        originalTask.description = 'Test description';
        originalTask.order = 0;
        originalTask.projectID = 'test-project';
        originalTask.sectionID = 'test-section';
        originalTask.labels = ['test-label'];
        originalTask.completed = false;
        originalTask.parent = null;
        originalTask.children = [];
        originalTask.due = null;
        originalTask.filePath = 'test-path';

        // Convert it to a Markdown line
        const markdownLine = originalTask.toMarkdownLine();

        // Convert it back to an ObsidianTask
        const convertedTask = ObsidianTask.fromMarkdownLine(markdownLine);

        // Check if the converted task equals the original one
        expect(convertedTask).toEqual(originalTask);
    });
});
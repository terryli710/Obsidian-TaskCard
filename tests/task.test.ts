
import { ObsidianTask, DueDate } from '../src/taskModule/task';

// describe('ObsidianTask', () => {
//     it('should correctly convert to and from Markdown', () => {
//         // Create a new ObsidianTask instance
//         const originalTask = new ObsidianTask();
//         originalTask.content = 'Test task';
//         originalTask.priority = 2;
//         originalTask.description = 'Test description';
//         originalTask.order = 0;
//         originalTask.project = { id: 'test-id', name: 'test-name' };
//         originalTask.sectionID = 'test-section';
//         originalTask.labels = ['test-label', 'another-label'];
//         originalTask.completed = false;
//         originalTask.parent = null;
//         originalTask.children = [];
//         originalTask.due = null;
//         originalTask.metadata = {};

//         // Convert it to a Markdown line
//         const markdownLine = originalTask.toMarkdownLine();

//         // Convert it back to an ObsidianTask
//         const convertedTask = ObsidianTask.fromMarkdownLine(markdownLine);

//         // Check if the converted task equals the original one
//         expect(convertedTask).toEqual(originalTask);
//     });


//     it('should correctly convert to and from Markdown', () => {
//         const taskMarkdown = '<div class="obsidian-taskcard task-list-item"> <div style="display:flex;"> <input type="checkbox"> <span> This is a dummy task </span> </div> <span class="content" style="display:none;">"This is a dummy task"</span> <span class="priority" style="display:none;">4</span> <span class="description" style="display:none;">"- This is a description of the dummy task. \n- very long descriptionvery long descriptionvery long descriptionvery long descriptionvery long descriptionvery long descriptionvery long descriptionvery long descriptionvery long descriptionvery long descriptionvery long descriptionvery long descriptionvery long description"</span> <span class="order" style="display:none;">1</span> <span class="project" style="display:none;">"{\"id\":\"project-123\", \"name\":\"Project Name\"}"</span> <span class="section-id" style="display:none;">"section-456"</span> <span class="labels" style="display:none;">["label1","label2","label3","label4","label5"]</span> <span class="completed" style="display:none;">false</span> <span class="parent" style="display:none;">null</span> <span class="children" style="display:none;">[]</span> <span class="due" style="display:none;">"{\"isRecurring\":false,\"string\":\"2023-08-15\",\"date\":\"2024-08-15\",\"datetime\":null,\"timezone\":null}"</span> <span class="file-path" style="display:none;">"/path/to/file"</span> </div>';
//         const task = ObsidianTask.fromMarkdownLine(taskMarkdown);
//         const convertedTaskMarkdown = task.toMarkdownLine();
//         expect(convertedTaskMarkdown).toEqual(taskMarkdown);
//     })
// });
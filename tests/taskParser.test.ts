
import { taskParser } from "../src/taskModule/taskParser";
import { ObsidianTask } from "../src/taskModule/task";
import { JSDOM } from 'jsdom';

describe('taskParser', () => {
    describe('parseTaskEl', () => {
        it('should parse a task element correctly', () => {
            // Create a test task element using the example task HTML structure
            const dom = new JSDOM();
            const document = dom.window.document;

            const taskElement = document.createElement('div');
            taskElement.className = 'cm-active HyperMD-list-line HyperMD-list-line-1 HyperMD-task-line cm-line';
            taskElement.setAttribute('data-task', ' ');
            taskElement.style.textIndent = '-23px';
            taskElement.style.paddingInlineStart = '27px';

            const createImg = () => {
            const img = document.createElement('img');
            img.className = 'cm-widgetBuffer';
            img.setAttribute('aria-hidden', 'true');
            return img;
            };

            const createSpanWithEmbed = (className: string, content: string) => {
            const span = document.createElement('span');
            span.className = 'cm-html-embed';
            span.tabIndex = -1;
            span.contentEditable = 'false';
            span.innerHTML = `<span style="display:none;" class="${className}">${content}</span>`;
            return span;
            };

            const label = document.createElement('label');
            label.className = 'task-list-label';
            label.contentEditable = 'false';

            const checkbox = document.createElement('input');
            checkbox.className = 'task-list-item-checkbox';
            checkbox.type = 'checkbox';
            checkbox.setAttribute('data-task', ' ');

            label.appendChild(checkbox);

            const taskContentSpan = document.createElement('span');
            taskContentSpan.className = 'cm-list-1';
            taskContentSpan.textContent = ' An example task ';

            taskElement.appendChild(createImg());
            taskElement.appendChild(document.createElement('span'));
            taskElement.appendChild(createImg());
            taskElement.appendChild(createImg());
            taskElement.appendChild(label);
            taskElement.appendChild(createImg());
            taskElement.appendChild(taskContentSpan);
            taskElement.appendChild(createImg());
            taskElement.appendChild(createSpanWithEmbed('priority', '4'));
            taskElement.appendChild(createImg());
            taskElement.appendChild(document.createElement('span'));
            taskElement.appendChild(createImg());
            taskElement.appendChild(createSpanWithEmbed('description', '"- A multi line description.\\n- the second line."'));
            taskElement.appendChild(createImg());
            taskElement.appendChild(document.createElement('span'));
            taskElement.appendChild(createImg());
            taskElement.appendChild(createSpanWithEmbed('order', '1'));
            taskElement.appendChild(createImg());
            taskElement.appendChild(document.createElement('span'));
            taskElement.appendChild(createImg());
            taskElement.appendChild(createSpanWithEmbed('project', '{"id":"project-123", "name":"Project Name"}'));
            taskElement.appendChild(createImg());
            taskElement.appendChild(document.createElement('span'));
            taskElement.appendChild(createImg());
            taskElement.appendChild(createSpanWithEmbed('section-id', '"section-456"'));
            taskElement.appendChild(createImg());
            taskElement.appendChild(document.createElement('span'));
            taskElement.appendChild(createImg());
            taskElement.appendChild(createSpanWithEmbed('labels', '["label1","label2","label3","label4","label5"]'));
            taskElement.appendChild(createImg());
            taskElement.appendChild(document.createElement('span'));
            taskElement.appendChild(createImg());
            taskElement.appendChild(createSpanWithEmbed('completed', 'false'));

            // Expected task object
            const expectedTask: ObsidianTask = {
                id: '',
                content: 'An example task',
                priority: 4,
                description: '- A multi line description.\n- the second line.',
                order: 1,
                project: { id: 'project-123', name: 'Project Name' },
                sectionID: 'section-456',
                labels: ['label1', 'label2', 'label3', 'label4', 'label5'],
                completed: false,
                parent: null,
                children: [],
                due: null,
                metadata: {}
                // Add other properties as needed
            };

            // Call the parseTaskEl method
            const parsedTask = taskParser.parseTaskEl(taskElement);

            // Assert that the parsed task matches the expected task object
            expect(parsedTask).toEqual(expectedTask);
        });
    });
});
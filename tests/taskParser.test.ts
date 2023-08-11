
import { TaskParser } from "../src/taskModule/taskParser";
import { ObsidianTask, DateOnly } from '../src/taskModule/task';
import { JSDOM } from 'jsdom';
import { logger } from "../src/utils/log";
import { writable } from "svelte/store";
import { Project, ProjectModule } from "../src/taskModule/project";

describe('taskParser', () => {

    let warnSpy, errorSpy, debugSpy, infoSpy;

    beforeEach(() => {
        warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
        errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
        debugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {});
        infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
        warnSpy.mockRestore();
        errorSpy.mockRestore();
        debugSpy.mockRestore();
        infoSpy.mockRestore();
    });
    
    let mockProjectModule;
    let mockSettingStore;
    let taskParser;
    let projects: Project[];
    beforeEach(() => {
        // Mock the SettingStore with controlled settings
        mockSettingStore = writable({
            parsingSettings: {
                indicatorTag: 'TaskCard',
                markdownStartingNotation: '%%*',
                markdownEndingNotation: '*%%'
            }
        });

        projects = [
            {
                id: 'project-123',
                name: 'Project Name'
            },
            {
                id: 'project-456',
                name: 'ProjectX'
            }
        ]
        mockProjectModule = new ProjectModule()
        mockProjectModule.updateProjects(projects);

        taskParser = new TaskParser(mockSettingStore, mockProjectModule);
    });    


    
    describe('parseTaskEl', () => {
        it('should parse a task element correctly', () => {
            // Create a test task element using the example task HTML structure
            const dom = new JSDOM();
            const document = dom.window.document;

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

            const taskElement = document.createElement('div');
            taskElement.className = 'cm-active HyperMD-list-line HyperMD-list-line-1 HyperMD-task-line cm-line';
            taskElement.setAttribute('data-task', ' ');
            taskElement.style.textIndent = '-23px';
            taskElement.style.paddingInlineStart = '27px';

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

        it('should parse another task element correctly', () => {
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
            checkbox.setAttribute('data-task', 'x');

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
            taskElement.appendChild(createSpanWithEmbed('priority', '2'));
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
            taskElement.appendChild(createSpanWithEmbed('due', '{"isRecurring":false, "string":"next monday", "date":"2023-02-15"}'));
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

            // Expected task object
            const expectedTask: ObsidianTask = {
                id: '',
                content: 'An example task',
                priority: 2,
                description: '- A multi line description.\n- the second line.',
                order: 1,
                project: null,
                sectionID: 'section-456',
                labels: ['label1', 'label2', 'label3', 'label4', 'label5'],
                completed: true,
                parent: null,
                children: [],
                due: {isRecurring: false, string:"next monday", date: "2023-02-15"},
                metadata: {}
                // Add other properties as needed
            };

            // Call the parseTaskEl method
            const parsedTask = taskParser.parseTaskEl(taskElement);

            // Assert that the parsed task matches the expected task object
            expect(parsedTask).toEqual(expectedTask);
        });
    });


    describe('parseTaskMarkdown', () => {

        // 1. Parsing a simple task without any attributes.
        it('should parse a simple task without attributes correctly', () => {
            const taskMarkdown = "- [ ] A simple task";
            
            const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

            const expectedTask: Partial<ObsidianTask> = {
                content: "A simple task",
                completed: false,
            };

            expect(parsedTask).toMatchObject(expectedTask);
        });

        // 2. Parsing a task with a completed checkbox with labels.
        it('should parse a task with a completed checkbox correctly', () => {
            const taskMarkdown = "- [x] A completed task with #some #Labels #one-more-label";
            
            const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

            const expectedTask: Partial<ObsidianTask> = {
                content: "A completed task with",
                completed: true,
                labels: ["some", "Labels", "one-more-label"]
            };

            expect(parsedTask).toMatchObject(expectedTask);
        });

        // 2.5 the indicatorTag will be removed from labels
        it('task with labels: the indicatorTag will be removed from labels', () => {
            const taskMarkdown = "- [x] A completed task with #labels #TaskCard";

            const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

            const expectedTask: Partial<ObsidianTask> = {
                content: "A completed task with",
                completed: true,
                labels: ["labels"]
            }
            expect(parsedTask).toMatchObject(expectedTask);
        })

        // 3. Parsing a task with a `due` attribute.
        it('should parse a task with a due attribute correctly', () => {
            const taskMarkdown = "- [ ] Task with due date %%*due:2023-08-05*%%";
            
            const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

            const expectedTask: Partial<ObsidianTask> = {
                content: "Task with due date",
                completed: false,
                due: {
                    isRecurring: false,
                    date: "2023-08-05",
                    string: "2023-08-05"
                }
            };

            expect(parsedTask).toMatchObject(expectedTask);
        });

        // 4. Parsing a task with a `priority` attribute.
        it('should parse a task with a priority attribute correctly', () => {
            const taskMarkdown = "- [ ] Priority task %%*priority:2*%%";
            
            const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

            const expectedTask: Partial<ObsidianTask> = {
                content: "Priority task",
                completed: false,
                priority: 2
            };

            expect(parsedTask).toMatchObject(expectedTask);
        });

        // 5. Parsing a task with an unknown attribute.
        it('should warn and skip unknown attributes', () => {
            const taskMarkdown = "- [ ] Task with unknown attribute %%*unknown:hello*%%";
            
            const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

            expect(warnSpy).toHaveBeenCalledWith("Unknown attribute: unknown");

        });

        // 6. Parsing a task with a `description` attribute.
        it('should parse a task with a description attribute correctly', () => {
            const taskMarkdown = "- [ ] Task with description %%*description:A detailed description*%%";
            
            const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

            const expectedTask: Partial<ObsidianTask> = {
                content: "Task with description",
                description: "A detailed description"
            };

            expect(parsedTask).toMatchObject(expectedTask);
        });

        // 7. Parsing a task with an `order` attribute.
        it('should parse a task with an order attribute correctly', () => {
            const taskMarkdown = "- [ ] Ordered task %%*order:3*%%";
            
            const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

            const expectedTask: Partial<ObsidianTask> = {
                content: "Ordered task",
                order: 3
            };

            expect(parsedTask).toMatchObject(expectedTask);
        });

        // 8. Parsing a task with a `project` attribute.
        it('should parse a task with a project attribute correctly', () => {
            const taskMarkdown = "- [ ] Task for a project %%*project: Project Name*%%";
            
            const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

            const expectedTask: Partial<ObsidianTask> = {
                content: "Task for a project",
                project: {
                    id: "project-123",
                    name: "Project Name"
                }
            };

            expect(parsedTask).toMatchObject(expectedTask);
        });

        // 8.5 Parsing a task with wrong project name would be a task without a project
        it('should parse a task with a wrong project name would be a task without a project', () => {
            const taskMarkdown = "- [ ] Task for a project %%*project:Wrong Project Name*%%";
            
            const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

            const expectedTask: Partial<ObsidianTask> = {
                content: "Task for a project",
                project: null
            }

            expect(parsedTask).toMatchObject(expectedTask);
        })


        // 9. Parsing a task with a `sectionID` attribute.
        it('should parse a task with a sectionID attribute correctly', () => {
            const taskMarkdown = "- [ ] Task in a section %%*sectionID:abcd*%%";
            
            const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

            const expectedTask: Partial<ObsidianTask> = {
                content: "Task in a section",
                sectionID: "abcd"
            };

            expect(parsedTask).toMatchObject(expectedTask);
        });

        // 10. Parsing a task with `metadata` attribute.
        it('should parse a task with metadata correctly', () => {
            const taskMarkdown = "- [ ] Task with metadata %%*metadata:{\"key1\":\"value1\",\"key2\":42}*%%";
            
            const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

            const expectedTask: Partial<ObsidianTask> = {
                content: "Task with metadata",
                metadata: {
                    key1: "value1",
                    key2: 42
                }
            };

            expect(parsedTask).toMatchObject(expectedTask);
        });

        // 11. Parsing a task with multiple attributes.
        it('should parse a task with multiple attributes correctly', () => {
            const taskMarkdown = "- [ ] Multi-attribute task %%*priority:2*%% %%*due:2023-09-01*%%";
            
            const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

            const expectedTask: Partial<ObsidianTask> = {
                content: "Multi-attribute task",
                priority: 2,
                due: {
                    isRecurring: false,
                    date: "2023-09-01",
                    string: "2023-09-01"
                }
            };

            expect(parsedTask).toMatchObject(expectedTask);
        });

    });


});
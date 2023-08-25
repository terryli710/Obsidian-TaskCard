import { TaskParser } from '../src/taskModule/taskParser';
import { ObsidianTask, DateOnly, TaskProperties } from '../src/taskModule/task';
import { JSDOM } from 'jsdom';
import { logger } from '../src/utils/log';
import { writable } from 'svelte/store';
import { Project, ProjectModule } from '../src/taskModule/project';

function createTestTaskElement(document: Document): HTMLElement {
  // Create the main task element
  const taskElement = document.createElement('li');
  taskElement.setAttribute('data-line', '0');
  taskElement.setAttribute('data-task', '');
  taskElement.className = 'task-list-item';
  taskElement.style.display = 'none';

  // Create the list bullet
  const listBullet = document.createElement('div');
  listBullet.className = 'list-bullet';
  taskElement.appendChild(listBullet);

  // Create the checkbox
  const checkbox = document.createElement('input');
  checkbox.setAttribute('data-line', '0');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-list-item-checkbox';
  taskElement.appendChild(checkbox);

  // Add the task content
  taskElement.appendChild(document.createTextNode('An example task '));

  // Create the tag link
  const tagLink = document.createElement('a');
  tagLink.href = '#TaskCard';
  tagLink.className = 'tag';
  tagLink.target = '_blank';
  tagLink.rel = 'noopener';
  tagLink.textContent = '#TaskCard';
  taskElement.appendChild(tagLink);

  // Helper function to create hidden span elements
  const createHiddenSpan = (className: string, content: string) => {
    const span = document.createElement('span');
    span.className = className;
    span.style.display = 'none';
    span.textContent = content;
    taskElement.appendChild(span);
  };

  // Add the hidden span elements
  createHiddenSpan('priority', '4');
  createHiddenSpan(
    'description',
    '"- A multi line description.\\n- the second line."'
  );
  createHiddenSpan('order', '1');
  createHiddenSpan(
    'project',
    '{"id":"project-123", "name":"Project Name", "color":"#f1f1f1"}'
  );
  createHiddenSpan('section-id', '"section-456"');
  createHiddenSpan('labels', '["label1","label2"]');
  createHiddenSpan('parent', 'null');
  createHiddenSpan('children', '[]');
  createHiddenSpan(
    'due',
    '{"isRecurring":false,"string":"2023-08-15","date":"2024-08-15","timezone":null}'
  );
  createHiddenSpan('metadata', '{"filePath":"/path/to/file"}');

  return taskElement;
}

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

  let mockProjectModule: ProjectModule;
  let mockSettingStore;
  let taskParser: TaskParser;
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
    ];
    mockProjectModule = new ProjectModule();
    mockProjectModule.updateProjects(projects);

    taskParser = new TaskParser(mockSettingStore, mockProjectModule);
  });

  describe('parseTaskEl', () => {

    it('should merge labels from both hidden span and content', () => {
      const dom = new JSDOM();
      const document = dom.window.document;
      const taskElement = createTestTaskElement(document);
      const parsedTask = taskParser.parseTaskEl(taskElement);

      // Expecting labels to contain both 'label1', 'label2' from the hidden span and '#TaskCard' from the content
      expect(parsedTask.labels).toEqual(['label1', 'label2', '#TaskCard']);
    });

    it('should filter out duplicate labels', () => {
      const dom = new JSDOM();
      const document = dom.window.document;
      const taskElement = createTestTaskElement(document);

      // Adding another span to introduce a duplicate label
      const duplicateLabelSpan = document.createElement('span');
      duplicateLabelSpan.className = 'labels';
      duplicateLabelSpan.style.display = 'none';
      duplicateLabelSpan.textContent = '["#TaskCard"]';
      taskElement.appendChild(duplicateLabelSpan);

      const parsedTask = taskParser.parseTaskEl(taskElement);

      // Expecting labels to contain 'label1', 'label2', and '#TaskCard' without any duplicates
      expect(parsedTask.labels).toEqual(['label1', 'label2', '#TaskCard']);
    });

    it('should handle only hidden span labels when no content labels are present', () => {
      const dom = new JSDOM();
      const document = dom.window.document;
      const taskElement = createTestTaskElement(document);

      // Removing content label
      const tagElement = taskElement.querySelector('a.tag');
      if (tagElement) {
        taskElement.removeChild(tagElement);
      }

      const parsedTask = taskParser.parseTaskEl(taskElement);

      // Expecting labels to contain only 'label1', 'label2' from the hidden span
      expect(parsedTask.labels).toEqual(['label1', 'label2']);
    });

    it('should handle only content labels when no hidden span labels are present', () => {
      const dom = new JSDOM();
      const document = dom.window.document;
      const taskElement = createTestTaskElement(document);

      // Removing hidden span labels
      const labelsSpan = taskElement.querySelector('span.labels');
      if (labelsSpan) {
        taskElement.removeChild(labelsSpan);
      }

      const parsedTask = taskParser.parseTaskEl(taskElement);

      // Expecting labels to contain only '#TaskCard' from the content
      expect(parsedTask.labels).toEqual(['#TaskCard']);
    });

    it('should parse a task element correctly', () => {
      // Create a test task element using the new task HTML structure
      const dom = new JSDOM();
      const document = dom.window.document;
      const taskElement = createTestTaskElement(document);

      // Expected task object
      const expectedTask: TaskProperties = {
        id: '',
        content: 'An example task',
        priority: 4,
        description: '- A multi line description.\n- the second line.',
        order: 1,
        project: {
          id: 'project-123',
          name: 'Project Name',
          color: '#f1f1f1'
        },
        sectionID: 'section-456',
        labels: ['label1', 'label2'],
        completed: false,
        parent: null,
        children: [],
        due: {
          isRecurring: false,
          string: '2023-08-15',
          date: '2024-08-15',
          timezone: null
        },
        metadata: {
          filePath: '/path/to/file'
        }
      };

      // Call the parseTaskEl method
      const parsedTask = taskParser.parseTaskEl(taskElement);

      // Assert that the parsed task matches the expected task object
      expect(parsedTask).toEqual(expectedTask);
    });

    it('should parse another task element correctly', () => {
      // Create a test task element using the new task HTML structure
      const dom = new JSDOM();
      const document = dom.window.document;
      const taskElement = createTestTaskElement(document);

      // Expected task object without the id property
      const expectedTask: TaskProperties = {
        id: '',
        content: 'An example task',
        priority: 4,
        description: '- A multi line description.\n- the second line.',
        order: 1,
        project: {
          id: 'project-123',
          name: 'Project Name',
          color: '#f1f1f1'
        },
        sectionID: 'section-456',
        labels: ['label1', 'label2'],
        completed: false,
        parent: null,
        children: [],
        due: {
          isRecurring: false,
          string: '2023-08-15',
          date: '2024-08-15',
          timezone: null
        },
        metadata: {
          filePath: '/path/to/file'
        }
      };

      // Call the parseTaskEl method
      const parsedTask = taskParser.parseTaskEl(taskElement);

      // Assert that the parsed task matches the expected task object without considering the id
      expect(parsedTask).toEqual(expect.objectContaining(expectedTask));
    });
  });

  describe('parseTaskMarkdown', () => {
    // 1. Parsing a simple task without any attributes.
    it('should parse a simple task without attributes correctly', () => {
      const taskMarkdown = '- [ ] A simple task';

      const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

      const expectedTask: Partial<ObsidianTask> = {
        content: 'A simple task',
        completed: false
      };

      expect(parsedTask).toMatchObject(expectedTask);
    });

    // 2. Parsing a task with a completed checkbox with labels.
    it('should parse a task with a completed checkbox correctly', () => {
      const taskMarkdown =
        '- [x] A completed task with #some #Labels #one-more-label';

      const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

      const expectedTask: Partial<ObsidianTask> = {
        content: 'A completed task with',
        completed: true,
        labels: ['some', 'Labels', 'one-more-label']
      };

      expect(parsedTask).toMatchObject(expectedTask);
    });

    // 2.5 the indicatorTag will be removed from labels
    it('task with labels: the indicatorTag will be removed from labels', () => {
      const taskMarkdown = '- [x] A completed task with #labels #TaskCard';

      const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

      const expectedTask: Partial<ObsidianTask> = {
        content: 'A completed task with',
        completed: true,
        labels: ['labels']
      };
      expect(parsedTask).toMatchObject(expectedTask);
    });

    // 3. Parsing a task with a `due` attribute.
    it('should parse a task with a due attribute correctly', () => {
      const taskMarkdown = '- [ ] Task with due date %%*due:2023-08-05*%%';

      const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

      const expectedTask: Partial<ObsidianTask> = {
        content: 'Task with due date',
        completed: false,
        due: {
          isRecurring: false,
          date: '2023-08-05',
          string: '2023-08-05'
        }
      };

      expect(parsedTask).toMatchObject(expectedTask);
    });

    // 4. Parsing a task with a `priority` attribute.
    it('should parse a task with a priority attribute correctly', () => {
      const taskMarkdown = '- [ ] Priority task %%*priority:2*%%';

      const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

      const expectedTask: Partial<ObsidianTask> = {
        content: 'Priority task',
        completed: false,
        priority: 2
      };

      expect(parsedTask).toMatchObject(expectedTask);
    });

    // 5. Parsing a task with an unknown attribute.
    it('should warn and skip unknown attributes', () => {
      const taskMarkdown =
        '- [ ] Task with unknown attribute %%*unknown:hello*%%';

      const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

      expect(warnSpy).toHaveBeenCalledWith('Unknown attribute: unknown');
    });

    // 6. Parsing a task with a `description` attribute.
    it('should parse a task with a description attribute correctly', () => {
      const taskMarkdown =
        '- [ ] Task with description %%*description:A detailed description*%%';

      const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

      const expectedTask: Partial<ObsidianTask> = {
        content: 'Task with description',
        description: 'A detailed description'
      };

      expect(parsedTask).toMatchObject(expectedTask);
    });

    // 7. Parsing a task with an `order` attribute.
    it('should parse a task with an order attribute correctly', () => {
      const taskMarkdown = '- [ ] Ordered task %%*order:3*%%';

      const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

      const expectedTask: Partial<ObsidianTask> = {
        content: 'Ordered task',
        order: 3
      };

      expect(parsedTask).toMatchObject(expectedTask);
    });

    // 8. Parsing a task with a `project` attribute.
    it('should parse a task with a project attribute correctly', () => {
      const taskMarkdown =
        '- [ ] Task for a project %%*project: Project Name*%%';

      const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

      const expectedTask: Partial<ObsidianTask> = {
        content: 'Task for a project',
        project: {
          id: 'project-123',
          name: 'Project Name'
        }
      };

      expect(parsedTask).toMatchObject(expectedTask);
    });

    // 8.5 Parsing a task with wrong project name would be a task without a project
    it('should parse a task with a wrong project name would be a task without a project', () => {
      const taskMarkdown =
        '- [ ] Task for a project %%*project:Wrong Project Name*%%';

      const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

      const expectedTask: Partial<ObsidianTask> = {
        content: 'Task for a project',
        project: null
      };

      expect(parsedTask).toMatchObject(expectedTask);
    });

    // 9. Parsing a task with a `sectionID` attribute.
    it('should parse a task with a sectionID attribute correctly', () => {
      const taskMarkdown = '- [ ] Task in a section %%*sectionID:abcd*%%';

      const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

      const expectedTask: Partial<ObsidianTask> = {
        content: 'Task in a section',
        sectionID: 'abcd'
      };

      expect(parsedTask).toMatchObject(expectedTask);
    });

    // 10. Parsing a task with `metadata` attribute.
    it('should parse a task with metadata correctly', () => {
      const taskMarkdown =
        '- [ ] Task with metadata %%*metadata:{"key1":"value1","key2":42}*%%';

      const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

      const expectedTask: Partial<ObsidianTask> = {
        content: 'Task with metadata',
        metadata: {
          key1: 'value1',
          key2: 42
        }
      };

      expect(parsedTask).toMatchObject(expectedTask);
    });

    // 11. Parsing a task with multiple attributes.
    it('should parse a task with multiple attributes correctly', () => {
      const taskMarkdown =
        '- [ ] Multi-attribute task %%*priority:2*%% %%*due:2023-09-01*%%';

      const parsedTask = taskParser.parseTaskMarkdown(taskMarkdown);

      const expectedTask: Partial<ObsidianTask> = {
        content: 'Multi-attribute task',
        priority: 2,
        due: {
          isRecurring: false,
          date: '2023-09-01',
          string: '2023-09-01'
        }
      };

      expect(parsedTask).toMatchObject(expectedTask);
    });
  });
});

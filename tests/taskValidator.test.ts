import { writable } from 'svelte/store';
import { TaskValidator } from '../src/taskModule/taskValidator'; // Update this to the correct import path
import { logger } from '../src/utils/log';
import { ObsidianTask } from '../src/taskModule/task';
import { JSDOM } from 'jsdom';

describe('TaskValidator', () => {
  let mockSettingStore;
  let taskValidator: TaskValidator;

  beforeEach(() => {
    // Mock the SettingStore with controlled settings
    mockSettingStore = writable({
      parsingSettings: {
        indicatorTag: 'TaskCard',
        markdownStartingNotation: '%%*',
        markdownEndingNotation: '*%%',
        markdownSuffix: ' .'
      }
    });

    taskValidator = new TaskValidator(mockSettingStore);
  });

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

  function createMockTaskElement(includeAllAttributes: boolean = true): HTMLElement {
    const dom = new JSDOM();
    const document = dom.window.document;
  
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
  
    // Create a single hidden span element containing all attributes as a JSON object
    const attributes = {
      id: 'task-001',
      priority: includeAllAttributes || Math.random() > 0.5 ? 4 : null,
      description: includeAllAttributes || Math.random() > 0.5 ? '- A multi line description.\n- the second line.' : null,
      order: includeAllAttributes || Math.random() > 0.5 ? 1 : null,
      project: includeAllAttributes || Math.random() > 0.5 ? { id: 'project-123', name: 'Project Name' } : null,
      sectionID: includeAllAttributes || Math.random() > 0.5 ? 'section-456' : null,
      labels: includeAllAttributes || Math.random() > 0.5 ? ['label1', 'label2'] : null,
      parent: null,
      children: [],
      due: includeAllAttributes || Math.random() > 0.5 ? {
        isRecurring: false,
        string: '2023-08-15',
        date: '2024-08-15',
        timezone: null
      } : null,
      metadata: includeAllAttributes || Math.random() > 0.5 ? { filePath: '/path/to/file' } : null
    };
  
    const attributesSpan = document.createElement('span');
    attributesSpan.style.display = 'none';
    attributesSpan.textContent = JSON.stringify(attributes);
    taskElement.appendChild(attributesSpan);
  
    return taskElement;
  }
  

  describe('isValidFormattedTaskMarkdown', () => {
    it('should validate correctly formatted task markdown with single span', () => {
      const formattedTask = `- [ ] An example task #TaskCard <span style="display:none;">{"priority": 4, "description": "- A multi line description.\\n- the second line."}</span>`;
      expect(taskValidator.isValidFormattedTaskMarkdown(formattedTask)).toBe(true);
    });

    it('should invalidate incorrectly formatted task markdown', () => {
      const incorrectFormattedTask = `- [ ] Missing TaskCard tag <span style="display:none;">{"priority": 4}</span>`;
      expect(taskValidator.isValidFormattedTaskMarkdown(incorrectFormattedTask)).toBe(false);
    });
  });

  describe('isValidTaskElement', () => {
    function createMockTaskElementWithSingleSpan(createSpan: boolean = true): HTMLElement {
      const dom = new JSDOM();
      const document = dom.window.document;
      const taskElement = document.createElement('li');
      taskElement.className = 'task-list-item';
      taskElement.style.display = 'none';
    
      // Create and append the list bullet
      const bulletDiv = document.createElement('div');
      bulletDiv.className = 'list-bullet';
      taskElement.appendChild(bulletDiv);
    
      // Create and append the checkbox
      const checkbox = document.createElement('input');
      checkbox.setAttribute('data-line', '0');
      checkbox.type = 'checkbox';
      checkbox.className = 'task-list-item-checkbox';
      taskElement.appendChild(checkbox);
    
      // Add the task content
      taskElement.appendChild(document.createTextNode('An example task '));
    
      // Create and append the tag link
      const tagLink = document.createElement('a');
      tagLink.href = '#TaskCard';
      tagLink.className = 'tag';
      tagLink.target = '_blank';
      tagLink.rel = 'noopener';
      tagLink.textContent = '#TaskCard';
      taskElement.appendChild(tagLink);
    
      // Create and append the single span containing all attributes as a JSON object
      const singleSpan = document.createElement('span');
      singleSpan.style.display = 'none';
      singleSpan.textContent = '{"priority": 4, "description": "- A multi line description.\\n- the second line."}';
      if (createSpan === true) {
        taskElement.appendChild(singleSpan);
      }
    
      return taskElement;
    }
    

    it('should validate task element with single span and attributes', () => {
      const mockElement = createMockTaskElementWithSingleSpan();
      expect(taskValidator.isValidTaskElement(mockElement)).toBe(true);
    });

    it('should invalidate task element without single span', () => {
      const mockElement = createMockTaskElementWithSingleSpan(false);  // Using your existing function
      expect(taskValidator.isValidTaskElement(mockElement)).toBe(false);
    });
  });

  describe('isValidUnformattedTaskMarkdown', () => {
    it('should validate correctly unformatted task markdown', () => {
      const unformattedTask = `- [ ] An example task #label1 #label2 #TaskCard 
            %%*priority:4*%% 
            %%*description:"- A multi line description.\n- the second line."*%% 
            %%*order:1*%% %%*project:{"id":"project-123", "name":"Project Name"}*%% 
            %%*section-id:"section-456"*%% %%*parent:null*%% %%*children:[]*%% 
            %%*due:"Aug 15, 2024"*%% 
            %%*metadata:{"filePath":"/path/to/file"}*%%`;
      const onelineUnformattedTask = unformattedTask.replace(/\n/g, '');

      expect(
        taskValidator.isValidUnformattedTaskMarkdown(onelineUnformattedTask)
      ).toBe(true);
    });

    it('should invalidate incorrectly unformatted task markdown', () => {
      const incorrectUnformattedTask = `- [ ] An example task #label1 #label2`;

      expect(
        taskValidator.isValidUnformattedTaskMarkdown(incorrectUnformattedTask)
      ).toBe(false);
    });

    // More edge cases
    it('should validate unformatted task markdown with no attributes', () => {
      const taskWithoutAttributes = `- [ ] An example task #label1 #label2 #TaskCard`;

      expect(
        taskValidator.isValidUnformattedTaskMarkdown(taskWithoutAttributes)
      ).toBe(true);
    });

    it('should validate unformatted task markdown with incorrect tags by just ignoring them', () => {
      const taskWithIncorrectTags = `- [ ] An example task #label1 #label2 #TaskCard %%*priority:4*%% %%*incorrectAttribute:something*%%`;

      expect(
        taskValidator.isValidUnformattedTaskMarkdown(taskWithIncorrectTags)
      ).toBe(true);
    });
  });
});


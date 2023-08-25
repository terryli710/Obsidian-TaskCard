import { logger } from '../utils/log';
import { escapeRegExp, extractTags } from '../utils/regexUtils';
import { kebabToCamel } from '../utils/stringCaseConverter';
import { toArray, toBoolean } from '../utils/typeConversion';
import { DueDate, ObsidianTask, Order, Priority, TaskProperties } from './task';
import { Project, ProjectModule } from './project';
import Sugar from 'sugar';
import { SettingStore } from '../settings';

export class TaskParser {
  indicatorTag: string;
  markdownStartingNotation: string;
  markdownEndingNotation: string;
  projectModule: ProjectModule;

  constructor(
    settingsStore: typeof SettingStore,
    projectModule: ProjectModule
  ) {
    // Subscribe to the settings store
    settingsStore.subscribe((settings) => {
      this.indicatorTag = settings.parsingSettings.indicatorTag;
      this.markdownStartingNotation =
        settings.parsingSettings.markdownStartingNotation;
      this.markdownEndingNotation =
        settings.parsingSettings.markdownEndingNotation;
    });
    this.projectModule = projectModule;
  }


  // New method to parse labels from task content
  parseLabelsFromContent(taskEl: Element): string[] {
    const tags = taskEl.querySelectorAll("a.tag");
    const labels: string[] = [];
    tags.forEach((tagElement) => {
      const tagContent = tagElement.textContent || "";
      if (tagContent) labels.push(tagContent);
    });
    return labels;
  }

  parseTaskEl(taskEl: Element): ObsidianTask {
    function parseQuery(queryName: string, defaultValue: string = '') {
      try {
        const spanElement = taskEl.querySelector(`span.${queryName}`);
        if (spanElement) {
          return JSON.parse(spanElement.textContent || defaultValue);
        }
        return JSON.parse(defaultValue);
      } catch (e) {
        console.warn(`Failed to parse ${queryName} (got): ${e}`);
        return defaultValue;
      }
    }

    const task = new ObsidianTask();
    task.id = parseQuery('id', '') as string;
    task.priority = parseQuery('priority', '1') as TaskProperties['priority'];
    task.description = parseQuery(
      'description',
      '""'
    ) as TaskProperties['description'];
    task.order = parseQuery('order', '0') as TaskProperties['order'];
    task.project = parseQuery('project', 'null') as Project | null;
    task.sectionID = parseQuery(
      'section-id',
      ''
    ) as TaskProperties['sectionID'];
    
    // Get labels from span
    let labelsFromSpan = parseQuery('labels', '[]') as TaskProperties['labels'];

    // Get labels from content
    let labelsFromContent = this.parseLabelsFromContent(taskEl);

    // Concatenate and filter unique labels
    task.labels = Array.from(new Set([...labelsFromSpan, ...labelsFromContent])).filter(
      (label) => label !== `#${this.indicatorTag}`
    );

    // Make sure the each label starts with exactly one "#"
    task.labels = task.labels.map(label => {
      // Remove all leading '#' characters
      const cleanedLabel = label.replace(/^#+/, '');
      // Add a single '#' at the beginning
      return '#' + cleanedLabel;
    });
    

    // Isolate the task content excluding tags// Get reference to the input checkbox element
    const checkboxElement = taskEl.querySelector('input.task-list-item-checkbox');

    if (checkboxElement) {
      let currentNode: Node | null = checkboxElement;
      let content = '';

      // Traverse through next siblings to accumulate text content
      while ((currentNode = currentNode.nextSibling) !== null) {
        if (currentNode.nodeType === 3) { // Node.TEXT_NODE
          content += currentNode.textContent?.trim() + ' ';
        }
        if (currentNode.nodeType === 1 && (currentNode as Element).tagName === 'A') { // Node.ELEMENT_NODE
          break;
        }
      }

      task.content = content.trim();
    }

    const checkbox = taskEl.querySelector(
      '.task-list-item-checkbox'
    ) as HTMLInputElement;
    task.completed = checkbox?.checked || false;

    // note: currently will always be null, as the relationship is already represented by indent in the document.
    task.parent = parseQuery('parent', 'null') as ObsidianTask['parent'] | null;
    task.children = parseQuery('children', '[]') as
      | ObsidianTask['children']
      | [];

    task.due = parseQuery('due', 'null') as DueDate | null;
    task.metadata = parseQuery('metadata', '{}') as TaskProperties['metadata'];

    return task;
  }

  parseTaskMarkdown(taskMarkdown: string, noticeFunc: (msg: string) => void = null): ObsidianTask {
    const task: ObsidianTask = new ObsidianTask();
    const errors: string[] = [];
  
    const tryParseAttribute = (
      attributeName: string,
      parseFunc: (val: string) => any,
      value: string,
      type: string
    ) => {
      try {
        let parsedValue = parseFunc(value);
        if (parsedValue === null) {
          throw new Error(`Failed to parse ${attributeName}: ${value}`);
        }

        console.log(`Parsed ${attributeName}: ${parsedValue}`);

        // Type specific parsing if needed
        switch (type) {
          case 'array':
            parsedValue = toArray(parsedValue);
            break;
          case 'boolean':
            parsedValue = toBoolean(parsedValue);
            break;
          case 'string':
            break;
          case 'other':
            break;
          default:
            parsedValue = JSON.parse(parsedValue);
            break;
        }
        return parsedValue;
      } catch (e) {
        errors.push(`${attributeName} attribute error: ${e.message}`);
        return null;
      }
    };


    // Splitting the content and the attributes
    const contentEndIndex = taskMarkdown.indexOf(this.markdownStartingNotation);
    const markdownTaskContent =
      contentEndIndex !== -1
        ? taskMarkdown.slice(0, contentEndIndex).trim()
        : taskMarkdown.trim();

    const contentWithLabels = markdownTaskContent.slice(5).trim();
    task.completed = markdownTaskContent.startsWith('- [x]'); // TODO: currently only supports x

    // Extracting labels from the content line
    const [contentLabels, remainingContent] = extractTags(contentWithLabels);
    task.content = remainingContent;
    task.labels = contentLabels.filter((label) => label !== `#${this.indicatorTag}`);



    // Parsing attributes
    const attributesString = taskMarkdown.slice(contentEndIndex);
    const attributeRegexText = `${escapeRegExp(this.markdownStartingNotation)}(.*?)${escapeRegExp(this.markdownEndingNotation)}`;
    const attributesPattern = new RegExp(attributeRegexText, 'g');

    const matches = [...attributesString.matchAll(attributesPattern)];

    let parsedAttributeNames: string[] = [];

    for (const match of matches) {
      const attributeString = match[1];
      const attributeName = kebabToCamel(
        attributeString.substring(0, attributeString.indexOf(':')).trim()
      );
      
      // Check if this attribute has already been parsed
      if (parsedAttributeNames.includes(attributeName)) {
        logger.warn(`Duplicate attribute ignored: ${attributeName}`);
        continue;
      }

      const attributeValue = attributeString
        .substring(attributeString.indexOf(':') + 1)
        .trim();

      // Explicitly assert the type of the key
      const taskKey = attributeName as keyof ObsidianTask;

      if (!(taskKey in task)) {
        logger.warn(`Unknown attribute: ${attributeName}`);
        continue;
      }

      switch (attributeName) {
        case 'due':
          task.due = tryParseAttribute('due', this.parseDue.bind(this), attributeValue, 'other');
          break;
        case 'project':
          task.project = tryParseAttribute('project', this.parseProject.bind(this), attributeValue, 'string');
          break;
        case 'metadata':
          task.metadata = tryParseAttribute('metadata', JSON.parse, attributeValue, 'other');
          break;
        default:
          const taskKey = attributeName as keyof ObsidianTask;
          if (taskKey in task) {
            const type = typeof task[taskKey];
            (task as any)[taskKey] = tryParseAttribute(attributeName, (val) => val, attributeValue, type);
            if (task[taskKey] !== null) {
              parsedAttributeNames.push(taskKey);
            }
          }
          break;
      }
    }

  if (noticeFunc && errors.length > 0) {
    for (const error of errors) {
      noticeFunc(error);
    }
  }

    return task;
  }

  parseFormattedTaskMarkdown(taskMarkdown: string): ObsidianTask {
    const task: ObsidianTask = new ObsidianTask();

    // Splitting the content and the attributes
    const contentEndIndex = taskMarkdown.indexOf('<span class=');
    const markdownTaskContent =
      contentEndIndex !== -1
        ? taskMarkdown.slice(0, contentEndIndex).trim()
        : taskMarkdown.trim();

    const contentWithLabels = markdownTaskContent.slice(5).trim();
    task.completed = markdownTaskContent.startsWith('- [x]'); // TODO: currently only supports x

    // Extracting labels from the content line
    const [contentLabels, remainingContent] = extractTags(contentWithLabels);
    task.content = remainingContent;
    task.labels = contentLabels.filter((label) => label !== `#${this.indicatorTag}`);

    // Parsing attributes
    const attributesString = taskMarkdown.slice(contentEndIndex);

    function extractFormattedAttributes(attributeString: string): Map<string, string> {
      // spread spans <span class="[^"]+" style="display:none;">.*?<\\/span>
      const attributeSpan: RegExp = new RegExp(`<span class="([^"]+)" style="display:none;">(.*?)<\\/span>`, 'g');
      const matches = [...attributeString.matchAll(attributeSpan)];
      // extract the attributes names and values
      const attributes: Map<string, string> = new Map();
      for (const match of matches) {
        // group 1 and group 2 are the attributes names and values
        const attributeName: string = match[1].trim();
        const attributeValue: string = match[2].trim();
        attributes.set(attributeName, attributeValue);
      }
      return attributes;
    }

    const attributes = extractFormattedAttributes(attributesString);

    // Helper function to parse JSON attributes
    function parseJSONAttribute<T>(attributeValue: string | undefined, attributeName: string, fallbackValue: T | null): T | null {
      try {
        return attributeValue ? (JSON.parse(attributeValue) as T) : fallbackValue;
      } catch (e) {
        logger.warn(`Failed to parse ${attributeName} attribute: ${e.message}`);
        return fallbackValue;
      }
    }

    // For string attributes
    task.id = parseJSONAttribute(attributes.get('id'), 'id', '');
    task.description = parseJSONAttribute(attributes.get('description'), 'description', '');
    task.sectionID = parseJSONAttribute(attributes.get('sectionID'), 'sectionID', '');

    // For attributes that require JSON parsing
    task.priority = parseJSONAttribute(attributes.get('priority'), 'priority', '4' as unknown as Priority);
    task.order = parseJSONAttribute(attributes.get('order'), 'order', 0);
    task.project = parseJSONAttribute(attributes.get('project'), 'project', null);
    task.due = parseJSONAttribute(attributes.get('due'), 'due', null); 
    task.metadata = parseJSONAttribute(attributes.get('metadata'), 'metadata', {}); 

    // Optional attributes
    task.parent = parseJSONAttribute(attributes.get('parent'), 'parent', null); // Or a default parent
    task.children = parseJSONAttribute(attributes.get('children'), 'children', []); // Assuming children are in JSON array format
  
    return task;
  }

  parseDue(dueString: string): DueDate | null {
    const parsedDateTime = Sugar.Date.create(dueString);

    // Check if the parsedDateTime is a valid date
    if (!parsedDateTime || !Sugar.Date.isValid(parsedDateTime)) {
      return null;
    }

    const parsedDate = Sugar.Date.format(parsedDateTime, '{yyyy}-{MM}-{dd}');
    const parsedTime = Sugar.Date.format(parsedDateTime, '{HH}:{mm}');

    const isDateOnly = ['00:00', '23:59'].includes(parsedTime);

    if (isDateOnly) {
      return {
        isRecurring: false,
        date: parsedDate,
        string: dueString
      } as DueDate;
    } else {
      return {
        isRecurring: true,
        date: parsedDate,
        time: parsedTime,
        string: dueString
      } as DueDate;
    }
  }

  parseProject(projectString: string): Project | null {
    const project = this.projectModule.getProjectByName(projectString);
    if (!project) {
      return null;
    }
    return project;
  }
}

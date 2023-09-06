import { logger } from '../utils/log';
import { escapeRegExp, extractTags } from '../utils/regexUtils';
import { kebabToCamel } from '../utils/stringCaseConverter';
import { toArray, toBoolean } from '../utils/typeConversion';
import { DueDate, ObsidianTask, Order, Priority, TaskProperties } from './task';
import { Project, ProjectModule } from './project';
import Sugar from 'sugar';
import { SettingStore } from '../settings';
import { DescriptionParser } from './description';


export class TaskParser {
  indicatorTag: string;
  markdownStartingNotation: string;
  markdownEndingNotation: string;
  projectModule: ProjectModule;
  descriptionParser: DescriptionParser

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

  selectHiddenSpans(taskEl: HTMLElement): HTMLElement[] {
    // Get all span elements
    const allSpans = taskEl.querySelectorAll('span');

    // Filter those that have 'display:none' in their style attribute
    const hiddenSpans = Array.from(allSpans).filter(span => {
      const style = span.getAttribute('style');
      return style && style.replace(/\s/g, '').includes('display:none');
    });

    return hiddenSpans;
  }
  
  parseTaskEl(taskEl: HTMLElement): ObsidianTask {
    function parseAttributes(): any {
      try {
        const hiddenSpans = this.selectHiddenSpans(taskEl);
        if (hiddenSpans.length === 0) { return null; }
        const spanElement = hiddenSpans[0];
        if (spanElement) {
          return JSON.parse(spanElement.textContent || '{}');
        }
        return null;
      } catch (e) {
        console.warn(`Failed to parse attributes: ${e}`);
        return null;
      }
    }
  
    const task = new ObsidianTask();
    const attributes = parseAttributes.bind(this)();
    if (attributes === null) { return task; }
  
    task.id = attributes.id || '';
    task.priority = attributes.priority || '1';
    task.description = (attributes.description || '') + (DescriptionParser.parseDescriptionFromTaskEl(taskEl) || '');
    task.order = attributes.order || 0;
    task.project = attributes.project || null;
    task.sectionID = attributes.sectionID || '';
    task.labels = attributes.labels || [];
    task.parent = attributes.parent || null;
    task.children = attributes.children || [];
    task.due = attributes.due || null;
    task.metadata = attributes.metadata || {};
  
    // Get labels from content
    let labelsFromContent = this.parseLabelsFromContent(taskEl);
    
    // Conditional label setting
    if (attributes.labels && attributes.labels.length > 0) {
      task.labels = [...task.labels, ...labelsFromContent];
    } else {
      task.labels = labelsFromContent;
    }

    // Remove duplicate labels and remove indicator tag from labels
    task.labels = Array.from(new Set(task.labels)).filter(
      (label) => label !== `#${this.indicatorTag}`
    );
  
    // Make sure each label starts with exactly one "#"
    task.labels = task.labels.map((label) => {
      // Remove all leading '#' characters
      const cleanedLabel = label.replace(/^#+/, '');
      // Add a single '#' at the beginning
      return '#' + cleanedLabel;
    });
  
    // Isolate the task content excluding tags
    // Get reference to the input checkbox element
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

    // if taskMarkdown is multi-line, split it
    if (taskMarkdown.includes('\n')) {
      const lines = taskMarkdown.split('\n');
      task.description = lines.slice(1).join('\n'); // From the second line to the last line, joined by '\n'
      taskMarkdown = lines[0]; // The first line
    }

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

    // if taskMarkdown is multi-line, split it
    if (taskMarkdown.includes('\n')) {
      const lines = taskMarkdown.split('\n');
      task.description = lines.slice(1).join('\n'); // From the second line to the last line, joined by '\n'
      taskMarkdown = lines[0]; // The first line
    }
    
    // Global regex to capture task part, content, labels, and metadata
    const regex = new RegExp(`- \\[(.)\\] (.+?)(?:\\s*<span style="display:none">({.+})<\\/span>)`);
    const match = taskMarkdown.trim().match(regex);
    
    if (!match || !match[1] || !match[2] || !match[3]) {
      logger.warn(`Failed to parse task: ${taskMarkdown}`);
      return task;
    }
  
    // Extracting completion status
    task.completed = match[1] !== ' ';
  
    // Extracting content
    task.content = match[2].trim();

    const contentWithLabels = match[2].trim();
  
    // Extracting labels from the content line
    const [contentLabels, remainingContent] = extractTags(contentWithLabels);
    task.content = remainingContent;
    task.labels = contentLabels.filter((label) => label !== `#${this.indicatorTag}`);
  
    // Helper function to parse JSON attributes
    function parseJSONAttribute<T>(attributeValue: any, attributeName: string, fallbackValue: T | null): T | null {
      try {
        return attributeValue !== undefined ? attributeValue : fallbackValue;
      } catch (e) {
        logger.warn(`Failed to parse ${attributeName} attribute: ${e.message}`);
        return fallbackValue;
      }
    }
  
    // Extracting and parsing the JSON attributes
    const metadata = JSON.parse(match[3]);
    if (!metadata) {
      logger.warn(`Failed to parse metadata: ${match[3]}`);
      return task;
    }

    // For string attributes
    task.id = parseJSONAttribute(metadata['id'], 'id', '');
    task.description += parseJSONAttribute(metadata['description'], 'description', '').replace(/\\n/g, '\n');
    task.sectionID = parseJSONAttribute(metadata['sectionID'], 'sectionID', '');

    // For attributes that require JSON parsing
    task.priority = parseJSONAttribute(metadata['priority'], 'priority', '4' as unknown as Priority);
    task.order = parseJSONAttribute(metadata['order'], 'order', 0);
    task.project = parseJSONAttribute(metadata['project'], 'project', null);
    task.due = parseJSONAttribute(metadata['due'], 'due', null); 
    task.metadata = parseJSONAttribute(metadata['metadata'], 'metadata', {}); 

    // Optional attributes
    task.parent = parseJSONAttribute(metadata['parent'], 'parent', null); // Or a default parent
    task.children = parseJSONAttribute(metadata['children'], 'children', []); // Assuming children are in JSON array format
    
    return task;
  }

//   parseExtractedFormattedTaskMarkdown(taskMarkdown: string): ObsidianTask {
//     const task = new ObsidianTask();
  
//     if (!taskMarkdown) {
//       logger.warn(`Failed to parse task: ${taskMarkdown}`);
//       return task;
//     }
  
//     taskMarkdown = taskMarkdown.trim();
  
//     // Single regex to capture task part, content, labels, indicator tag, and metadata
//     const regex = new RegExp(`- \\[(.)\\] (.+)\\s+#${this.indicatorTag}({.+})<\\/span>`);
//     const match = taskMarkdown.match(regex);
  
//     if (!match || !match[1] || !match[2] || !match[3]) {
//       logger.warn(`Failed to parse task: ${taskMarkdown}, match: ${match}`);
//       return task;
//     } 

//     const contentWithLabels = match[2].trim();
  
//     // Extracting labels from the content line
//     const [contentLabels, remainingContent] = extractTags(contentWithLabels);
//     task.content = remainingContent;
//     task.labels = contentLabels.filter((label) => label !== `#${this.indicatorTag}`);
//     // Extracting completion status
//     task.completed = match[1] !== ' ';

//     // Extracting JSON metadata
//     const metadata = JSON.parse(match[3]);
//     if (!metadata) {
//       logger.warn(`Failed to parse metadata: ${match[3]}`);
//       return task;
//     }

//     // For string attributes
//     task.id = metadata.id || '';
//     task.description = metadata.description || '';
//     task.sectionID = metadata.sectionID || '';

//     // For attributes that require JSON parsing
//     task.priority = metadata.priority || 4;
//     task.order = metadata.order || 0;
//     task.project = metadata.project || null;
//     task.due = metadata.due || null;
//     task.metadata = metadata.metadata || {};

//     // Optional attributes
//     task.parent = metadata.parent || null;
//     task.children = metadata.children || [];

//     return task;
// }
  

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
        isRecurring: false,
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

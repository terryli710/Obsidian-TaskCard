import { logger } from '../utils/log';
import { escapeRegExp, extractTags } from '../utils/regexUtils';
import { kebabToCamel } from '../utils/stringCaseConverter';
import { toArray, toBoolean } from '../utils/typeConversion';
import { DueDate, Duration, ObsidianTask, Order, Priority, TaskProperties, TextPosition } from './task';
import { Project, ProjectModule } from './project';
import Sugar from 'sugar';
import { SettingStore } from '../settings';
import { DescriptionParser } from './description';
import parse from 'parse-duration';


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

    // logger.debug(`Parsing task element: ${taskEl.outerHTML}`);
  
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
    task.duration = attributes.duration || null;
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

    // Utility function to convert leading tabs in a line to spaces
    const convertLeadingTabsToSpaces = (line: string): string => {
        let result = "";
        let index = 0;
    
        while (index < line.length) {
            if (line[index] === '\t') {
                result += "    "; // Replace tab with 4 spaces
            } else if (line[index] === ' ') {
                result += line[index];
            } else {
                // Once we encounter a non-space, non-tab character, break
                break;
            }
            index++;
        }
        
        // Append the remainder of the line
        result += line.slice(index);
        return result;
    };

    // Utility function to check if all lines start with a space
    const allLinesStartWithSpace = (lines: string[]): boolean => {
      return lines.every(line => line.startsWith(" "));
    };

    // Utility function to remove the leading space from all lines
    const removeLeadingSpace = (lines: string[]): string[] => {
      return lines.map(line => line.startsWith(" ") ? line.slice(1) : line);
    };

    if (taskMarkdown.includes('\n')) {
      // process multi-line task - has description
      let lines = taskMarkdown.split('\n');
      let descLines = lines.slice(1);
      // Convert tabs to spaces
      descLines = descLines.map(convertLeadingTabsToSpaces);

      // Iteratively remove indentation
      while (allLinesStartWithSpace(descLines)) {
        descLines = removeLeadingSpace(descLines);
      }
      // logger.debug(`Multi-line task: ${descLines.join('\n')}`);
      task.description = descLines.join('\n');
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
        case 'duration':
          task.duration = tryParseAttribute('duration', this.parseDuration.bind(this), attributeValue, 'other');
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
    task.duration = parseJSONAttribute(metadata['duration'], 'duration', null);
    task.metadata = parseJSONAttribute(metadata['metadata'], 'metadata', {}); 

    // Optional attributes
    task.parent = parseJSONAttribute(metadata['parent'], 'parent', null); // Or a default parent
    task.children = parseJSONAttribute(metadata['children'], 'children', []); // Assuming children are in JSON array format
    
    return task;
  }

  parseFormattedTaskFromFileLines(lines: string[]): ObsidianTask {
    const descriptionLineNumber = this.determineDescriptionLineNumber(lines);
    const taskMarkdown = lines.slice(0, descriptionLineNumber + 1).join('\n');
    return this.parseFormattedTaskMarkdown(taskMarkdown);
  }

  /**
   * Determine the number of lines of the description of a task within a document.
   * 
   * @param {string[]} lines - An array of strings, each representing a line in the document.
   * @returns {number} - The number of lines of the description of the task. Returns 0 if the line is not a task or has no description.
   * 
   * The function follows this logic:
   * 1. Check if the first line is a task. A task starts with "<space>*- [<any one char>] ...".
   * 2. If it's not a task, return 0.
   * 3. If it is a task, find its indentation level.
   * 4. Iterate through the following lines to find the description.
   * 5. A line is considered a description if:
   *    a. It is not purely space or an empty line.
   *    b. It is not a task that has the same or less indentation than the original task line.
   * 6. The function stops iterating when it encounters a line that is not a description and returns the number of lines iterated.
   */
  determineDescriptionLineNumber(lines: string[]): number {
    // Regular expression to match a task line
    const taskRegex = /^\s*- \[.\]/;
    // Check if the first line is a task
    if (!taskRegex.test(lines[0])) {
      return 0;
    }

    // Determine the indentation level of the task
    const taskIndentation = lines[0].match(/^\s*/)[0].length;

    let descriptionLineCount = 0;

    // Loop through the lines to find the description
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      // Check if the line is not purely space or empty
      if (line.trim() === '') {
        break;
      }

      // Check if the line is another task with the same or less indentation
      if (taskRegex.test(line) && line.match(/^\s*/)[0].length <= taskIndentation) {
        break;
      }

      // If the line passes the above checks, it is a description
      descriptionLineCount++;
    }
    return descriptionLineCount;
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
        isRecurring: false,
        date: parsedDate,
        time: parsedTime,
        string: dueString
      } as DueDate;
    }
  }

  parseDuration(durationString: string): Duration | null {
    const durationInMinutes = parse(durationString, 'm');
    // Convert the difference to hours and minutes
    const hours = Math.floor(durationInMinutes / 60);
    const minutes = durationInMinutes % 60;

    return {
      hours: hours,
      minutes: minutes
    } as Duration;
  }
  

  parseProject(projectString: string): Project | null {
    const project = this.projectModule.getProjectByName(projectString);
    if (!project) {
      return null;
    }
    return project;
  }
}

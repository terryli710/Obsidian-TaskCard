import { logger } from '../utils/log';
import { escapeRegExp, extractTags } from '../utils/regexUtils';
import { kebabToCamel } from '../utils/stringCaseConverter';
import { toArray, toBoolean } from '../utils/typeConversion';
import { DueDate, ObsidianTask, TaskProperties } from './task';
import { Project, ProjectModule } from './project';
import Sugar from 'sugar';
import { SettingStore } from '../settings';
import { Notice } from 'obsidian';

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
    task.content =
      taskEl
        .querySelector('.task-list-item-checkbox')
        ?.nextSibling?.textContent?.trim() || '';
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
    task.labels = parseQuery('labels', '[]') as TaskProperties['labels'];
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

  parseTaskMarkdown(taskMarkdown: string): ObsidianTask { // TODO: optimize this function
    const task: ObsidianTask = new ObsidianTask();

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
    task.labels = contentLabels.filter((label) => label !== this.indicatorTag);

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
          try {
            const parsedDue = this.parseDue(attributeValue);
            if (!parsedDue) {
              throw new Error(`Failed to parse due date: ${attributeValue}`);
            }
            task.due = parsedDue;
            parsedAttributeNames.push('due');
          } catch (e) {
            console.error(`Failed to parse due date: ${e.message}`);
            new Notice(`[TaskCard] Failed to parse due date: ${e.message}`);
          }
          break;
        case 'project':
          try {
            const parsedProject = this.parseProject(attributeValue);
            if (!parsedProject) {
              throw new Error(`Failed to parse project: ${attributeValue}`);
            }
            task.project = parsedProject;
            parsedAttributeNames.push('project');
          } catch (e) {
            console.error(
              `Cannot find project: ${attributeValue}, error: ${e.message}`
            );
            new Notice(`[TaskCard] Failed to parse project: ${e.message}`);
          }
          break;
        case 'metadata':
          try {
            task.metadata = JSON.parse(attributeValue);
            parsedAttributeNames.push('metadata');
          } catch (e) {
            console.error(`Failed to parse metadata attribute: ${e.message}`);
          }
          break;
        default:
          // Explicitly assert the type of the key
          const taskKey = attributeName as keyof ObsidianTask;

          // Only assign the value if the key exists on ObsidianTask and parse it with the correct type
          if (taskKey in task) {
            try {
              if (Array.isArray(task[taskKey])) {
                (task[taskKey] as any) = toArray(attributeValue);
              } else if (typeof task[taskKey] === 'boolean') {
                (task[taskKey] as any) = toBoolean(attributeValue);
              } else if (typeof task[taskKey] === 'string') {
                (task[taskKey] as any) = attributeValue;
              } else {
                (task[taskKey] as any) = JSON.parse(attributeValue);
              }
              parsedAttributeNames.push(taskKey);
            } catch (e) {
              logger.error(
                `Failed to convert value for key ${taskKey}: ${e.message}`
              );
            }
          }
          break;
      }
    }

    return task;
  }

  parseDue(dueString: string): DueDate | null {
    const parsedDateTime = Sugar.Date.create(dueString);

    // Check if the parsedDateTime is a valid date
    if (!parsedDateTime) {
      return null;
    }

    const parsedDate = Sugar.Date.format(parsedDateTime, '{yyyy}-{MM}-{dd}');
    const parsedTime = Sugar.Date.format(parsedDateTime, '{HH}:{mm}');

    const isDateOnly = parsedTime === '00:00';

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




import { logger } from "../utils/log";
import { escapeRegExp, extractTags } from "../utils/regexUtils";
import { kebabToCamel } from "../utils/stringCaseConverter";
import { toArray, toBoolean } from "../utils/typeConversion";
import { DueDate, ObsidianTask, TaskProperties } from './task';
import { Project, ProjectModule } from './project';
import * as chrono from 'chrono-node';
import { SettingStore } from "../settings";
import { Notice } from "obsidian";

export class TaskParser {
    indicatorTag: string;
    markdownStartingNotation: string;
    markdownEndingNotation: string;
    projectModule: ProjectModule;

    constructor(settingsStore: typeof SettingStore, projectModule: ProjectModule) {
        // Subscribe to the settings store
        settingsStore.subscribe(settings => {
            this.indicatorTag = settings.parsingSettings.indicatorTag;
            this.markdownStartingNotation = settings.parsingSettings.markdownStartingNotation;
            this.markdownEndingNotation = settings.parsingSettings.markdownEndingNotation;
        });
        this.projectModule = projectModule;
    }

    parseTaskEl(taskEl: Element): ObsidianTask {
        function parseQuery(queryName: string, defaultValue: string = "") {
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
        task.content = taskEl.querySelector('.task-list-item-checkbox')?.nextSibling?.textContent?.trim() || '';
        task.priority = parseQuery('priority', '1') as TaskProperties['priority'];
        task.description = parseQuery('description', '""') as TaskProperties['description'];
        task.order = parseQuery('order', '0') as TaskProperties['order'];
        task.project = parseQuery('project', 'null') as Project | null;
        task.sectionID = parseQuery('section-id', '') as TaskProperties['sectionID'];
        task.labels = parseQuery('labels', '[]') as TaskProperties['labels'];
        const checkbox = taskEl.querySelector('.task-list-item-checkbox') as HTMLInputElement;
        task.completed = checkbox?.checked || false;
    
        // note: currently will always be null, as the relationship is already represented by indent in the document.
        task.parent = parseQuery('parent', 'null') as ObsidianTask['parent'] | null; 
        task.children = parseQuery('children', '[]') as ObsidianTask['children'] | []; 
    
        task.due = parseQuery('due', 'null') as DueDate | null;
        task.metadata = parseQuery('metadata', '{}') as TaskProperties['metadata'];
    
        logger.debug(`task project: ${task.project}`);
    
        return task;
    }
    
    
    parseTaskMarkdown(taskMarkdown: string): ObsidianTask {
        const task: ObsidianTask = new ObsidianTask();
    
        // Splitting the content and the attributes
        const contentEndIndex = taskMarkdown.indexOf(this.markdownStartingNotation);
        const markdownTaskContent = contentEndIndex !== -1
            ? taskMarkdown.slice(0, contentEndIndex).trim()
            : taskMarkdown.trim();
    
        task.content = markdownTaskContent.slice(5).trim();
        task.completed = markdownTaskContent.startsWith("- [x]"); // TODO: currently only supports x
    
        // Extracting labels from the content line
        const [contentLabels, remainingContent] = extractTags(task.content);
        task.content = remainingContent;
        task.labels = contentLabels.filter(label => label !== this.indicatorTag);
    
        // Parsing attributes
        const attributesString = taskMarkdown.slice(contentEndIndex);
        const attributesPattern = new RegExp(`${escapeRegExp(this.markdownStartingNotation)}(.*?)${escapeRegExp(this.markdownEndingNotation)}`, 'g');
    
        const matches = [...attributesString.matchAll(attributesPattern)];
        
        for (const match of matches) {
            const attributeString = match[1];
            const attributeName = kebabToCamel(attributeString.substring(0, attributeString.indexOf(':')).trim());
            const attributeValue = attributeString.substring(attributeString.indexOf(':') + 1).trim();

            // Explicitly assert the type of the key
            const taskKey = attributeName as keyof ObsidianTask;

            if (!(taskKey in task)) {
                logger.warn(`Unknown attribute: ${attributeName}`);
                continue;
            }

            switch (attributeName) {
                case 'due':
                    try {
                        task.due = this.parseDue(attributeValue);
                    }
                    catch (e) {
                        console.error(`Failed to parse due date: ${e.message}`);
                    }
                case 'project':
                    try {
                        const parsedProject = this.parseProject(attributeValue);
                        task.project = parsedProject;
                    } catch (e) {
                        console.error(`Cannot find project: ${attributeValue}, error: ${e.message}`);
                    }
                    break;
                case 'metadata':
                    try {
                        task.metadata = JSON.parse(attributeValue);
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
                        } catch (e) {
                            logger.error(`Failed to convert value for key ${taskKey}: ${e.message}`);
                        }
                    }
                    break;
            }
        }
    
        return task;
    }

    parseDue(dueString: string): DueDate | null {
        let parsedResult;
        try {
            parsedResult = chrono.parse(dueString)[0];
            // Check if parsedResult is undefined
            if (!parsedResult) {
                throw new Error('Failed to parse due date. No parsed result found.');
            }
            
        } catch (e) {
            logger.error(`Failed to parse due date: ${e.message}`);
            new Notice(`[TaskCard]: Failed to parse due date: ${e.message}`);
            return null;
        }
        const ParsedComponent = parsedResult.start;
        const isDateOnly = !ParsedComponent.isCertain('hour') && !ParsedComponent.isCertain('minute') && !ParsedComponent.isCertain('second');
        const parsedDateTime: Date = ParsedComponent.date();
        const parsedDate = `${parsedDateTime.getFullYear()}-${String(parsedDateTime.getMonth() + 1).padStart(2, '0')}-${String(parsedDateTime.getDate()).padStart(2, '0')}`;
        const parsedTime = `${parsedDateTime.getHours()}:${parsedDateTime.getMinutes()}`;
        logger.debug(`dueString: ${dueString}, parsedDate: ${parsedDate}, parsedTime: ${parsedTime}`);
        if (isDateOnly) {
            return { isRecurring: false, date: parsedDate, string: dueString } as DueDate;
        } else {
            return { isRecurring: true, date: parsedDate, time: parsedTime, string: dueString } as DueDate;
        }
    }

    parseProject(projectString: string): Project | null {
        logger.debug(`Parsing project: ${projectString}, this.projectModule: ${JSON.stringify(this.projectModule.getProjectsData())}`);
        const project = this.projectModule.getProjectByName(projectString);
        if (!project) { return null };
        return project;
    }
}
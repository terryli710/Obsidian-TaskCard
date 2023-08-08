


import { logger } from "../log";
import { escapeRegExp, extractTags } from "../utils/regexUtils";
import { kebabToCamel } from "../utils/stringCaseConverter";
import { toArray, toBoolean } from "../utils/typeConversion";
import { DueDate, ObsidianTask, TaskProperties } from "./task";
import * as chrono from 'chrono-node';

export class taskParser {
    markdownStartingNotation: string;
    markdownEndingNotation: string;

    constructor(
        markdownStartingNotation: string = '%%*',
        markdownEndingNotation: string = '*%%',
    ) {
        this.markdownStartingNotation = markdownStartingNotation;
        this.markdownEndingNotation = markdownEndingNotation;
    }

    static parseTaskEl(taskEl: Element): ObsidianTask {
        function parseQuery(queryName: string, defaultValue: string = "") {
            try {
                const embedElement = taskEl.querySelector(`.cm-html-embed > .${queryName}`);
                if (embedElement) {
                    return JSON.parse(embedElement.textContent || defaultValue);
                }
                return JSON.parse(defaultValue);
            } catch (e) {
                console.warn(`Failed to parse ${queryName} (got): ${e}`);
                return defaultValue;
            }
        }
    
        const task = new ObsidianTask();
        task.id = parseQuery('id', '') as string;
        task.content = taskEl.querySelector('.cm-list-1')?.textContent?.trim() || '';
        task.priority = parseQuery('priority', '1') as TaskProperties['priority'];
        task.description = parseQuery('description', '') as string;
        task.order = parseQuery('order', '0') as TaskProperties['order'];
        task.project = parseQuery('project', 'null') as TaskProperties['project'];
        task.sectionID = parseQuery('section-id', '') as TaskProperties['sectionID'];
        task.labels = parseQuery('labels', '[]') as TaskProperties['labels'];
        const checkbox = taskEl.querySelector('.task-list-item-checkbox') as HTMLInputElement;
        task.completed = checkbox?.getAttribute('data-task') === 'x';

        // note: currently will always be null, as the relationship is already represented by indent in the document.
        task.parent = parseQuery('parent', 'null') as ObsidianTask['parent'] | null; 
        task.children = parseQuery('children', '[]') as ObsidianTask['children'] | []; 

        task.due = parseQuery('due', 'null') as TaskProperties['due'] | null;
        task.metadata = parseQuery('metadata', '{}') as TaskProperties['metadata'];
    
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
        task.completed = markdownTaskContent.startsWith("- [x]");
    
        // Extracting labels from the content line
        const [contentLabels, remainingContent] = extractTags(task.content);
        task.content = remainingContent;
        task.labels = contentLabels;
    
        // Parsing attributes
        const attributesString = taskMarkdown.slice(contentEndIndex);
        const escapedStartingNotation = escapeRegExp(this.markdownStartingNotation);
        const escapedEndingNotation = escapeRegExp(this.markdownEndingNotation);
        const attributesPattern = new RegExp(`${escapedStartingNotation}(.*?)${escapedEndingNotation}`, 'g');
    
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
                    if (!attributeValue) {
                        logger.warn(`Failed to parse due attribute: ${attributeValue}`);
                        task.due = null;
                    } else {
                        task.due = this.parseDue(attributeValue);
                    }
                case 'project':
                    try {
                        const parsedProject = JSON.parse(attributeValue);
                        task.project = {
                            id: parsedProject.id || "",
                            name: parsedProject.name || ""
                        };
                    } catch (e) {
                        console.error(`Failed to parse project attribute: ${e.message}`);
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

    private parseDue(dueString: string): DueDate | null {
        const parsedResult = chrono.parse(dueString)[0];
        const ParsedComponent = parsedResult.start;
        const isDateOnly = !ParsedComponent.isCertain('hour') && !ParsedComponent.isCertain('minute') && !ParsedComponent.isCertain('second');
        const parsedDateTime: Date = ParsedComponent.date();
        const parsedDate = `${parsedDateTime.getFullYear()}-${String(parsedDateTime.getMonth() + 1).padStart(2, '0')}-${String(parsedDateTime.getDate()).padStart(2, '0')}`;
        const parsedTime = `${parsedDateTime.getHours()}:${parsedDateTime.getMinutes()}`;
        if (isDateOnly) {
            return { isRecurring: false, date: parsedDate, string: dueString } as DueDate;
        } else {
            return { isRecurring: true, date: parsedDate, time: parsedTime, string: dueString } as DueDate;
        }
    }
}
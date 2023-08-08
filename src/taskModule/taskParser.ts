


import { logger } from "../log";
import { escapeRegExp } from "../utils/regexUtils";
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
        // parse the raw markdown to obtain the task
        const task = new ObsidianTask();

        // Splitting the content and the attributes
        const contentEndIndex = taskMarkdown.indexOf(this.markdownStartingNotation);
        const markdownTaskContent = contentEndIndex !== -1
            ? taskMarkdown.slice(0, contentEndIndex).trim()
            : taskMarkdown.trim();

        task.content = markdownTaskContent.slice(5).trim();
        task.completed = markdownTaskContent.startsWith("- [x]");

        // Parsing attributes
        const attributesString = taskMarkdown.slice(contentEndIndex);
        const escapedStartingNotation = escapeRegExp(this.markdownStartingNotation);
        const escapedEndingNotation = escapeRegExp(this.markdownEndingNotation);
        const attributesPattern = new RegExp(`${escapedStartingNotation}(.*?)${escapedEndingNotation}`, 'g');

        const matches = [...attributesString.matchAll(attributesPattern)];
        
        for (const match of matches) {
            const attributeString = match[1];
            const parts = attributeString.split(/\s*:\s*/);  // Splitting using `:` and allowing spaces around
            const attributeName = parts[0];
            const attributeValue = parts.length > 1 ? parts[1] : undefined;  // Check if there's a value present
        
            console.log('After splitting - Attribute:', attributeName, 'Value:', attributeValue); // Print parsed keys and values
        
            // Assigning attributes to the task based on the attribute name
            switch (attributeName.trim()) {
                case 'due':
                    if (!attributeValue) {
                        logger.error('Due attribute found without a value.');
                    }
                    task.due = this.parseDue(attributeValue); 
                    break;
                case 'priority':
                    if (!attributeValue) {
                        logger.error('Priority attribute found without a value.');
                    }
                    task.priority = parseInt(attributeValue.trim(), 10) as TaskProperties['priority'];
                    break;
                // Add more cases for other attributes as needed
                default:
                    logger.warn(`Unknown attribute: ${attributeName}`);
                    break;
                }
        }

        logger.info('Task parsed successfully.'); // Info level log indicating successful parsing


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
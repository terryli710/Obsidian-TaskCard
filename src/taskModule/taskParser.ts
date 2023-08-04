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
            console.warn(`Failed to parse ${queryName}: ${e}`);
            return defaultValue;
          }
        }
    
        const task = new ObsidianTask();
        task.id = parseQuery('id', '') as string;
        task.content = taskEl.querySelector('.cm-list-1')?.textContent?.trim() || '';
        task.priority = parseQuery('priority', '1') as TaskProperties['priority'];
        task.description = parseQuery('description', '') as string;
        task.order = parseQuery('order', '0') as TaskProperties['order'];
        task.project = parseQuery('project', '{}') as TaskProperties['project'];
        task.sectionID = parseQuery('section-id', '') as TaskProperties['sectionID'];
        task.labels = parseQuery('labels', '[]') as TaskProperties['labels'];
        const checkbox = taskEl.querySelector('.task-list-item-checkbox') as HTMLInputElement;
        task.completed = checkbox?.getAttribute('data-task') === 'x';

        // note: currently will always be null, as the relationship is already represented by indent in the document.
        task.parent = parseQuery('parent', 'null') as ObsidianTask['parent'] | null; 
        task.children = parseQuery('children', '[]') as ObsidianTask['children'] | []; 

        task.due = parseQuery('due', '{}') as TaskProperties['due'] | null;
        task.metadata = parseQuery('metadata', '{}') as TaskProperties['metadata'];
    
        return task;
    }

    parseTaskMarkdown(taskMarkdown: string): ObsidianTask {
      
        const task = new ObsidianTask();

        // Splitting the content and the attributes
        const contentEndIndex = taskMarkdown.indexOf(this.markdownStartingNotation);
        task.content = contentEndIndex !== -1
            ? taskMarkdown.slice(0, contentEndIndex).trim()
            : taskMarkdown.trim();
        task.completed = task.content.startsWith("- [x]");

        // Parsing attributes
        const attributesString = taskMarkdown.slice(contentEndIndex);
        const attributesPattern = new RegExp(`${this.markdownStartingNotation}(.*?)${this.markdownEndingNotation}`, 'g');
        let match;

        while ((match = attributesPattern.exec(attributesString)) !== null) {
            const attributeString = match[1];
            const [attributeName, attributeValue] = attributeString.split(':');

            // Assigning attributes to the task based on the attribute name
            switch (attributeName.trim()) {
            case 'due':
                task.due = this.parseDue(attributeValue); // Placeholder function for parsing 'due'
                break;
            case 'priority':
                task.priority = parseInt(attributeValue.trim(), 10) as TaskProperties['priority'];
                break;
            // Add more cases for other attributes as needed
            default:
                console.warn(`Unknown attribute: ${attributeName}`);
                break;
            }
        }

        return task;
    } // TODO: test the parsing functions

    private parseDue(dueString: string): DueDate | null {
        const parsedResult = chrono.parse(dueString)[0];
        const ParsedComponent = parsedResult.start;
        const isDateOnly = !ParsedComponent.isCertain('hour') && !ParsedComponent.isCertain('minute') && !ParsedComponent.isCertain('second');
        const parsedDateTime: Date = ParsedComponent.date();
        const parsedDate = `${parsedDateTime.getFullYear()}-${parsedDateTime.getMonth() + 1}-${parsedDateTime.getDate()}`;
        const parsedTime = `${parsedDateTime.getHours()}:${parsedDateTime.getMinutes()}`;
        if (isDateOnly) {
            return { isRecurring: false, date: parsedDate } as DueDate;
        } else {
            return { isRecurring: true, date: parsedDate, time: parsedTime } as DueDate;
        }
    }
}
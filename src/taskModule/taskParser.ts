import { ObsidianTask, TaskProperties } from "./task";

export class taskParser {

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
}
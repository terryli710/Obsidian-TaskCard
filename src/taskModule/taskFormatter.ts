


import { SettingStore } from '../settings';
import { camelToKebab } from '../utils/stringCaseConverter';
import { ObsidianTask } from './task';

export class TaskFormatter {
    indicatorTag: string;

    constructor(settingsStore: typeof SettingStore) {
        // Subscribe to the settings store
        settingsStore.subscribe(settings => {
            this.indicatorTag = settings.parsingSettings.indicatorTag;
        });
    }

    taskToMarkdown(task: ObsidianTask): string {
        let markdownLine = `- [${task.completed ? 'x' : ' '}] ${task.content} #${this.indicatorTag}\n`;
        
        // Iterate over keys in task, but exclude 'completed' and 'content'
        for (let key in task) {
            if (key === 'completed' || key === 'content') continue;
    
            let value = task[key];
            if (value === null || value === undefined) {
                value = "null";
            } else if (key === 'description') {
                value = value.replace(/\n/g, '\\n');
            } else if (typeof value === 'object') {
                value = JSON.stringify(value);
            }
            // for string value, add quotes
            const stringAttributes = ['id', 'description']
            if (stringAttributes.includes(key)) {
                value = `"${value}"`;
            }
    
            let kebabCaseKey = camelToKebab(key);
            markdownLine += `<span class="${kebabCaseKey}" style="display:none;">${value}</span>\n`;
        }
        
        return markdownLine;
    }
    

    taskToMarkdownOneLine(task: ObsidianTask): string {
        return this.taskToMarkdown(task).replace(/\n/g, '');
    }
}




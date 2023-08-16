


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
    
            if (task[key] !== null && task[key] !== undefined) {
                let kebabCaseKey = camelToKebab(key);
                let value = task[key];
                if (key === 'description') {
                    value = value.replace(/\n/g, '\\n');
                }
                if (typeof value === 'object') {
                    markdownLine += `<span class="${kebabCaseKey}" style="display:none;">${JSON.stringify(value)}</span>\n`;
                } else {
                    markdownLine += `<span class="${kebabCaseKey}" style="display:none;">"${value}"</span>\n`;
                }
            }
        }
        
        return markdownLine;
    }

    taskToMarkdownOneLine(task: ObsidianTask): string {
        return this.taskToMarkdown(task).replace(/\n/g, '');
    }
}




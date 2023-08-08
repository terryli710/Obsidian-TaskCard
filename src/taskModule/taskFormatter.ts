


import { camelToKebab } from '../utils/stringCaseConverter';
import { ObsidianTask } from './task';

export class taskFormatter {

    static taskToMarkdown(task: ObsidianTask, indicatorTag: string = "TaskCard"): string {
        let markdownLine = `- [${task.completed ? 'x' : ' '}] ${task.content} #{indicatorTag}`;
        
        // Iterate over keys in task, but exclude 'completed' and 'content'
        for (let key in task) {
            if (key === 'completed' || key === 'content') continue;
    
            if (task[key] !== null && task[key] !== undefined) {
                let kebabCaseKey = camelToKebab(key);
                if (typeof task[key] === 'object') {
                markdownLine += ` <span class="${kebabCaseKey}" style="display:none;">${JSON.stringify(task[key])}</span>`;
                } else {
                markdownLine += ` <span class="${kebabCaseKey}" style="display:none;">${task[key]}</span>`;
                }
            }
        }
        
        return markdownLine;
    }
}


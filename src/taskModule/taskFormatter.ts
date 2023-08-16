


import { camelToKebab } from '../utils/stringCaseConverter';
import { ObsidianTask } from './task';

export class taskFormatter {

    static taskToMarkdown(task: ObsidianTask, indicatorTag: string = "TaskCard"): string {
        let markdownLine = `- [${task.completed ? 'x' : ' '}] ${task.content} #${indicatorTag}\n`;
        
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
}




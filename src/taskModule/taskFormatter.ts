import { TaskDisplayMode } from '../renderer/postProcessor';
import { SettingStore } from '../settings';
import { logger } from '../utils/log';
import { camelToKebab } from '../utils/stringCaseConverter';
import { ObsidianTask } from './task';

export class TaskFormatter {
  indicatorTag: string;
  markdownSuffix: string;
  defaultMode: string;
  specialAttributes: string[] = ['completed', 'content', 'labels', 'description'];

  constructor(settingsStore: typeof SettingStore) {
    // Subscribe to the settings store
    settingsStore.subscribe((settings) => {
      this.indicatorTag = settings.parsingSettings.indicatorTag;
      this.markdownSuffix = settings.parsingSettings.markdownSuffix;
      this.defaultMode = settings.displaySettings.defaultMode;
    });
  }

  taskToMarkdown(task: ObsidianTask): string {
    const taskPrefix = `- [${task.completed ? 'x' : ' '}]`;
    const labelMarkdown = task.labels.join(' ');
    let taskMarkdown = `${taskPrefix} ${task.content} ${labelMarkdown} #${this.indicatorTag}`;
    taskMarkdown = taskMarkdown.replace(/\s+/g, ' '); // remove multiple spaces
  
    // Initialize an empty object to hold all attributes
    const allAttributes: { [key: string]: any } = {};
  
    // Iterate over keys in task, but exclude special attributes
    for (let key in task) {
      if (this.specialAttributes.includes(key)) continue;
  
      let value = task[key];
      if (value === undefined) {
        value = null;
      }
      allAttributes[key] = value;
    }
  
    // Add the attributes object to the markdown line
    taskMarkdown += `<span style="display:none">${JSON.stringify(allAttributes)}</span>`;

    // add suffix to task content
    taskMarkdown += this.markdownSuffix;

    // Add description
    if (task.description.length > 0) {
      // for each line, add 4 spaces
      taskMarkdown += `\n    ${task.description.replace(/\n/g, '\n    ')}`;
    }
  
    return taskMarkdown;
  }
  
}

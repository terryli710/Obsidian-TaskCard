import { TaskDisplayMode } from '../renderer/postProcessor';
import { SettingStore } from '../settings';
import { logger } from '../utils/log';
import { camelToKebab } from '../utils/stringCaseConverter';
import { ObsidianTask } from './task';

export class TaskFormatter {
  indicatorTag: string;
  markdownSuffix: string;
  defaultMode: string;
  specialAttributes: string[] = ['completed', 'content', 'labels'];

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
    let markdownLine = `${taskPrefix} ${task.content} ${labelMarkdown} #${this.indicatorTag}`;
    markdownLine = markdownLine.replace(/\s+/g, ' '); // remove multiple spaces
    markdownLine += '\n';

    // add TaskDisplayParams to task
    if (!task.metadata.taskDisplayParams) {
      task.metadata.taskDisplayParams = { mode: this.defaultMode as TaskDisplayMode };
    }

    // Iterate over keys in task, but exclude special attributes
    for (let key in task) {
      if (this.specialAttributes.includes(key)) continue;

      let value = task[key];
      if (value === undefined) {
        value = null;
      }
      value = JSON.stringify(value);

      let kebabCaseKey = camelToKebab(key);
      markdownLine += `<span class="${kebabCaseKey}" style="display:none;">${value}</span>\n`;
    }
    return markdownLine;
  }

  taskToMarkdownOneLine(task: ObsidianTask): string {
    // add suffix ' .' to task content
    const markdown = this.taskToMarkdown(task).replace(/\n/g, '');
    return markdown + this.markdownSuffix;
  }
}

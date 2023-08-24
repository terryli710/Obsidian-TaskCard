import { TaskMode } from '../renderer/postProcessor';
import { SettingStore } from '../settings';
import { logger } from '../utils/log';
import { camelToKebab } from '../utils/stringCaseConverter';
import { ObsidianTask } from './task';

export class TaskFormatter {
  indicatorTag: string;
  markdownSuffix: string;
  defaultMode: string;

  constructor(settingsStore: typeof SettingStore) {
    // Subscribe to the settings store
    settingsStore.subscribe((settings) => {
      this.indicatorTag = settings.parsingSettings.indicatorTag;
      this.markdownSuffix = settings.parsingSettings.markdownSuffix;
      this.defaultMode = settings.displaySettings.defaultMode;
    });
  }

  taskToMarkdown(task: ObsidianTask): string {
    let markdownLine = `- [${task.completed ? 'x' : ' '}] ${task.content} #${
      this.indicatorTag
    }\n`;

    // add TaskItemParams to task
    if (!task.metadata.taskItemParams) {
      task.metadata.taskItemParams = { mode: this.defaultMode as TaskMode };
    }

    // Iterate over keys in task, but exclude 'completed' and 'content'
    for (let key in task) {
      if (key === 'completed' || key === 'content') continue;

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

import type {
  MarkdownPostProcessor,
  MarkdownPostProcessorContext
} from 'obsidian';
import { MarkdownRenderChild } from 'obsidian';
import { logger } from '../log';

export class Emoji extends MarkdownRenderChild {
  static ALL_EMOJIS: Record<string, string> = {
    ':+1:': '👍',
    ':sunglasses:': '😎',
    ':smile:': '😄'
  };

  text: string;

  constructor(containerEl: HTMLElement, text: string) {
    super(containerEl);

    this.text = text;
  }

  onload() {
    const emojiEl = this.containerEl.createSpan({
      text: Emoji.ALL_EMOJIS[this.text] ?? this.text
    });
    this.containerEl.replaceWith(emojiEl);
  }
}

export const EmojiPostProcessor: MarkdownPostProcessor = async function (
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext
): Promise<void> {
  const codeblocks = el.querySelectorAll('code');

  for (let index = 0; index < codeblocks.length; index++) {
    const codeblock = codeblocks.item(index);
    const text = codeblock.textContent.trim();
    const isEmoji = text[0] === ':' && text[text.length - 1] === ':';
    if (isEmoji) {
      ctx.addChild(new Emoji(codeblock, text));
    }
  }
};

import { ObsidianTask } from '../taskModule/task';
export class TaskCard extends MarkdownRenderChild {
  taskEl: HTMLElement;
  task: ObsidianTask;

  constructor(taskEl: HTMLElement, task: ObsidianTask) {
    super(taskEl);

    this.taskEl = taskEl;
    this.task = task;
  }

  onload() {
    const content = this.taskEl.querySelector('.content')?.textContent;
    const priority = this.taskEl.querySelector('.priority')?.textContent;
    const description = this.taskEl.querySelector('.description')?.textContent;
    const order = this.taskEl.querySelector('.order')?.textContent;
    const projectId = this.taskEl.querySelector('.project-id')?.textContent;
    const sectionId = this.taskEl.querySelector('.section-id')?.textContent;
    const labels = this.taskEl.querySelector('.labels')?.textContent;
    const completed = this.taskEl.querySelector('.completed')?.textContent;
    const parent = this.taskEl.querySelector('.parent')?.textContent;
    const children = this.taskEl.querySelector('.children')?.textContent;
    const due = this.taskEl.querySelector('.due')?.textContent;
    const filePath = this.taskEl.querySelector('.file-path')?.textContent;

    const taskCardEl = this.containerEl.createEl('div', {cls: 'task-card'});
    taskCardEl.createEl('div', {cls: 'task-card-priority', text: `${priority}`});
    taskCardEl.createEl('div', {cls: 'task-card-description', text: description});
    taskCardEl.createEl('div', {cls: 'task-card-order', text: `${order}`});
    taskCardEl.createEl('div', {cls: 'task-card-project-id', text: `Project ID: ${projectId}`});
    taskCardEl.createEl('div', {cls: 'task-card-section-id', text: `Section ID: ${sectionId}`});
    taskCardEl.createEl('div', {cls: 'task-card-labels', text: `${labels}`});
    // taskCardEl.createEl('div', {cls: 'task-card-completed', text: `Completed: ${completed}`});
    taskCardEl.createEl('div', {cls: 'task-card-due', text: `Due: ${due}`});
    taskCardEl.createEl('div', {cls: 'task-card-file-path', text: `File Path: ${filePath}`});
  }
}

// The PostProcessor that identifies task markdown and applies the TaskCard class.
export const TaskCardPostProcessor: MarkdownPostProcessor = async function (
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext
): Promise<void> {
  // Select all task list items in the element.
  const taskItems = Array.from(el.querySelectorAll('.task-list-item'))
    .filter(item => item.querySelector('span[style="display:none;"]'));

  for (let i = 0; i < taskItems.length; i++) {
    const taskItem = taskItems[i] as HTMLElement;
    logger.debug(`taskItem: ${taskItem.innerHTML}`);
    const taskMarkdown = taskItem.textContent;
    const task = ObsidianTask.fromMarkdownLine(taskMarkdown);
    ctx.addChild(new TaskCard(taskItem, task));
  }
};
import {
  MarkdownRenderChild,
  type MarkdownPostProcessor,
  type MarkdownPostProcessorContext
} from 'obsidian';
import { logger } from '../log';
import type { SvelteComponent } from 'svelte';
import TaskItem from '../ui/TaskItem.svelte';

export type TaskMode = 'single-line' | 'multi-line';
export interface TaskItemParams {
  mode: TaskMode;
}
export class TaskItemSvelteAdapter extends MarkdownRenderChild {
  taskItemEl: HTMLElement;
  svelteComponent: SvelteComponent;
  params: TaskItemParams = {
    mode: 'single-line'
  }

  constructor(taskItemEl: HTMLElement) {
    super(taskItemEl);
    this.taskItemEl = taskItemEl;
  }
  
  setMode(mode: TaskMode) {
    this.params = { ...this.params, mode };
    this.svelteComponent.$set({ params: this.params });

    if (mode === 'single-line') {
      this.taskItemEl.addEventListener('click', this.handleSwitchMode);
      this.taskItemEl.addEventListener('keydown', this.handleKeydown);
      logger.debug('Switched to single line mode');
    } else if (mode === 'multi-line') {
      this.taskItemEl.removeEventListener('click', this.handleSwitchMode);
      this.taskItemEl.removeEventListener('keydown', this.handleKeydown);
      logger.debug('Switched to multi-line mode');
    } else {
      logger.error(`Unknown mode: ${mode}`);
    }
  }

  handleSwitchMode = (event: MouseEvent | KeyboardEvent) => {
    this.setMode('multi-line');
    if (event instanceof KeyboardEvent && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
    }
  }

  handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      this.handleSwitchMode(event);
    }
  }

  handleCustomSwitchModeEvent = (event: CustomEvent) => {
    const newMode = event.detail;
    this.setMode(newMode);
  }

  onload() {
    logger.debug(`taskItemEl: ${this.taskItemEl}`);
    logger.debug(`params: ${JSON.stringify(this.params)}`);
    this.svelteComponent = new TaskItem({
      target: this.taskItemEl,
      props: {
        taskItemEl: this.taskItemEl,
        params: this.params,
      },
    });

    this.svelteComponent.$on('switchMode', this.handleCustomSwitchModeEvent);

    this.setMode(this.params.mode);
  }

  onunload() {
    this.svelteComponent.$destroy();
    this.svelteComponent.$off('switchMode', this.handleCustomSwitchModeEvent);
  }
}

// The PostProcessor that identifies task markdown and applies the TaskCard class.
export const TaskCardPostProcessor: MarkdownPostProcessor = async function (
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext
): Promise<void> {
  // Select all task list items in the element.
  const taskCards = Array.from(el.querySelectorAll('.obsidian-taskcard'));

  const taskItems: HTMLElement[] = [];
  for (const taskCard of taskCards) { taskItems.push(taskCard.parentElement); }

  // print the first task's parent element
  for (let i = 0; i < taskItems.length; i++) {
    const taskItem = taskItems[i] as HTMLElement;
    ctx.addChild(new TaskItemSvelteAdapter(taskItem));
  }
};
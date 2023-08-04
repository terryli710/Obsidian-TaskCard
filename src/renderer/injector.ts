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

  switchToMultiLine = () => {
    this.params = {
      ... this.params,
      mode: 'multi-line'
    }
    logger.debug(`in injector.ts: switch to multi line mode`);
    // Update the mode prop in the Svelte component
    this.svelteComponent.$set({ params : this.params });
  }

  switchToSingleLine = () => {
    this.params = {
      ... this.params,
      mode: 'single-line'
    }
    logger.debug(`in injector.ts: switch to single line mode`);
    // Update the mode prop in the Svelte component
    this.svelteComponent.$set({ params : this.params });
  }

  // Method to handle the switchMode event
  handleSwitchModeEvent = (event: CustomEvent) => {
    const newMode = event.detail; // Assuming the new mode is passed directly as the event detail
    logger.debug(`In injector.ts: switching to mode: ${newMode}`);
    if (newMode === 'multi-line') {
      this.switchToMultiLine();
    } else if (newMode === 'single-line') {
      this.switchToSingleLine();
    } else {
      logger.error(`Unknown mode: ${newMode}`);
    }
    logger.debug(`params => ${JSON.stringify(this.params)}`);
  }

  handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      this.switchToMultiLine();
      event.preventDefault(); // Prevent the default action for the Space key
    }
  }

  onload() {
    // Assuming registerDomEvent can be used to register DOM events
    this.registerDomEvent(this.taskItemEl, 'click', this.switchToMultiLine);
    this.registerDomEvent(this.taskItemEl, 'keydown', this.handleKeydown);

    this.svelteComponent = new TaskItem({
      target: this.taskItemEl,
      props: {
        taskItemEl: this.taskItemEl,
        params: this.params,
      }
    });

    // Add the event listener
    this.svelteComponent.$on('switchMode', this.switchToSingleLine);

  }

  onunload() {
    this.svelteComponent.$destroy();

    // Remove the event listener
    this.svelteComponent.$off('switchMode', this.handleSwitchModeEvent);
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
import {
  MarkdownRenderChild,
  type MarkdownPostProcessor,
  type MarkdownPostProcessorContext
} from 'obsidian';
import { logger } from '../log';
import type { SvelteComponent } from 'svelte';
import TaskItem from '../ui/TaskItem.svelte';

export type TaskMode = 'single-line' | 'multi-line';

class SvelteAdapter extends MarkdownRenderChild {
  taskItemEl: HTMLElement;
  svelteComponent: SvelteComponent;
  mode: TaskMode = 'multi-line';
  
  constructor(taskItemEl: HTMLElement) {
    super(taskItemEl);
    this.taskItemEl = taskItemEl;
  }

  handleAction = () => {
    // switch to multi line
    this.mode = 'multi-line';

    // Update the mode prop in the Svelte component
    this.svelteComponent.$set({ mode: this.mode });
  }

  handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      this.handleAction();
      event.preventDefault(); // Prevent the default action for the Space key
    }
  }

  onload() {
    // Assuming registerDomEvent can be used to register DOM events
    this.registerDomEvent(this.taskItemEl, 'click', this.handleAction);
    this.registerDomEvent(this.taskItemEl, 'keydown', this.handleKeydown);

    this.svelteComponent = new TaskItem({
      target: this.taskItemEl,
      props: {
        taskItemEl: this.taskItemEl,
        mode: this.mode
      }
    });

  }

  onunload() {
    this.svelteComponent.$destroy();
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
    ctx.addChild(new SvelteAdapter(taskItem));
  }
};
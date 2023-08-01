import {
  MarkdownRenderChild,
  type MarkdownPostProcessor,
  type MarkdownPostProcessorContext
} from 'obsidian';
import TaskCard from '../ui/TaskCard.svelte';
import { logger } from '../log';
import type { SvelteComponent } from 'svelte';


class SvelteAdapter extends MarkdownRenderChild {
  taskEl: HTMLElement;
  svelteComponent: SvelteComponent; // You might want to replace 'any' with the actual Svelte component type

  constructor(taskEl: HTMLElement) {
    super(taskEl);
    this.taskEl = taskEl;
  }

  onload() {
    this.svelteComponent = new TaskCard({ target: this.taskEl, props: { taskEl: this.taskEl } });
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
  const taskItems = Array.from(el.querySelectorAll('.obsidian-taskcard'));

  for (let i = 0; i < taskItems.length; i++) {
    const taskItem = taskItems[i] as HTMLElement;
    logger.debug(`taskItem: ${taskItem.innerHTML}`);
    ctx.addChild(new SvelteAdapter(taskItem));
  }
};
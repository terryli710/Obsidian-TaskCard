import {
  MarkdownRenderChild,
  type MarkdownPostProcessor,
  type MarkdownPostProcessorContext
} from 'obsidian';
import { logger } from '../utils/log';
import type { SvelteComponent } from 'svelte';
import TaskItem from '../ui/TaskItem.svelte';
import { TaskCardSettings, SettingStore } from '../settings';
import { get } from 'svelte/store';
import TaskCardPlugin from '..';

export type TaskMode = 'single-line' | 'multi-line';
export interface TaskItemParams {
  mode: TaskMode;
}

export class TaskItemSvelteAdapter extends MarkdownRenderChild {
  taskItemEl: HTMLElement;
  svelteComponent: SvelteComponent;
  plugin: TaskCardPlugin;
  params: TaskItemParams;

  constructor(taskItemEl: HTMLElement, plugin: TaskCardPlugin) {
    super(taskItemEl);
    this.taskItemEl = taskItemEl;

    const initialSettings = get(SettingStore);
    this.params = { mode: initialSettings.displaySettings.defaultMode as TaskMode };

    this.plugin = plugin;
  }

  // Ensure to unsubscribe from the store when the object is destroyed to prevent memory leaks
  onDestroy() {

  }
  onload() {
    this.svelteComponent = new TaskItem({
      target: this.taskItemEl.parentElement,
      props: {
        taskItemEl: this.taskItemEl,
        plugin: this.plugin,
        defaultParams: this.params,
      },
      anchor: this.taskItemEl,
    });

  }

  onunload() {
    this.svelteComponent.$destroy();
    // this.svelteComponent.$off('switchMode', this.handleCustomSwitchModeEvent); // TODO: there's no $off for svelte components
  }
}

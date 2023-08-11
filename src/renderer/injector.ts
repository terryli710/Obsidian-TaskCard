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

  setMode(mode: TaskMode) {
    this.params = { ...this.params, mode };
    this.svelteComponent.$set({ params: this.params });

    if (mode === 'single-line') {
      this.taskItemEl.addEventListener('click', this.handleSwitchMode);
      this.taskItemEl.addEventListener('keydown', this.handleKeydown);
      logger.info('Switched to single line mode');
    } else if (mode === 'multi-line') {
      this.taskItemEl.removeEventListener('click', this.handleSwitchMode);
      this.taskItemEl.removeEventListener('keydown', this.handleKeydown);
      logger.info('Switched to multi-line mode');
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
    this.svelteComponent = new TaskItem({
      target: this.taskItemEl,
      props: {
        taskItemEl: this.taskItemEl,
        plugin: this.plugin,
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

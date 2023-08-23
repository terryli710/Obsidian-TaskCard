import { MarkdownRenderChild } from 'obsidian';
import { SvelteComponent } from 'svelte';
import TaskCardPlugin from '..';
import { get } from 'svelte/store';
import { SettingStore } from '../settings';
import { TaskStore } from './store';
import TaskItem from '../ui/TaskItem.svelte';
import {
  ObsidianTaskSyncManager,
  ObsidianTaskSyncProps
} from '../taskModule/taskSyncManager';
import { logger } from '../utils/log';

export type TaskMode = 'single-line' | 'multi-line';
export interface TaskItemParams {
  mode: TaskMode;
}

export class TaskItemSvelteAdapter extends MarkdownRenderChild {
  taskSync: ObsidianTaskSyncProps;
  taskSyncManager: ObsidianTaskSyncManager;
  svelteComponent: SvelteComponent;
  plugin: TaskCardPlugin;
  params: TaskItemParams;

  constructor(taskSync: ObsidianTaskSyncProps, plugin: TaskCardPlugin) {
    super(taskSync.taskItemEl);
    this.taskSync = taskSync;
    this.taskSyncManager = new ObsidianTaskSyncManager(plugin, taskSync);
    this.plugin = plugin;
    this.params = {
      mode: get(SettingStore).displaySettings.defaultMode as TaskMode
    }

    // Subscribe to taskModes in TaskStore to keep params.mode in sync
    this.plugin.taskStore.subscribe(async (taskModes) => {
      const mode = await this.plugin.taskStore.getModeBySync(this.taskSync);
      if (!mode) {
        this.plugin.taskStore.setModeBySync(this.taskSync);
        this.params.mode = this.plugin.taskStore.getDefaultMode(); // Assuming you have a getDefaultMode() method in TaskStore
      } else {
        this.params.mode = mode;
      }

      // Notify Svelte component about the change
      this.svelteComponent.$set({ params: this.params });
    });
  }

  onload() {
    this.svelteComponent = new TaskItem({
      target: this.taskSync.taskItemEl.parentElement,
      props: {
        taskSyncManager: this.taskSyncManager,
        plugin: this.plugin,
        defaultParams: this.params
      },
      anchor: this.taskSync.taskItemEl
    });

    // New element has been created right before the target element, now hide the target element
    this.taskSync.taskItemEl.style.display = 'none';
  }
}

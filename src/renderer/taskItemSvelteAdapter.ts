

import { MarkdownRenderChild } from 'obsidian';
import { SvelteComponent } from 'svelte';
import TaskCardPlugin from '..';
import TaskItem from '../ui/TaskItem.svelte';
import {
  ObsidianTaskSyncManager,
  ObsidianTaskSyncProps
} from '../taskModule/taskSyncManager';
import { logger } from '../utils/log';


export class TaskItemSvelteAdapter extends MarkdownRenderChild {
  taskSync: ObsidianTaskSyncProps;
  taskSyncManager: ObsidianTaskSyncManager;
  svelteComponent: SvelteComponent;
  plugin: TaskCardPlugin;
  
  constructor(taskSync: ObsidianTaskSyncProps, plugin: TaskCardPlugin) {
    super(taskSync.taskItemEl);
    this.taskSync = taskSync;
    this.taskSyncManager = new ObsidianTaskSyncManager(plugin, taskSync);
    this.plugin = plugin;
  }

  onload() {
    this.svelteComponent = new TaskItem({
      target: this.taskSync.taskItemEl.parentElement,
      props: {
        taskSyncManager: this.taskSyncManager,
        plugin: this.plugin,
        // defaultParams: this.params
      },
      anchor: this.taskSync.taskItemEl
    });

    // New element has been created right before the target element, now hide the target element
    this.taskSync.taskItemEl.style.display = 'none';
  }
}





import { MarkdownRenderChild } from 'obsidian';
import { SvelteComponent } from 'svelte';
import TaskCardPlugin from '..';
import TaskItem from '../ui/TaskItem.svelte';
import {
  ObsidianTaskSyncManager,
  ObsidianTaskSyncProps
} from '../taskModule/taskSyncManager';


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
    this.taskSync.taskItemEl.addClass('obsidian-taskcard-source-hidden');
    // the card now covers for the raw item; drop the pre-mount visibility hide
    this.taskSync.taskItemEl.classList.remove('obsidian-taskcard-mount-pending');
  }

  onunload() {
    if (this.svelteComponent) {
      this.svelteComponent.$destroy();
      this.svelteComponent = null;
    }
    if (this.taskSync.taskItemEl) {
      this.taskSync.taskItemEl.removeClass('obsidian-taskcard-source-hidden');
      this.taskSync.taskItemEl.classList.remove('obsidian-taskcard-mount-pending');
    }
  }
}



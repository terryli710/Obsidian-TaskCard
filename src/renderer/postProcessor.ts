
import { MarkdownRenderChild } from 'obsidian';
import { TaskItemData } from './index';
import { SvelteComponent } from 'svelte';
import TaskCardPlugin from '..';
import { get } from 'svelte/store';
import { SettingStore } from '../settings';
import TaskItem from '../ui/TaskItem.svelte';
import { ObsidianTaskSyncProps } from '../taskModule/taskSyncManager';

export type TaskMode = 'single-line' | 'multi-line';
export interface TaskItemParams {
    mode: TaskMode;
}

export class TaskItemSvelteAdapter extends MarkdownRenderChild {
    taskSync: ObsidianTaskSyncProps;
    svelteComponent: SvelteComponent;
    plugin: TaskCardPlugin;
    params: TaskItemParams;

    constructor(taskSync: ObsidianTaskSyncProps, plugin: TaskCardPlugin) {
        super(taskSync.taskItemEl);
        this.taskSync = taskSync;

        const initialSettings = get(SettingStore);
        this.params = { mode: initialSettings.displaySettings.defaultMode as TaskMode };

        this.plugin = plugin;
    }

    onload() {
        this.svelteComponent = new TaskItem({
            target: this.taskSync.taskItemEl.parentElement,
            props: {
                taskItemEl: this.taskSync.taskItemEl,
                plugin: this.plugin,
                defaultParams: this.params,
            },
            anchor: this.taskSync.taskItemEl,
        });
    
        // New element has been created right before the target element, now hide the target element
        this.taskSync.taskItemEl.style.display = 'none';
    }
}
    
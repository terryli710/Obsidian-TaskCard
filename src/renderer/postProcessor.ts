
import { MarkdownRenderChild } from 'obsidian';
import { TaskItemData } from './index';
import { SvelteComponent } from 'svelte';
import TaskCardPlugin from '..';
import { get } from 'svelte/store';
import { SettingStore } from '../settings';
import TaskItem from '../ui/TaskItem.svelte';

export type TaskMode = 'single-line' | 'multi-line';
export interface TaskItemParams {
    mode: TaskMode;
}

export class TaskItemSvelteAdapter extends MarkdownRenderChild {
    taskItemData: TaskItemData;
    svelteComponent: SvelteComponent;
    plugin: TaskCardPlugin;
    params: TaskItemParams;

    constructor(taskItemData: TaskItemData, plugin: TaskCardPlugin) {
        super(taskItemData.el);
        this.taskItemData = taskItemData;

        const initialSettings = get(SettingStore);
        this.params = { mode: initialSettings.displaySettings.defaultMode as TaskMode };

        this.plugin = plugin;
    }

    onload() {
        this.svelteComponent = new TaskItem({
            target: this.taskItemData.el.parentElement,
            props: {
                taskItemEl: this.taskItemData.el,
                plugin: this.plugin,
                defaultParams: this.params,
            },
            anchor: this.taskItemData.el,
        });
    
        // Replace the original li element with the new task card element
        const newTaskCardElement = this.svelteComponent.$el;
        this.taskItemData.el.parentElement.replaceChild(newTaskCardElement, this.taskItemData.el);
    }
}
    
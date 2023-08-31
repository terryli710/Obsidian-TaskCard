import { MarkdownRenderChild, Workspace } from "obsidian";
import { SvelteComponent } from 'svelte';
import StaticTaskList from '../ui/StaticTaskList.svelte';
import { MarkdownTaskMetadata } from "./staticTaskListRenderer";
import { ObsidianTask } from "../taskModule/task";
import TaskCardPlugin from "..";


export class StaticTaskListSvelteAdapter extends MarkdownRenderChild {
    plugin: TaskCardPlugin
    svelteComponent: SvelteComponent
    codeBlockEl: HTMLElement
    taskListInfo: {task: ObsidianTask, markdownTaskMetadata: MarkdownTaskMetadata}[]

    constructor(
        plugin: TaskCardPlugin,
        codeBlockEl: HTMLElement, 
        taskListInfo: {task: ObsidianTask, 
            markdownTaskMetadata: MarkdownTaskMetadata}[]) {
        super(codeBlockEl);
        this.plugin = plugin
        this.codeBlockEl = codeBlockEl
        this.taskListInfo = taskListInfo
    }

    onload() {
        this.svelteComponent = new StaticTaskList({
            target: this.codeBlockEl,
            props: {
                taskListInfo: this.taskListInfo,
                plugin: this.plugin
            }
        })
    }
}

// openLinkText to link to the original markdown task
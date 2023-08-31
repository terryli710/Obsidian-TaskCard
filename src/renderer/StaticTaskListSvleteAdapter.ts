import { MarkdownRenderChild } from "obsidian";
import { SvelteComponent } from 'svelte';
import StaticTaskList from '../ui/StaticTaskList.svelte';
import { MarkdownTaskMetadata } from "./staticTaskListRenderer";
import { ObsidianTask } from "../taskModule/task";


export class StaticTaskListSvelteAdapter extends MarkdownRenderChild {
    svelteComponent: SvelteComponent
    codeBlockEl: HTMLElement
    taskListInfo: {task: ObsidianTask, markdownTaskMetadata: MarkdownTaskMetadata}[]

    constructor(codeBlockEl: HTMLElement, 
        taskListInfo: {task: ObsidianTask, 
            markdownTaskMetadata: MarkdownTaskMetadata}[]) {
        super(codeBlockEl);
        this.codeBlockEl = codeBlockEl
        this.taskListInfo = taskListInfo
    }

    onload() {
        this.svelteComponent = new StaticTaskList({
            target: this.codeBlockEl,
            props: {
                taskListInfo: this.taskListInfo
            }
        })
    }
}

// openLinkText to link to the original markdown task
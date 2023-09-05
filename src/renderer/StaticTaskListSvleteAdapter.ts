// import { MarkdownRenderChild, Workspace } from "obsidian";
// import { SvelteComponent } from 'svelte';
// import StaticTaskList from '../ui/StaticTaskList.svelte';
// import { MarkdownTaskMetadata } from "./staticTaskListRenderer";
// import { ObsidianTask, PositionedObsidianTask } from "../taskModule/task";
// import TaskCardPlugin from "..";
// import { QuerySyncManager } from "../query/querySyncManager";


// export class StaticTaskListSvelteAdapter extends MarkdownRenderChild {
//     plugin: TaskCardPlugin
//     svelteComponent: SvelteComponent
//     codeBlockEl: HTMLElement
//     positionedTaskList: PositionedObsidianTask[]

//     constructor(
//         plugin: TaskCardPlugin,
//         codeBlockEl: HTMLElement, 
//         positionedTaskList: PositionedObsidianTask[]) {
//         super(codeBlockEl);
//         this.plugin = plugin
//         this.codeBlockEl = codeBlockEl
//         this.positionedTaskList = positionedTaskList
//     }

//     onload() {
//         this.svelteComponent = new StaticTaskList({
//             target: this.codeBlockEl,
//             props: {
//                 taskList: this.positionedTaskList,
//                 plugin: this.plugin
//                 QuerySyncManager
//             }
//         })
//     }
// }

// // openLinkText to link to the original markdown task
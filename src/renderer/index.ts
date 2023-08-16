import { MarkdownPostProcessor, MarkdownPostProcessorContext, MarkdownSectionInformation, htmlToMarkdown } from "obsidian";
import TaskCardPlugin from "..";
import { filterTaskItems, getIndicesOfFilter, isTaskItemEl, isTaskList } from "./filters";
import { TaskValidator } from "../taskModule/taskValidator";
import { TaskItemSvelteAdapter } from "./postProcessor";
import { logger } from "../utils/log";
import { ObsidianTaskSyncProps } from "../taskModule/taskSyncManager";

export interface TaskItemData {
    // HTML information about the TaskItem
    el: HTMLElement;
    origHTML: string;
    mdSectionInfo: MarkdownSectionInformation;
    lineNumberInSection: number;
    lineNumberEndsInSection?: number;
    markdown: string;
}


export class TaskCardRenderManager {
    // - Post Processor = input el and MarkdownPostProcessorContext
    // 1. filter the elements;
    // 2. pin point the markdown text for the filtered element;
    // 3. render the filtered element using customized svelte component;
    // 4. methods to call for editing the attributes of the tasks;
    private plugin: TaskCardPlugin;
    private taskItemFilter: ((elems: HTMLElement) => boolean)
    constructor(plugin: TaskCardPlugin) {
        this.plugin = plugin
        
        this.taskItemFilter = ((taskValidator: TaskValidator) => (elem: HTMLElement) => isTaskItemEl(elem, taskValidator))(this.plugin.taskValidator);

    }

    getPostProcessor(): MarkdownPostProcessor {
        const postProcessor = async (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
            // logger.debug(`PostProcessor - before onload: el: ${el.innerHTML}`)
            
            const taskSyncs: ObsidianTaskSyncProps[] = await this.constructTaskSync(el, ctx)

            for (const taskSync of taskSyncs) {
                const processor = new TaskItemSvelteAdapter(taskSync, this.plugin);
                processor.onload();
                }
            // logger.debug(`PostProcessor - after onload: el: ${el.innerHTML}`)
            }
        return postProcessor
    }

    async constructTaskSync(sectionDiv: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<ObsidianTaskSyncProps[]> {
        // markdownTask is null (not used here)
        const section: HTMLElement = sectionDiv.children[0] as HTMLElement;
        if (!isTaskList(section)) return [];
        const taskItemsIndices: number[] = getIndicesOfFilter(
            Array.from(section.children) as HTMLElement[], 
            this.taskItemFilter
        );
        if (taskItemsIndices.length === 0) return [];
        
        const mdSectionInfo = ctx.getSectionInfo(section);
        const sourcePath = ctx.sourcePath;
        const lineNumbers: number[] = taskItemsIndices.map((index) => getLineNumberOfListItem(section, index));

        const taskSyncs: ObsidianTaskSyncProps[] = taskItemsIndices.map((index, i) => {
            const taskItemEl: HTMLElement = section.children[index] as HTMLElement;
            const lineStartInSection = lineNumbers[i];
            const lineEndsInSection = lineNumbers[i + 1]; // currently just 1 line
            const obsidianTask = this.plugin.taskParser.parseTaskEl(taskItemEl);
            return {
                obsidianTask: obsidianTask,
                markdownTask: null,
                taskItemEl: taskItemEl,
                taskMetadata: {
                    sourcePath: sourcePath,
                    mdSectionInfo: mdSectionInfo,
                    lineStartInSection: lineStartInSection,
                    lineEndsInSection: lineEndsInSection,
                }
            }
        })
        return taskSyncs

    }

}


export function getLineNumberOfListItem(ul: HTMLElement, index: number): number {
    let lineNumber = 0;
    for (let i = 0; i < index; i++) {
        lineNumber += htmlToMarkdown(ul.children[i].innerHTML).split('\n').length;
    }
    return lineNumber;
}
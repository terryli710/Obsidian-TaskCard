import { MarkdownPostProcessor, MarkdownPostProcessorContext, MarkdownSectionInformation, htmlToMarkdown } from "obsidian";
import TaskCardPlugin from "..";
import { filterTaskItems, getIndicesOfFilter, isTaskItemEl, isTaskList } from "./filters";
import { TaskValidator } from "../taskModule/taskValidator";
import { TaskItemSvelteAdapter } from "./postProcessor";
import { logger } from "../utils/log";

export interface TaskItemData {
    // HTML information about the TaskItem
    el: HTMLElement;
    origHTML: string;
    mdSectionInfo: MarkdownSectionInformation;
    lineNumberInSection: number;
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
            logger.debug(`PostProcessor - before onload: el: ${el.innerHTML}`)
            
            const taskItems: TaskItemData[] = this.constructTaskItemsFromSectionElement(el, ctx);

            for (const taskItem of taskItems) {
                const processor = new TaskItemSvelteAdapter(taskItem, this.plugin);
                processor.onload();
                }
            logger.debug(`PostProcessor - after onload: el: ${el.innerHTML}`)
            }
        return postProcessor
    }

    constructTaskItemsFromSectionElement(
            sectionDiv: HTMLElement, 
            ctx: MarkdownPostProcessorContext): TaskItemData[] {
        const section: HTMLElement = sectionDiv.children[0] as HTMLElement;
        // logger.debug(`constructTaskItemsFromSectionElement: section: ${section.outerHTML}`)
        if (!isTaskList(section)) return []
        const taskItemsIndices: number[] = getIndicesOfFilter(
            Array.from(section.children) as HTMLElement[], 
            this.taskItemFilter
        )
        
        if (taskItemsIndices.length === 0) return []
        const mdSectionInfo = ctx.getSectionInfo(section)
        const lineNumbers: number[] = taskItemsIndices.map((index) => getLineNumberOfListItem(section, index));
        
        const taskItems: TaskItemData[] = taskItemsIndices.map((index, i) => {
            const el = section.children[index] as HTMLElement;
            const origHTML = el.outerHTML;
            const lineNumberInSection = lineNumbers[i];
            const markdown = el.innerText;
            return { el, origHTML, mdSectionInfo, lineNumberInSection, markdown };
        });

        // logger.debug(`constructTaskItemsFromSectionElement: taskItems: ${JSON.stringify(taskItems)}`)

        return taskItems;
    }


}



export function getLineNumberOfListItem(ul: HTMLElement, index: number): number {
    let lineNumber = 0;
    for (let i = 0; i < index; i++) {
        lineNumber += htmlToMarkdown(ul.children[i].innerHTML).split('\n').length;
    }
    return lineNumber;
}
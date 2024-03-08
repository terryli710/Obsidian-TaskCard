import { SvelteComponent } from "svelte"
import TaskCardPlugin from ".."
import QueryEditor from "../ui/QueryEditor.svelte";
import StaticTaskList from '../ui/StaticTaskList.svelte';
import { QuerySyncManager } from "../query/querySyncManager"
import { MarkdownPostProcessorContext, MarkdownSectionInformation } from "obsidian"
import { logger } from "../utils/log";
import StaticTaskMatrix from "../ui/StaticTaskMatrix.svelte";
import QueryDisplay from "../ui/QueryDisplay.svelte";


export class QueryAndTaskListSvelteAdapter {
    plugin: TaskCardPlugin
    svelteComponent: SvelteComponent
    codeBlockEl: HTMLElement
    codeBlockMetadata: {
        sectionEl: HTMLElement
        ctx: MarkdownPostProcessorContext
        sourcePath: string
        lineStart: number
        lineEnd: number
    }
    querySyncManager: QuerySyncManager

    constructor(
        plugin: TaskCardPlugin, 
        blockLanguage: string, 
        source: string,
        el: HTMLElement, 
        ctx: MarkdownPostProcessorContext,
    ) {
        this.plugin = plugin
        this.codeBlockEl = el
        const mdSectionInfo: MarkdownSectionInformation = ctx.getSectionInfo(el);
        this.codeBlockMetadata = {
        sectionEl: el,
        ctx: ctx,
        sourcePath: ctx.sourcePath,
        lineStart: mdSectionInfo.lineStart,
        lineEnd: mdSectionInfo.lineEnd
        }
        this.querySyncManager = new QuerySyncManager(
            this.plugin,
            blockLanguage,
            source,
            this.codeBlockMetadata
        )
    }

    async onload() {
        if (this.querySyncManager.editMode) {
            this.svelteComponent = new QueryEditor({
                target: this.codeBlockEl,
                props: {
                    options: this.querySyncManager.getOptions(),
                    query: this.querySyncManager.taskQuery,
                    querySyncManager: this.querySyncManager,
                    paths: this.plugin.fileOperator.getAllFilesAndFolders(),
                }
            })
        } else {
            this.svelteComponent = new QueryDisplay({
                    target: this.codeBlockEl,
                    props: {
                        taskList: await this.querySyncManager.getFilteredTasks(),
                        plugin: this.plugin,
                        querySyncManager: this.querySyncManager,
                        displayMode: this.plugin.settings.displaySettings.queryDisplayMode,
                    }
                })

        }

    }
}
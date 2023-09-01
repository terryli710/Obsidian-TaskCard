import { SvelteComponent } from "svelte"
import TaskCardPlugin from ".."
import { MultipleAttributeTaskQuery } from "../query/cache"
import QueryEditor from "../ui/QueryEditor.svelte"
import { QuerySyncManager } from "../query/querySyncManager"
import { MarkdownPostProcessorContext, MarkdownSectionInformation } from "obsidian"
import { logger } from "../utils/log"



export class QueryEditorSvelteAdapter {
    plugin: TaskCardPlugin
    svelteComponent: SvelteComponent
    codeBlockEl: HTMLElement
    codeBlockMetadata: {
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

    onload() {
        logger.debug(`QueryEditorSvelteAdapter.onload, options: ${JSON.stringify(this.querySyncManager.options)}`)
        logger.debug(`QueryEditorSvelteAdapter.onload, query: ${JSON.stringify(this.querySyncManager.taskQuery)}`)
        this.svelteComponent = new QueryEditor({
            target: this.codeBlockEl,
            props: {
                options: this.querySyncManager.options,
                query: this.querySyncManager.taskQuery,
                querySyncManager: this.querySyncManager
            }
        })
    }
}
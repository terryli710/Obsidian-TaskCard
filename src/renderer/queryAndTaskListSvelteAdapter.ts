import { SvelteComponent } from "svelte"
import TaskCardPlugin from ".."
import QueryEditor from "../ui/QueryEditor.svelte";
import StaticTaskList from '../ui/StaticTaskList.svelte';
import { normalizeQueryDisplayMode, QuerySyncManager } from "../query/querySyncManager"
import { MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownSectionInformation } from "obsidian"
import { logger } from "../utils/log";
import StaticTaskMatrix from "../ui/StaticTaskMatrix.svelte";
import QueryDisplay from "../ui/QueryDisplay.svelte";


export class QueryAndTaskListSvelteAdapter extends MarkdownRenderChild {
    plugin: TaskCardPlugin
    svelteComponent: SvelteComponent
    codeBlockEl: HTMLElement
    codeBlockMetadata: {
        sectionEl: HTMLElement
        ctx: MarkdownPostProcessorContext
        sourcePath: string
        lineStart: number | null
        lineEnd: number | null
    }
    querySyncManager: QuerySyncManager

    constructor(
        plugin: TaskCardPlugin,
        blockLanguage: string,
        source: string,
        el: HTMLElement,
        ctx: MarkdownPostProcessorContext,
    ) {
        super(el)
        this.plugin = plugin
        this.codeBlockEl = el
        // getSectionInfo returns null once the element is detached from the
        // rendered document; QuerySyncManager re-resolves the span at write time
        const mdSectionInfo: MarkdownSectionInformation | null = ctx.getSectionInfo(el);
        this.codeBlockMetadata = {
        sectionEl: el,
        ctx: ctx,
        sourcePath: ctx.sourcePath,
        lineStart: mdSectionInfo?.lineStart ?? null,
        lineEnd: mdSectionInfo?.lineEnd ?? null
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
                        displayMode: this.querySyncManager.displayMode
                            ?? normalizeQueryDisplayMode(this.plugin.settings.displaySettings.queryDisplayMode),
                    }
                })

        }

    }

    onunload() {
        if (this.svelteComponent) {
            this.svelteComponent.$destroy();
            this.svelteComponent = null;
        }
    }
}

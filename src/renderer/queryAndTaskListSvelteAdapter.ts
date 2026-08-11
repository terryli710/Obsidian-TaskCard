import { SvelteComponent } from "svelte"
import TaskCardPlugin from ".."
import QueryEditor from "../ui/QueryEditor.svelte";
import { normalizeQueryDisplayMode, QuerySyncManager } from "../query/querySyncManager"
import { MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownSectionInformation } from "obsidian"
import QueryDisplay from "../ui/QueryDisplay.svelte";
import { logger } from "../utils/log";


export class QueryAndTaskListSvelteAdapter extends MarkdownRenderChild {
    plugin: TaskCardPlugin
    svelteComponent: SvelteComponent
    private unloaded = false
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

    // MarkdownRenderChild.onload is declared void; returning a promise from it
    // means Obsidian never sees the failure and cannot know the mount is still
    // in flight. Keep the override sync and own the async work here — including
    // the unload race, since getFilteredTasks() can resolve after the block has
    // already been torn down, which would otherwise leak an orphan component.
    onload(): void {
        void this.mount().catch((err) =>
            logger.error(`Failed to render taskcard query block: ${err}`)
        );
    }

    private async mount(): Promise<void> {
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
            const taskList = await this.querySyncManager.getFilteredTasks();
            if (this.unloaded) return;
            this.svelteComponent = new QueryDisplay({
                    target: this.codeBlockEl,
                    props: {
                        taskList,
                        plugin: this.plugin,
                        querySyncManager: this.querySyncManager,
                        displayMode: this.querySyncManager.displayMode
                            ?? normalizeQueryDisplayMode(this.plugin.settings.displaySettings.queryDisplayMode),
                    }
                })

        }

    }

    onunload() {
        this.unloaded = true;
        if (this.svelteComponent) {
            this.svelteComponent.$destroy();
            this.svelteComponent = null;
        }
    }
}

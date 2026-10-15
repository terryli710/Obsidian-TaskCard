<script lang="ts">
    import { PositionedObsidianTask } from "../taskModule/task";
    import TaskCardPlugin from "..";
    import { QuerySyncManager } from "../query/querySyncManager";
    import StaticTaskList from "./StaticTaskList.svelte";
    import StaticTaskMatrix from "./StaticTaskMatrix.svelte";

    import { normalizeListPresentation } from '../query/listPresentation';

    export let taskList: PositionedObsidianTask[];
    export let plugin: TaskCardPlugin;
    export let querySyncManager: QuerySyncManager;
    export let displayMode: string = "list";

    const presentation = normalizeListPresentation(querySyncManager.listPresentation);

    const cacheInitialized = plugin.cache.taskCache.status.initialized;
    $: completedTaskCount = taskList.filter(task => task.completed).length;

    function refreshCompletionCounts() {
        // Completion changes and reversions refresh query and quadrant summaries.
        taskList = taskList;
    }


    function toEditMode() {
        querySyncManager.toEditMode();
    }


</script>

<ul class="query-results contain-task-list has-list-bullet">
    {#if cacheInitialized}
        <div class="query-header">
            <span class="query-header-label">Tasks</span>
            <span class="query-count" title="Tasks shown / indexed TaskCard tasks in this vault">{taskList.length} shown / {plugin.cache.taskCache.getLength()} in vault</span>
        </div>
    {/if}
    {#if !cacheInitialized}
        <div class="error-page">
            <h2>Tasks Not Fully Indexed in Obsidian TaskCard</h2>
            <!-- TODO: Can we link to the plugin settings here? -->
            <p>The <code>Obsidian TaskCard</code> plugin requires the <a href="https://obsidian.md/plugins?id=dataview" target="_blank"><code>Dataview</code></a> plugin to query tasks effectively. Please follow these steps to ensure full functionality:</p>
            <ol>
                <li><strong>Install Dataview Plugin:</strong> Navigate to <em>Settings &gt; Community Plugins &gt; Browse</em> in Obsidian, and search for "Dataview". Install the plugin.</li>
                <li><strong>Enable Dataview:</strong> After installation, make sure the Dataview plugin is enabled in <em>Settings &gt; Community Plugins &gt; Installed Plugins</em>.</li>
            </ol>
            <p>For more detailed information and assistance, visit <a href="https://github.com/blacksmithgu/obsidian-dataview" target="_blank">Dataview GitHub</a>.</p>
            <p>Tasks Not Fully Indexed. Please make sure that the <a href="https://github.com/blacksmithgu/obsidian-dataview" target="_blank" rel="noopener noreferrer">dataview</a> plugin is also enabled in Obsidian. This is necessary for this feature to work properly</p>
        </div>
    {:else if taskList.length > 0}
        {#if displayMode === "matrix"}
            <StaticTaskMatrix {taskList} {plugin} on:completionChange={refreshCompletionCounts} />
        {:else}
            <StaticTaskList {taskList} {plugin} {presentation} on:completionChange={refreshCompletionCounts} />
        {/if}
    {:else}
        <div class="error-page">
            <h2>No Tasks Found</h2>
            <p>It looks like there are no tasks that match your filter.</p>
        </div>
    {/if}
</ul>
<div class="query-footer">
    <span class="query-count" title="Completed tasks / tasks shown in this query">{completedTaskCount} / {taskList.length} done</span>
    <button class="edit-link" on:click={toEditMode}>Edit</button>
</div>

<style>
    .query-results {
        margin-bottom: 0;
    }

    .query-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        padding: 0 2px 6px;
    }

    .query-header-label {
        font-size: 11px;
        font-weight: 600;
        color: var(--text-faint);
        text-transform: uppercase;
        letter-spacing: 0.08em;
    }

    .query-count {
        font-size: var(--font-ui-smaller);
        color: var(--text-faint);
        font-variant-numeric: tabular-nums;
    }

    .query-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 0;
        padding: 13px 2px 0;
        border-top: none;
    }

    .edit-link {
        padding: 0;
        border: none;
        background: transparent;
        box-shadow: none;
        color: var(--text-muted);
        font-size: var(--font-ui-smaller);
        cursor: pointer;
    }

    .edit-link:hover {
        color: var(--text-normal);
        text-decoration: underline;
    }

    .error-page {
        text-align: left;
        font-size: 14px;
        color: var(--text-muted);
        margin: 20px;
    }

    .error-page h2 {
        text-align: center;
        font-size: 24px;
        margin-bottom: 10px;
    }

    .error-page p {
        margin-bottom: 20px;
    }

</style>

<script lang="ts">
    import { ObsidianTask, PositionedObsidianTask } from "../taskModule/task";
    import StaticTaskItem from './StaticTaskItem.svelte';
    import TaskCardPlugin from "..";
    import { logger } from "../utils/log";
    import { QuerySyncManager } from "../query/querySyncManager";
    import StaticTaskList from "./StaticTaskList.svelte";
    import StaticTaskMatrix from "./StaticTaskMatrix.svelte";
    import { DisplayMode } from "../types";

    export let taskList: PositionedObsidianTask[];
    export let plugin: TaskCardPlugin;
    export let querySyncManager: QuerySyncManager;
    let displayMode: string = querySyncManager.taskQuery.displayModeQuery || DisplayMode.List;

    const cacheInitialized = plugin.cache.taskCache.status.initialized;


    function toEditMode() {
        querySyncManager.toEditMode();
    }


</script>

<ul class="contain-task-list has-list-bullet">
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
        {#if displayMode === "list"}
            <StaticTaskList {taskList} {plugin} />
        {:else if displayMode === "matrix"}
            <StaticTaskMatrix {taskList} {plugin} />
        {/if}
    {:else}
        <div class="error-page">
            <h2>No Tasks Found</h2>
            <p>It looks like there are no tasks that match your filter.</p>
        </div>
    {/if}
</ul>
<div class="button-menu">
    <span class="list-stats">TaskCard Query: {taskList.length} / {querySyncManager.plugin.cache.taskCache.getLength()} tasks.</span>
    <button class="edit-button" on:click={toEditMode}>Edit</button>

</div>

<style>
    .button-menu {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .edit-button {
        width: 40%;
        color: var(--text-normal);
        margin: 10px;
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

    .list-stats {
        font-size: var(--font-ui-small);
        color: var(--text-muted);
    }
</style>

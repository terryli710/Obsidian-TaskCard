<script lang="ts">
    import { ObsidianTask, PositionedObsidianTask } from "../taskModule/task";
    import StaticTaskItem from './StaticTaskItem.svelte';
    import TaskCardPlugin from "..";
    import { logger } from "../utils/log";
    import { QuerySyncManager } from "../query/querySyncManager";

    export let taskList: PositionedObsidianTask[];
    export let plugin: TaskCardPlugin;
    export let querySyncManager: QuerySyncManager;

    const cacheInitialized = plugin.cache.taskCache.status.initialized;

    function toEditMode() {
        querySyncManager.toEditMode();
    }
</script>

<ul class="contain-task-list has-list-bullet">
    {#if !cacheInitialized}
        <div class="error-page">
            <h2>Task Card Query Failed</h2>
            <p>Tasks Not Fully Indexed. Please make sure that the <a href="https://github.com/blacksmithgu/obsidian-dataview" target="_blank" rel="noopener noreferrer">dataview</a> plugin is also enabled in Obsidian. This is necessary for this feature to work properly</p>
        </div>
    {:else if taskList.length > 0}
        {#each taskList as taskItem}
            <StaticTaskItem {taskItem} {plugin} />
        {/each}
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
        text-align: center;
        font-size: 14px;
        color: var(--text-muted);
        margin: 20px;
    }

    .error-page h2 {
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

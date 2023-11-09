<script lang="ts">
    import { ObsidianTask, PositionedObsidianTask } from "../taskModule/task";
    import StaticTaskItem from './StaticTaskItem.svelte';
    import TaskCardPlugin from "..";
    import { logger } from "../utils/log";
    import { QuerySyncManager } from "../query/querySyncManager";
    import StaticTaskCard from "./StaticTaskCard.svelte";

    export let taskList: PositionedObsidianTask[];
    export let plugin: TaskCardPlugin;
    export let querySyncManager: QuerySyncManager;

    const cacheInitialized = plugin.cache.taskCache.status.initialized;

    function toEditMode() {
        querySyncManager.toEditMode();
    }

    let counts = {
        do: 0,
        plan: 0,
        delegate: 0,
        delete: 0
    };

    $: if(taskList) {
        counts = taskList.reduce((acc, task) => {
            const category = categorizeTasks(task);
            acc[category] = (acc[category] || 0) + 1;
            return acc;
        }, counts);
    }

    function categorizeTasks(task: PositionedObsidianTask): string {
        if (task.priority > 1 && task.due) {
            return "do"; // was "important-urgent"
        } else if (task.priority > 1 && !task.due) {
            return "plan"; // was "important-not-urgent"
        } else if (!(task.priority > 1) && task.due) {
            return "delegate"; // was "not-important-urgent"
        } else {
            return "delete"; // was "not-important-not-urgent"
        }
    }
</script>

<ul class="contain-task-list has-list-bullet">
    {#if !cacheInitialized}
        <div class="error-page">
            <h2>Task Card Query Failed</h2>
            <p>Tasks Not Fully Indexed. Please make sure that the <a href="https://github.com/blacksmithgu/obsidian-dataview" target="_blank" rel="noopener noreferrer">dataview</a> plugin is also enabled in Obsidian. This is necessary for this feature to work properly</p>
        </div>
    {:else if taskList.length > 0}
        <div class="matrix-container">
            <div class="category do">
                <div class="category-title">Do ({counts.do})</div>
                <div class="task-list">
                    <ul class="contain-task-list has-list-bullet">
                    {#each taskList as taskItem}
                        {#if categorizeTasks(taskItem) === "do"}
                        <StaticTaskItem {taskItem} {plugin} />
                        {/if}
                    {/each}
                    </ul>
                </div>
            </div>
            <div class="category plan">
                <div class="category-title">Plan ({counts.plan})</div>
                <div class="task-list">
                    <ul class="contain-task-list has-list-bullet">
                    {#each taskList as taskItem}
                        {#if categorizeTasks(taskItem) === "plan"}
                        <StaticTaskItem {taskItem} {plugin} />
                        {/if}
                    {/each}
                    </ul>
                </div>
            </div>
            <div class="category delegate">
                <div class="category-title">Delegate ({counts.delegate})</div>
                <div class="task-list">
                    <ul class="contain-task-list has-list-bullet">
                    {#each taskList as taskItem}
                        {#if categorizeTasks(taskItem) === "delegate"}
                        <StaticTaskItem {taskItem} {plugin} />
                        {/if}
                    {/each}
                    </ul>
                </div>
            </div>
            <div class="category delete">
                <div class="category-title">Delete ({counts.delete})</div>
                <div class="task-list">
                    <ul class="contain-task-list has-list-bullet">
                    {#each taskList as taskItem}
                        {#if categorizeTasks(taskItem) === "delete"}
                        <StaticTaskItem {taskItem} {plugin} />
                        {/if}
                    {/each}
                    </ul>
                </div>
            </div>
        </div>
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

    *, *:before, *:after {
    box-sizing: border-box;
    }

    /* Add CSS for the 2x2 grid layout */
    .matrix-container {
        display: grid;
        grid-template-columns: 1fr 1fr; /* 2 columns with equal width */
        grid-template-rows: auto auto; /* Auto-size rows based on content */
        gap: 10px; /* Adjust the gap as needed */
        max-width: 100%; /* Set the maximum width to 100% */
        overflow-x: hidden; /* Disable horizontal scrolling for the whole grid */
    }

    /* Add styles for each category */
    .category {
        flex: 1 1 auto;
        overflow: auto;
        background-color: transparent; /* Set a transparent background */
        padding: 0; /* Remove padding */
        max-height: 50vh; /* Allow vertical scrolling within each category */
        overflow: hidden;
    }

    .task-list {
        width: 100%;
        max-height: 250px;
        overflow-x: hidden;
        overflow-y: auto;
    }

    .category-title {
        font-size: 1em; /* Smaller size, adjust as needed */
        font-weight: bold;
        margin-bottom: 0.5em;
        padding: 0.25em;
        /* Add more styles as needed for prettiness */
    }
    
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

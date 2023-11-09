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

    // Define a function to categorize tasks
    function categorizeTasks(task: PositionedObsidianTask): string {
        // For demo purposes, you can design how to categorize tasks here
        // For example, you can use task properties like 'important' and 'urgent'
        if (task.priority > 1 && task.due) {
            return "important-urgent";
        } else if (task.priority > 1 && !task.due) {
            return "important-not-urgent";
        } else if (!(task.priority > 1) && task.due) {
            return "not-important-urgent";
        } else {
            return "not-important-not-urgent";
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
            <div class="category important-urgent">
                <h3>Important and Urgent</h3>
                <div class="task-list">
                    <ul class="contain-task-list has-list-bullet">
                    {#each taskList as taskItem}
                        {#if categorizeTasks(taskItem) === "important-urgent"}
                        <StaticTaskItem {taskItem} {plugin} />
                        {/if}
                    {/each}
                    </ul>
                </div>
            </div>
            <div class="category important-not-urgent">
                <h3>Important and Not Urgent</h3>
                <div class="task-list">
                    <ul class="contain-task-list has-list-bullet">
                    {#each taskList as taskItem}
                        {#if categorizeTasks(taskItem) === "important-not-urgent"}
                        <StaticTaskItem {taskItem} {plugin} />
                        {/if}
                    {/each}
                    </ul>
                </div>
            </div>
            <div class="category not-important-urgent">
                <h3>Not Important and Urgent</h3>
                <div class="task-list">
                    <ul class="contain-task-list has-list-bullet">
                    {#each taskList as taskItem}
                        {#if categorizeTasks(taskItem) === "not-important-urgent"}
                        <StaticTaskItem {taskItem} {plugin} />
                        {/if}
                    {/each}
                    </ul>
                </div>
            </div>
            <div class="category not-important-not-urgent">
                <h3>Not Important and Not Urgent</h3>
                <div class="task-list">
                    <ul class="contain-task-list has-list-bullet">
                    {#each taskList as taskItem}
                        {#if categorizeTasks(taskItem) === "not-important-not-urgent"}
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
        background-color: transparent; /* Set a transparent background */
        padding: 0; /* Remove padding */
        max-height: 250px; /* Allow vertical scrolling within each category */
        overflow: hidden;
    }

    .task-list {
        width: 100%;
        max-height: 250px;
        overflow-x: hidden;
        overflow-y: auto;
    }

    /* Add any other styles you need */
</style>

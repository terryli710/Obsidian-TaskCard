<script lang="ts">
    import { ObsidianTask, PositionedObsidianTask } from "../taskModule/task";
    import StaticTaskItem from './StaticTaskItem.svelte';
    import TaskCardPlugin from "..";
    import { logger } from "../utils/log";
    import { QuerySyncManager } from "../query/querySyncManager";

    export let taskList: PositionedObsidianTask[];
    export let plugin: TaskCardPlugin;
    export let querySyncManager: QuerySyncManager;

    function toEditMode() {
        querySyncManager.toEditMode();
    }
</script>

<ul class="contain-task-list has-list-bullet">
    {#each taskList as taskItem}
        <StaticTaskItem {taskItem} {plugin} />
    {:else}
        <div class="error-page">
            <h2>No Tasks Found</h2>
            <p>It looks like there are no tasks that match your filter.</p>
        </div>
    {/each}
</ul>
<div class="button-menu">
    <button class="edit-button" on:click={toEditMode}>Edit</button>
</div>

<style>
    .button-menu {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .edit-button {
        width: 80%;
        font-size: 16px;
        color: var(--text-normal);
        margin: 10px;
    }

    .error-page {
        text-align: center;
        font-size: 18px;
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
</style>

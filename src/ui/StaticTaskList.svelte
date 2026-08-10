<script lang="ts">
    import { PositionedObsidianTask } from "../taskModule/task";
    import StaticTaskItem from './StaticTaskItem.svelte';
    import TaskCardPlugin from "..";

    export let taskList: PositionedObsidianTask[];
    export let plugin: TaskCardPlugin;

</script>

<div class="static-task-list">
    {#each taskList as taskItem}
        <StaticTaskItem {taskItem} {plugin} />
    {/each}
</div>

<style>
    .static-task-list {
        min-width: 0;
    }

    .static-task-list > :global(li.obsidian-taskcard + li.obsidian-taskcard) {
        margin-top: 0;
        border-top: 1px solid var(--background-modifier-border);
    }
</style>

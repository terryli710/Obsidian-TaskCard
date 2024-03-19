<script lang="ts">
    import { ObsidianTask, PositionedObsidianTask } from "../taskModule/task";
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
</style>

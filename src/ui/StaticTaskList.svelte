

<script lang="ts">
    import { ObsidianTask, PositionedObsidianTask } from "../taskModule/task";
    import StaticTaskItem from './StaticTaskItem.svelte';
    import TaskCardPlugin from "..";
    import { logger } from "../utils/log";

    export let taskList: PositionedObsidianTask[];
    export let plugin: TaskCardPlugin;
</script>

<ul class="contain-task-list has-list-bullet">
    {#each taskList as taskItem}
        <StaticTaskItem {taskItem} {plugin} />
    {/each}
</ul>



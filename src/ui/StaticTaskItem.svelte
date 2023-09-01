<script lang="ts">
    import { ObsidianTask, PositionedObsidianTask } from "../taskModule/task";
    import StaticTaskCard from "./StaticTaskCard.svelte";
    import TaskCardPlugin from "..";

    export let taskItem: PositionedObsidianTask;
    export let plugin: TaskCardPlugin;
</script>


<li class="obsidian-taskcard task-list-item mode-multi-line">
    <StaticTaskCard
        taskItem={taskItem}
        plugin={plugin}
    />
</li>
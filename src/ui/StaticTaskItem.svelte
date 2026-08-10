<script lang="ts">
    import { PositionedObsidianTask } from "../taskModule/task";
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



<style>
    .obsidian-taskcard {
        margin: 0;
        padding: 6px 2px;
        border: none;
        border-radius: 0;
        background-color: transparent;
        box-shadow: none;
        transform: none;
    }

    .obsidian-taskcard:hover {
        border-color: transparent;
        background-color: transparent;
        box-shadow: none;
        transform: none;
    }

</style>

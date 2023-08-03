<script>
    import { onMount } from "svelte";
    import { logger } from "../log";
    import TaskCard from "./TaskCard.svelte";
    import { modeStore } from "../renderer/store";
  
    export let taskItemEl;
    const taskEl = taskItemEl.querySelector('.obsidian-taskcard');

    taskItemEl.innerHTML = "";

    let mode;
    $:  mode = $modeStore;

</script>

<button class="obsidian-taskcard task-list-item">
    <TaskCard {taskEl} />
</button>
<script>
    import { onMount } from "svelte";
    import { logger } from "../log";
    import TaskCard from "./TaskCard.svelte";
    import { writable } from "svelte/store";
  
    export let taskItemEl;
    export let mode = "single-line";
    const taskEl = taskItemEl.querySelector('.obsidian-taskcard');

    taskItemEl.innerHTML = "";

</script>

<button class="obsidian-taskcard task-list-item">
    <TaskCard {taskEl} {mode}/>
</button>
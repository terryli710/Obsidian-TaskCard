<script>
    import { onMount } from "svelte";
    import { logger } from "../log";
    import TaskCard from "./TaskCard.svelte";
  
    export let taskItemEl;
    export let mode = "multi-line";
    const taskEl = taskItemEl.querySelector('.obsidian-taskcard');

    taskItemEl.innerHTML = "";
</script>

<div class="obsidian-taskcard task-list-item">
<TaskCard {taskEl} mode={mode} />
</div>
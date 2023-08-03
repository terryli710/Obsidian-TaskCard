<script>
    import { logger } from "../log";
    import TaskCard from "./TaskCard.svelte";
  
    export let taskItemEl;
    export let mode = "single-line";
    const taskEl = taskItemEl.querySelector('.obsidian-taskcard');

    // don't display the original task element content
    taskEl.style.display = "none";

</script>


{#if mode === "single-line"}
    <div class="obsidian-taskcard task-list-item mode-single-line">
        <TaskCard {taskEl} {mode}/>
    </div>
{:else}
    <div class="obsidian-taskcard task-list-item mode-multi-line">
        <TaskCard {taskEl} {mode}/>
    </div>
{/if}
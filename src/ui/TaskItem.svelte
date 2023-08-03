<script>
    import { logger } from "../log";
    import TaskCard from "./TaskCard.svelte";
  
    export let taskItemEl;
    export let mode = "single-line";
    const taskEl = taskItemEl.querySelector('.obsidian-taskcard');

    logger.debug(`taskItemEl.innerHTML: ${taskItemEl.innerHTML}`);

    // don't display the original task element content
    taskEl.style.display = "none";

</script>


{#if mode === "single-line"}
    <button class="obsidian-taskcard task-list-item">
        <TaskCard {taskEl} {mode}/>
    </button>
{:else}
    <button class="obsidian-taskcard task-list-item">
        <TaskCard {taskEl} {mode}/>
    </button>
{/if}
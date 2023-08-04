<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { logger } from "../log";
    import { TaskItemParams } from "../renderer/injector";
    import TaskCard from "./TaskCard.svelte";
  
    export let taskItemEl;
    export let params: TaskItemParams;

    const taskEl = taskItemEl.querySelector('.obsidian-taskcard');

    // don't display the original task element content
    taskEl.style.display = "none";

    const dispatch = createEventDispatcher();

    function handleSwitchMode(event: CustomEvent) {
      // Calling method on the adapter instance
      dispatch('switchMode', event.detail);
      logger.debug(`In TaskItem, switching mode to ${event.detail}`);
    }
    logger.debug(`params in taskItem => ${JSON.stringify(params)}`);
    
</script>


{#if params.mode === "single-line"}
    <div class="obsidian-taskcard task-list-item mode-single-line">
        <TaskCard {taskEl} {params}/>
    </div>
{:else}
    <div class="obsidian-taskcard task-list-item mode-multi-line">
        <TaskCard {taskEl} {params} on:switchMode={handleSwitchMode}/>
    </div>
{/if}
<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { logger } from "../utils/log";
    import { TaskItemParams } from "../renderer/postProcessor";
    import TaskCard from "./TaskCard.svelte";
    import TaskCardPlugin from "..";
  
    export let taskItemEl: HTMLElement;
    export let plugin: TaskCardPlugin;
    export let defaultParams: TaskItemParams;

    let params = defaultParams;

    const taskEl: HTMLElement = taskItemEl.querySelector('.task-list-item'); 
    taskEl.style.display = "none";

    const dispatch = createEventDispatcher();

    function handleSwitchMode(event: MouseEvent | KeyboardEvent | CustomEvent) {
        if (event instanceof KeyboardEvent && (event.key !== 'Enter' && event.key !== ' ')) {
            return; // Only handle Enter or Space key
        }
        
        // Toggle between the two modes
        const newMode = params.mode === 'single-line' ? 'multi-line' : 'single-line';
        dispatch('switchMode', newMode);
        logger.debug(`In TaskItem, switching mode to ${newMode}`);
        params = { ...params, mode: newMode };
    }

    logger.debug(`params in taskItem => ${JSON.stringify(params)}`);
</script>

{#if params.mode === "single-line"}
    <button 
        class="obsidian-taskcard task-list-item mode-single-line" 
        on:click={handleSwitchMode} 
        on:keydown={handleSwitchMode}
        tabindex="0"
    >
        <TaskCard taskEl={taskEl} {plugin} {params}/>
    </button>
{:else}
    <li class="obsidian-taskcard task-list-item mode-multi-line">
        <TaskCard taskEl={taskEl} {plugin} {params} on:switchMode={handleSwitchMode}/>
    </li>
{/if}

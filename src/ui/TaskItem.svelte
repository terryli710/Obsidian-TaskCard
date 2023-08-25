

<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { logger } from "../utils/log";
    import { TaskDisplayParams, TaskDisplayMode } from "../renderer/postProcessor";
    import TaskCard from "./TaskCard.svelte";
    import TaskCardPlugin from "..";
    import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";

    export let taskSyncManager: ObsidianTaskSyncManager;
    export let plugin: TaskCardPlugin;
    // export let defaultParams: TaskDisplayParams;
    let params: TaskDisplayParams;

    params = { ...taskSyncManager.obsidianTask.metadata.taskDisplayParams };

    // Find the input element with class "task-list-item-checkbox" within taskItemEl
    const inputElement = taskSyncManager.taskItemEl.querySelector('input.task-list-item-checkbox');

    // Get the value of the 'data-line' attribute
    const dataLine = inputElement ? inputElement.getAttribute('data-line') : null;


    function handleSwitchMode(event: MouseEvent | KeyboardEvent | CustomEvent) {
        if (event instanceof KeyboardEvent && (event.key !== 'Enter' && event.key !== ' ')) {
            return; // Only handle Enter or Space key
        }
        
        // Toggle between the two modes
        let newMode: TaskDisplayMode | null = null;
        if (event.detail.mode) { newMode = event.detail.mode;}
        else { newMode = params.mode === 'single-line' ? 'multi-line' : 'single-line';}
        params = { ...params, mode: newMode };
        taskSyncManager.updateObsidianTaskDisplayParams('mode', newMode);
    }

</script>

{#if params.mode === "single-line"}
    <li class="obsidian-taskcard-list-item" data-line={dataLine}>
        <button class="obsidian-taskcard task-list-item mode-single-line"
            on:click={handleSwitchMode} 
            on:keydown={handleSwitchMode}
        >
            <TaskCard 
                taskSyncManager={taskSyncManager} 
                plugin={plugin} 
                params={params} 
            />
        </button>
    </li>
{:else}
    <li 
        class="obsidian-taskcard task-list-item mode-multi-line"
        data-line={dataLine}
    >
        <TaskCard 
            taskSyncManager={taskSyncManager} 
            plugin={plugin} 
            params={params} 
            on:switchMode={handleSwitchMode}/>
    </li>
{/if}

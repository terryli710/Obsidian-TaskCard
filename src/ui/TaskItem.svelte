

<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { logger } from "../utils/log";
    import { TaskItemParams } from "../renderer/postProcessor";
    import TaskCard from "./TaskCard.svelte";
    import TaskCardPlugin from "..";
    import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";

    export let taskSyncManager: ObsidianTaskSyncManager;
    export let plugin: TaskCardPlugin;
    export let defaultParams: TaskItemParams;

    let params = defaultParams;

    // Reactive statement to watch for changes in params.mode
    $: {
    // Update TaskStore if params.mode changes
    plugin.taskStore.setModeBySync(taskSyncManager, params.mode); // Assuming you have a setModeForSync() method in TaskStore
    }

    const dispatch = createEventDispatcher();

    function handleSwitchMode(event: MouseEvent | KeyboardEvent | CustomEvent) {
        if (event instanceof KeyboardEvent && (event.key !== 'Enter' && event.key !== ' ')) {
            return; // Only handle Enter or Space key
        }
        
        // Toggle between the two modes
        const newMode = params.mode === 'single-line' ? 'multi-line' : 'single-line';
        dispatch('switchMode', newMode);
        params = { ...params, mode: newMode };
    }

</script>

{#if params.mode === "single-line"}
    <button 
        class="obsidian-taskcard task-list-item mode-single-line" 
        on:click={handleSwitchMode} 
        on:keydown={handleSwitchMode}
        tabindex="0"
    >
        <TaskCard 
            taskSyncManager={taskSyncManager} 
            plugin={plugin} 
            params={params} 
            on:switchMode={handleSwitchMode}/>
    </button>
{:else}
    <li class="obsidian-taskcard task-list-item mode-multi-line">
        <TaskCard 
            taskSyncManager={taskSyncManager} 
            plugin={plugin} 
            params={params} 
            on:switchMode={handleSwitchMode}/>
    </li>
{/if}

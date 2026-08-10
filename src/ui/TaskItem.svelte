

<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { logger } from "../utils/log";
    import { TaskDisplayParams, TaskDisplayMode } from "../renderer/postProcessor";
    import TaskCard from "./TaskCard.svelte";
    import TaskCardPlugin from "..";
    import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";
    import { SettingStore } from "../settings";
    import { get } from "svelte/store";

    export let taskSyncManager: ObsidianTaskSyncManager;
    export let plugin: TaskCardPlugin;

    let params: TaskDisplayParams = { ...taskSyncManager.obsidianTask.metadata.taskDisplayParams };

    // one-shot read; a per-mount subscribe here leaked (known-issues #1)
    let defaultMode: TaskDisplayMode = get(SettingStore).displaySettings
        .defaultMode as TaskDisplayMode;


    if (!('mode' in params)) {
        params.mode = defaultMode
    }

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
    <li
        class="obsidian-taskcard obsidian-taskcard-live task-list-item mode-single-line"
        data-line={dataLine}
    >
        <div
            class="obsidian-taskcard-hitbox"
            on:click={handleSwitchMode}
            on:keydown={handleSwitchMode}
            role="button"
            tabindex="0"
        >
            <TaskCard 
                taskSyncManager={taskSyncManager} 
                plugin={plugin} 
                params={params} 
            />
        </div>
    </li>
{:else}
    <li
        class="obsidian-taskcard obsidian-taskcard-live task-list-item mode-multi-line"
        data-line={dataLine}
    >
        <div class="obsidian-taskcard-hitbox">
            <TaskCard 
                taskSyncManager={taskSyncManager} 
                plugin={plugin} 
                params={params} 
                on:switchMode={handleSwitchMode}/>
        </div>
    </li>
{/if}

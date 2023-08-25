<script lang="ts">
    import { createEventDispatcher, tick } from 'svelte';
    import { ObsidianTaskSyncManager } from '../taskModule/taskSyncManager';
    import { TaskDisplayMode } from '../renderer/postProcessor';
    import { logger } from '../utils/log';
    export let taskSyncManager: ObsidianTaskSyncManager;
    let content: string = taskSyncManager.obsidianTask.content;
    let isEditing = false;
    let inputElement: HTMLInputElement;

    async function enableEditMode(event: MouseEvent | KeyboardEvent) {
        if (event instanceof KeyboardEvent) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                isEditing = true;
                await tick();
                focusAndSelect(inputElement);
            }
        } else if (event instanceof MouseEvent) {
            isEditing = true;
            await tick();
            focusAndSelect(inputElement);
        }
    }

    function finishEditing(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            event.preventDefault();  // Prevent browser's default save behavior
            isEditing = false;
            taskSyncManager.updateObsidianTaskAttribute('content', content);
        } else if (event.key === 'Escape') {
            // Cancel editing, return to non-editing mode, and reset the description
            isEditing = false;
            content = taskSyncManager.obsidianTask.content;
        }
    }

    function focusAndSelect(node: HTMLInputElement) {
        // Focus on the input element
        node.focus();
        // Select all the content
        node.select();
    }

    const dispatch = createEventDispatcher();

    function setMode(event: MouseEvent | KeyboardEvent, newMode: TaskDisplayMode | null = null) {
        event.stopPropagation();
        dispatch('setMode', { mode: newMode });
    }



</script>


{#if isEditing}
    <input 
        class="task-card-content mode-multi-line" 
        bind:value={content} 
        bind:this={inputElement}
        on:keydown={finishEditing} />
{:else}
    <div 
        class="task-card-content mode-multi-line" 
        role="button" 
        tabindex="0" 
        on:click={enableEditMode} 
        on:keydown={enableEditMode}>
        {content}
    </div>
{/if}

<style>

    .task-card-content.mode-multi-line:hover {
    background-color: var(--background-modifier-hover); /* Background hover color */
    }

    .task-card-content.mode-multi-line:active {
    background-color: var(--background-modifier-active-hover); /* Background active color */
    }

    input.task-card-content.mode-multi-line {
    border:  var(--input-border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    font-size: var(--font-text-size);
    font-weight: var(--input-font-weight);
    outline: none; /* Remove default focus outline */
    box-shadow: none; /* Remove default box-shadow */
    }

    input.task-card-content.mode-multi-line:hover {
        border-color: var(--background-modifier-border-hover); /* Border color on hover */
    }

    input.task-card-content.mode-multi-line:focus {
        border-color: var(--background-modifier-border-focus); /* Border color on focus */
        box-shadow: 0 0 5px var(--background-modifier-border-focus); /* Subtle shadow on focus */
    }

</style>
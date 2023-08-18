<script lang="ts">
    import { tick } from 'svelte';
    import { ObsidianTaskSyncManager } from '../taskModule/taskSyncManager';
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
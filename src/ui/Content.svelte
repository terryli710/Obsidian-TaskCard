<script lang="ts">
    import { ObsidianTaskSyncManager } from '../taskModule/taskSyncManager';
    export let taskSyncManager: ObsidianTaskSyncManager;
    let content: string = taskSyncManager.obsidianTask.content;
    let isEditing = false;

    function enableEditMode(event: MouseEvent | KeyboardEvent) {
        if (event instanceof KeyboardEvent) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                isEditing = true;
            }
        } else if (event instanceof MouseEvent) {
            isEditing = true;
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
</script>


{#if isEditing}
    <input 
        class="task-card-content mode-multi-line" 
        bind:value={content} 
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
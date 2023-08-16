<script lang="ts">
    import { marked } from 'marked';
    marked.use({ mangle: false, headerIds: false, langPrefix: '' });
    import { logger } from "../utils/log";
    import { ObsidianTaskSyncManager } from '../taskModule/taskSyncManager';

    export let taskSyncManager: ObsidianTaskSyncManager;
    let description = taskSyncManager.obsidianTask.description;
    let descriptionMarkdown = marked(description);
    let isEditing = false;

    function handleDescriptionClick() {
        isEditing = true;
    }

    function handleDescriptionKeyDown(event: KeyboardEvent) {
        // Enable editing mode if the key is Enter or Space
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault(); // Prevent default behavior (e.g., page scroll on Space)
            isEditing = true;
        }
    }

    function descriptionSaved() {
        isEditing = false;
        descriptionMarkdown = marked(description);
        taskSyncManager.updateObsidianTaskAttribute('description', description);
    }

    function handleDescriptionEditKeyDown(event: KeyboardEvent) {
        if (event.shiftKey && event.key === 'Enter') {
            event.preventDefault();  // Prevent browser's default save behavior
            descriptionSaved();
        } else if (event.key === 'Escape') {
            // Cancel editing, return to non-editing mode, and reset the description
            isEditing = false;
            description = taskSyncManager.obsidianTask.description;
            descriptionMarkdown = marked(description);
        }
    }
</script>

{#if isEditing}
    <textarea 
        bind:value={description} 
        on:keydown={handleDescriptionEditKeyDown}
        class="task-card-description"
    ></textarea>
{:else}
    <div 
        class="task-card-description" 
        role="button" 
        tabindex="0"
        on:click={handleDescriptionClick}
        on:keydown={handleDescriptionKeyDown}
    >
        {@html descriptionMarkdown}
    </div>
{/if}

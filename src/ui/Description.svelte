

<script lang="ts">
    import { marked } from 'marked';
    marked.use({ mangle: false, headerIds: false, langPrefix: '' });
    import { logger } from "../utils/log";
    import { ObsidianTaskSyncManager } from '../taskModule/taskSyncManager';
    import { tick } from 'svelte';

    export let taskSyncManager: ObsidianTaskSyncManager;
    let description = taskSyncManager.obsidianTask.description;
    let descriptionMarkdown = marked(description);
    let inputElement: HTMLTextAreaElement;

    async function enableEditMode(event: MouseEvent | KeyboardEvent) {
        if (event instanceof KeyboardEvent) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                taskSyncManager.taskCardStatus.descriptionStatus = 'editing';
                await tick();
                focusAndSelect(inputElement);
            }
        } else if (event instanceof MouseEvent) {
            taskSyncManager.taskCardStatus.descriptionStatus = 'editing';
            await tick();
            focusAndSelect(inputElement);
        }
    }

    function finishEditing(event: KeyboardEvent) {
        if (event.shiftKey && event.key === 'Enter') {
            event.preventDefault();  // Prevent browser's default save behavior
            taskSyncManager.taskCardStatus.descriptionStatus = 'done';
            descriptionMarkdown = marked(description);
            taskSyncManager.updateObsidianTaskAttribute('description', description);
        } else if (event.key === 'Escape') {
            // Cancel editing, return to non-editing mode, and reset the description
            taskSyncManager.taskCardStatus.descriptionStatus = 'done';
            description = taskSyncManager.obsidianTask.description;
            descriptionMarkdown = marked(description);
        }
    }

    function focusAndSelect(node: HTMLTextAreaElement) {
        // Focus on the input element
        node.focus();
        // Select all the content
        node.select();
    }

</script>

{#if taskSyncManager.getTaskCardStatus('descriptionStatus') === 'editing'}
    <textarea 
        bind:value={description} 
        on:keydown={finishEditing}
        bind:this={inputElement}
        class="task-card-description"
    ></textarea>
{:else}
    <div 
        class="task-card-description" 
        role="button" 
        tabindex="0"
        on:click={enableEditMode}
        on:keydown={enableEditMode}
    >
        {@html descriptionMarkdown}
    </div>
{/if}

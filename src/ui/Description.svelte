

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
                adjustHeightForTextArea();
            }
        } else if (event instanceof MouseEvent) {
            taskSyncManager.taskCardStatus.descriptionStatus = 'editing';
            await tick();
            focusAndSelect(inputElement);
            adjustHeightForTextArea();
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

    function adjustHeightForTextArea() {
        inputElement.style.height = 'auto';
        inputElement.style.height = `${inputElement.scrollHeight + 4}px`;
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
        wrap="soft"
        placeholder="Type in Description. Shift+Enter to Save. Esc to Cancel."
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


<style>

    .task-card-description {
        grid-column: 2;
        grid-row: 2;
        font-size: var(--font-smallest);
        line-height: var(--line-height-tight);
        color: var(--text-faint);
        border-radius: 5px; /* Rounded square */
        cursor: pointer; /* Pointer cursor on hover */
        margin: 0.1em; /* Padding for the content */
        padding: 0.22em; /* Padding for the content */
        word-wrap: break-word; /* To break words if too long */
        white-space: normal; /* To auto change lines */

    }

    .task-card-description:hover {
    background-color: var(--background-primary-alt);
    }


    textarea.task-card-description {
        background-color: var(--background-primary-alt);
        width: 100%;
        height: 100%;
        border-radius: 5px;
        padding: 0.22em;
        word-wrap: break-word; /* To break words if too long */
        resize: vertical;
    }

</style>
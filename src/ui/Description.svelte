<script lang="ts">
    import { marked } from 'marked';
    import { logger } from "../utils/log";

    export let description: string;
    marked.use({ mangle: false, headerIds: false, langPrefix: '' });
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

    function handleDescriptionEditKeyDown(event: KeyboardEvent) {
        if (event.shiftKey && event.key === 'Enter') {
            event.preventDefault();  // Prevent browser's default save behavior
            isEditing = false;  // Exit the editing mode after saving
            descriptionMarkdown = marked(description);  // Update the markdown\
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

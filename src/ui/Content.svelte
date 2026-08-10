<script lang="ts">
    import { createEventDispatcher, tick } from 'svelte';
    import { ObsidianTaskSyncManager } from '../taskModule/taskSyncManager';
    import { TaskDisplayMode } from '../renderer/postProcessor';
    import { logger } from '../utils/log';
    import { ObsidianTask } from '../taskModule/task';

    export let interactive: boolean = true;
    export let taskSyncManager: ObsidianTaskSyncManager = undefined;
    export let taskItem: ObsidianTask = undefined;

    let content: string = interactive ? taskSyncManager.obsidianTask.content : taskItem.content;
    let isEditing = false;
    let inputElement: HTMLElement;

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

    // Uniform edit-mode contract (all card fields): Enter and focus loss both
    // commit; Escape is the only discard path. Unchanged values close the
    // editor without a file write.
    function commitEdit() {
        if (!isEditing) return;
        isEditing = false;
        // contenteditable can pick up NBSPs, and drag-drops can carry
        // newlines; a task is a single markdown line, so flatten first
        content = content.replace(/\u00A0/g, ' ').replace(/\s*\r?\n\s*/g, ' ');
        if (content.trim() === '') {
            // a task line needs content; treat an emptied editor as a cancel
            content = taskSyncManager.obsidianTask.content;
            return;
        }
        if (content === taskSyncManager.obsidianTask.content) return;
        taskSyncManager.updateObsidianTaskAttribute('content', content);
    }

    function cancelEdit() {
        if (!isEditing) return;
        isEditing = false;
        content = taskSyncManager.obsidianTask.content;
    }

    function finishEditing(event: KeyboardEvent) {
        if (event.isComposing) return; // Enter/Escape inside IME composition belongs to the IME
        if (event.key === 'Enter') {
            event.preventDefault(); // a task stays one line: Enter commits, never inserts a newline
            commitEdit();
        } else if (event.key === 'Escape') {
            cancelEdit();
        }
    }

    function handlePaste(event: ClipboardEvent) {
        // the contenteditable default would insert rich HTML; paste as
        // plain text, flattened to one line
        event.preventDefault();
        const text = (event.clipboardData?.getData('text/plain') ?? '').replace(/\s*\r?\n\s*/g, ' ');
        document.execCommand?.('insertText', false, text);
    }

    function focusAndSelect(node: HTMLElement) {
        node.focus();
        // select-all so typing replaces the whole title
        window.getSelection()?.selectAllChildren(node);
    }

    const dispatch = createEventDispatcher();

    function setMode(event: MouseEvent | KeyboardEvent, newMode: TaskDisplayMode | null = null) {
        event.stopPropagation();
        dispatch('setMode', { mode: newMode });
    }



</script>


{#if isEditing}
    <div
        class="task-card-content mode-multi-line editing"
        contenteditable="true"
        bind:textContent={content}
        bind:this={inputElement}
        role="textbox"
        tabindex="0"
        aria-label="Content"
        title="Enter to save · Esc to cancel"
        on:keydown={finishEditing}
        on:paste={handlePaste}
        on:blur={commitEdit}
    ></div>
{:else}
    <div 
        class="task-card-content mode-multi-line {interactive ? 'interactive' : ''}" 
        role="button" 
        tabindex="0" 
        on:click={interactive ? enableEditMode : null} 
        on:keydown={interactive ? enableEditMode : null}
        aria-label="Content"
        >
        {content}
    </div>
{/if}

<style>

    /* the content line renders exactly like normal note text (user decision
       2026-07-07, replacing the pillar-3 "weightier title"): no font
       overrides — family/size/weight/line-height all inherit from the card
       root's --font-text variables */

    .task-card-content.mode-multi-line.interactive:hover {
        background-color: var(--background-primary-alt); /* Background hover color */
    }

    .task-card-content.mode-multi-line.interactive:active {
        background-color: var(--background-modifier-active-hover); /* Background active color */
    }

    /* editing swaps in a contenteditable div with the identical box —
       same element, padding, font, and line-height as the display div, no
       border — so entering/leaving edit mode can never change the card's
       height, even for wrapped content. The focus ring is box-shadow,
       which paints without affecting layout. */
    .task-card-content.mode-multi-line.editing {
        cursor: text;
        outline: none;
        white-space: pre-wrap; /* keep typed/trailing spaces visible while editing */
        min-height: calc(var(--line-height-normal) * 1em); /* an emptied editor keeps its line box */
        background-color: var(--background-primary-alt); /* the hover tint it was clicked from */
        box-shadow:
            inset 0 0 0 var(--input-border-width) var(--background-modifier-border-focus),
            0 0 5px var(--background-modifier-border-focus);
    }

</style>
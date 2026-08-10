


<script lang='ts'>
    import AttributeValueSuggestions from './AttributeValueSuggestions.svelte';
    import type { AttributeValueSuggestion } from '../autoSuggestions/valueSuggestions';

    export let newLabel = '';
    // export let editingIndex = null;
    export let finishLabelEditing;
    export let commitLabelEditing: (updatedLabel: string) => void = () => {};
    export let inputElement: HTMLInputElement;
    export let showSuggestions = false;
    export let labels: string[] = [];

    let suggestionMenu: AttributeValueSuggestions;
    let suggestionsOpen = showSuggestions;

    function handleKeydown(event: KeyboardEvent) {
        const clearing = event.key === 'Enter' && newLabel.trim() === '';
        if (!clearing && suggestionsOpen && suggestionMenu?.handleKeydown(event)) return;
        if (!suggestionsOpen && showSuggestions && event.key === 'ArrowDown') {
            event.preventDefault();
            suggestionsOpen = true;
            return;
        }
        finishLabelEditing(event, newLabel);
    }

    function chooseSuggestion(suggestion: AttributeValueSuggestion) {
        newLabel = suggestion.value;
        suggestionsOpen = false;
    }

    setTimeout(() => {
        if (inputElement) {
            inputElement.focus();  // Focus on the input element
            inputElement.select(); // Select all text inside the input element
        }
    }, 0);
</script>

<div class="task-card-label-input-container" class:suggestions-open={suggestionsOpen}>
    <div class="task-card-label-input-left-part">
        <span class="task-card-label-input-prefix">#</span>
    </div>
    <input
        type="text"
        class="task-card-label-input"
        bind:value={newLabel}
        bind:this={inputElement}
        title="Enter to save · Esc to cancel"
        on:focus={() => (suggestionsOpen = showSuggestions)}
        on:input={() => (suggestionsOpen = showSuggestions)}
        on:keydown|stopPropagation={handleKeydown}
        on:blur={() => commitLabelEditing(newLabel)}
    />
    {#if suggestionsOpen}
        <AttributeValueSuggestions
            bind:this={suggestionMenu}
            field="label"
            query={newLabel}
            {labels}
            includeDefaults={false}
            on:choose={(event) => chooseSuggestion(event.detail)}
            on:dismiss={() => (suggestionsOpen = false)}
        />
    {/if}
</div>


<style>
    .task-card-label-input-container {
        position: relative;
        display: flex;
        align-items: center;
        box-sizing: border-box;
        height: 21px; /* matches the unified chip height (chip-polish) */
        border-radius: 999px;
        overflow: hidden;
        font-size: var(--font-ui-smaller);
        border: var(--border-width) solid var(--text-accent);
    }

    .task-card-label-input-container.suggestions-open {
        overflow: visible;
    }

    .task-card-label-input-left-part {
        background-color: var(--background-primary);
        border-top-left-radius: 2em;
        border-bottom-left-radius: 2em;
        border-top-right-radius: var(--radius-s);
        border-bottom-right-radius: var(--radius-s);
        display: flex;
        align-items: center;
        padding: 0 5px;
    }

    .task-card-label-input-prefix {
        color: var(--text-accent);
        line-height: 1;
    }

    .task-card-label-input {
        display: inline-block;
        background-color: var(--background-primary-alt);
        padding: 0 10px 0 2px;
        font: inherit;
        color: var(--text-muted);
        line-height: 1;
        box-sizing: border-box;
        width: 100px;
        height: 100%;
        white-space: nowrap;
        border: none;
        flex-grow: 1;
    }

    .task-card-label-input:focus {
        outline: none;
        box-shadow: none;
    }

</style>

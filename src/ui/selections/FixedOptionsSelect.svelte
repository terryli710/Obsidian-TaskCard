


<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    // Input prop for the choices
    interface TagSelectChoice {
        displayText?: string;
        displayHTML?: string;
        value: any;
    }
    export let title: string = 'Select';
    export let description: string = '';
    export let choices: TagSelectChoice[] = [];
    export let initialChoice = null;

    // Internal state to keep track of selected tag
    let selectedTag = initialChoice;

    function isValidEvent(evt: MouseEvent | KeyboardEvent) {
        // return true if evt is mouse single click or keyboard "Enter" key press
        if (evt instanceof MouseEvent) { return evt.button === 0; }
        return evt instanceof KeyboardEvent && (evt.key === 'Enter' || evt.key === ' ');
    }

    // Function to select a tag
    function selectTag(tag, evt: MouseEvent | KeyboardEvent) {
        if (!isValidEvent(evt)) { return; }
        selectedTag = tag; // Direct assignment for single selection
    }

    const dispatch = createEventDispatcher();

    $: dispatch('selected', selectedTag);
</script>

<div class="tc-query-row">
    <div class="tc-query-info">
        <div class="tc-query-name">{title}</div>
        <div class="tc-query-description">{description}</div>
    </div>
    <div class="tc-query-control">
        {#each choices as choice (choice.value)}
            <button
                type="button"
                class="tc-query-chip"
                class:selected={selectedTag === choice.value}
                on:click={(evt) => selectTag(choice.value, evt)}
                on:keydown={(evt) => selectTag(choice.value, evt)}>
                {#if choice.displayText}
                    {choice.displayText}
                {:else if choice.displayHTML}
                    {@html choice.displayHTML}
                {/if}
            </button>
        {/each}
    </div>
</div>

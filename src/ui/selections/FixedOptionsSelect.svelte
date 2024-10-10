


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

<li class="container">
    <div class="header">
        <div class="inline-title-wrapper">
            <div class="inline-title">{title}</div>
            <div class="inline-description">{description}</div>
        </div>
        <div class="separator"></div>
        <div class="choices-wrapper">
            {#each choices as choice (choice.value)}
                <button 
                    class="tag {selectedTag === choice.value ? 'selected' : ''}" 
                    on:click={(evt) => selectTag(choice.value, evt)}
                    on:keydown={(evt) => selectTag(choice.value, evt)}>
                    {@html choice.displayText || choice.displayHTML}
                </button>
            {/each}
        </div>
    </div>
</li>



<style>

.container {
    display: flex;
    flex-direction: column;
}

.header {
    display: flex;
    align-items: center; /* Aligns the title to the middle */
    justify-content: space-between;
}

.inline-title-wrapper {
    flex: 0 0 30%;
    margin: 0;
    padding: 0;
    line-height: 1.5;
    font-size: 1.2em;
    text-align: left;
    display: flex;
    flex-direction: column;
}

.inline-title {
    color: var(--text-normal);
    font-size: var(--font-ui-medium);
    line-height: var(--line-height-tight);
}

.inline-description {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    padding-top: var(--size-4-1);
    line-height: var(--line-height-tight);
}

.choices-wrapper {
    flex: 1;
    background-color: var(--background-primary-alt);
    border-radius: 12px;
    padding: 15px;
    margin: 8px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
}

.tag {
    flex-grow: 1;
    margin: 5px;
}

.tag.selected {
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
}

</style>
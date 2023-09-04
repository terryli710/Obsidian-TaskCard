




<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { logger } from '../../utils/log';

    // Input prop for the choices
    interface TagSelectChoice {
        displayText?: string;
        displayHTML?: string;
        value: any;
    }
    export let title: string = 'Multi Select';
    export let description: string = '';
    export let choices: TagSelectChoice[] = [];
    export let initialChoices = [];

    // Internal state to keep track of selected tags
    let selectedTags = initialChoices;

    function isValidEvent(evt: MouseEvent | KeyboardEvent) {
        // return true if evt is mouse single click or keyboard "Enter" key press
        if (evt instanceof MouseEvent) { return evt.button === 0; }
        return evt instanceof KeyboardEvent && (evt.key === 'Enter' || evt.key === ' ');
    }

    // Function to toggle the selection of a tag
    function toggleTag(tag, evt: MouseEvent | KeyboardEvent) {
        if (!isValidEvent(evt)) { return; }
        if (selectedTags.includes(tag)) {
            selectedTags = selectedTags.filter(t => t !== tag);
        } else {
            selectedTags = [...selectedTags, tag];
        }
    }

    const dispatch = createEventDispatcher();

    $: dispatch('selected', selectedTags);

    logger.debug(`Selected tags: ${selectedTags}`);
</script>



<div class="container">
    <div class="header">
        <div class="inline-title-wrapper">
            <div class="inline-title">{title}</div>
            <div class="inline-description">{description}</div>
        </div>
        <div class="separator"></div>
        <div class="choices-wrapper">
            {#each choices as choice (choice.value)}
                <button 
                    class="tag {selectedTags.includes(choice.value) ? 'selected' : ''}" 
                    on:click={(evt) => toggleTag(choice.value, evt)}
                    on:keydown={(evt) => toggleTag(choice.value, evt)}>
                    {@html choice.displayText || choice.displayHTML}
                </button>
            {/each}
        </div>
    </div>
</div>



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
    background-color: #f2f2f2;
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
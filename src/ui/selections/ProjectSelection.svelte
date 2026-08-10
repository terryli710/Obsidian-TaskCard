


<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { Project } from '../../taskModule/project';

    // Input prop for the choices
    export let title: string = 'Select Projects';
    export let description: string = '';
    export let choices: Project[] = [];
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

</script>

<div class="tc-query-row">
    <div class="tc-query-info">
        <div class="tc-query-name">{title}</div>
        <div class="tc-query-description">{description}</div>
    </div>
    <div class="tc-query-control">
        {#each choices as choice}
            <button
                type="button"
                class="tc-query-chip"
                class:selected={selectedTags.includes(choice.name)}
                on:click={(evt) => toggleTag(choice.name, evt)}
                on:keydown={(evt) => toggleTag(choice.name, evt)}>
                <span
                    class="tc-query-project-dot"
                    style="background-color: {choice.color};"
                ></span>
                {choice.name}
            </button>
        {/each}
    </div>
</div>
    

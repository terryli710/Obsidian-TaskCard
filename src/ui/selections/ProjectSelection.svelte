


<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { logger } from '../../utils/log';
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


<div class="container">
    <div class="header">
        <div class="inline-title-wrapper">
            <div class="inline-title">{title}</div>
            <div class="inline-description">{description}</div>
        </div>
        <div class="separator"></div>
        <div class="choices-wrapper">
            {#each choices as choice}
                <button 
                    class="project-selection-button {selectedTags.includes(choice.name) ? 'selected' : ''}" 
                    on:click={(evt) => toggleTag(choice.name, evt)}
                    on:keydown={(evt) => toggleTag(choice.name, evt)}>
                    <div class="project-choice">
                        <div class="project-name">
                            {choice.name}
                        </div>
                        <span
                            class="project-color"
                            style="background-color: {choice.color};"
                        ></span>
                    </div>
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
        align-items: center;
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
        justify-content: flex-start;
    }
    
    button.project-selection-button {
        margin: 5px;
        height: var(--line-height-tight);
        padding: 0px 4px;
        border-radius: 10px;
        align-items: center;
        vertical-align: middle;
    }

    .project-selection-button.selected {
        background-color: var(--interactive-accent);
        color: var(--text-on-accent);
    }
    
    .project-choice {
        align-items: center;
        display: flex;
        flex-direction: row;
    }

    .project-name {
        padding: 0px 4px;
    }
    
    .project-color {
        display: inline-block;
        width: 12px;
        height: 12px;
        padding: 4px;
        border-radius: 50%;
        margin: 4px;
        border: var(--border-width) solid rgba(0, 0, 0, 0);
    }
    
</style>
    
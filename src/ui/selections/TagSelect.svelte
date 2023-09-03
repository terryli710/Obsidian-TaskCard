


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


<div>
    <h3>{title}</h3>
    <hr />
    {#each choices as choice (choice.value)}
        <button 
            class="tag {selectedTags.includes(choice.value) ? 'selected' : ''}" 
            on:click={(evt) => toggleTag(choice.value, evt)}
            on:keydown={(evt) => toggleTag(choice.value, evt)}>
            {@html choice.displayText || choice.displayHTML}
        </button>
    {/each}
</div>



<style>
    .tag {
      padding: 5px 10px;
      border: 1px solid #ccc;
      margin: 5px;
      cursor: pointer;
      display: inline-block;
      border-radius: 5px;
      background: none;
      outline: none;
    }
  
    .tag.selected {
      background-color: #007BFF;
      color: white;
    }
</style>
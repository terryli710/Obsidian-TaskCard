

<script lang='ts'>
  import { onMount } from 'svelte';
  import { logger } from '../utils/log';
  import { Menu } from 'obsidian';
  import Plus from '../components/icons/Plus.svelte';
  import { LabelModule } from '../taskModule/labels';
  import { ObsidianTaskSyncManager } from '../taskModule/taskSyncManager';
    import LabelInput from './LabelInput.svelte';

  export let taskSyncManager: ObsidianTaskSyncManager;
  let labelModule = new LabelModule();
  let isAddingLabel = false;
  let newLabel = '';
  let editingIndex = null;
  let inputElement: HTMLInputElement;

  labelModule.setLabels(taskSyncManager.obsidianTask.labels, false);

  function addLabel() {
    labelModule.addLabel(newLabel, false);
    newLabel = '';
    isAddingLabel = false;
    taskSyncManager.updateObsidianTaskAttribute('labels', labelModule.getLabels());
  }

  function editLabel(index) {
    editingIndex = index;
    newLabel = labelModule.getLabels()[index].substring(1); // remove leading #
  }

  function saveEdit() {
    labelModule.editLabel('#' + newLabel, '#' + labelModule.getLabels()[editingIndex].substring(1), false);
    newLabel = '';
    editingIndex = null;
    taskSyncManager.updateObsidianTaskAttribute('labels', labelModule.getLabels());
  }

  function deleteLabel(index) {
    labelModule.deleteLabel(labelModule.getLabels()[index]);
    taskSyncManager.updateObsidianTaskAttribute('labels', labelModule.getLabels());
  }

  function finishLabelEditing(event: KeyboardEvent, updatedLabel: string) {
    if (event.key === 'Enter') {
      event.preventDefault();
      newLabel = updatedLabel;  // Update the newLabel with the value from the child component
      if (editingIndex !== null) {
        saveEdit(); // Save the edited label
      } else {
        addLabel(); // Add a new label
      }
    } else if (event.key === 'Escape') {
      // Cancel the editing process
      newLabel = '';
      editingIndex = null;
      isAddingLabel = false;
    }
  }

  function enableLabelAddMode() {
    isAddingLabel = true;
  }

  function showPopupMenu(index, event) {
    event.preventDefault();
    const popupMenu = new Menu();
    popupMenu.addItem((item) => {
      item.setTitle('Edit');
      item.setIcon('pencil');
      item.onClick((evt: MouseEvent | KeyboardEvent) => {
        editLabel(index);
        return item;
      });
    });
    popupMenu.addItem((item) => {
      item.setTitle('Delete');
      item.setIcon('trash');
      item.onClick((evt: MouseEvent | KeyboardEvent) => {
        deleteLabel(index);
        return item;
      });
    });
    popupMenu.showAtPosition({ x: event.clientX, y: event.clientY });
  }

</script>


<div class="task-card-labels">
  {#each labelModule.getLabels() as label, index}
    {#if editingIndex === index}
      <LabelInput
        {newLabel}
        {finishLabelEditing}
        {inputElement}
      />
    {:else}
      <div class="label-container">
        <a
          href="{label}"
          class="tag"
          target="_blank"
          rel="noopener"
          on:contextmenu={(e) => showPopupMenu(index, e)}
        >
          {label}
        </a>
      </div>
    {/if}
    {#if label !== labelModule.getLabels()[labelModule.getLabels().length - 1]}{" "}{/if}
  {/each}
  {#if isAddingLabel}
    <LabelInput
      {newLabel}
      {finishLabelEditing}
      {inputElement}
    />
  {:else}
    <button class="task-card-button label-plus-button" on:click={enableLabelAddMode}>
      <Plus/>
    </button>
  {/if}
</div>


<style>

.task-card-labels {
  display: flex;
  padding: 2px 0;
  flex-wrap: nowrap; /* Prevents wrapping */
  overflow: scroll; /* Truncates any labels that don't fit */
  white-space: nowrap; /* Keeps labels on a single line */
  align-items: center;
  gap: 4px;
  flex-grow: 1; /* Make it take up all available space */
  font-size: var(--font-ui-medium);
}

.task-card-labels a {
  text-decoration: none;
  flex-shrink: 0;
}

.task-card-labels button:hover {
  background-color: var(
    --background-modifier-hover
  ); /* Change the background color on hover */
}

button.label-plus-button {
  color: var(--tag-color);
  background-color: var(--tag-background);
  border-radius: 50%;
}

button.label-plus-button:hover {
  background-color: var(--tag-background-hover);
}

</style>
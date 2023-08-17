

<script lang='ts'>
  import { onMount } from 'svelte';
  import { logger } from '../utils/log';
  import { Menu } from 'obsidian';
  import Plus from '../components/icons/Plus.svelte';
  import { LabelModule } from '../taskModule/labels';

  export let taskSyncManager;
  let labelModule = new LabelModule();
  let isEditingLabel = false;
  let newLabel = '';
  let editingIndex = null;

  labelModule.setLabels(taskSyncManager.obsidianTask.labels, false);

  function addLabel() {
    labelModule.addLabel(newLabel, false);
    newLabel = '';
    isEditingLabel = false;
    taskSyncManager.updateObsidianTaskAttribute('labels', labelModule.getLabels());
  }

  function editLabel(index) {
    editingIndex = index;
    newLabel = labelModule.getLabels()[index].substr(1); // remove leading #
  }

  function saveEdit() {
    labelModule.editLabel('#' + newLabel, '#' + labelModule.getLabels()[editingIndex].substr(1), false);
    newLabel = '';
    editingIndex = null;
    taskSyncManager.updateObsidianTaskAttribute('labels', labelModule.getLabels());
  }

  function deleteLabel(index) {
    labelModule.deleteLabel(labelModule.getLabels()[index]);
    taskSyncManager.updateObsidianTaskAttribute('labels', labelModule.getLabels());
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
      <input
        type="text"
        class="task-card-label-input"
        bind:value={newLabel}
        on:keydown={(e) => e.key === 'Enter' && saveEdit()}
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
  {#if isEditingLabel}
    <input
      type="text"
      class="task-card-label-input"
      bind:value={newLabel}
      on:keydown={(e) => e.key === 'Enter' && addLabel()}
    />
  {:else}
    <button class="task-card-round-button" on:click={() => (isEditingLabel = true)}>
      <Plus/>
    </button>
  {/if}
</div>

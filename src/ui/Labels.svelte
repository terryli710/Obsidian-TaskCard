<script lang='ts'>
  import { onMount } from 'svelte';
  import { logger } from '../utils/log';
  import { Menu } from 'obsidian';

  export let taskSyncManager;
  let labels: string[] = taskSyncManager.obsidianTask.labels;
  let isEditingLabel = false;
  let newLabel = '';
  let editingIndex = null;

  function addLabel() {
    if (newLabel && !labels.includes(newLabel)) {
      labels = [...labels, newLabel];
    }
    newLabel = '';
    isEditingLabel = false;
    taskSyncManager.updateObsidianTaskAttribute('labels', labels);
  }

  function editLabel(index) {
    editingIndex = index;
    newLabel = labels[index];
  }

  function saveEdit() {
    if (newLabel && !labels.includes(newLabel)) {
      labels[editingIndex] = newLabel;
    }
    newLabel = '';
    editingIndex = null;
    taskSyncManager.updateObsidianTaskAttribute('labels', labels);
  }

  function deleteLabel(index) {
    labels = labels.filter((_, i) => i !== index);
    taskSyncManager.updateObsidianTaskAttribute('labels', labels);
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
  {#each labels as label, index}
    {#if editingIndex === index}
      <input
        type="text"
        bind:value={newLabel}
        on:keydown={(e) => e.key === 'Enter' && saveEdit()}
      />
    {:else}
      <div class="label-container">
        <a
          href="#{label}"
          class="tag"
          target="_blank"
          rel="noopener"
          on:contextmenu={(e) => showPopupMenu(index, e)}
        >
          #{label}
        </a>
      </div>
    {/if}
    {#if label !== labels[labels.length - 1]}{" "}{/if}
  {/each}
  {#if isEditingLabel}
    <input
      type="text"
      bind:value={newLabel}
      on:keydown={(e) => e.key === 'Enter' && addLabel()}
    />
  {:else}
    <button on:click={() => (isEditingLabel = true)}>+</button>
  {/if}
</div>

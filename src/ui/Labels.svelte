

<script lang='ts'>
  import { Menu, getAllTags } from 'obsidian';
  import Plus from '../components/icons/Plus.svelte';
  import { LabelModule } from '../taskModule/labels';
  import { ObsidianTaskSyncManager } from '../taskModule/taskSyncManager';
  import type TaskCardPlugin from '..';
  import LabelInput from './LabelInput.svelte';

  export let taskSyncManager: ObsidianTaskSyncManager;
  export let showAddButton = true;
  export let addLabelSignal = 0;
  export let plugin: TaskCardPlugin = undefined;
  export let enableSuggestions = false;
  let labelModule = new LabelModule();
  let isAddingLabel = false;
  let newLabel = '';
  let editingIndex = null;
  let inputElement: HTMLInputElement;
  let lastHandledAddLabelSignal = addLabelSignal;
  let labelSuggestions: string[] = [];

  labelModule.setLabels(taskSyncManager.obsidianTask.labels, false);

  function addLabel() {
    labelModule.addLabel(newLabel, false);
    newLabel = '';
    isAddingLabel = false;
    taskSyncManager.updateObsidianTaskAttribute('labels', labelModule.getLabels());
  }

  function editLabel(index) {
    refreshLabelSuggestions(labelModule.getLabels()[index]);
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

  // Uniform edit-mode contract (all card fields): Enter and focus loss both
  // commit; Escape is the only discard path. An empty or unchanged input
  // closes the editor without a file write.
  function commitLabelEditing(updatedLabel: string) {
    if (!isAddingLabel && editingIndex === null) return;
    newLabel = updatedLabel;
    if (
      newLabel.trim() === '' ||
      (editingIndex !== null &&
        '#' + newLabel === labelModule.getLabels()[editingIndex])
    ) {
      cancelLabelEditing();
      return;
    }
    if (editingIndex !== null) {
      saveEdit(); // Save the edited label
    } else {
      addLabel(); // Add a new label
    }
  }

  function cancelLabelEditing() {
    newLabel = '';
    editingIndex = null;
    isAddingLabel = false;
  }

  function finishLabelEditing(event: KeyboardEvent, updatedLabel: string) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitLabelEditing(updatedLabel);
    } else if (event.key === 'Escape') {
      cancelLabelEditing();
    }
  }

  function enableLabelAddMode() {
    refreshLabelSuggestions();
    isAddingLabel = true;
  }

  function refreshLabelSuggestions(currentLabel: string | null = null) {
    const labels = new Set<string>();
    const app = plugin?.app;
    const indexedLabels = plugin?.cache?.taskCache?.database?.getAllIndexValues('labels');
    if (enableSuggestions && indexedLabels && indexedLabels.length > 0) {
      // Reuse TaskCard's maintained label index on the normal path. This
      // avoids walking every cached Markdown file each time an editor opens.
      for (const indexedValue of indexedLabels) {
        for (const label of String(indexedValue).split(',')) {
          if (label.trim()) labels.add(label.trim());
        }
      }
    } else if (enableSuggestions && app?.vault && app?.metadataCache) {
      // Early-start fallback before Dataview has populated the task index.
      for (const file of app.vault.getMarkdownFiles()) {
        const cache = app.metadataCache.getFileCache(file);
        if (!cache) continue;
        for (const tag of getAllTags(cache) ?? []) labels.add(tag);
      }
    }
    for (const appliedLabel of labelModule.getLabels()) {
      if (appliedLabel !== currentLabel) labels.delete(appliedLabel);
    }
    if (currentLabel) labels.add(currentLabel);
    labelSuggestions = Array.from(labels);
  }

  $: if (addLabelSignal !== lastHandledAddLabelSignal) {
    lastHandledAddLabelSignal = addLabelSignal;
    enableLabelAddMode();
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


<div
  class="task-card-labels"
  class:suggestions-open={enableSuggestions && (isAddingLabel || editingIndex !== null)}
>
  {#each labelModule.getLabels() as label, index}
    {#if editingIndex === index}
      <LabelInput
        {newLabel}
        {finishLabelEditing}
        {commitLabelEditing}
        {inputElement}
        showSuggestions={enableSuggestions}
        labels={labelSuggestions}
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
  {/each}
  {#if isAddingLabel}
    <LabelInput
      {newLabel}
      {finishLabelEditing}
      {commitLabelEditing}
      {inputElement}
      showSuggestions={enableSuggestions}
      labels={labelSuggestions}
    />
  {:else if showAddButton}
    <button class="task-card-button task-card-plus-button label-plus-button" on:click={enableLabelAddMode}>
      <Plus ariaLabel="Add Label"/>
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
  min-width: 2em;
  gap: 6px;
  flex-grow: 1; /* Make it take up all available space */
  font-size: var(--font-ui-small);
}

.task-card-labels.suggestions-open {
  overflow: visible;
}

.task-card-labels a {
  text-decoration: none;
  flex-shrink: 0;
}

/* unified chip metrics (chip-polish, 2026-07-08): native tag colors, but the
   same height / side padding / text size as the attribute chips so the whole
   bottom bar reads as one family */
.task-card-labels a.tag {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  height: 21px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: var(--font-ui-smaller);
  line-height: 1;
}

.task-card-labels button:hover {
  background-color: var(
    --background-modifier-hover
  ); /* Change the background color on hover */
}

</style>

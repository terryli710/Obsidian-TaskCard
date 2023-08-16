<script lang='ts'>
    import { onMount } from 'svelte';
    import { logger } from '../utils/log';
  
    export let taskSyncManager;
    let labels: string[] = taskSyncManager.obsidianTask.labels;
    let isEditingLabel = false;
    let newLabel = '';
    let editingIndex = null;
    let showDropdown = false;
    let dropdownIndex = null;
  
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
  
    function toggleDropdown(index, event) {
      event.preventDefault();
      showDropdown = !showDropdown;
      dropdownIndex = index;
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
            on:contextmenu={(e) => toggleDropdown(index, e)}
          >
            #{label}
          </a>
          {#if showDropdown && dropdownIndex === index}
            <div class="dropdown">
              <button on:click={() => {editLabel(index); showDropdown = false}}>Edit</button>
              <button on:click={() => {deleteLabel(index); showDropdown = false}}>Delete</button>
            </div>
          {/if}
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

<script>
    import { onMount } from 'svelte';
    import { logger } from '../utils/log';
  
    export let labels;
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
    }
  
    function deleteLabel(index) {
      labels = labels.filter((_, i) => i !== index);
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
              <button on:click={() => editLabel(index)}>Edit</button>
              <button on:click={() => deleteLabel(index)}>Delete</button>
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
  
  <style>
    .task-card-labels {
      display: flex;
      flex-wrap: nowrap; /* Prevents wrapping */
      overflow: scroll; /* Truncates any labels that don't fit */
      white-space: nowrap; /* Keeps labels on a single line */
      gap: 4px;
    }
  
    .task-card-labels a {
      text-decoration: none;
      flex-shrink: 0; /* Prevents individual labels from shrinking */
    }
  
    .label-container {
      position: relative;
    }
  
    .dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
  </style>
  
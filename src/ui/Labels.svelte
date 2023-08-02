
<script>
    import { onMount } from 'svelte';
    import { writable } from 'svelte/store';
    import { logger } from '../log';
  
    export let labels;
    let labelsContainer;
    let hiddenLabels = writable(false);
  
    onMount(() => {
      // Check initially
      updateHiddenLabels();
  
      // Update when the window is resized
      window.addEventListener('resize', updateHiddenLabels);
  
      // Clean up event listener
      return () => window.removeEventListener('resize', updateHiddenLabels);
    });
  
    function updateHiddenLabels() {
      // If the scroll width (total width including hidden content) is greater than the client width (visible width), some labels are hidden
      hiddenLabels.set(labelsContainer.scrollWidth > labelsContainer.clientWidth);
      logger.debug(`hiddenLabels: ${hiddenLabels}`);
    }
  </script>
  
  <div class="task-card-labels" bind:this={labelsContainer}>
    {#each labels as label}
      <a href="#{label}" class="tag" target="_blank" rel="noopener">#{label}</a>{#if label !== labels[labels.length - 1]}{" "}{/if}
    {/each}
    {#if $hiddenLabels}
      <span class="more-labels-symbol">...</span>
    {/if}
  </div>
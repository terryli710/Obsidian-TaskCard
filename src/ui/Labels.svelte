
<script>
    import { onMount } from 'svelte';
    import { logger } from '../utils/log';
  
    export let labels;
  </script>
  
<div class="task-card-labels">
    {#each labels as label}
        <a href="#{label}" class="tag" target="_blank" rel="noopener">#{label}</a>{#if label !== labels[labels.length - 1]}{" "}{/if}
    {/each}
</div>
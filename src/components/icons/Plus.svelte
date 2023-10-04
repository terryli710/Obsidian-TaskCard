

<script lang='ts'>
    import LucideIcon from './LucideIcon.svelte';
    export let width = "24";
    export let height = "24";
    export let ariaLabel = "plus";
    const svgPath = `
      <path d="M5 12h14"/>
      <path d="M12 5v14"/>
    `;

  </script>
  
  <LucideIcon width={width} height={height} svgPath={svgPath} ariaLabel={ariaLabel} class="task-card-icon" />
  
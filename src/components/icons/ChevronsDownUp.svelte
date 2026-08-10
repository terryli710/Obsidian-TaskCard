

<script>
  import LucideIcon from './LucideIcon.svelte';
  export let width = "24";
  export let height = "24";
  export let ariaLabel = "chevrons-down-up";
  const svgPath = `
    <path d="m7 20 5-5 5 5" />
    <path d="m7 4 5 5 5-5" />
  `;
</script>

<LucideIcon width={width} height={height} svgPath={svgPath} ariaLabel={ariaLabel} class="task-card-icon" />
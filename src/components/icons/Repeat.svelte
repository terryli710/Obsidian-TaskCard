<script>
    import LucideIcon from './LucideIcon.svelte';
    export let width = "24";
    export let height = "24";
    export let ariaLabel = "repeat";
    const svgPath = `
    <path d="m17 2 4 4-4 4"/>
    <path d="M3 11v-1a4 4 0 0 1 4-4h14"/>
    <path d="m7 22-4-4 4-4"/>
    <path d="M21 13v1a4 4 0 0 1-4 4H3"/>
    `;
  </script>
  <LucideIcon width={width} height={height} svgPath={svgPath} ariaLabel={ariaLabel} class="task-card-icon" />

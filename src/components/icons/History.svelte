

<script>
    import LucideIcon from './LucideIcon.svelte';
    export let width = "24";
    export let height = "24";
    export let ariaLabel = "chevrons-up-down";
    const svgPath = `
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>
    `;
  </script>
  <LucideIcon width={width} height={height} svgPath={svgPath} ariaLabel={ariaLabel} class="task-card-icon" />


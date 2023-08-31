

<script>
    import LucideIcon from './LucideIcon.svelte';
    export let width = "24";
    export let height = "24";
    const svgPath = `
    <path d="m7 15 5 5 5-5"/>
    <path d="m7 9 5-5 5 5"/>
    `;
  </script>
  <LucideIcon width={width} height={height} svgPath={svgPath} ariaLabel="chevrons-up-down" class="task-card-icon" />

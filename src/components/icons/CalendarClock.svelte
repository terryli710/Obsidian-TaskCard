

<script>
    import LucideIcon from './LucideIcon.svelte';
    export let width = "24";
    export let height = "24";
    export let ariaLabel = "chevrons-up-down";
    const svgPath = `
    <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/>
    <path d="M16 2v4"/>
    <path d="M8 2v4"/>
    <path d="M3 10h5"/>
    <path d="M17.5 17.5 16 16.25V14"/>
    <path d="M22 16a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z"/>
    `;
  </script>
  <LucideIcon width={width} height={height} svgPath={svgPath} ariaLabel={ariaLabel} class="task-card-icon" />


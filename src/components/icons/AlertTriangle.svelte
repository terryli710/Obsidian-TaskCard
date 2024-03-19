

<script>
    import LucideIcon from './LucideIcon.svelte';
    export let width = "24";
    export let height = "24";
    export let ariaLabel = "chevrons-up-down";
    const svgPath = `
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
    <path d="M12 9v4"/>
    <path d="M12 17h.01"/>
    `;
</script>
<LucideIcon width={width} height={height} svgPath={svgPath} ariaLabel={ariaLabel} class="task-card-icon" />

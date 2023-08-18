

<script lang='ts'>
    import LucideIcon from './LucideIcon.svelte';
    export let width = "24";
    export let height = "24";
    const svgPath = `
        <circle cx="12" cy="12" r="1"/>
        <circle cx="12" cy="5" r="1"/>
        <circle cx="12" cy="19" r="1"/>
    `;
</script>

<LucideIcon width={width} height={height} svgPath={svgPath} ariaLabel="more-vertical" class="task-card-icon" />
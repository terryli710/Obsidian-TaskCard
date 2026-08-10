<script lang="ts">
  export let SomeSvelteComponent: any; // change to `any` to accept any kind of component
  export let componentProps: { [key: string]: any } = {}; // prepare to receive the props for SomeSvelteComponent
  export let color: string;
  $: svgStyle = color ? `--color: ${color};` : ''; // This creates a reactive style declaration using the color variable if it's provided.
</script>

<!-- Container for the SVG, applying the reactive style declaration -->
<div class="svg-mono-color-scale" style={svgStyle}>
  <svelte:component this={SomeSvelteComponent} {...componentProps} class="svg-content" />
</div>

<style>
  .svg-mono-color-scale {
    /* Inherit color from global if not provided as a prop */
    --color: var(--text-accent);
  }

  .svg-mono-color-scale :global(svg) {
    /* Step 1: Convert to grayscale */
    filter: grayscale(100%) sepia(1) hue-rotate(var(--color)) saturate(2); /* tweak hue-rotate and saturate values to match the desired color and saturation */
  }
  .svg-mono-color-scale :global(svg *:not(g)) {
    /* Remove the fill and mix-blend-mode rules */
  }
</style>

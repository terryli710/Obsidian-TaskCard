

<script lang="ts">
    export let width: string = "24";
    export let height: string = "24";
    export let color: string = 'currentColor';
    export let role: string = 'img';
    export let ariaLabel: string = 'icon';
    export let strokeWidth: string = "2";
    export let svgPath: string = '';
    export let box: number = 24;
  </script>
  
  <svg
    xmlns="http://www.w3.org/2000/svg"
    {width}
    {height}
    {role}
    aria-label={ariaLabel}
    fill="none"
    stroke={color}
    stroke-width={strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    viewBox="0 0 {box} {box}"
    class={$$props.class}
    on:click
    on:keydown
    on:keyup
    on:focus
    on:blur
    on:mouseenter
    on:mouseleave
    on:mouseover
    on:mouseout
  >
    {@html svgPath}
  </svg>
  
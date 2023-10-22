

<script lang="ts">
    export let svgPath: string = '';
    export let altText: string = 'icon';  // Alt text for accessibility
    export let imgWidth: string = "24px";  // You can also use other units like 'em' or '%'
    export let imgHeight: string = "24px";
  </script>
  
  <style>
    .svg-container {
      /* Styles for your container, if needed, e.g., sizing, aspect ratio, etc. */
      width: var(--imgWidth);
      height: var(--imgHeight);
      background-repeat: no-repeat;
      background-size: contain;  /* Ensures your SVG scales nicely */
    }
  </style>
  
  <div class="svg-container" style="--imgWidth: {imgWidth}; --imgHeight: {imgHeight}; background-image: url('{svgPath}');" role="img" aria-label={altText}></div>
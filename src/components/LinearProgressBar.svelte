<script>
  export let value = 0;
  export let max = 1;
  export let showDigits = true;
  export let fillColor = 'var(--text-accent)'; // Default filling color
  export let barLength = 100; // Default length in pixels
  export let borderRadius = 5; // Default border radius in pixels

  $: progressBarWidth = () => {
    if (value <= 0) {
      return 0;
    } else if (value >= max) {
      return barLength; // Full width based on the barLength
    } else {
      return (value / max) * barLength; // Percentage of the max value adjusted to barLength
    }
  };
</script>

<div class="task-card-progress">
  <div class="svg-container" style="width: {barLength}px; height: 20px;">
    <svg viewBox={`0 0 ${barLength} 10`}>
      <rect
        x="0"
        y="0"
        width={barLength}
        height="10"
        fill="var(--background-secondary)"
        rx={borderRadius}
        ry={borderRadius}
      />
      <rect
        x="0"
        y="0"
        width={progressBarWidth()}
        height="10"
        fill={fillColor}
        rx={borderRadius}
        ry={borderRadius}
      />
    </svg>
  </div>
  {#if showDigits}
    <div class="digit">
      <span class="digit-content">{value}/{max}</span>
    </div>
  {/if}
</div>

<style>
  .task-card-progress {
    display: flex;
    flex-direction: row;
    align-items: center;
    align-self: center;

    border-radius: var(--radius-s);
  }

  .svg-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
  }

  svg {
    width: 100%; /* Full container width */
    height: 100%; /* Full container height */
  }

  .digit {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 15px;
  }

  .digit-content {
    font-size: var(--font-ui-small);
    color: var(--text-accent);
    padding: 3px 0px 0px 10px; /* Adjust padding for text alignment */
  }
</style>

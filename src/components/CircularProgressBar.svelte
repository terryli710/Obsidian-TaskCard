

<script>
    export let value = 0;
    export let max = 1;
    export let showDigits = true;
  
    $: progressPath = () => {
      if (value <= 0) {
        return "";
      } else if (value >= max) {
        return "M50,5A45 45 0 1 1 49.9999 5";
      } else {
        const angle = Math.PI * 2 * (value / max);
        const x = 50 + Math.cos(angle - Math.PI / 2) * 45;
        const y = 50 + Math.sin(angle - Math.PI / 2) * 45;
  
        let path = "M50,5";
  
        if (angle > Math.PI) {
          path += "A45 45 0 0 1 50 95";
        }
  
        path += `A45 45 0 0 1 ${x} ${y}`;
  
        return path;
      }
    };
  </script>

<div class="task-card-progress">
  <div class="svg-container">
    <svg viewBox="-10 -10 115 120">
        <path d="M50,5A45 45 0 1 1 49.9999 5" />
        <path d="{progressPath()}" />
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
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
  }

  svg {
    fill: transparent;
    stroke-linecap: round;
  }

  path:first-child {
    stroke: var(--background-secondary);
    stroke-width: 18px;
  }

  path:last-child {
    stroke: var(--text-accent);
    stroke-width: 20px;
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
    padding: 3px 0px 0px 0px;
  }
</style>

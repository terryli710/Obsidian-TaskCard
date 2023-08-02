<script>
    import { logger } from "../log";
    import { darkenHexColor } from "../utils/colorConverter";
    import TaskCard from "./TaskCard.svelte";
  
    export let taskEl;
  
    const style = getComputedStyle(document.body);
    const color = style.getPropertyValue('--background-secondary').trim();
    const darkenColor = darkenHexColor(color, 0.4);
  </script>
  
  <div class="obsidian-taskcard task-list-item">
    <TaskCard {taskEl} />
  </div>
  
<script>
    import { logger } from "../log";
    import { darkenHexColor } from "../utils/colorConverter";
    import TaskCard from "./TaskCard.svelte";
  
    export let taskItemEl;
    const taskEl = taskItemEl.querySelector('.obsidian-taskcard');
    logger.debug(`taskEl: ${taskEl.innerHTML}`);
  
    const style = getComputedStyle(document.body);
    const color = style.getPropertyValue('--background-secondary').trim();
    const darkenColor = darkenHexColor(color, 0.2);

    taskItemEl.innerHTML = "";
  </script>
  
  <div class="obsidian-taskcard task-list-item" style="box-shadow: 0px 0px 10px {darkenColor};">
    <TaskCard {taskEl} />
  </div>
  
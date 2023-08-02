<script>
    import { logger } from "../log";
    import TaskCard from "./TaskCard.svelte";
  
    export let taskItemEl;
    const taskEl = taskItemEl.querySelector('.obsidian-taskcard');
    logger.debug(`taskEl: ${taskEl.innerHTML}`);
  
    // const style = getComputedStyle(document.body);
    // const color = style.getPropertyValue('--background-secondary').trim();
    // const darkenColor = darkenHexColor(color, 0.2);

    taskItemEl.innerHTML = "";
</script>

<div class="obsidian-taskcard task-list-item">
<TaskCard {taskEl} />
</div>
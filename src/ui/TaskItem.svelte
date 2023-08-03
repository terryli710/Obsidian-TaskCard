<script>
    import { onMount } from "svelte";
    import { logger } from "../log";
    import TaskCard from "./TaskCard.svelte";
  
    export let taskItemEl;
    export let mode = "multi-line";
    const taskEl = taskItemEl.querySelector('.obsidian-taskcard');

    taskItemEl.innerHTML = "";


    function handleAction() {
        mode = "multi-line";
    }

    function handleKeydown(event) {
        // Respond to the Enter or Space key
        if (event.key === 'Enter' || event.key === ' ') {
            handleAction();
            event.preventDefault(); // Prevent the default action for the Space key
        }
    }
</script>

<button 
    class="obsidian-taskcard task-list-item" 
    on:click={handleAction} 
    on:keydown={handleKeydown}
>
    <TaskCard {taskEl} mode={mode} />
</button>
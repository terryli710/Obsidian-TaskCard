<script lang="ts">
    import Due from './Due.svelte';
    import Project from "./Project.svelte";
    import Labels from "./Labels.svelte";
    import { TaskItemParams } from "../renderer/injector";
    import Description from './Description.svelte';
    import { logger } from '../utils/log';
    import { createEventDispatcher } from 'svelte';
    import Collapse from '../components/icons/Collapse.svelte';
    import TaskCardPlugin from '../index';
    import { ObsidianTask } from '../taskModule/task';

    export let taskEl: HTMLElement;
    export let plugin: TaskCardPlugin;
    export let params: TaskItemParams;

    const task: ObsidianTask = plugin.taskParser.parseTaskEl(taskEl);

    const dispatch = createEventDispatcher();

    function switchMode(event, newMode) {
      event.stopPropagation();
      logger.debug(`Switching mode to ${newMode}`);
      dispatch('switchMode', newMode);
    }

    function handleCheckboxClick() {
      task.completed = !task.completed;
      // more logic to reflect the change on the taskEl
    }

</script>


{#if params.mode === "single-line"}
  <div class="task-card-single-line">
    <div class="task-card-single-line-left-container">
      <input type="checkbox" class={`task-card-checkbox ${task.priority}`} checked={task.completed} on:click|stopPropagation={handleCheckboxClick}>
      <div class="task-card-content">{task.content}</div>
    </div>
    <div class="task-card-single-line-right-container">
      <Due due={task.due} />
      <Project project={task.project} params={params} />
    </div>
  </div>
{:else}
<!-- mode = multi-line -->
  <div class="task-card-major-block">
    <div class="task-card-checkbox-wrapper">
      <input type="checkbox" class={`task-card-checkbox ${task.priority}`} checked={task.completed} on:click|stopPropagation={handleCheckboxClick}>
    </div>
    <div class="task-card-content-project-line">
      <div class="task-card-content">{task.content}</div>
      <div class="task-card-project">
        <Project project={task.project} params={params} />
      </div>
    </div>
    <Description description={task.description} />
  </div>

  <div class="task-card-attribute-bottom-bar">
    <div class="task-card-attribute-bottom-bar-left">
      <Due due={task.due} />
      <div class="task-card-attribute-separator"> | </div>
      <Labels labels={task.labels} />
    </div>
    <div class="task-card-attribute-bottom-bar-right">
      <button class="task-card-collapse-button" on:click={(event) => switchMode(event, 'single-line')}>
        <Collapse class="task-card-icon" />
      </button>
    </div>
  </div>
{/if}
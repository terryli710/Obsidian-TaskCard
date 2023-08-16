<script lang="ts">
    import Due from './Due.svelte';
    import Project from "./Project.svelte";
    import Labels from "./Labels.svelte";
    import { TaskItemParams } from "../renderer/postProcessor";
    import Description from './Description.svelte';
    import { logger } from '../utils/log';
    import { createEventDispatcher } from 'svelte';
    import Collapse from '../components/icons/Collapse.svelte';
    import TaskCardPlugin from '../index';
    import { ObsidianTask } from '../taskModule/task';
    import { ObsidianTaskSyncManager } from '../taskModule/taskSyncManager';
    import Content from './Content.svelte';

    export let taskSyncManager: ObsidianTaskSyncManager;
    export let plugin: TaskCardPlugin;
    export let params: TaskItemParams;

    let task: ObsidianTask = taskSyncManager.obsidianTask;

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
      <Due taskSyncManager={taskSyncManager} plugin={plugin} />
      <Project taskSyncManager={taskSyncManager} params={params} />
    </div>
  </div>
{:else}
<!-- mode = multi-line -->
  <div class="task-card-major-block">
    <div class="task-card-checkbox-wrapper">
      <input type="checkbox" class={`task-card-checkbox ${task.priority}`} checked={task.completed} on:click|stopPropagation={handleCheckboxClick}>
    </div>
    <div class="task-card-content-project-line">
      <Content taskSyncManager={taskSyncManager} />
      <div class="task-card-project">
        <Project taskSyncManager={taskSyncManager} params={params} />
      </div>
    </div>
    <Description taskSyncManager={taskSyncManager} />
  </div>

  <div class="task-card-attribute-bottom-bar">
    <div class="task-card-attribute-bottom-bar-left">
      <Due taskSyncManager={taskSyncManager} plugin={plugin} />
      <div class="task-card-attribute-separator"> | </div>
      <Labels taskSyncManager={taskSyncManager} />
    </div>
    <div class="task-card-attribute-bottom-bar-right">
      <button class="task-card-collapse-button" on:click={(event) => switchMode(event, 'single-line')}>
        <Collapse class="task-card-icon" />
      </button>
    </div>
  </div>
{/if}
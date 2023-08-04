<script lang="ts">
    import Due from './Due.svelte';
    import Project from "./Project.svelte";
    import Labels from "./Labels.svelte";
    import { TaskItemParams } from "../renderer/injector";
    import Description from './Description.svelte';
    import { logger } from '../log';
    import { createEventDispatcher } from 'svelte';
    import Collapse from '../components/icons/Collapse.svelte';

    export let taskEl;
    export let params: TaskItemParams;

    function parseQuery(queryName, defaultValue = "") {
      try {
        return JSON.parse(taskEl.querySelector(`.${queryName}`)?.textContent || defaultValue)
      } catch (e) {
        logger.warn(`Failed to parse ${queryName}: ${e}`);
      }
    }

    const dispatch = createEventDispatcher();

    function switchMode(newMode) {
      // Calling method on the adapter instance
      dispatch('switchMode', newMode);
    }

    let content = parseQuery('content');
    let priority = parseQuery('priority');
    let priorityClass = `priority${priority}`;
    let description = parseQuery('description');
    let order = parseQuery('order');
    let project = JSON.parse(parseQuery('project', '{}'));
    let sectionId = parseQuery('section-id');
    let labels = parseQuery('labels', '[]');
    let completed = parseQuery('completed');
    let parent = parseQuery('parent');
    let children = parseQuery('children');
    let due = JSON.parse(parseQuery('due', '{}'));
    let filePath = parseQuery('file-path');

</script>

{#if params.mode === "single-line"}
  <div class="task-card-single-line">
    <div class="task-card-single-line-left-container">
      <input type="checkbox" class={`task-card-checkbox ${priorityClass}`}>
      <div class="task-card-content">{content}</div>
    </div>
    <div class="task-card-single-line-right-container">
      <Due {due} />
      <Project {project} {params} />
    </div>
  </div>
{:else}
<!-- mode = multi-line -->
  <div class="task-card-major-block">
    <div class="task-card-checkbox-wrapper">
      <input type="checkbox" class={`task-card-checkbox ${priorityClass}`}>
    </div>
    <div class="task-card-content-project-line">
      <div class="task-card-content">{content}</div>
      <div class="task-card-project">
        <Project {project} {params} />
      </div>
    </div>
    <Description {description} />
  </div>

  <div class="task-card-attribute-bottom-bar">
    <div class="task-card-attribute-bottom-bar-left">
      <Due {due} />
      <div class="task-card-attribute-separator"> | </div>
      <Labels {labels} />
    </div>
    <div class="task-card-attribute-bottom-bar-right">
      <button class="task-card-collapse-button" on:click={() => switchMode('one-line')}>
        <Collapse class="task-card-icon" />
      </button>
    </div>
  </div>
{/if}
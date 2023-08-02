<script>
  import { logger } from "../log";
  import Due from './Due.svelte';
  import { onMount, tick } from 'svelte';
  import Project from "./Project.svelte";
  import { darkenHexColor } from "../utils/colorConverter";

  export let taskEl;

  // let checkboxElement;
  // let descriptionElement;

  // onMount(async () => {
  //   // await tick();
  //   // descriptionElement.style.marginLeft = `${checkboxElement.offsetWidth}px`;
  //   descriptionElement.style.marginLeft = `40px`; // TODO: debug
  // });

  function parseQuery(queryName, defaultValue = "") {
    return JSON.parse(taskEl.querySelector(`.${queryName}`)?.textContent || defaultValue);
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


  taskEl.innerHTML = ""; // this component replaces the innerHTML
</script>

<div class="task-card-major-block">
  <div class="task-card-checkbox-wrapper">
    <input type="checkbox" class={`task-card-checkbox ${priorityClass}`}>
  </div>
  <div class="task-card-content-project-line">
    <div class="task-card-content">{content}</div>
    <div class="task-card-project">
      <Project {project} />
    </div>
  </div>
  <div class="task-card-description">{description}</div>
</div>


<div class="task-card-due-labels">
  <Due {due} />
  <div class="task-card-due-labels-separator">|</div>
  <div class="task-card-labels">
    {#each labels as label}
      <a href="#{label}" class="tag" target="_blank" rel="noopener">#{label}</a>{#if label !== labels[labels.length - 1]}{" "}{/if}
    {/each}
  </div>
</div>
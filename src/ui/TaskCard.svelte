<script>
  import { logger } from "../log";
  import Due from './Due.svelte';

  export let taskEl;

  function parseQuery(queryName, defaultValue = "") {
    return JSON.parse(taskEl.querySelector(`.${queryName}`)?.textContent || defaultValue);
  }

  let content = parseQuery('content');
  let priority = parseQuery('priority');
  let priorityClass = `priority${priority}`;
  let description = parseQuery('description');
  let order = parseQuery('order');
  let project = JSON.parse(parseQuery('project', '{}'));
  let projectName = project.name
  let projectId = project.id
  let projectColor = null; // TODO: find a way to get.
  let sectionId = parseQuery('section-id');
  let labels = parseQuery('labels', '[]');
  let completed = parseQuery('completed');
  let parent = parseQuery('parent');
  let children = parseQuery('children');
  let due = JSON.parse(parseQuery('due', '{}'));
  let filePath = parseQuery('file-path');


  taskEl.innerHTML = ""; // this component replaces the innerHTML
  // NOTE: the outerHTML is the div of .obsidian-taskcard

</script>

<div class="task-card-first-line">
  <div class="task-card-content">
    <input type="checkbox" class={`task-card-checkbox ${priorityClass}`}>
    <span>{content}</span>
  </div>
  <div class="task-card-project">
    <a href="#{projectName}" class="tag" target="_blank" rel="noopener">{projectName}</a>
  </div>
</div>

<div class="task-card-description">{description}</div>
<!-- <div class="task-card-section-id">{sectionId}</div> -->
<div class="task-card-labels">
  {#each labels as label}
    <a href="#{label}" class="tag" target="_blank" rel="noopener">#{label}</a>{#if label !== labels[labels.length - 1]}, {/if}
  {/each}
</div>
<Due {due} />

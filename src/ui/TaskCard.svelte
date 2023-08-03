<script>
  import Due from './Due.svelte';
  import Project from "./Project.svelte";
  import Labels from "./Labels.svelte";
  import Description from './Description.svelte';

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
  <Description {description} />
</div>


<div class="task-card-attribute-bottom-bar">
  <Due {due} />
  <div class="task-card-attribute-separator"> | </div>
  <Labels {labels} />
</div>
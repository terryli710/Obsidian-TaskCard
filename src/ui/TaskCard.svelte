<script>
  export let taskEl;

  function parseQuery(queryName, defaultValue = "") {
    return JSON.parse(taskEl.querySelector(`.${queryName}`)?.textContent || defaultValue);
  }

  let content = parseQuery('content');
  let priority = parseQuery('priority');
  let description = parseQuery('description');
  let order = parseQuery('order');
  let projectId = parseQuery('project-id');
  let sectionId = parseQuery('section-id');
  let labels = parseQuery('labels', '[]');
  let completed = parseQuery('completed');
  let parent = parseQuery('parent');
  let children = parseQuery('children');
  let due = parseQuery('due');
  let filePath = parseQuery('file-path');

  taskEl.innerHTML = ""; // this component replaces the innerHTML
  // NOTE: the outerHTML is the div of .obsidian-taskcard

</script>

<div class="task-card-first-line">
  <input type="checkbox" class="task-card-checkbox" class:priority={priority}>
  <span class="task-card-content">{content}</span>
  <div class="task-card-project-id"><a href="#">{projectId}</a></div>
</div>

<div class="task-card-description">{description}</div>
<div class="task-card-order">{order}</div>
<div class="task-card-section-id">{sectionId}</div>
{#each labels as label}
  <span class="task-card-labels">#{label}</span>
{/each}
<div class="task-card-due">Due: {due}</div>


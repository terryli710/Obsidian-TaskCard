<script>
  export let taskEl;
  // export let task;
  
  let content = JSON.parse(taskEl.querySelector('.content')?.textContent || '');
  let priority = taskEl.querySelector('.priority')?.textContent;
  let description = taskEl.querySelector('.description')?.textContent;
  let order = taskEl.querySelector('.order')?.textContent;
  let projectId = taskEl.querySelector('.project-id')?.textContent;
  let sectionId = taskEl.querySelector('.section-id')?.textContent;
  let labels = taskEl.querySelector('.labels')?.textContent;
  let completed = taskEl.querySelector('.completed')?.textContent;
  let parent = taskEl.querySelector('.parent')?.textContent;
  let children = taskEl.querySelector('.children')?.textContent;
  let due = taskEl.querySelector('.due')?.textContent;
  let filePath = taskEl.querySelector('.file-path')?.textContent;
</script>

<div class="obsidian-taskcard">
  <div class="task-card-first-line">
    <input type="checkbox" class="task-card-checkbox">
    <span class="task-card-content">{content}</span>
  </div>
  
  <div class="task-card-priority">{priority}</div>
  <div class="task-card-description">{description}</div>
  <div class="task-card-order">{order}</div>
  <div class="task-card-project-id">Project ID: {projectId}</div>
  <div class="task-card-section-id">Section ID: {sectionId}</div>
  <div class="task-card-labels">{labels}</div>
  <div class="task-card-due">Due: {due}</div>
  <div class="task-card-file-path">File Path: {filePath}</div>
</div>
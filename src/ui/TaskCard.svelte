<script>
    export let task = {
      content: 'Task content',
      description: 'Task description',
      labels: ['label1', 'label2'],
      completed: false,
    };
  
    function toggleComplete() {
      task.completed = !task.completed;
    }
  </script>
  
  <div class="card">
    <div class="task-checkbox" on:click={toggleComplete}>
      {task.completed ? '[x]' : '[ ]'}
    </div>
    <div class="task-content">
      <div class="task-title">{task.content}</div>
      {#if task.description}
        <div class="task-description">{task.description}</div>
      {/if}
      <div class="task-labels">
        {#each task.labels as label}
          <span class="task-label">#{label}</span>
        {/each}
      </div>
    </div>
  </div>
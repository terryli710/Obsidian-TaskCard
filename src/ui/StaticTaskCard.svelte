<script lang="ts">
    import { Platform, Workspace } from 'obsidian';
  import ChevronsDownUp from '../components/icons/ChevronsDownUp.svelte';
  import ChevronsUpDown from '../components/icons/ChevronsUpDown.svelte';
  import {
    TaskDisplayMode,
    TaskDisplayParams
  } from '../renderer/postProcessor';
  import { MarkdownTaskMetadata } from '../renderer/staticTaskListRenderer';
  import { LabelModule } from '../taskModule/labels';
  import { ObsidianTask } from '../taskModule/task';
  import { displayDate, displayTime } from '../utils/dateTimeFormatter';
  import { logger } from '../utils/log';
  import { marked } from 'marked';
    import TaskCardPlugin from '..';
  marked.use({ mangle: false, headerIds: false, langPrefix: '' });
  

  export let taskItemInfo: {
    task: ObsidianTask;
    markdownTaskMetadata: MarkdownTaskMetadata;
  };
  export let plugin: TaskCardPlugin;

  let taskDisplayParams: TaskDisplayParams = { mode: 'single-line' };
  let task = taskItemInfo.task;
  let dueDisplay = '';
  let labelModule = new LabelModule();
  logger.debug(`task.description: ${task.description}`);
  let descriptionMarkdown = marked(task.description);

  labelModule.setLabels(task.labels);

  function handleCheckboxClick() {
    task.completed = !task.completed;
    toggleCompleteOfTask(task.completed, taskItemInfo.markdownTaskMetadata);
  }

  async function toggleCompleteOfTask(completed: boolean, markdownTaskMetadata: MarkdownTaskMetadata) {
  // Get the line from the file
  const line = await plugin.fileOperator.getLineFromFile(
    markdownTaskMetadata.filePath,
    markdownTaskMetadata.lineNumber + 1
  );

  // Determine the symbol to use based on the 'completed' flag
  const symbol = completed ? 'x' : ' ';

  // Use a regular expression to find the task's current completion symbol and replace it
  const updatedLine = line.replace(/- \[[^\]]\]/, `- [${symbol}]`);

  // Update the line in the file
  plugin.fileOperator.updateLineInFile(
    markdownTaskMetadata.filePath,
    markdownTaskMetadata.lineNumber + 1,
    updatedLine
  );
}

  function updateDueDisplay(): string {
    if (!task.due) {
      dueDisplay = '';
      return dueDisplay;
    }
    let datePart = displayDate(task.due.date);
    let timePart = displayTime(task.due.time);
    dueDisplay = timePart ? `${datePart}, ${timePart}` : datePart;
    return dueDisplay;
  }

  updateDueDisplay();

  function switchMode(
    event: MouseEvent | KeyboardEvent | CustomEvent,
    newMode: TaskDisplayMode | null = null
  ) {
    event.stopPropagation();
    taskDisplayParams.mode = newMode;
  }

  function linkToTask(event: MouseEvent | KeyboardEvent) {
    event.stopPropagation();

    const selectionState = {
          eState: {
              cursor: {
                  from: { line: taskItemInfo.markdownTaskMetadata.lineNumber, 
                          ch: 0 },
                  to: { line: taskItemInfo.markdownTaskMetadata.lineNumber + 1, 
                        ch: 0 },
              },
              line: taskItemInfo.markdownTaskMetadata.lineNumber,
          },
      };
    
    logger.debug(`selectionState: ${JSON.stringify(selectionState)}`);
    plugin.app.workspace.openLinkText(
      taskItemInfo.markdownTaskMetadata.filePath,
      taskItemInfo.markdownTaskMetadata.filePath,
      event.ctrlKey || (event.metaKey && Platform.isMacOS),
      selectionState
    )
  }

</script>

{#if taskDisplayParams.mode === 'single-line'}
  <div class="task-card-single-line">
    <div class="static-task-card-container">
      <!-- Left Element: Checkbox -->
      <div class="static-task-card-left">
        <input
          type="checkbox"
          class={`task-card-checkbox priority-${task.priority}`}
          checked={task.completed}
          on:click|stopPropagation={handleCheckboxClick}
        />
      </div>
  
      <!-- Middle Element: Content and Project -->
      <div 
        class="static-task-card-middle"
        role="button" 
        tabindex="0" 
        on:click={linkToTask}
        on:keydown={linkToTask}
      >
        <div class="static-task-card-content">{task.content}</div>
        <div class="static-task-card-middle-right">
          <!-- Due -->
          {#if task.hasDue()}
            <div class="task-card-due mode-single-line}" role="button" tabindex="0">
              <div class="due-display">
                {dueDisplay}
              </div>
            </div>
          {/if}
          <div class="task-card-project">
            {#if task.hasProject()}
              <span
                class="project-color"
                style="background-color: {task.project.color};"
              />
            {/if}
          </div>
        </div>
      </div>
  
      <!-- Right Element: Button -->
      <div class="static-task-card-right">
        <button
          class="task-card-button mode-toggle-button"
          on:click={(event) => switchMode(event, 'multi-line')}
        >
          <ChevronsUpDown />
        </button>
      </div>
    </div>    
  </div>
{:else}
  <!-- mode = multi-line -->
  <div 
    class="task-card-major-block"
    role="button" 
    tabindex="0" 
    on:click={linkToTask}
    on:keydown={linkToTask}
  >
    <div class="task-card-checkbox-wrapper">
      <input
        type="checkbox"
        class={`task-card-checkbox priority-${task.priority}`}
        checked={task.completed}
        on:click|stopPropagation={handleCheckboxClick}
      />
    </div>
    <div class="task-card-content-project-line">
      <!-- Content -->
      <div class="task-card-content mode-multi-line" role="button" tabindex="0">
        {task.content}
      </div>
      <!-- Project -->
      <div class="project-wrapper">
        {#if task.hasProject()}
          <div class="task-card-project">
            <a
              href="#{task.project.name}"
              class="tag"
              target="_blank"
              rel="noopener"
            >
              {task.project.name}
            </a>
            <span
              class="project-color clickable-icon"
              style="background-color: {task.project.color};"
            />
          </div>
        {/if}
      </div>
    </div>
    <!-- Description -->
    {#if task.hasDescription()}
      <div class="task-card-description" role="button" tabindex="0">
        {@html descriptionMarkdown}
      </div>
    {/if}
  </div>

  <div class="task-card-attribute-bottom-bar">
    <div class="task-card-attribute-bottom-bar-left">
      <!-- Due -->
      {#if task.hasDue()}
        <div class="task-card-due mode-multi-line}" role="button" tabindex="0">
          <div class="due-display">
            {dueDisplay}
          </div>
        </div>
        {#if taskDisplayParams.mode === 'multi-line'}
          <div class="task-card-attribute-separator"> | </div>
        {/if}
      {/if}
      <!-- Labels -->
      <div class="task-card-labels">
        {#each labelModule.getLabels() as label}
          <div class="label-container">
            <a href={label} class="tag" target="_blank" rel="noopener">
              {label}
            </a>
          </div>
        {/each}
      </div>
    </div>
    <div class="task-card-attribute-bottom-bar-right">
      <button
        class="task-card-button mode-toggle-button"
        on:click={(event) => switchMode(event, 'single-line')}
      >
        <ChevronsDownUp />
      </button>
    </div>
  </div>
{/if}


<style>
  .static-task-card-content {
    padding-left: 0.25em;
    padding-right: 0.25em;
    font-size: var(--font-text-size);
    flex-grow: 1; /* Make it take up all available space */
  }
  .static-task-card-container {
    display: flex;
    align-items: center;
    width: 100%; /* Ensure it takes up all available space */
  }

  .static-task-card-left {
    flex-shrink: 0;
    display: flex; /* Added */
    align-items: center; /* Center align items vertically */
  }

  .static-task-card-middle {
    flex-grow: 1;
    display: flex;
    flex-direction: row; /* Changed from column to row */
    justify-content: space-between; /* Added */
    align-items: center; /* Added */
    cursor: pointer;
    border-radius: var(--radius-s);
  }

  .static-task-card-middle:hover {
    background-color: var(--background-modifier-hover);
  }

  .static-task-card-right {
    flex-shrink: 0;
    align-self: flex-end;
    display: flex; /* Added */
    align-items: center; /* Center align items vertically */
    margin-left: 4px;
  }

  .project-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .task-card-project {
    flex-shrink: 0;
    white-space: nowrap;
    display: flex;
    align-items: center;
    font-size: var(--font-ui-small);
  }

  .project-color {
    display: inline-block;
    width: 12px;
    height: 12px;
    padding: 4px;
    border-radius: 50%;
    margin: 4px;
    border: var(--border-width) solid var(--background-primary);
  }

  .task-card-due {
    display: inline;
    padding: var(--tag-padding-y) var(--tag-padding-x);
    border: var(--border-width) solid var(--background-modifier-border);
    width: auto;
    border-radius: var(--tag-radius);
    font-size: calc(var(--font-ui-medium) * 0.875);
    color: var(--text-accent);
    white-space: nowrap;
    line-height: 1;
  }

  .static-task-card-middle-right {
    display: flex;
    align-items: center;
  }

  .task-card-checkbox {
    border: var(--border-width) solid;
    border-color: var(--checkbox-border-color);
  }

  /* Apply color to checkbox based on priority */
  .task-card-checkbox.priority-1 {
    border-color: var(--color-red);
  }
  .task-card-checkbox.priority-2 {
    border-color: var(--color-orange);
  }
  .task-card-checkbox.priority-3 {
    border-color: var(--color-yellow);
  }

  /* Maintain border color on hover */
  .task-card-checkbox.priority-4:hover {
    border-color: var(--checkbox-border-color-hover);
  }

  .task-card-checkbox.priority-1:hover {
    background-color: rgba(var(--color-red-rgb), 0.1);
  }
  .task-card-checkbox.priority-2:hover {
    background-color: rgba(var(--color-orange-rgb), 0.1);
  }
  .task-card-checkbox.priority-3:hover {
    background-color: rgba(var(--color-yellow-rgb), 0.1);
  }

  input[type=checkbox].task-card-checkbox.priority-1:checked {
    background-color: rgba(var(--color-red-rgb), 0.7);
  }
  input[type=checkbox].task-card-checkbox.priority-2:checked {
    background-color: rgba(var(--color-orange-rgb), 0.7);
  }
  input[type=checkbox].task-card-checkbox.priority-3:checked {
    background-color: rgba(var(--color-yellow-rgb), 0.7);
  }

  input[type=checkbox].task-card-checkbox.priority-1:checked:hover {
    background-color: rgba(var(--color-red-rgb), 0.9);
  }
  input[type=checkbox].task-card-checkbox.priority-2:checked:hover {
    background-color: rgba(var(--color-orange-rgb), 0.9);
  }
  input[type=checkbox].task-card-checkbox.priority-3:checked:hover {
    background-color: rgba(var(--color-yellow-rgb), 0.9);
  }

  .task-card-description {
    grid-column: 2;
    grid-row: 2;
    font-size: var(--font-smallest);
    line-height: var(--line-height-tight);
    color: var(--text-faint);
    border-radius: 5px; /* Rounded square */
    margin: 0.1em; /* Padding for the content */
    padding: 0.22em; /* Padding for the content */
    word-wrap: break-word; /* To break words if too long */
    white-space: normal; /* To auto change lines */
  }

  .task-card-labels {
    display: flex;
    padding: 2px 0;
    flex-wrap: nowrap; /* Prevents wrapping */
    overflow: scroll; /* Truncates any labels that don't fit */
    white-space: nowrap; /* Keeps labels on a single line */
    align-items: center;
    gap: 4px;
    flex-grow: 1; /* Make it take up all available space */
    font-size: var(--font-ui-medium);
  }

  .task-card-labels a {
    text-decoration: none;
    flex-shrink: 0;
  }

  .task-card-major-block {
    display: grid;
    grid-template-columns: auto 1fr; /* Checkbox takes only the space it needs, rest for content and description */
    grid-template-rows: auto auto; /* Two rows for content and description */
    width: 100%;
    align-items: center;
    margin: 0 -3px;
    padding: 0 3px;
  }

  .task-card-major-block:hover {
    background-color: var(--background-modifier-hover);
    border-radius: var(--radius-m);
    cursor: pointer;
  }

  button.mode-toggle-button {
    border-radius: var(--radius-m);
  }
  
</style>
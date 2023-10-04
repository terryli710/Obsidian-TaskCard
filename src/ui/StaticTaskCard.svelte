<script lang="ts">
    import { Platform, Workspace } from 'obsidian';
  import ChevronsDownUp from '../components/icons/ChevronsDownUp.svelte';
  import ChevronsUpDown from '../components/icons/ChevronsUpDown.svelte';
  import {
    TaskDisplayMode,
    TaskDisplayParams
  } from '../renderer/postProcessor';
  import { LabelModule } from '../taskModule/labels';
  import { DocPosition, ObsidianTask, PositionedObsidianTask } from '../taskModule/task';
  import { displayDate, displayTime } from '../utils/dateTimeFormatter';
  import { logger } from '../utils/log';
  import { marked } from 'marked';
  import TaskCardPlugin from '..';
  import { DescriptionParser } from '../taskModule/description';
    import CircularProgressBar from '../components/CircularProgressBar.svelte';
  marked.use({ mangle: false, headerIds: false, langPrefix: '' });
  

  export let taskItem: PositionedObsidianTask;
  export let plugin: TaskCardPlugin;

  let taskDisplayParams: TaskDisplayParams = { mode: 'single-line' };
  let task = taskItem;
  let docPosition = taskItem.docPosition;
  let dueDisplay = '';
  let labelModule = new LabelModule();
  let descriptionMarkdown = marked(task.description);
  let descriptionProgress = DescriptionParser.progressOfDescription(task.description);

  labelModule.setLabels(task.labels);

  function handleCheckboxClick() {
    task.completed = !task.completed;
    toggleCompleteOfTask(task.completed, taskItem.docPosition);
  }

  async function toggleCompleteOfTask(completed: boolean, docPosition: DocPosition) {
  // Get the line from the file
  const line = await plugin.fileOperator.getLineFromFile(
    docPosition.filePath,
    docPosition.start.line + 1,
  );

  // Determine the symbol to use based on the 'completed' flag
  const symbol = completed ? 'x' : ' ';

  // Use a regular expression to find the task's current completion symbol and replace it
  const updatedLine = line.replace(/- \[[^\]]\]/, `- [${symbol}]`);

  // Update the line in the file
  plugin.fileOperator.updateLineInFile(
    docPosition.filePath,
    docPosition.start.line + 1,
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
                  from: { line: docPosition.start.line, 
                          ch: 0 },
                  to: { line: docPosition.start.line + 1, 
                        ch: 0 },
              },
              line: docPosition.start.line,
          },
      };
    
    plugin.app.workspace.openLinkText(
      docPosition.filePath,
      docPosition.filePath,
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
        title="{docPosition.filePath}"
        on:click={linkToTask}
        on:keydown={linkToTask}
      >
        <div class="static-task-card-content">{task.content}</div>
        <div class="static-task-card-middle-right">
          {#if descriptionProgress[1] * descriptionProgress[0] > 0 && !task.completed }
            <CircularProgressBar value={descriptionProgress[0]} max={descriptionProgress[1]} showDigits={false} />
          {/if}
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
          <ChevronsUpDown ariaLabel="Toggle Task Display Mode" />
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
    title="{docPosition.filePath}"
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
    <div class="task-card-description-wrapper">
      {#if descriptionProgress[1] * descriptionProgress[0] > 0 }
        <div class="task-card-progress-position">
          <CircularProgressBar value={descriptionProgress[0]} max={descriptionProgress[1]} />
        </div>
      {/if}
      {#if task.hasDescription()}
        <div class="task-card-description" role="button" tabindex="0">
          {@html descriptionMarkdown}
        </div>
      {/if}
    </div>
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
        <ChevronsDownUp ariaLabel="Toggle Task Display Mode" />
      </button>
    </div>
  </div>
{/if}


<style>

  .task-card-progress-position {
    position: absolute; /* Absolute positioning for the progress bar */
    top: 3px;
    right: 3px;
    /* background: linear-gradient(to right, transparent 0%, var(--background-primary) 30%, var(--background-primary) 100%); */
    background-color: var(--background-primary);
    border-radius: var(--radius-s);
    padding: 2px 5px 2px 5px;
    display: flex;
    align-items: center;
    /* height: 35px; */
  }

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
    border-color: var(--color-yellow);
  }
  .task-card-checkbox.priority-3 {
    border-color: var(--color-cyan);
  }

  /* Maintain border color on hover */
  .task-card-checkbox.priority-4:hover {
    border-color: var(--checkbox-border-color-hover);
  }

  .task-card-checkbox.priority-1:hover {
    background-color: rgba(var(--color-red-rgb), 0.1);
  }
  .task-card-checkbox.priority-2:hover {
    background-color: rgba(var(--color-yellow-rgb), 0.1);
  }
  .task-card-checkbox.priority-3:hover {
    background-color: rgba(var(--color-cyan-rgb), 0.1);
  }

  input[type=checkbox].task-card-checkbox.priority-1:checked {
    background-color: rgba(var(--color-red-rgb), 0.7);
  }
  input[type=checkbox].task-card-checkbox.priority-2:checked {
    background-color: rgba(var(--color-yellow-rgb), 0.7);
  }
  input[type=checkbox].task-card-checkbox.priority-3:checked {
    background-color: rgba(var(--color-cyan-rgb), 0.7);
  }

  input[type=checkbox].task-card-checkbox.priority-1:checked:hover {
    background-color: rgba(var(--color-red-rgb), 0.9);
  }
  input[type=checkbox].task-card-checkbox.priority-2:checked:hover {
    background-color: rgba(var(--color-yellow-rgb), 0.9);
  }
  input[type=checkbox].task-card-checkbox.priority-3:checked:hover {
    background-color: rgba(var(--color-cyan-rgb), 0.9);
  }


  .task-card-description-wrapper {
        position: relative; /* Relative positioning for the wrapper */
        grid-column: 2;
        grid-row: 2;
        width: 100%;
        height: 100%;
    }

  .task-card-description {
    font-size: var(--font-smallest);
    line-height: var(--line-height-tight);
    color: var(--text-faint);
    border-radius: var(--radius-s);
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
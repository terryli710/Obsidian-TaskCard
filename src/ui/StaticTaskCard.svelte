<script lang="ts">
  import ChevronsDownUp from '../components/icons/ChevronsDownUp.svelte';
  import {
    TaskDisplayMode,
    TaskDisplayParams
  } from '../renderer/postProcessor';
  import { MarkdownTaskMetadata } from '../renderer/staticTaskListRenderer';
  import { LabelModule } from '../taskModule/labels';
  import { ObsidianTask } from '../taskModule/task';
  import { displayDate, displayTime } from '../utils/dateTimeFormatter';

  export let taskItemInfo: {
    task: ObsidianTask;
    markdownTaskMetadata: MarkdownTaskMetadata;
  };

  let taskDisplayParams: TaskDisplayParams = { mode: 'single-line' };
  let task = taskItemInfo.task;
  let dueDisplay = '';
  let labelModule = new LabelModule();

  labelModule.setLabels(task.labels);

  function handleCheckboxClick() {
    task.completed = !task.completed;
    // TODO: update the original task
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
</script>

{#if taskDisplayParams.mode === 'single-line'}
  <div class="task-card-single-line">
    <div class="static-task-card-button">
      <div class="task-card-single-line-left-container">
        <input
          type="checkbox"
          class={`task-card-checkbox priority-${task.priority}`}
          checked={task.completed}
          on:click|stopPropagation={handleCheckboxClick}
        />
        <div class="task-card-content">{task.content}</div>
      </div>
      <div class="task-card-single-line-right-container">
        <!-- Due -->
        {#if task.hasDue()}
          <div
            class="task-card-due mode-single-line"
            role="button"
            tabindex="0"
          >
            <div class="due-display">
              {dueDisplay}
            </div>
          </div>
        {/if}
        <!-- Project -->
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
    <!-- TODO: add a multi-line icon -->
  </div>
{:else}
  <!-- mode = multi-line -->
  <div class="task-card-major-block">
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
        {@html task.description}
      </div>
    {/if}
  </div>

  <div class="task-card-attribute-bottom-bar">
    <div class="task-card-attribute-bottom-bar-left">
      {#if task.hasDue()}
        <div class="task-card-due mode-multi-line}" role="button" tabindex="0">
          <div class="due-display">
            {dueDisplay}
          </div>
        </div>
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

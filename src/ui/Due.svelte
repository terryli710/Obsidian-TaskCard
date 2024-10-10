<script lang="ts">
  import { logger } from '../utils/log';
  import { ScheduleDate, ObsidianTask } from '../taskModule/task';
  import { ObsidianTaskSyncManager } from '../taskModule/taskSyncManager';
  import TaskCardPlugin from '..';
  import { tick } from 'svelte';
  import { TaskDisplayParams } from '../renderer/postProcessor';
  import { Notice } from 'obsidian';
  import AlertTriangle from '../components/icons/AlertTriangle.svelte';
  import moment from 'moment';
  import { getRelativeTimeDisplay, getAbsoluteTimeDisplay } from '../utils/timeDisplay';

  export let interactive: boolean = true;
  export let taskSyncManager: ObsidianTaskSyncManager = undefined;
  export let taskItem: ObsidianTask = undefined;
  export let plugin: TaskCardPlugin = undefined;
  export let params: TaskDisplayParams;

  let due: ScheduleDate;
  let dueDisplay = '';
  let dueInputElement: HTMLInputElement;
  let dueInputString = '';
  let editMode = false;

  function updateDue() {
    if (interactive) {
      due = taskSyncManager.obsidianTask.hasDue() ? taskSyncManager.obsidianTask.due : null;
    } else {
      due = taskItem.due;
    }
    updateDueDisplay();
  }

  async function toggleDueEditMode(event: MouseEvent | KeyboardEvent) {
    if (editMode) {
      return;
    }
    if (event instanceof KeyboardEvent && event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    editMode = true;
    dueInputString = due ? due.string : '';
    await tick();
    focusAndSelect(dueInputElement);
  }

  function finishDueEditing(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      const parsedDue = plugin.taskParser.parseSchedule(dueInputString);
      if (parsedDue || dueInputString.trim() === '') {
        due = parsedDue;
        taskSyncManager.updateObsidianTaskAttribute('due', due);
        updateDueDisplay();
      } else {
        new Notice("[TaskCard] Invalid due date format: " + dueInputString);
      }
      editMode = false;
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      editMode = false;
      updateDueDisplay();
    }
  }
  function getTaskDueStatus(task: ObsidianTask): string {
    if (!task.due) return '';

    const now = moment();
    const dueDateTime = moment(`${task.due.date} ${task.due.time || '23:59'}`);
    const taskDuration = task.duration ? moment.duration(task.duration) : null;
    const taskSchedule = task.schedule ? moment(`${task.schedule.date} ${task.schedule.time || '00:00'}`) : null;
    
    if (task.completed) {
      return 'passed';
    } else if (dueDateTime.isBefore(now)) {
      return 'passDue';
    }

    // Check if the task is ongoing
    if (!taskDuration && !taskSchedule) {
      // No duration, no schedule: ongoing if due within 24 hours
      if (dueDateTime.diff(now, 'hours') <= 24) {
        return 'ongoing';
      }
    } else if (taskDuration && !taskSchedule) {
      // Duration yes, schedule no: ongoing if within duration to due 
      const startTime = dueDateTime.clone().subtract(taskDuration);
      if (now.isBetween(startTime, dueDateTime)) {
        return 'ongoing';
      }
    } else if (taskDuration && taskSchedule) {
      // Duration yes, schedule yes: ongoing if within schedule to schedule + duration
      const endTime = taskSchedule.clone().add(taskDuration);
      if (now.isBetween(taskSchedule, endTime)) {
        return 'ongoing';
      }
    } else if (!taskDuration && taskSchedule) {
      // Duration no, schedule yes: ongoing if between schedule and due
      if (now.isBetween(taskSchedule, dueDateTime)) {
        return 'ongoing';
      }
    }

    // If not ongoing, check if it's upcoming (due within the next 24 hours)
    if (dueDateTime.diff(now, 'hours') <= 24) {
      return 'upcoming';
    }
    
    return '';
  }

  $: dueStatus = getTaskDueStatus(interactive ? taskSyncManager.obsidianTask : taskItem);

  function updateDueDisplay(mode = 'relative'): string {
    if (!due || !due.date) {
      dueDisplay = '';
      return dueDisplay;
    }

    const dueDateTime = due.time
      ? moment(`${due.date} ${due.time}`)
      : moment(`${due.date}`);

    if (mode === 'absolute') {
      dueDisplay = getAbsoluteTimeDisplay(dueDateTime);
    } else if (mode === 'relative') {
      dueDisplay = getRelativeTimeDisplay(dueDateTime);
    }

    return dueDisplay;
  }

  function focusAndSelect(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  updateDue();
</script>

<div class="task-card-due-container {params.mode === 'single-line' ? 'mode-single-line' : 'mode-multi-line'} {due ? '' : 'no-due'} {editMode ? 'edit-mode' : ''} {dueStatus}"
  on:click={interactive ? toggleDueEditMode : null}
  on:keydown={interactive ? toggleDueEditMode : null}
  role="button"
  tabindex="0"
  aria-label="Due date"
>
  <div class="task-card-due-left-part {dueStatus}" aria-hidden="true" title="Due date">
    <span class="task-card-due-prefix {dueStatus}" aria-hidden="true">
      <AlertTriangle width="14" height="14" ariaLabel="Due"/>
    </span>
  </div>
  {#if interactive && editMode}
    <input
      type="text"
      bind:value={dueInputString}
      bind:this={dueInputElement}
      on:keydown={finishDueEditing}
      on:blur={() => editMode = false}
      class="task-card-due-input"
      placeholder="Due date"
    />
  {:else if due}
    <div class="task-card-due {dueStatus}">
      <div class="due-display">
        {dueDisplay}
      </div>
    </div>
  {/if}
</div>

<style>
  .task-card-due-container {
    display: flex;
    align-items: center;
    border-radius: 2em;
    overflow: hidden;
    margin: 0 2px;
    font-size: var(--tag-size);
    border: var(--border-width) solid var(--text-accent);
    padding: 0;
    height: 22px;
  }

  .task-card-due-container.no-due {
    width: 25px;
    height: 22px;
  }

  .task-card-due-container.no-due.edit-mode {
    width: auto;
  }

  .task-card-due-left-part {
    display: flex;
    align-items: center;
    padding: 3px 0px 3px 5px;
    height: 100%;
  }

  .task-card-due-prefix {
    color: var(--text-accent);
    font-size: var(--tag-size);
    line-height: 1;
    display: flex;
    align-items: center;
  }

  .task-card-due, .task-card-due-input {
    padding: var(--tag-padding-y) var(--tag-padding-x) var(--tag-padding-y) calc(var(--tag-padding-x) / 2);
    color: var(--text-accent);
    white-space: nowrap;
    line-height: 1;
  }

  .task-card-due-input {
    box-sizing: border-box;
    border: none;
    background-color: transparent;
    width: 100px;
    height: 100%;
    font-family: var(--font-text);
    font-size: var(--tag-size);
  }

  .task-card-due-input:focus {
    outline: none;
    box-shadow: none;
  }

  .due-display {
    display: flex;
    align-items: center;
    height: 100%;
    padding-top: 1.5px;
  }

  .task-card-due-container:hover {
    background-color: var(--background-modifier-hover);
    color: var(--text-accent-hover);
    cursor: pointer;
  }

  .task-card-due-container.mode-multi-line {
    margin-top: 2px;
  }

  .task-card-due-container {
    &.ongoing {
      background-color: var(--interactive-accent);
      border-color: var(--interactive-accent);
      &:hover {
        background-color: var(--interactive-accent-hover);
      }
    }
    /* &.passDue { border-color: var(--text-error); }
    &.upcoming { border-color: var(--text-warning); }
    &.passed { border-color: var(--text-faint); } */
  }

  .task-card-due-left-part,
  .task-card-due,
  .task-card-due-prefix {
    &.ongoing { color: var(--text-on-accent); }
    &.passDue { color: var(--text-error); }
    &.upcoming { color: var(--text-warning); }
    &.passed { color: var(--text-faint); }
  }

  .task-card-due.upcoming {
    font-style: italic;
    text-decoration: underline;
  }
</style>
<script lang="ts">
  import { logger } from "../utils/log";
  import { ScheduleDate, ObsidianTask } from "../taskModule/task";
  import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";
  import TaskCardPlugin from "..";
  import { tick } from "svelte";
  import { TaskDisplayParams } from "../renderer/postProcessor";
  import { Notice } from "obsidian";
  import CalendarClock from "../components/icons/CalendarClock.svelte";
  import moment from "moment";
  import { getRelativeTimeDisplay, getAbsoluteTimeDisplay } from '../utils/timeDisplay';

  export let interactive: boolean = true;
  export let taskSyncManager: ObsidianTaskSyncManager = undefined;
  export let taskItem: ObsidianTask = undefined;
  export let plugin: TaskCardPlugin = undefined;
  export let params: TaskDisplayParams;

  let schedule: ScheduleDate;
  let scheduleDisplay = "";
  let scheduleInputElement: HTMLInputElement;
  let scheduleInputString = "";
  let editMode = false;

  function updateSchedule() {
    if (interactive) {
      schedule = taskSyncManager.obsidianTask.hasSchedule() ? taskSyncManager.obsidianTask.schedule : null;
    } else {
      schedule = taskItem.schedule;
    }
    updateScheduleDisplay();
  }

  function updateScheduleDisplay(mode = 'relative'): string {
    if (!schedule || !schedule.date) {
      scheduleDisplay = '';
      return scheduleDisplay;
    }

    const schduleDateTime = schedule.time
      ? moment(`${schedule.date} ${schedule.time}`)
      : moment(`${schedule.date}`);

    if (mode === 'absolute') {
      scheduleDisplay = getAbsoluteTimeDisplay(schduleDateTime);
    } else if (mode === 'relative') {
      scheduleDisplay = getRelativeTimeDisplay(schduleDateTime);
    }

    return scheduleDisplay;
  }

  async function toggleScheduleEditMode(event: MouseEvent | KeyboardEvent) {
    if (editMode) {
      return;
    }
    if (event instanceof KeyboardEvent && event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    editMode = true;
    scheduleInputString = schedule ? schedule.string : '';
    await tick();
    focusAndSelect(scheduleInputElement);
  }

  function finishScheduleEditing(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      const parsedSchedule = plugin.taskParser.parseSchedule(scheduleInputString);
      if (parsedSchedule || scheduleInputString.trim() === '') {
        schedule = parsedSchedule;
        taskSyncManager.updateObsidianTaskAttribute('schedule', schedule);
        updateScheduleDisplay();
      } else {
        new Notice("[TaskCard] Invalid schedule format: " + scheduleInputString);
      }
      logger.debug(`exiting schedule edit mode: ${event.key}, editMode: ${editMode}`);
      editMode = false;
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      editMode = false;
      updateScheduleDisplay();
    }
  }

  function focusAndSelect(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  updateSchedule();
</script>

<div class="task-card-schedule-container {params.mode === 'single-line' ? 'mode-single-line' : 'mode-multi-line'} {schedule ? '' : 'no-schedule'} {editMode ? 'edit-mode' : ''}"
  on:click={interactive ? toggleScheduleEditMode : null}
  on:keydown={interactive ? toggleScheduleEditMode : null}
  role="button"
  tabindex="0"
  aria-label="Schedule"
>
  <div class="task-card-schedule-left-part" aria-hidden="true" title="Schedule">
    <span class="task-card-schedule-prefix" aria-hidden="true">
      <CalendarClock width="14" height="14" ariaLabel="Schedule"/>
    </span>
  </div>
  {#if interactive && editMode}
    <input
      type="text"
      bind:value={scheduleInputString}
      bind:this={scheduleInputElement}
      on:keydown={finishScheduleEditing}
      on:blur={() => editMode = false}
      class="task-card-schedule-input"
      placeholder="Schedule"
    />
  {:else if schedule}
    <div class="task-card-schedule">
      <div class="schedule-display">
        {scheduleDisplay}
      </div>
    </div>
  {/if}
</div>

<style>
  .task-card-schedule-container {
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

  .task-card-schedule-container.no-schedule {
    width: 25px;
    height: 22px;
  }

  .task-card-schedule-container.no-schedule.edit-mode {
    width: auto;
  }

  .task-card-schedule-left-part {
    display: flex;
    align-items: center;
    padding: 3px 0px 3px 5px;
    height: 100%;
  }

  .task-card-schedule-prefix {
    color: var(--text-accent);
    font-size: var(--tag-size);
    line-height: 1;
    display: flex;
    align-items: center;
  }

  .task-card-schedule, .task-card-schedule-input {
    padding: var(--tag-padding-y) var(--tag-padding-x) var(--tag-padding-y) calc(var(--tag-padding-x) / 2);
    color: var(--text-accent);
    white-space: nowrap;
    line-height: 1;
  }

  .task-card-schedule-input {
    box-sizing: border-box;
    border: none;
    background-color: transparent;
    width: 100px;
    height: 100%;
    font-family: var(--font-text);
    font-size: var(--tag-size);
  }

  .task-card-schedule-input:focus {
    outline: none;
    box-shadow: none;
  }

  .schedule-display {
    display: flex;
    align-items: center;
    height: 100%;
    padding-top: 1.5px;
  }

  .task-card-schedule-container:hover {
    background-color: var(--background-modifier-hover);
    color: var(--text-accent-hover);
    cursor: pointer;
  }

  .task-card-schedule-container.mode-multi-line {
    margin-top: 2px;
  }
</style>
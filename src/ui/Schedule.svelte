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

    const scheduleDateTime = schedule.time
      ? moment(`${schedule.date} ${schedule.time}`)
      : moment(`${schedule.date}`);
    const now = moment();

    const diff = {
      years: scheduleDateTime.diff(now, 'years', true),
      months: scheduleDateTime.diff(now, 'months', true),
      weeks: scheduleDateTime.diff(now, 'weeks', true),
      days: scheduleDateTime.diff(now, 'days', true),
      hours: scheduleDateTime.diff(now, 'hours', true),
      minutes: scheduleDateTime.diff(now, 'minutes', true)
    };

    if (mode === 'absolute') {
      if (diff.years > 1) {
        scheduleDisplay = `${scheduleDateTime.year()}`;
      } else if (diff.years === 1) {
        scheduleDisplay = `${scheduleDateTime.format('MMM, YYYY')}`;
      } else if (diff.months > 0) {
        scheduleDisplay = `${scheduleDateTime.format('MMM DD')}`;
      } else if (diff.weeks > 0) {
        scheduleDisplay = `next ${scheduleDateTime.format('ddd, MMM DD')}`;
      } else if (diff.days > 1 || (diff.days === 1 && diff.hours >= 24)) {
        scheduleDisplay = schedule.time ? `${scheduleDateTime.format('ddd, MMM DD, hA')}` : `${scheduleDateTime.format('ddd')}`;
      } else if (diff.days === 1) {
        scheduleDisplay = 'Tomorrow';
      } else {
        scheduleDisplay = schedule.time ? `${scheduleDateTime.format('h:mmA')}` : 'Today';
      }
    } else if (mode === 'relative') {
      let prefix = 'in ';
      let suffix = '';

      if (scheduleDateTime.isBefore(now)) {
        prefix = '';
        suffix = ' ago';
      }

      const units: Array<{ unit: string; method: moment.unitOfTime.Diff }> = [
        { unit: 'year', method: 'year' },
        { unit: 'month', method: 'month' },
        { unit: 'day', method: 'day' },
        { unit: 'hour', method: 'hour' },
        { unit: 'minute', method: 'minute' },
        { unit: 'second', method: 'second' }
      ];

      for (let i = 0; i < units.length; i++) {
        const { unit, method } = units[i];
        const value = Math.abs(scheduleDateTime.diff(now, method));

        if (value > 0) {
          if (i === units.length - 1 || value > 1 || (i + 1 < units.length && Math.abs(scheduleDateTime.diff(now, units[i + 1].method)) === 0)) {
            const pluralSuffix = value !== 1 ? 's' : '';
            scheduleDisplay = `${prefix}${value} ${unit}${pluralSuffix}${suffix}`;
            return scheduleDisplay;
          }
          if (i + 1 < units.length) {
            const nextUnit = units[i + 1];
            let nextValue: number;
            if (unit === 'year') {
              nextValue = Math.abs(scheduleDateTime.diff(now, 'month') % 12);
            } else if (unit === 'month') {
              nextValue = Math.abs(scheduleDateTime.diff(now, 'day') % 30);
            } else {
              nextValue = Math.abs(scheduleDateTime.diff(now, nextUnit.method));
            }
            if (nextValue > 0) {
              const pluralSuffix1 = value !== 1 ? 's' : '';
              const pluralSuffix2 = nextValue !== 1 ? 's' : '';
              scheduleDisplay = `${prefix}${value} ${unit}${pluralSuffix1} and ${nextValue} ${nextUnit.unit}${pluralSuffix2}${suffix}`;
              return scheduleDisplay;
            }
          }
        }
      }

      scheduleDisplay = 'just now';
    }
    return scheduleDisplay;
  }

  async function toggleScheduleEditMode(event: MouseEvent | KeyboardEvent) {
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
      const parsedSchedule = plugin.taskParser.parseSchedule(scheduleInputString);
      if (parsedSchedule || scheduleInputString.trim() === '') {
        schedule = parsedSchedule;
        taskSyncManager.updateObsidianTaskAttribute('schedule', schedule);
        updateScheduleDisplay();
      } else {
        new Notice("[TaskCard] Invalid schedule format: " + scheduleInputString);
      }
      editMode = false;
    } else if (event.key === 'Escape') {
      event.preventDefault();
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
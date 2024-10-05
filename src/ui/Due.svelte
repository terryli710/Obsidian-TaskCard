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
    if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') {
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
      editMode = false;
      updateDueDisplay();
    }
  }


  function updateDueDisplay(mode = 'relative'): string {
    if (!due || !due.date) {
      dueDisplay = '';
      return dueDisplay;
    }

    const dueDateTime = due.time
      ? moment(`${due.date} ${due.time}`)
      : moment(`${due.date}`);
    const now = moment();

    const diff = {
      years: dueDateTime.diff(now, 'years', true),
      months: dueDateTime.diff(now, 'months', true),
      weeks: dueDateTime.diff(now, 'weeks', true),
      days: dueDateTime.diff(now, 'days', true),
      hours: dueDateTime.diff(now, 'hours', true),
      minutes: dueDateTime.diff(now, 'minutes', true)
    };

    // If mode is 'absolute', use the existing logic to display a time point.
    if (mode === 'absolute') {
      // Choose display format based on the difference
      if (diff.years > 1) {
        dueDisplay = `${dueDateTime.year()}`;
      } else if (diff.years === 1) {
        dueDisplay = `${dueDateTime.format('MMM, YYYY')}`;
      } else if (diff.months > 0) {
        dueDisplay = `${dueDateTime.format('MMM DD')}`;
      } else if (diff.weeks > 0) {
        dueDisplay = `next ${dueDateTime.format('ddd, MMM DD')}`;
      } else if (diff.days > 1 || (diff.days === 1 && diff.hours >= 24)) {
        // If due.time is null or empty, just show the day
        if (!due.time) {
          dueDisplay = `${dueDateTime.format('ddd')}`;
        }
        dueDisplay = `${dueDateTime.format('ddd, MMM DD, hA')}`;
      } else if (diff.days === 1) {
        dueDisplay = 'Tomorrow';
      } else {
        // If due.time is null or empty, return "Today"
        if (!due.time) {
          dueDisplay = 'Today';
        }
        dueDisplay = `${dueDateTime.format('h:mmA')}`;
      }
      return dueDisplay;
    } else if (mode === 'relative') {
      let prefix = 'in ';
      let suffix = '';

      if (dueDateTime.isBefore(now)) {
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
        const value = Math.abs(dueDateTime.diff(now, method));

        if (value > 0) {
          // If it's the last unit, the value is significant, or the next unit is 0
          if (
            i === units.length - 1 ||
            value > 1 ||
            (i + 1 < units.length &&
              Math.abs(dueDateTime.diff(now, units[i + 1].method)) === 0)
          ) {
            const pluralSuffix = value !== 1 ? 's' : '';
            dueDisplay = `${prefix}${value} ${unit}${pluralSuffix}${suffix}`;
            return dueDisplay;
          }
          // Check if we should display this unit and the next one
          if (i + 1 < units.length) {
            const nextUnit = units[i + 1];
            let nextValue: number;
            if (unit === 'year') {
              nextValue = Math.abs(dueDateTime.diff(now, 'month') % 12);
            } else if (unit === 'month') {
              nextValue = Math.abs(dueDateTime.diff(now, 'day') % 30); // Approximation
            } else {
              nextValue = Math.abs(dueDateTime.diff(now, nextUnit.method));
            }
            if (nextValue > 0) {
              const pluralSuffix1 = value !== 1 ? 's' : '';
              const pluralSuffix2 = nextValue !== 1 ? 's' : '';
              dueDisplay = `${prefix}${value} ${unit}${pluralSuffix1} and ${nextValue} ${nextUnit.unit}${pluralSuffix2}${suffix}`;
              return dueDisplay;
            }
          }
        }
      }

      dueDisplay = 'just now';
      return dueDisplay;
    }
  }


  function focusAndSelect(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  updateDue();
</script>

<div class="task-card-due-container {params.mode === 'single-line' ? 'mode-single-line' : 'mode-multi-line'} {due ? '' : 'no-due'} {editMode ? 'edit-mode' : ''}"
  on:click={interactive ? toggleDueEditMode : null}
  on:keydown={interactive ? toggleDueEditMode : null}
  role="button"
  tabindex="0"
  aria-label="Due date"
>
  <div class="task-card-due-left-part" aria-hidden="true" title="Due date">
    <span class="task-card-due-prefix" aria-hidden="true">
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
    <div class="task-card-due">
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
</style>
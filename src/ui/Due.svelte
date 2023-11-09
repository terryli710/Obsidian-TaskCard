<script lang="ts">
  import { logger } from "../utils/log";
  import { displayDate, displayTime } from "../utils/dateTimeFormatter"
  import { ScheduleDate, Duration, ObsidianTask } from "../taskModule/task";
  import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";
  import TaskCardPlugin from "..";
  import { tick } from "svelte";
  import { TaskDisplayParams, TaskDisplayMode } from "../renderer/postProcessor";
  import { Notice } from "obsidian";
  import AlertTriangle from "../components/icons/AlertTriangle.svelte";
  import moment from "moment";

  export let interactive: boolean = true;
  export let taskSyncManager: ObsidianTaskSyncManager = undefined;
  export let taskItem: ObsidianTask = undefined;
  export let plugin: TaskCardPlugin = undefined;
  export let params: TaskDisplayParams;
  export let displayDue: boolean;

  let due: ScheduleDate;
  let duration: Duration;
  let dueString: string = "";
  let dueDisplay: string = "";
  let inputElement: HTMLInputElement;

  if (interactive) {
    due = taskSyncManager.obsidianTask.hasDue() ? taskSyncManager.obsidianTask.due : undefined;
    duration = taskSyncManager.obsidianTask.hasDuration() ? taskSyncManager.obsidianTask.duration : undefined;
  } else {
    due = taskItem.due;
    duration = taskItem.duration;
  } 

  dueString = due ? due.string : '';

  updateDueDisplay();

  async function toggleEditMode(event: KeyboardEvent | MouseEvent) {
      if (taskSyncManager.taskCardStatus.dueStatus === 'done') {
        enableDueEditMode(event);
      } else {
        finishDueEditing(event);
      }
  }

  async function enableDueEditMode(event: KeyboardEvent | MouseEvent) {
    if (event instanceof KeyboardEvent) {
      if (event.key != 'Enter') {
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
      }
    }
      // taskSyncManager.setTaskCardStatus('dueStatus', 'editing');
      taskSyncManager.taskCardStatus.dueStatus = 'editing';
      dueString = due ? due.string : '';
      await tick();
      focusAndSelect(inputElement);
      adjustWidthForInput(inputElement);
  }

  function finishDueEditing(event: KeyboardEvent | MouseEvent) {
    if (event instanceof MouseEvent) {
        return;
    }

    if (event.key === 'Enter' || event.key === 'Escape') {
        taskSyncManager.taskCardStatus.dueStatus = 'done';
        if (event.key === 'Escape') {
            updateDueDisplay();
            return;
        }

        if (dueString.trim() === '') {
            due = null;
        } else {
            try {
                let newDue = plugin.taskParser.parseSchedule(dueString);
                if (newDue) {
                    due = newDue;
                } else {
                    new Notice(`[TaskCard] Invalid due date: ${dueString}`);
                    dueString = due ? due.string : '';
                }
            } catch (e) {
                logger.error(e);
                dueString = due ? due.string : '';
            }
        }

        taskSyncManager.updateObsidianTaskAttribute('due', due);
        updateDueDisplay();
    }
  }


  function updateDueDisplay(mode = 'relative'): string {
    if (!due || !due.date) {
        dueDisplay = '';
        return dueDisplay;
    }

    const dueDateTime = due.time ? moment(`${due.date} ${due.time}`) : moment(`${due.date}`);
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
        dueDisplay = "Tomorrow";
      } else {
          // If due.time is null or empty, return "Today"
          if (!due.time) {
            dueDisplay = "Today";
          }
          dueDisplay = `${dueDateTime.format('h:mmA')}`;
      }
      return dueDisplay;
    }

    // If mode is 'relative', calculate and display the time until the deadline.
    else if (mode === 'relative') {
        // Logic to determine which unit to display based on the difference.
        // Always round down since we want to display until the deadline is reached.
        // detect pass due
        let prefix = '';
        if (dueDateTime.isBefore(now)) {
          prefix = '- ';
          // make diff to be absolute
          diff.years = -diff.years;
          diff.months = -diff.months;
          diff.weeks = -diff.weeks;
          diff.days = -diff.days;
          diff.hours = -diff.hours;
          diff.minutes = -diff.minutes;
        }
        if (Math.floor(diff.years) > 0) {
            dueDisplay = `${prefix}${Math.floor(diff.years)} year${Math.floor(diff.years) > 1 ? 's' : ''}`;
        } else if (Math.floor(diff.months) > 0) {
            dueDisplay = `${prefix}${Math.floor(diff.months)} month${Math.floor(diff.months) > 1 ? 's' : ''}`;
        } else if (Math.floor(diff.days) > 0) {
            dueDisplay = `${prefix}${Math.floor(diff.days)} day${Math.floor(diff.days) > 1 ? 's' : ''}`;
        } else if (Math.floor(diff.hours) > 0) {
            dueDisplay = `${prefix}${Math.floor(diff.hours)} hour${Math.floor(diff.hours) > 1 ? 's' : ''}`;
        } else {
            dueDisplay = `${prefix}${Math.floor(diff.minutes)} minute${Math.floor(diff.minutes) > 1 ? 's' : ''}`;
        }
    }

    return dueDisplay;
}


  // Action function to focus and select the input content
  function focusAndSelect(node: HTMLInputElement) {
    // Focus on the input element
    node.focus();
    // Select all the content
    node.select();
  }

  function adjustWidthForInput(node: HTMLInputElement) {
    // Create a temporary element to measure the text width
    const tempElement = document.createElement('span');
    tempElement.style.font = window.getComputedStyle(node, null).getPropertyValue('font');
    tempElement.style.padding = window.getComputedStyle(node, null).getPropertyValue('padding');
    tempElement.style.position = 'absolute';
    tempElement.style.left = '-9999px';
    tempElement.innerHTML = node.value.replace(/ /g, '&nbsp;');
    document.body.appendChild(tempElement);

    // Get the width of the temporary element
    const newWidth = tempElement.getBoundingClientRect().width * 1.15 ;
    document.body.removeChild(tempElement);

    // Set the new width to the input element, considering min and max width
    const minWidth = 75; // Set your minimum width
    const maxWidth = 200; // Set your maximum width
    node.style.width = Math.min(Math.max(newWidth, minWidth), maxWidth) + 'px';
  }


  function convertDueToMoment(dueDate: ScheduleDate): moment.Moment | null {
    if (!dueDate.date) {
      return null;  // Ensure the date is present.
    }

    let datetimeStr = dueDate.date;
    if (dueDate.time) {
      datetimeStr += ' ' + dueDate.time;
    }

    return moment(datetimeStr);
  }

  $: {
    if (interactive) {
      displayDue = taskSyncManager.obsidianTask.hasDue() || taskSyncManager.taskCardStatus.dueStatus === 'editing';
    } else {
      displayDue = !!taskItem.due; // The double bang '!!' converts a truthy/falsy value to a boolean true/false
    }
  }

  enum TaskDueStatus {
    Upcoming = "upcoming",
    Ongoing = "ongoing",
    PassDue = "passDue",
    Passed= "passed"
  }

  function getTaskDueStatus(task: ObsidianTask, minuteGap: number = 15): TaskDueStatus | null {
    const due = task.due;
    let duration = task.duration;
    const currTime = moment();
    const finished = task.completed;
    if (!due) { return null; }
    const dueMoment = convertDueToMoment(due);
    const timeGap = moment.duration(dueMoment.diff(currTime)).asMinutes();
    // upcoming
    if (timeGap > 0 && timeGap < minuteGap) {
      return TaskDueStatus.Upcoming;
    }
    if (!duration) { duration = { hours: 0, minutes: 0 }; }
    if (!duration.hours) { duration.hours = 0; }
    if (!duration.minutes) { duration.minutes = 0; }
    
    // ongoing
    const endMoment = dueMoment.clone().add(duration.hours, 'hours').add(duration.minutes, 'minutes');
    if (currTime.isBetween(dueMoment, endMoment)) {
      return TaskDueStatus.Ongoing;
    }
    // pass due
    if (currTime.isAfter(endMoment) && !finished) {
      return TaskDueStatus.PassDue;
    }
    // passed
    if (currTime.isAfter(endMoment) && finished) {
      return TaskDueStatus.Passed;
    }
    return null;
  }

  const taskDueStatus = getTaskDueStatus(interactive ? taskSyncManager.obsidianTask : taskItem, 15);

</script>

{#if displayDue}
  <div class="task-card-due-container {params.mode === 'single-line' ? 'mode-single-line' : 'mode-multi-line'} {taskDueStatus ? taskDueStatus : ''}"
    on:click={interactive ? toggleEditMode : null}
    on:keydown={interactive ? toggleEditMode : null}
    aria-label="Due"
    role="button"
    tabindex="0"
  >
    <div class="task-card-due-left-part">
      <span class="task-card-due-prefix {taskDueStatus ? taskDueStatus : ''}">
        <AlertTriangle width={"14"} height={"14"} ariaLabel="Due"/>
      </span>
    </div>
    {#if interactive && taskSyncManager.getTaskCardStatus('dueStatus') === 'editing'}
      <input
        type="text"
        on:input={() => adjustWidthForInput(inputElement)}
        bind:value={dueString}
        bind:this={inputElement}
        class="task-card-due"
      />
    {:else}
      <div class="task-card-due {taskDueStatus ? taskDueStatus : ''}">
        <div class="due-display">
          {dueDisplay}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>


  .task-card-due-left-part {
      /* background-color: var(--background-secondary); */
      border-top-left-radius: 2em;
      border-bottom-left-radius: 2em;
      border-top-right-radius: var(--radius-s);
      border-bottom-right-radius: var(--radius-s);
      display: flex;
      align-items: center;
      padding: 0 5px;
  }

  .task-card-due-prefix {
    color: var(--text-accent);
    font-size: var(--tag-size);
    line-height: 1;
    align-self: center;
    align-items: center;
    padding-top: 1.5px;
  }

  .task-card-due-prefix.ongoing {
    color: var(--text-on-accent);
  }

  .task-card-due-prefix.passDue {
    color: var(--text-warning);
  }

  .task-card-due-prefix.passed {
    color: var(--text-faint);
  }

  .task-card-due-prefix.ongoing:hover {
    color: var(--text-on-accent-hover);
  }

  .task-card-due-container {
    align-items: center;
    display: flex;
    border-radius: 2em;
    overflow: hidden;
    margin: 0 2px;
    font-size: var(--tag-size);
    border: var(--border-width) solid var(--text-accent);
  }

  .task-card-due-container.ongoing {
    background-color: var(--interactive-accent);
  }

  .task-card-due-container.ongoing:hover {
    background-color: var(--interactive-accent-hover);
  }

  .task-card-due-container.mode-multi-line {
    margin-top: 2px;
  }

  .due-display {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    padding-top: 1.5px;
  }
  
  .task-card-due {
    display: inline;
    padding: var(--tag-padding-y) 0px;
    padding-right: var(--tag-padding-x);
    width: auto;
    /* font-size: var(--tag-size); */
    color: var(--text-accent);
    white-space: nowrap;
    line-height: 1;
  }

  .task-card-due.upcoming {
    font-style: italic;
    text-decoration: underline;
  }

  .task-card-due.passDue {
    color: var(--text-warning);
  }

  .task-card-due.passed {
    color: var(--text-faint);
  }

  .task-card-due.ongoing {
    color: var(--text-on-accent);
  }

  /* This selector ensures that the cursor only changes to a hand pointer when the div is not empty */
  .task-card-due-container.mode-multi-line:not(:empty):hover {
    background-color: var(--background-modifier-hover);
    color: var(--text-accent-hover);
    cursor: pointer;
  }

  .task-card-due-container.mode-multi-line.ongoing:not(:empty):hover {
    background-color: var(--interactive-accent-hover);
    color: var(--text-accent-hover);
  }

  input.task-card-due {
    box-sizing: border-box;
    border: none;
    display: inline;
    background-color: rgba(var(--background-primary-alt), 0.0);
    padding: var(--tag-padding-y) 0px;
    padding-right: var(--tag-padding-x);
    width: auto;
    height: auto;
    /* color: var(--text-accent); */
    white-space: nowrap;
    line-height: 1;
    font-family: var(--font-text);
  }

  /* Customize the focus styles */
  input.task-card-due:focus {
    outline: none; /* Remove the default outline */
    box-shadow: none; /* Remove the default box-shadow */
  }
</style>
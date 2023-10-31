<script lang="ts">
  import { logger } from "../utils/log";
  import { displayDate, displayTime } from "../utils/dateTimeFormatter"
  import { ScheduleDate, Duration, ObsidianTask } from "../taskModule/task";
  import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";
  import TaskCardPlugin from "..";
  import { tick } from "svelte";
  import { TaskDisplayParams, TaskDisplayMode } from "../renderer/postProcessor";
  import { Notice } from "obsidian";
  import CalendarClock from "../components/icons/CalendarClock.svelte";
  import moment from "moment";

  export let taskSyncManager: ObsidianTaskSyncManager;
  export let plugin: TaskCardPlugin;
  export let params: TaskDisplayParams;
  export let displayDue: boolean;

  let due: ScheduleDate | null;
  let dueString: string;
  let duration: Duration | null;
  let dueDisplay = "";
  let inputElement: HTMLInputElement;
  due = taskSyncManager.obsidianTask.hasDue() ? taskSyncManager.obsidianTask.due : null;
  dueString = due ? due.string : '';
  duration = taskSyncManager.obsidianTask.hasDuration() ? taskSyncManager.obsidianTask.duration : null;

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

  // function updateDueDisplay(): string {
  //     if (!due) {
  //         dueDisplay = '';
  //         return dueDisplay;
  //     }
  //     let datePart = displayDate(due.date);
  //     let timePart = displayTime(due.time);
  //     dueDisplay = timePart ? `${datePart}, ${timePart}` : datePart;
  //     return dueDisplay;
  // }
  

function updateDueDisplay(): string {
    if (!due || !due.date) {
        dueDisplay = '';
        return dueDisplay;
    }

    // Convert to Moment object, considering cases where due.time is null or ''
    logger.debug(`${JSON.stringify(due)}`);
    const dueDateTime = due.time ? moment(`${due.date} ${due.time}`) : moment(`${due.date}`);
    const now = moment();

    // Calculate differences
    const yearsDiff = dueDateTime.diff(now, 'years');
    const monthsDiff = dueDateTime.diff(now, 'months');
    const weeksDiff = dueDateTime.diff(now, 'weeks');
    const daysDiff = dueDateTime.diff(now, 'days');
    const hoursDiff = dueDateTime.diff(now, 'hours');

    // Choose display format based on the difference
    if (yearsDiff > 1) {
      dueDisplay = `${dueDateTime.year()}`;
    } else if (yearsDiff === 1) {
      dueDisplay = `${dueDateTime.format('MMM, YYYY')}`;
    } else if (monthsDiff > 0) {
      dueDisplay = `${dueDateTime.format('MMM DD')}`;
    } else if (weeksDiff > 0) {
      dueDisplay = `next ${dueDateTime.format('ddd, MMM DD')}`;
    } else if (daysDiff > 1 || (daysDiff === 1 && hoursDiff >= 24)) {
        // If due.time is null or empty, just show the day
        if (!due.time) {
          dueDisplay = `${dueDateTime.format('ddd')}`;
        }
        dueDisplay = `${dueDateTime.format('ddd, MMM DD, hA')}`;
    } else if (daysDiff === 1) {
      dueDisplay = "Tomorrow";
    } else {
        // If due.time is null or empty, return "Today"
        if (!due.time) {
          dueDisplay = "Today";
        }
        dueDisplay = `Today, ${dueDateTime.format('h:mmA')}`;
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

  $: displayDue = taskSyncManager.obsidianTask.hasDue() || taskSyncManager.taskCardStatus.dueStatus === 'editing';
  
  
  // upcoming and ongoing
  // function isUpcoming(due: ScheduleDate, currTime: moment.Moment, minuteGap: number = 15): boolean {
  //   if (!due || !due.date || !due.time) { return false; }
  //   // convert due to moment
  //   const dueMoment = convertDueToMoment(due);
  //   // calculate the time gap
  //   const timeGap = moment.duration(dueMoment.diff(currTime)).asMinutes();
  //   // check if the time gap is within the specified range
  //   return timeGap > 0 && timeGap < minuteGap;
  // }

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

  const taskDueStatus = getTaskDueStatus(taskSyncManager.obsidianTask, 15);

</script>

{#if displayDue}
  <div class="task-card-due-container {params.mode === 'single-line' ? 'mode-single-line' : 'mode-multi-line'} {taskDueStatus ? taskDueStatus : ''}"
    on:click={toggleEditMode}
    on:keydown={toggleEditMode}
    aria-label="Due"
    role="button"
    tabindex="0"
  >
    <div class="task-card-due-left-part">
      <span class="task-card-due-prefix {taskDueStatus ? taskDueStatus : ''}">
        <CalendarClock width={"14"} height={"14"} ariaLabel="due"/>
      </span>
    </div>
    {#if taskSyncManager.getTaskCardStatus('dueStatus') === 'editing'}
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
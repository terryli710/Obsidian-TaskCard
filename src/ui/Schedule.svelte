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

  export let interactive: boolean = true;
  export let taskSyncManager: ObsidianTaskSyncManager = undefined;
  export let taskItem: ObsidianTask = undefined;
  export let plugin: TaskCardPlugin = undefined;
  export let params: TaskDisplayParams;
  export let displaySchedule: boolean;
  
  let schedule: ScheduleDate;
  let duration: Duration;
  let scheduleString: string = "";
  let scheduleDisplay: string = "";
  let inputElement: HTMLInputElement;

  if (interactive) {
    schedule = taskSyncManager.obsidianTask.hasSchedule() ? taskSyncManager.obsidianTask.schedule : undefined;
    duration = taskSyncManager.obsidianTask.hasDuration() ? taskSyncManager.obsidianTask.duration : undefined;
  } else {
    schedule = taskItem.schedule;
    duration = taskItem.duration;
  }  

  scheduleString = schedule ? schedule.string : '';

  updateScheduleDisplay();

  async function toggleEditMode(event: KeyboardEvent | MouseEvent) {
      if (taskSyncManager.taskCardStatus.scheduleStatus === 'done') {
        enableScheduleEditMode(event);
      } else {
        finishScheduleEditing(event);
      }
  }

  async function enableScheduleEditMode(event: KeyboardEvent | MouseEvent) {
    if (event instanceof KeyboardEvent) {
      if (event.key != 'Enter') {
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
      }
    }
      // taskSyncManager.setTaskCardStatus('scheduleStatus', 'editing');
      taskSyncManager.taskCardStatus.scheduleStatus = 'editing';
      scheduleString = schedule ? schedule.string : '';
      await tick();
      focusAndSelect(inputElement);
      adjustWidthForInput(inputElement);
  }

  function finishScheduleEditing(event: KeyboardEvent | MouseEvent) {
    if (event instanceof MouseEvent) {
        return;
    }

    if (event.key === 'Enter' || event.key === 'Escape') {
        taskSyncManager.taskCardStatus.scheduleStatus = 'done';
        if (event.key === 'Escape') {
            updateScheduleDisplay();
            return;
        }

        if (scheduleString.trim() === '') {
            schedule = null;
        } else {
            try {
                let newSchedule = plugin.taskParser.parseSchedule(scheduleString);
                if (newSchedule) {
                    schedule = newSchedule;
                } else {
                    new Notice(`[TaskCard] Invalid schedule date: ${scheduleString}`);
                    scheduleString = schedule ? schedule.string : '';
                }
            } catch (e) {
                logger.error(e);
                scheduleString = schedule ? schedule.string : '';
            }
        }

        taskSyncManager.updateObsidianTaskAttribute('schedule', schedule);
        updateScheduleDisplay();
    }
  }

  function updateScheduleDisplay(): string {
      if (!schedule) {
          scheduleDisplay = '';
          return scheduleDisplay;
      }
      let datePart = displayDate(schedule.date);
      let timePart = displayTime(schedule.time);
      scheduleDisplay = timePart ? `${datePart}, ${timePart}` : datePart;
      return scheduleDisplay;
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


  function convertScheduleToMoment(scheduleDate: ScheduleDate): moment.Moment | null {
    if (!scheduleDate.date) {
      return null;  // Ensure the date is present.
    }

    let datetimeStr = scheduleDate.date;
    if (scheduleDate.time) {
      datetimeStr += ' ' + scheduleDate.time;
    }

    return moment(datetimeStr);
  }

  $: {
    if (interactive) {
      displaySchedule = taskSyncManager.obsidianTask.hasSchedule() || taskSyncManager.taskCardStatus.scheduleStatus === 'editing';
    } else {
      displaySchedule = !!taskItem.schedule; // The double bang '!!' converts a truthy/falsy value to a boolean true/false
    }
  }
  
  enum TaskScheduleStatus {
    Upcoming = "upcoming",
    Ongoing = "ongoing",
    PassSchedule = "passSchedule",
    Passed= "passed"
  }

  function getTaskScheduleStatus(task: ObsidianTask, minuteGap: number = 15): TaskScheduleStatus | null {
    const schedule = task.schedule;
    let duration = task.duration;
    const currTime = moment();
    const finished = task.completed;
    if (!schedule) { return null; }
    const scheduleMoment = convertScheduleToMoment(schedule);
    const timeGap = moment.duration(scheduleMoment.diff(currTime)).asMinutes();
    // upcoming
    if (timeGap > 0 && timeGap < minuteGap) {
      return TaskScheduleStatus.Upcoming;
    }
    if (!duration) { duration = { hours: 0, minutes: 0 }; }
    if (!duration.hours) { duration.hours = 0; }
    if (!duration.minutes) { duration.minutes = 0; }
    
    // ongoing
    const endMoment = scheduleMoment.clone().add(duration.hours, 'hours').add(duration.minutes, 'minutes');
    if (currTime.isBetween(scheduleMoment, endMoment)) {
      return TaskScheduleStatus.Ongoing;
    }
    // pass schedule
    if (currTime.isAfter(endMoment) && !finished) {
      return TaskScheduleStatus.PassSchedule;
    }
    // passed
    if (currTime.isAfter(endMoment) && finished) {
      return TaskScheduleStatus.Passed;
    }
    return null;
  }

  const taskScheduleStatus = getTaskScheduleStatus(interactive ? taskSyncManager.obsidianTask : taskItem, 15);

</script>

<!-- svelte-ignore non-top-level-reactive-declaration -->
{#if displaySchedule}
  <div class="task-card-schedule-container {params.mode === 'single-line' ? 'mode-single-line' : 'mode-multi-line'} {taskScheduleStatus ? taskScheduleStatus : ''}"
    on:click={interactive ? toggleEditMode : null}
    on:keydown={interactive ? toggleEditMode : null}
    aria-label="Schedule"
    role="button"
    tabindex="0"
  >
    <div class="task-card-schedule-left-part">
      <span class="task-card-schedule-prefix {taskScheduleStatus ? taskScheduleStatus : ''}">
        <CalendarClock width={"14"} height={"14"} ariaLabel="Schedule"/>
      </span>
    </div>
    {#if interactive && taskSyncManager.getTaskCardStatus('scheduleStatus') === 'editing'}
      <input
        type="text"
        on:input={() => adjustWidthForInput(inputElement)}
        bind:value={scheduleString}
        bind:this={inputElement}
        class="task-card-schedule"
      />
    {:else}
      <div class="task-card-schedule {taskScheduleStatus ? taskScheduleStatus : ''}">
        <div class="schedule-display">
          {scheduleDisplay}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>


  .task-card-schedule-left-part {
      /* background-color: var(--background-secondary); */
      border-top-left-radius: 2em;
      border-bottom-left-radius: 2em;
      border-top-right-radius: var(--radius-s);
      border-bottom-right-radius: var(--radius-s);
      display: flex;
      align-items: center;
      padding: 0 5px;
  }

  .task-card-schedule-prefix {
    color: var(--text-accent);
    font-size: var(--tag-size);
    line-height: 1;
    align-self: center;
    align-items: center;
    padding-top: 1.5px;
  }

  .task-card-schedule-prefix.ongoing {
    color: var(--text-on-accent);
  }

  .task-card-schedule-prefix.passSchedule {
    color: var(--text-warning);
  }

  .task-card-schedule-prefix.passed {
    color: var(--text-faint);
  }

  .task-card-schedule-prefix.ongoing:hover {
    color: var(--text-on-accent-hover);
  }

  .task-card-schedule-container {
    align-items: center;
    display: flex;
    border-radius: 2em;
    min-width: 2em;
    overflow: hidden;
    margin: 0 2px;
    font-size: var(--tag-size);
    border: var(--border-width) solid var(--text-accent);
  }

  .task-card-schedule-container.ongoing {
    background-color: var(--interactive-accent);
  }

  .task-card-schedule-container.ongoing:hover {
    background-color: var(--interactive-accent-hover);
  }

  .task-card-schedule-container.mode-multi-line {
    margin-top: 2px;
  }

  .schedule-display {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    padding-top: 1.5px;
  }
  
  .task-card-schedule {
    display: inline;
    padding: var(--tag-padding-y) 0px;
    padding-right: var(--tag-padding-x);
    width: auto;
    /* font-size: var(--tag-size); */
    color: var(--text-accent);
    white-space: nowrap;
    line-height: 1;
  }

  .task-card-schedule.upcoming {
    font-style: italic;
    text-decoration: underline;
  }

  .task-card-schedule.passSchedule {
    color: var(--text-warning);
  }

  .task-card-schedule.passed {
    color: var(--text-faint);
  }

  .task-card-schedule.ongoing {
    color: var(--text-on-accent);
  }

  /* This selector ensures that the cursor only changes to a hand pointer when the div is not empty */
  .task-card-schedule-container.mode-multi-line:not(:empty):hover {
    background-color: var(--background-modifier-hover);
    color: var(--text-accent-hover);
    cursor: pointer;
  }

  .task-card-schedule-container.mode-multi-line.ongoing:not(:empty):hover {
    background-color: var(--interactive-accent-hover);
    color: var(--text-accent-hover);
  }

  input.task-card-schedule {
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
  input.task-card-schedule:focus {
    outline: none; /* Remove the default outline */
    box-shadow: none; /* Remove the default box-shadow */
  }
</style>
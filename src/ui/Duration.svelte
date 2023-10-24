<script lang="ts">
  import { logger } from "../utils/log";
  import { displayDate, displayTime } from "../utils/dateTimeFormatter"
  import { DueDate, Duration, ObsidianTask } from "../taskModule/task";
  import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";
  import TaskCardPlugin from "..";
  import { tick } from "svelte";
  import { TaskDisplayParams, TaskDisplayMode } from "../renderer/postProcessor";
  import { Notice } from "obsidian";
  import History from "../components/icons/History.svelte";

  export let taskSyncManager: ObsidianTaskSyncManager;
  export let params: TaskDisplayParams;
  export let displayDuration: boolean;
  let duration: Duration | null;
  duration = taskSyncManager.obsidianTask.hasDuration() ? taskSyncManager.obsidianTask.duration : null;


  function customDurationHumanizer(duration: Duration) {
    if (duration.hours === 0) {
      return `${duration.minutes}mins`;
    } else if (duration.minutes === 0) {
      return `${duration.hours}hrs`;
    } else {
      return `${duration.hours}h ${duration.minutes}m`;
    }
  }

  let durationDisplay = "";
  let durationInputElement: HTMLInputElement;
  let durationInputString = duration ? `${pad(duration.hours, 2)}:${pad(duration.minutes, 2)}` : '00:00';
  let origDurationInputString = durationInputString;

  updateDurationDisplay();

  function updateDurationDisplay(): string {
      if (!duration) {
          durationDisplay = '';
          return durationDisplay;
      }
      durationDisplay = customDurationHumanizer(duration);
      return durationDisplay;
  }

  async function toggleDurationEditMode(event: KeyboardEvent | MouseEvent) {
      if (taskSyncManager.taskCardStatus.durationStatus === 'done') {
          enableDurationEditMode(event);
      } else {
          finishDurationEditing(event);
      }
  }

  function pad(num:number, size:number): string {
      let s = num+"";
      while (s.length < size) s = "0" + s;
      return s;
  }

  async function enableDurationEditMode(event: KeyboardEvent | MouseEvent) {
      if (event instanceof KeyboardEvent) {
          if (event.key != 'Enter') {
              return;
          }
          if (event.key === 'Enter') {
              event.preventDefault();
          }
      }
      taskSyncManager.taskCardStatus.durationStatus = 'editing';
      durationInputString = duration ? `${pad(duration.hours, 2)}:${pad(duration.minutes, 2)}` : '01:00';
      origDurationInputString = durationInputString;
      await tick();
      focusAndSelect(durationInputElement);
  }

  function finishDurationEditing(event: KeyboardEvent | MouseEvent) {
    if (event instanceof MouseEvent) {
        return;
    }

    // Handle the Escape key, as the logic is simpler
    if (event.key === 'Escape') {
        event.preventDefault();
        taskSyncManager.taskCardStatus.durationStatus = 'done';
        return;
    }

    // Main logic for the Enter key
    if (event.key === 'Enter') {
        logger.debug(`duration finished: ${durationInputString}`);
        
        // Early exit for empty string or 00:00 duration
        if (durationInputString.trim() === '' || isValidZeroDuration(durationInputString)) {
            duration = null;
        } else {
            const parsedDuration = parseDurationInput(durationInputString);
            if (parsedDuration) {
                duration = parsedDuration;
            } else {
                new Notice(`[TaskCard] Invalid duration format: ${durationInputString}`);
            }
        }

        taskSyncManager.updateObsidianTaskAttribute('duration', duration);
        origDurationInputString = durationInputString;
        
        updateDurationDisplay();
        event.preventDefault();
        taskSyncManager.taskCardStatus.durationStatus = 'done';
    }
}

function isValidZeroDuration(input: string): boolean {
    const [hours, minutes] = input.split(":").map(Number);
    return hours === 0 && minutes === 0;
}

function parseDurationInput(input: string): { hours: number, minutes: number } | null {
    const [hours, minutes] = input.split(":").map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
        return { hours, minutes };
    }
    return null;
}


  // Action function to focus and select the input content
  function focusAndSelect(node: HTMLInputElement) {
    // Focus on the input element
    node.focus();
    // Select all the content
    node.select();
  }

  let displayDue: boolean = taskSyncManager.obsidianTask.hasDue() || taskSyncManager.getTaskCardStatus('dueStatus') === 'editing';
  $: displayDuration = taskSyncManager.obsidianTask.hasDuration() || taskSyncManager.getTaskCardStatus('durationStatus') === 'editing';


  </script>

<!-- Duration Display Section -->
{#if displayDuration}
  {#if displayDue}
    <span class="due-duration-padding"></span>
  {/if}
  <div class="task-card-duration-container {params.mode === 'single-line' ? 'mode-single-line' : 'mode-multi-line'}"
    on:click={toggleDurationEditMode}
    on:keydown={toggleDurationEditMode}
    role="button"
    tabindex="0"
    aria-label="Duration"
  >
    <div class="task-card-duration-left-part">
      <span class="task-card-duration-prefix"><History width={"14"} height={"14"} ariaLabel="duration"/></span>
    </div>
    {#if taskSyncManager.getTaskCardStatus('durationStatus') === 'editing'}
      <input
        type="text"
        bind:value={durationInputString}
        bind:this={durationInputElement}
        class="task-card-duration"
        placeholder="hh:mm"
      />
    {:else}
      <div class="task-card-duration">
        <div class="duration-display">
          {durationDisplay}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>

  .task-card-duration-left-part {
        /* background-color: var(--background-secondary); */
        border-top-left-radius: 2em;
        border-bottom-left-radius: 2em;
        border-top-right-radius: var(--radius-s);
        border-bottom-right-radius: var(--radius-s);
        display: flex;
        align-items: center;
        padding: 0 5px;
    }

  .task-card-duration-prefix {
    color: var(--text-accent);
    font-size: var(--tag-size);
    line-height: 1;
    align-self: center;
    align-items: center;
    padding-top: 1.5px;
  }

  .task-card-duration-container {
    align-items: center;
    display: flex;
    border-radius: 2em;
    overflow: hidden;
    font-size: var(--tag-size);
    border: var(--border-width) solid var(--text-accent);
  }

  .task-card-duration-container.mode-multi-line {
    margin-top: 2px;
  }
  
  .due-duration-padding {
    padding: 2px;
  }

  .duration-display {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    padding-top: 1.5px;
  }

  .task-card-duration {
    display: inline;
    padding: var(--tag-padding-y) 0px;
    padding-right: var(--tag-padding-x);
    width: auto;
    /* font-size: var(--tag-size); */
    color: var(--text-accent);
    white-space: nowrap;
    line-height: 1;
  }

  .task-card-duration-container.mode-multi-line:not(:empty):hover {
    background-color: var(--background-modifier-hover);
    color: var(--text-accent-hover);
    cursor: pointer;
  }

  input.task-card-duration {
    box-sizing: border-box;
    border: none;
    display: inline;
    background-color: rgba(var(--background-primary-alt), 0.0);
    padding: var(--tag-padding-y) 0px;
    padding-right: var(--tag-padding-x);
    width: 50px;
    height: auto;
    color: var(--text-accent);
    white-space: nowrap;
    line-height: 1;
    font-family: var(--font-text);
  }

  input.task-card-duration:focus {
    outline: none;
    box-shadow: none;
  }
</style>

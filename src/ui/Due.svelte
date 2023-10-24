<script lang="ts">
  import { logger } from "../utils/log";
  import { displayDate, displayTime } from "../utils/dateTimeFormatter"
  import { DueDate, Duration, ObsidianTask } from "../taskModule/task";
  import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";
  import TaskCardPlugin from "..";
  import { tick } from "svelte";
  import { TaskDisplayParams, TaskDisplayMode } from "../renderer/postProcessor";
  import { Notice } from "obsidian";
  import CalendarClock from "../components/icons/CalendarClock.svelte";

  export let taskSyncManager: ObsidianTaskSyncManager;
  export let plugin: TaskCardPlugin;
  export let params: TaskDisplayParams;
  let due: DueDate | null;
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
      if (event.key === 'Enter') {
          // event.preventDefault();
          // taskSyncManager.setTaskCardStatus('dueStatus', 'done');
          taskSyncManager.taskCardStatus.dueStatus = 'done';
          let newDue: DueDate | null;
          try {
            newDue = plugin.taskParser.parseDue(dueString);
          } catch (e) {
            logger.error(e);
          }
          if (!newDue) { 
            new Notice(`[TaskCard] Invalid due date: ${dueString}`);
            dueString = due ? due.string : '';
          } else {
            due = newDue;
          }
          taskSyncManager.updateObsidianTaskAttribute('due', due);
          updateDueDisplay();
      } else if (event.key === 'Escape') {
          event.preventDefault();
          // taskSyncManager.setTaskCardStatus('dueStatus', 'done');
          taskSyncManager.taskCardStatus.dueStatus = 'done';
      }
  }

  function updateDueDisplay(): string {
      if (!due) {
          dueDisplay = '';
          return dueDisplay;
      }
      let datePart = displayDate(due.date);
      let timePart = displayTime(due.time);
      dueDisplay = timePart ? `${datePart}, ${timePart}` : datePart;
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

  // let isEditingDue = taskSyncManager.taskCardStatus.dueStatus === 'editing';
  let displayDue = taskSyncManager.obsidianTask.hasDue() || taskSyncManager.taskCardStatus.dueStatus === 'editing';
  // let displayDuration = taskSyncManager.obsidianTask.hasDuration() || taskSyncManager.getTaskCardStatus('durationStatus') === 'editing';

</script>

{#if displayDue}
  <div class="task-card-due-container {params.mode === 'single-line' ? 'mode-single-line' : 'mode-multi-line'}"
    on:click={toggleEditMode}
    on:keydown={toggleEditMode}
    role="button"
    tabindex="0"
  >
    <div class="task-card-due-left-part">
      <span class="task-card-due-prefix"><CalendarClock width={"14"} height={"14"} ariaLabel="due"/></span>
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
      <div class="task-card-due">
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

  .task-card-due-container {
    align-items: center;
    display: flex;
    border-radius: 2em;
    overflow: hidden;
    font-size: var(--tag-size);
    border: var(--border-width) solid var(--text-accent);
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

  /* This selector ensures that the cursor only changes to a hand pointer when the div is not empty */
  .task-card-due-container.mode-multi-line:not(:empty):hover {
    background-color: var(--background-modifier-hover);
    color: var(--text-accent-hover);
    cursor: pointer;
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
    color: var(--text-accent);
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
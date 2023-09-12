<script lang="ts">
  import { logger } from "../utils/log";
  import { displayDate, displayTime } from "../utils/dateTimeFormatter"
  import { DueDate, ObsidianTask } from "../taskModule/task";
  import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";
  import TaskCardPlugin from "..";
  import { tick } from "svelte";
  import { TaskDisplayParams, TaskDisplayMode } from "../renderer/postProcessor";
    import { Notice } from "obsidian";

  export let taskSyncManager: ObsidianTaskSyncManager;
  export let plugin: TaskCardPlugin;
  export let params: TaskDisplayParams;
  let due: DueDate | null;
  let dueString: string;
  let dueDisplay = "";
  let inputElement: HTMLInputElement;
  due = taskSyncManager.obsidianTask.hasDue() ? taskSyncManager.obsidianTask.due : null;
  dueString = due ? due.string : '';

  updateDueDisplay();

  async function enableDueEditMode() {
      // taskSyncManager.setTaskCardStatus('dueStatus', 'editing');
      taskSyncManager.taskCardStatus.dueStatus = 'editing';
      dueString = due ? due.string : '';
      await tick();
      focusAndSelect(inputElement);
      adjustWidthForInput(inputElement);
  }

  function finishDueEditing(event: KeyboardEvent) {
      if (event.key === 'Enter') {
          event.preventDefault();
          // taskSyncManager.setTaskCardStatus('dueStatus', 'done');
          taskSyncManager.taskCardStatus.dueStatus = 'done';
          let newDue: DueDate | null;
          try {
            newDue = plugin.taskParser.parseDue(dueString);
          } catch (e) {
            logger.error(e);
          }
          if (!newDue) { 
            new Notice(`Invalid due date: ${dueString}`);
            dueString = due ? due.string : '';
          } else {
            due = newDue;
          }
          taskSyncManager.updateObsidianTaskAttribute('due', due);
          updateDueDisplay();
      } else if (event.key === 'Escape') {
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



</script>

{#if taskSyncManager.obsidianTask.hasDue() || taskSyncManager.getTaskCardStatus('dueStatus') === 'editing'}
  {#if taskSyncManager.getTaskCardStatus('dueStatus') === 'editing'}
    <input
      type="text"
      on:keydown={finishDueEditing}
      on:input={() => adjustWidthForInput(inputElement)}
      bind:value={dueString}
      bind:this={inputElement}
      class="task-card-due"
    />
  {:else}
    <div
      on:click={enableDueEditMode}
      on:keydown={enableDueEditMode}
      class="task-card-due {params.mode === 'single-line' ? 'mode-single-line' : 'mode-multi-line'}"
      role="button"
      tabindex="0"
    >
      <div class="due-display">
        {dueDisplay}
      </div>
    </div>
  {/if}
  {#if params.mode !== 'single-line'}
    <div class="task-card-attribute-separator"> | </div>
  {/if}
{/if}

<style>

  .due-display {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    padding-top: 1.12px;
  }
  
  .task-card-due {
    display: inline;
    padding: var(--tag-padding-y) var(--tag-padding-x);
    border: var(--border-width) solid var(--background-modifier-border);
    width: auto;
    border-radius: var(--tag-radius);
    font-size: calc(var(--font-ui-medium) * 0.875);
    color: var(--text-accent);
    white-space: nowrap;
    line-height: 1;
  }

  /* This selector ensures that the cursor only changes to a hand pointer when the div is not empty */
  .task-card-due.mode-multi-line:not(:empty):hover {
    background-color: var(--background-modifier-hover);
    color: var(--text-accent-hover);
    cursor: pointer;
  }

  input.task-card-due {
    border-radius: var(--tag-radius);
    background-color: var(--background-primary-alt);
    padding: var(--tag-padding-y) var(--tag-padding-x);
    border: var(--border-width) solid var(--background-modifier-border);
    width: auto;
    text-align: center;
    font-size: calc(var(--font-ui-medium) * 0.875);
    color: var(--text-muted);
    line-height: 1;
    box-sizing: border-box;
    width: auto;
    height: auto;
    font-family: var(--font-text);
  }

  /* Customize the focus styles */
  input.task-card-due:focus {
    outline: none; /* Remove the default outline */
    box-shadow: none; /* Remove the default box-shadow */
  }
</style>
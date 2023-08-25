<script lang="ts">
  import { logger } from "../utils/log";
  import { displayDate, displayTime } from "../utils/dateTimeFormatter"
  import { DueDate, ObsidianTask } from "../taskModule/task";
  import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";
  import TaskCardPlugin from "..";
  import { tick } from "svelte";
  import { TaskItemParams, TaskMode } from "../renderer/postProcessor";

  export let taskSyncManager: ObsidianTaskSyncManager;
  export let plugin: TaskCardPlugin;
  export let params: TaskItemParams;
  let due: DueDate | null;
  let dueString: string;
  due = taskSyncManager.obsidianTask.hasDue() ? taskSyncManager.obsidianTask.due : null;
  dueString = due ? due.string : '';

  let dueDisplay = "";
  let inputElement: HTMLInputElement;

  updateDueDisplay();

  async function enableDueEditMode() {
      // taskSyncManager.setTaskCardStatus('dueStatus', 'editing');
      taskSyncManager.taskCardStatus.dueStatus = 'editing';
      await tick();
      focusAndSelect(inputElement);
  }

  function finishDueEditing(event: KeyboardEvent) {
      if (event.key === 'Enter') {
          event.preventDefault();
          // taskSyncManager.setTaskCardStatus('dueStatus', 'done');
          taskSyncManager.taskCardStatus.dueStatus = 'done';
          try {
            due = plugin.taskParser.parseDue(dueString);
          } catch (e) {
            logger.error(e);
          }
          if (!due) { dueString = ''; }
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

</script>

{#if taskSyncManager.obsidianTask.hasDue() || taskSyncManager.getTaskCardStatus('dueStatus') === 'editing'}
  {#if taskSyncManager.getTaskCardStatus('dueStatus') === 'editing'}
    <input
      type="text"
      on:keydown={finishDueEditing}
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
      {dueDisplay}
    </div>
  {/if}
  <div class="task-card-attribute-separator"> | </div>
{/if}

<style>

  .task-card-due {
    display: inline-block;
    padding: var(--tag-padding-y) var(--tag-padding-x);
    border-radius: var(--radius-l);
    border: var(--border-width) solid var(--background-modifier-border);
    width: auto;
    font-size: var(--font-ui-smaller);
    white-space: nowrap;
  }

  /* This selector ensures that the cursor only changes to a hand pointer when the div is not empty */
  .task-card-due.mode-multi-line:not(:empty):hover {
    background-color: var(--background-modifier-hover);
    cursor: pointer;
  }

  input.task-card-due {
    border-radius: var(--radius-l);
    width: auto;
    text-align: center;
  }

  /* Customize the focus styles */
  input.task-card-due:focus {
    outline: none; /* Remove the default outline */
    box-shadow: none; /* Remove the default box-shadow */
    border: calc(0.75 * var(--border-width)) solid var(--background-modifier-border); /* Add a custom border */
  }
</style>
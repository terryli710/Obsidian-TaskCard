<script lang="ts">
  import { logger } from "../utils/log";
  import { displayDate, displayTime } from "../utils/dateTimeFormatter"
  import { DueDate, ObsidianTask } from "../taskModule/task";
  import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";
  import TaskCardPlugin from "..";
  import { tick } from "svelte";

  export let taskSyncManager: ObsidianTaskSyncManager;
  export let plugin: TaskCardPlugin;
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
          due = plugin.taskParser.parseDue(dueString);
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
      class="task-card-due"
      role="button"
      tabindex="0"
    >
      {dueDisplay}
    </div>
  {/if}
{/if}
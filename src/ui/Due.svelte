<script lang="ts">
  import { logger } from "../utils/log";
  import { displayDate, displayTime } from "../utils/dateTimeFormatter"
  import { DueDate, ObsidianTask } from "../taskModule/task";
  import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";
  import TaskCardPlugin from "..";

  export let taskSyncManager: ObsidianTaskSyncManager;
  export let plugin: TaskCardPlugin;
  let due: DueDate | null;
  let dueString: string;
  due = taskSyncManager.obsidianTask.hasDue() ? taskSyncManager.obsidianTask.due : null;
  dueString = due ? due.string : '';

  let dueDisplay = "";

  updateDueDisplay();

  function enableDueEditMode() {
      taskSyncManager.setTaskCardStatus('dueStatus', 'editing');
  }

  function finishDueEditing(event: KeyboardEvent) {
      if (event.key === 'Enter') {
          event.preventDefault();
          taskSyncManager.setTaskCardStatus('dueStatus', 'done');
          due = plugin.taskParser.parseDue(dueString);
          taskSyncManager.updateObsidianTaskAttribute('due', due);
          updateDueDisplay();
      } else if (event.key === 'Escape') {
          taskSyncManager.setTaskCardStatus('dueStatus', 'done');
      }
  }

  function updateDueDisplay() {
      let datePart = displayDate(due.date);
      let timePart = displayTime(due.time);
      dueDisplay = timePart ? `${datePart}, ${timePart}` : datePart;
  }
</script>

{#if taskSyncManager.obsidianTask.hasDue() || taskSyncManager.getTaskCardStatus('dueStatus') === 'editing'}
  {#if taskSyncManager.getTaskCardStatus('dueStatus') === 'editing'}
    <input
      type="text"
      on:keydown={finishDueEditing}
      bind:value={dueString}
      class="task-card-due"
    />
  {:else}
    <div
      on:dblclick={enableDueEditMode}
      on:keydown={enableDueEditMode}
      class="task-card-due"
      role="button"
      tabindex="0"
    >
      {dueDisplay}
    </div>
  {/if}
{/if}
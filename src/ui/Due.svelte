<script lang="ts">
  import { logger } from "../utils/log";
  import { displayDate, displayTime } from "../utils/dateTimeFormatter"
  import { DueDate } from "../taskModule/task";
  import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";
  import TaskCardPlugin from "..";

  export let taskSyncManager: ObsidianTaskSyncManager;
  export let plugin: TaskCardPlugin;
  let due: DueDate;
  let dueString: string;
  due = taskSyncManager.obsidianTask.due;
  dueString = due.string;

  let dueDisplay = "";
  let isEditingDue = false;

  $: {
    let datePart = displayDate(due.date);
    let timePart = displayTime(due.time);
    dueDisplay = timePart ? `${datePart}, ${timePart}` : datePart;
  }

  function enableDueEditMode() {
      isEditingDue = true;
  }

  function finishDueEditing(event: KeyboardEvent) {
      if (event.key === 'Enter') {
          event.preventDefault();
          isEditingDue = false;
          due = plugin.taskParser.parseDue(dueString);
          updateDueDisplay();
      } else if (event.key === 'Escape') {
          isEditingDue = false;
      }
  }

  function updateDueDisplay() {
      let datePart = displayDate(due.date);
      let timePart = displayTime(due.time);
      dueDisplay = timePart ? `${datePart}, ${timePart}` : datePart;
  }
</script>


{#if isEditingDue}
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
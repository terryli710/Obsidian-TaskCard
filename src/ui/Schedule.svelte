<script lang="ts">
  import { logger } from "../utils/log";
  import { formatScheduleValue } from "../taskModule/fieldSyntax";
  import { ScheduleDate, ObsidianTask } from "../taskModule/task";
  import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";
  import TaskCardPlugin from "..";
  import { tick } from "svelte";
  import { TaskDisplayParams } from "../renderer/postProcessor";
  import { Notice } from "obsidian";
  import CalendarClock from "../components/icons/CalendarClock.svelte";
  import { getTemporalPresentation, getTemporalStatus } from "../utils/temporalDisplay";
  import AttributeValueSuggestions from "./AttributeValueSuggestions.svelte";
  import type { AttributeValueSuggestion } from "../autoSuggestions/valueSuggestions";

  export let interactive: boolean = true;
  export let taskSyncManager: ObsidianTaskSyncManager = undefined;
  export let taskItem: ObsidianTask = undefined;
  export let plugin: TaskCardPlugin = undefined;
  export let params: TaskDisplayParams;
  export let displaySchedule: boolean;
  
  let schedule: ScheduleDate;
  let scheduleString: string = "";
  let scheduleDisplay: string = "";
  let scheduleTooltip: string = "";
  let inputElement: HTMLInputElement;
  let suggestionMenu: AttributeValueSuggestions;
  let suggestionsOpen =
    interactive &&
    params?.mode === 'multi-line' &&
    taskSyncManager?.getTaskCardStatus('scheduleStatus') === 'editing';
  let wasEditing = suggestionsOpen;
  $: canEdit = interactive && params.mode === 'multi-line';

  if (interactive) {
    schedule = taskSyncManager.obsidianTask.hasSchedule() ? taskSyncManager.obsidianTask.schedule : undefined;
  } else {
    schedule = taskItem.schedule;
  }  

  // The editor is always seeded with the *resolved* date, never the text the
  // user originally typed: "tomorrow" resolves against "now" once, at commit;
  // re-opening the editor later must show (and re-commit) the frozen date.
  function canonicalScheduleString(): string {
    if (!schedule) return '';
    return schedule.date ? formatScheduleValue(schedule) : (schedule.string ?? '');
  }

  scheduleString = canonicalScheduleString();

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
      scheduleString = canonicalScheduleString();
      suggestionsOpen = params.mode === 'multi-line';
      await tick();
      focusAndSelect(inputElement);
      adjustWidthForInput(inputElement);
  }

  // Uniform edit-mode contract (all card fields): Enter and focus loss both
  // commit; Escape is the only discard path. Unchanged or invalid values
  // close the editor without a file write (invalid ones revert with a
  // Notice); an emptied editor clears the field.
  function commitScheduleEdit() {
    if (taskSyncManager.taskCardStatus.scheduleStatus !== 'editing') return;
    suggestionsOpen = false;
    taskSyncManager.taskCardStatus.scheduleStatus = 'done';

    if (scheduleString.trim() === canonicalScheduleString().trim()) {
        scheduleString = canonicalScheduleString();
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
                scheduleString = canonicalScheduleString();
                updateScheduleDisplay();
                return;
            }
        } catch (e) {
            logger.error(e);
            scheduleString = canonicalScheduleString();
            updateScheduleDisplay();
            return;
        }
    }

    taskSyncManager.updateObsidianTaskAttribute('schedule', schedule);
    updateScheduleDisplay();
  }

  function cancelScheduleEdit() {
    if (taskSyncManager.taskCardStatus.scheduleStatus !== 'editing') return;
    suggestionsOpen = false;
    taskSyncManager.taskCardStatus.scheduleStatus = 'done';
    scheduleString = canonicalScheduleString();
    updateScheduleDisplay();
  }

  function finishScheduleEditing(event: KeyboardEvent | MouseEvent) {
    if (event instanceof MouseEvent) {
        return;
    }

    if (event.key === 'Enter') {
        event.preventDefault();
        commitScheduleEdit();
    } else if (event.key === 'Escape') {
        cancelScheduleEdit();
    }
  }

  function handleScheduleKeydown(event: KeyboardEvent) {
    const clearing = event.key === 'Enter' && scheduleString.trim() === '';
    if (!clearing && suggestionsOpen && suggestionMenu?.handleKeydown(event)) return;
    if (!suggestionsOpen && event.key === 'ArrowDown' && params.mode === 'multi-line') {
      event.preventDefault();
      suggestionsOpen = true;
      return;
    }
    finishScheduleEditing(event);
  }

  function chooseScheduleSuggestion(suggestion: AttributeValueSuggestion) {
    scheduleString = suggestion.value;
    suggestionsOpen = false;
    tick().then(() => adjustWidthForInput(inputElement));
  }

  // While editing, a click on the chip around the input must not steal focus
  // (which would commit and close the editor mid-interaction).
  function keepEditFocus(event: MouseEvent) {
    if (
        taskSyncManager.taskCardStatus.scheduleStatus === 'editing' &&
        event.target !== inputElement
    ) {
        event.preventDefault();
    }
  }

  function updateScheduleDisplay(): string {
      if (!schedule) {
          scheduleDisplay = '';
          scheduleTooltip = '';
          return scheduleDisplay;
      }
      const presentation = getTemporalPresentation(schedule, 'scheduled');
      scheduleDisplay = presentation.text;
      scheduleTooltip = presentation.tooltip;
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


  $: {
    if (interactive) {
      displaySchedule = taskSyncManager.obsidianTask.hasSchedule() || taskSyncManager.taskCardStatus.scheduleStatus === 'editing';
    } else {
      displaySchedule = !!taskItem.schedule; // The double bang '!!' converts a truthy/falsy value to a boolean true/false
    }
  }

  $: {
    const isEditing =
      interactive && taskSyncManager.getTaskCardStatus('scheduleStatus') === 'editing';
    if (isEditing && !wasEditing) {
      scheduleString = canonicalScheduleString();
      suggestionsOpen = params.mode === 'multi-line';
      tick().then(() => {
        if (inputElement) {
          focusAndSelect(inputElement);
          adjustWidthForInput(inputElement);
        }
      });
    }
    wasEditing = isEditing;
  }

  function getTaskScheduleStatus(task: ObsidianTask): string | null {
    const status = getTemporalStatus(task.schedule, task.duration, task.completed);
    if (status === 'past-incomplete') return 'passSchedule';
    if (status === 'past-complete') return 'passed';
    return status;
  }

  $: taskScheduleStatus = getTaskScheduleStatus(interactive ? taskSyncManager.obsidianTask : taskItem);

</script>

<!-- svelte-ignore non-top-level-reactive-declaration -->
{#if displaySchedule}
  <div class="task-card-schedule-container {params.mode === 'single-line' ? 'mode-single-line' : 'mode-multi-line'} {taskScheduleStatus ? taskScheduleStatus : ''}"
    class:day-only={!schedule?.time}
    class:suggestions-open={suggestionsOpen}
    on:click={canEdit ? toggleEditMode : null}
    on:keydown={canEdit ? toggleEditMode : null}
    on:mousedown={canEdit ? keepEditFocus : null}
    aria-label="Schedule"
    title={scheduleTooltip}
    role="button"
    tabindex="0"
  >
    <div class="task-card-schedule-left-part">
      <span class="task-card-schedule-prefix {taskScheduleStatus ? taskScheduleStatus : ''}">
        <CalendarClock width={"12"} height={"12"} ariaLabel="Schedule"/>
      </span>
    </div>
    {#if interactive && taskSyncManager.getTaskCardStatus('scheduleStatus') === 'editing'}
      <input
        type="text"
        on:input={() => {
          adjustWidthForInput(inputElement);
          suggestionsOpen = params.mode === 'multi-line';
        }}
        on:focus={() => (suggestionsOpen = params.mode === 'multi-line')}
        on:keydown|stopPropagation={handleScheduleKeydown}
        on:blur={commitScheduleEdit}
        bind:value={scheduleString}
        bind:this={inputElement}
        title="Enter to save · Esc to cancel"
        class="task-card-schedule"
      />
      {#if suggestionsOpen}
        <AttributeValueSuggestions
          bind:this={suggestionMenu}
          field="scheduled"
          query={scheduleString}
          on:choose={(event) => chooseScheduleSuggestion(event.detail)}
          on:dismiss={() => (suggestionsOpen = false)}
        />
      {/if}
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
      display: flex;
      align-items: center;
  }

  .task-card-schedule-prefix {
    display: flex;
    align-items: center;
    line-height: 1;
  }

  /* soft-tint chip (chip-polish, 2026-07-08): unified metrics across every
     chip — 21px tall, symmetric 10px sides, flex-centered — with an accent
     tint carrying the "date" meaning; the container owns the color, icon and
     text inherit it */
  .task-card-schedule-container {
    align-items: center;
    display: flex;
    gap: 4px;
    box-sizing: border-box;
    height: 21px;
    border-radius: 999px;
    min-width: 2em;
    flex-shrink: 0;
    overflow: hidden;
    padding: 0 10px;
    font-size: var(--font-ui-smaller);
    line-height: 1;
    background-color: color-mix(in srgb, var(--text-accent) 10%, transparent);
    color: var(--text-accent);
  }

  .task-card-schedule-container.suggestions-open {
    position: relative;
    overflow: visible;
  }

  .task-card-schedule-container.passSchedule {
    background-color: color-mix(in srgb, var(--text-warning) 12%, transparent);
    color: var(--text-warning);
  }

  .task-card-schedule-container.day-only:not(.passSchedule):not(.passed) {
    background-color: var(--background-modifier-hover);
    color: var(--text-muted);
  }

  .task-card-schedule-container.passed {
    background-color: var(--background-modifier-hover);
    color: var(--text-faint);
  }

  .task-card-schedule-container.ongoing {
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .schedule-display {
    display: flex;
    align-items: center;
  }

  .task-card-schedule {
    display: flex;
    align-items: center;
    white-space: nowrap;
    line-height: 1;
  }

  .task-card-schedule.upcoming {
    font-style: italic;
    text-decoration: underline;
  }

  .task-card-schedule-container.mode-multi-line:hover {
    background-color: color-mix(in srgb, var(--text-accent) 16%, transparent);
    cursor: pointer;
  }

  .task-card-schedule-container.mode-multi-line.passSchedule:hover {
    background-color: color-mix(in srgb, var(--text-warning) 18%, transparent);
  }

  .task-card-schedule-container.mode-multi-line.passed:hover {
    background-color: var(--background-modifier-active-hover);
  }

  .task-card-schedule-container.mode-multi-line.ongoing:hover {
    background-color: var(--interactive-accent-hover);
  }

  input.task-card-schedule {
    box-sizing: border-box;
    border: none;
    background: transparent;
    padding: 0;
    width: auto;
    height: auto;
    white-space: nowrap;
    line-height: 1;
    font: inherit;
    color: inherit;
  }

  /* Customize the focus styles */
  input.task-card-schedule:focus {
    outline: none; /* Remove the default outline */
    box-shadow: none; /* Remove the default box-shadow */
  }
</style>

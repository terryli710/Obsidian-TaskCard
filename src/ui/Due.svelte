<script lang="ts">
  import { logger } from "../utils/log";
  import { formatScheduleValue } from "../taskModule/fieldSyntax";
  import { ScheduleDate, ObsidianTask } from "../taskModule/task";
  import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";
  import TaskCardPlugin from "..";
  import { tick } from "svelte";
  import { TaskDisplayParams } from "../renderer/postProcessor";
  import { Notice } from "obsidian";
  import AlertTriangle from "../components/icons/AlertTriangle.svelte";
  import { getTemporalPresentation, getTemporalStatus } from "../utils/temporalDisplay";
  import AttributeValueSuggestions from "./AttributeValueSuggestions.svelte";
  import type { AttributeValueSuggestion } from "../autoSuggestions/valueSuggestions";

  export let interactive: boolean = true;
  export let taskSyncManager: ObsidianTaskSyncManager = undefined;
  export let taskItem: ObsidianTask = undefined;
  export let plugin: TaskCardPlugin = undefined;
  export let params: TaskDisplayParams;
  export let displayDue: boolean;

  let due: ScheduleDate;
  let dueString: string = "";
  let dueDisplay: string = "";
  let dueTooltip: string = "";
  let inputElement: HTMLInputElement;
  let suggestionMenu: AttributeValueSuggestions;
  let suggestionsOpen =
    interactive &&
    params?.mode === 'multi-line' &&
    taskSyncManager?.getTaskCardStatus('dueStatus') === 'editing';
  let wasEditing = suggestionsOpen;

  if (interactive) {
    due = taskSyncManager.obsidianTask.hasDue() ? taskSyncManager.obsidianTask.due : undefined;
  } else {
    due = taskItem.due;
  } 

  // The editor is always seeded with the *resolved* date, never the text the
  // user originally typed: "tomorrow" resolves against "now" once, at commit;
  // re-opening the editor later must show (and re-commit) the frozen date.
  function canonicalDueString(): string {
    if (!due) return '';
    return due.date ? formatScheduleValue(due) : (due.string ?? '');
  }

  dueString = canonicalDueString();

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
      dueString = canonicalDueString();
      suggestionsOpen = params.mode === 'multi-line';
      await tick();
      focusAndSelect(inputElement);
      adjustWidthForInput(inputElement);
  }

  // Uniform edit-mode contract (all card fields): Enter and focus loss both
  // commit; Escape is the only discard path. Unchanged or invalid values
  // close the editor without a file write (invalid ones revert with a
  // Notice); an emptied editor clears the field.
  function commitDueEdit() {
    if (taskSyncManager.taskCardStatus.dueStatus !== 'editing') return;
    suggestionsOpen = false;
    taskSyncManager.taskCardStatus.dueStatus = 'done';

    if (dueString.trim() === canonicalDueString().trim()) {
        dueString = canonicalDueString();
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
                dueString = canonicalDueString();
                updateDueDisplay();
                return;
            }
        } catch (e) {
            logger.error(e);
            dueString = canonicalDueString();
            updateDueDisplay();
            return;
        }
    }

    taskSyncManager.updateObsidianTaskAttribute('due', due);
    updateDueDisplay();
  }

  function cancelDueEdit() {
    if (taskSyncManager.taskCardStatus.dueStatus !== 'editing') return;
    suggestionsOpen = false;
    taskSyncManager.taskCardStatus.dueStatus = 'done';
    dueString = canonicalDueString();
    updateDueDisplay();
  }

  function finishDueEditing(event: KeyboardEvent | MouseEvent) {
    if (event instanceof MouseEvent) {
        return;
    }

    if (event.key === 'Enter') {
        event.preventDefault();
        commitDueEdit();
    } else if (event.key === 'Escape') {
        cancelDueEdit();
    }
  }

  function handleDueKeydown(event: KeyboardEvent) {
    const clearing = event.key === 'Enter' && dueString.trim() === '';
    if (!clearing && suggestionsOpen && suggestionMenu?.handleKeydown(event)) return;
    if (!suggestionsOpen && event.key === 'ArrowDown' && params.mode === 'multi-line') {
      event.preventDefault();
      suggestionsOpen = true;
      return;
    }
    finishDueEditing(event);
  }

  function chooseDueSuggestion(suggestion: AttributeValueSuggestion) {
    dueString = suggestion.value;
    suggestionsOpen = false;
    tick().then(() => adjustWidthForInput(inputElement));
  }

  // While editing, a click on the chip around the input must not steal focus
  // (which would commit and close the editor mid-interaction).
  function keepEditFocus(event: MouseEvent) {
    if (
        taskSyncManager.taskCardStatus.dueStatus === 'editing' &&
        event.target !== inputElement
    ) {
        event.preventDefault();
    }
  }


  function updateDueDisplay(): string {
    if (!due || !due.date) {
        dueDisplay = '';
        dueTooltip = '';
        return dueDisplay;
    }
    const presentation = getTemporalPresentation(due, 'due');
    dueDisplay = presentation.text;
    dueTooltip = presentation.tooltip;
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


  $: {
    if (interactive) {
      displayDue = taskSyncManager.obsidianTask.hasDue() || taskSyncManager.taskCardStatus.dueStatus === 'editing';
    } else {
      displayDue = !!taskItem.due; // The double bang '!!' converts a truthy/falsy value to a boolean true/false
    }
  }

  $: {
    const isEditing =
      interactive && taskSyncManager.getTaskCardStatus('dueStatus') === 'editing';
    if (isEditing && !wasEditing) {
      dueString = canonicalDueString();
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

  function getTaskDueStatus(task: ObsidianTask): string | null {
    const status = getTemporalStatus(task.due, task.duration, task.completed);
    if (status === 'past-incomplete') return 'passDue';
    if (status === 'past-complete') return 'passed';
    return status;
  }

  $: taskDueStatus = getTaskDueStatus(interactive ? taskSyncManager.obsidianTask : taskItem);

</script>

{#if displayDue}
  <div class="task-card-due-container {params.mode === 'single-line' ? 'mode-single-line' : 'mode-multi-line'} {taskDueStatus ? taskDueStatus : ''}"
    class:day-only={!due?.time}
    class:suggestions-open={suggestionsOpen}
    on:click={interactive ? toggleEditMode : null}
    on:keydown={interactive ? toggleEditMode : null}
    on:mousedown={interactive ? keepEditFocus : null}
    aria-label="Due"
    title={dueTooltip}
    role="button"
    tabindex="0"
  >
    <div class="task-card-due-left-part">
      <span class="task-card-due-prefix {taskDueStatus ? taskDueStatus : ''}">
        <AlertTriangle width={"12"} height={"12"} ariaLabel="Due"/>
      </span>
    </div>
    {#if interactive && taskSyncManager.getTaskCardStatus('dueStatus') === 'editing'}
      <input
        type="text"
        on:input={() => {
          adjustWidthForInput(inputElement);
          suggestionsOpen = params.mode === 'multi-line';
        }}
        on:focus={() => (suggestionsOpen = params.mode === 'multi-line')}
        on:keydown|stopPropagation={handleDueKeydown}
        on:blur={commitDueEdit}
        bind:value={dueString}
        bind:this={inputElement}
        title="Enter to save · Esc to cancel"
        class="task-card-due"
      />
      {#if suggestionsOpen}
        <AttributeValueSuggestions
          bind:this={suggestionMenu}
          field="due"
          query={dueString}
          on:choose={(event) => chooseDueSuggestion(event.detail)}
          on:dismiss={() => (suggestionsOpen = false)}
        />
      {/if}
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
      display: flex;
      align-items: center;
  }

  .task-card-due-prefix {
    display: flex;
    align-items: center;
    line-height: 1;
  }

  /* soft-tint chip (chip-polish, 2026-07-08): unified metrics across every
     chip — 21px tall, symmetric 10px sides, flex-centered — with an accent
     tint carrying the "date" meaning; the container owns the color, icon and
     text inherit it */
  .task-card-due-container {
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

  .task-card-due-container.suggestions-open {
    position: relative;
    overflow: visible;
  }

  .task-card-due-container.passDue {
    background-color: color-mix(in srgb, var(--text-warning) 12%, transparent);
    color: var(--text-warning);
  }

  .task-card-due-container.day-only:not(.passDue):not(.passed) {
    background-color: var(--background-modifier-hover);
    color: var(--text-muted);
  }

  .task-card-due-container.passed {
    background-color: var(--background-modifier-hover);
    color: var(--text-faint);
  }

  .task-card-due-container.ongoing {
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .due-display {
    display: flex;
    align-items: center;
  }

  .task-card-due {
    display: flex;
    align-items: center;
    white-space: nowrap;
    line-height: 1;
  }

  .task-card-due.upcoming {
    font-style: italic;
    text-decoration: underline;
  }

  .task-card-due-container.mode-multi-line:hover {
    background-color: color-mix(in srgb, var(--text-accent) 16%, transparent);
    cursor: pointer;
  }

  .task-card-due-container.mode-multi-line.passDue:hover {
    background-color: color-mix(in srgb, var(--text-warning) 18%, transparent);
  }

  .task-card-due-container.mode-multi-line.passed:hover {
    background-color: var(--background-modifier-active-hover);
  }

  .task-card-due-container.mode-multi-line.ongoing:hover {
    background-color: var(--interactive-accent-hover);
  }

  input.task-card-due {
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
  input.task-card-due:focus {
    outline: none; /* Remove the default outline */
    box-shadow: none; /* Remove the default box-shadow */
  }
</style>

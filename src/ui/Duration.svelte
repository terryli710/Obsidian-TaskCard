<script lang="ts">
  import { logger } from "../utils/log";
  import { Duration, ObsidianTask } from "../taskModule/task";
  import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";
  import { tick } from "svelte";
  import { TaskDisplayParams } from "../renderer/postProcessor";
  import { Notice } from "obsidian";
  import History from "../components/icons/History.svelte";
  import AttributeValueSuggestions from "./AttributeValueSuggestions.svelte";
  import { parseDurationInputValue, type AttributeValueSuggestion } from "../autoSuggestions/valueSuggestions";

  export let interactive: boolean = true;
  export let taskSyncManager: ObsidianTaskSyncManager = undefined;
  export let taskItem: ObsidianTask = undefined;
  export let params: TaskDisplayParams;
  export let displayDuration: boolean;

  const interactiveMode = interactive;

  let duration: Duration;
  if (interactiveMode) {
    duration = taskSyncManager.obsidianTask.hasDuration() ? taskSyncManager.obsidianTask.duration : undefined;
  } else {
    duration = taskItem.duration;
  }

  function customDurationHumanizer(duration: Duration) {
    if (duration.hours === 0) {
      return `${duration.minutes}min${duration.minutes === 1 ? '' : 's'}`;
    } else if (duration.minutes === 0) {
      return `${duration.hours}hr${duration.hours === 1 ? '' : 's'}`;
    } else {
      return `${duration.hours}h ${duration.minutes}m`;
    }
  }

  let durationDisplay = "";
  let durationInputElement: HTMLInputElement;
  let durationInputString = duration ? `${pad(duration.hours, 2)}:${pad(duration.minutes, 2)}` : '00:00';
  let origDurationInputString = durationInputString;
  let suggestionMenu: AttributeValueSuggestions;
  let suggestionsOpen =
    interactiveMode &&
    params?.mode === 'multi-line' &&
    taskSyncManager?.getTaskCardStatus('durationStatus') === 'editing';
  let wasEditing = suggestionsOpen;

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
      suggestionsOpen = params.mode === 'multi-line';
      await tick();
      focusAndSelect(durationInputElement);
  }

  // Uniform edit-mode contract (all card fields): Enter and focus loss both
  // commit; Escape is the only discard path. Unchanged or invalid values
  // close the editor without a file write (invalid ones revert with a
  // Notice); an emptied (or 00:00) editor clears the field. "Unchanged" is
  // measured against the task's real duration, not the editor's prefill, so
  // Enter on the suggested 01:00 of a duration-less task still saves — but
  // only Enter (`explicit`): abandoning the untouched suggestion by clicking
  // away must not add data the user never typed.
  function commitDurationEdit(explicit: boolean = false) {
    if (taskSyncManager.taskCardStatus.durationStatus !== 'editing') return;
    suggestionsOpen = false;
    taskSyncManager.taskCardStatus.durationStatus = 'done';

    const currentString = duration
        ? `${pad(duration.hours, 2)}:${pad(duration.minutes, 2)}`
        : '';
    if (durationInputString.trim() === currentString) {
        durationInputString = origDurationInputString;
        return;
    }
    if (!explicit && durationInputString === origDurationInputString) {
        return;
    }

    if (durationInputString.trim() === '' || isValidZeroDuration(durationInputString)) {
        duration = null;
    } else {
        const parsedDuration = parseDurationInput(durationInputString);
        if (parsedDuration) {
            duration = parsedDuration;
        } else {
            new Notice(`[TaskCard] Invalid duration format: ${durationInputString}`);
            durationInputString = origDurationInputString;
            return;
        }
    }
    taskSyncManager.updateObsidianTaskAttribute('duration', duration);
    origDurationInputString = durationInputString;
    updateDurationDisplay();
  }

  function cancelDurationEdit() {
    if (taskSyncManager.taskCardStatus.durationStatus !== 'editing') return;
    suggestionsOpen = false;
    taskSyncManager.taskCardStatus.durationStatus = 'done';
    durationInputString = origDurationInputString;
  }

  function finishDurationEditing(event: KeyboardEvent | MouseEvent) {
    if (event instanceof MouseEvent) {
        return;
    }

    if (event.key === 'Escape') {
        event.preventDefault();
        cancelDurationEdit();
    } else if (event.key === 'Enter') {
        event.preventDefault();
        commitDurationEdit(true);
    }
  }

  function handleDurationKeydown(event: KeyboardEvent) {
    const clearing =
      event.key === 'Enter' &&
      (durationInputString.trim() === '' || isValidZeroDuration(durationInputString));
    if (!clearing && suggestionsOpen && suggestionMenu?.handleKeydown(event)) return;
    if (!suggestionsOpen && event.key === 'ArrowDown' && params.mode === 'multi-line') {
      event.preventDefault();
      suggestionsOpen = true;
      return;
    }
    finishDurationEditing(event);
  }

  function chooseDurationSuggestion(suggestion: AttributeValueSuggestion) {
    durationInputString = suggestion.value;
    suggestionsOpen = false;
  }

  // While editing, a click on the chip around the input must not steal focus
  // (which would commit and close the editor mid-interaction).
  function keepEditFocus(event: MouseEvent) {
    if (
        taskSyncManager.taskCardStatus.durationStatus === 'editing' &&
        event.target !== durationInputElement
    ) {
        event.preventDefault();
    }
  }

function isValidZeroDuration(input: string): boolean {
    const parsed = parseDurationInputValue(input);
    return parsed?.hours === 0 && parsed?.minutes === 0;
}

function parseDurationInput(input: string): { hours: number, minutes: number } | null {
    return parseDurationInputValue(input);
}


  // Action function to focus and select the input content
  function focusAndSelect(node: HTMLInputElement) {
    // Focus on the input element
    node.focus();
    // Select all the content
    node.select();
  }

  $: {
    if (interactiveMode) {
      displayDuration = taskSyncManager.obsidianTask.hasDuration() || taskSyncManager.getTaskCardStatus('durationStatus') === 'editing';
    } else {
      displayDuration = !!taskItem.duration; // The double bang '!!' converts a truthy/falsy value to a boolean true/false
    }
  }

  $: {
    const isEditing =
      interactive && taskSyncManager.getTaskCardStatus('durationStatus') === 'editing';
    if (isEditing && !wasEditing) {
      durationInputString = duration
        ? `${pad(duration.hours, 2)}:${pad(duration.minutes, 2)}`
        : '01:00';
      origDurationInputString = durationInputString;
      suggestionsOpen = params.mode === 'multi-line';
      tick().then(() => durationInputElement && focusAndSelect(durationInputElement));
    }
    wasEditing = isEditing;
  }

  </script>

<!-- Duration Display Section -->
{#if displayDuration}
  <!-- {#if displaySchedule}
    <span class="schedule-duration-padding"></span>
  {/if} -->
  <div class="task-card-duration-container {params.mode === 'single-line' ? 'mode-single-line' : 'mode-multi-line'}"
    class:suggestions-open={suggestionsOpen}
    on:click={interactiveMode ? toggleDurationEditMode : null}
    on:keydown={interactiveMode ? toggleDurationEditMode : null}
    on:mousedown={interactiveMode ? keepEditFocus : null}
    role="button"
    tabindex="0"
    aria-label="Duration"
  >
    <div class="task-card-duration-left-part">
      <span class="task-card-duration-prefix"><History width={"12"} height={"12"} ariaLabel="duration"/></span>
    </div>
    {#if interactiveMode && taskSyncManager.getTaskCardStatus('durationStatus') === 'editing'}
      <input
        type="text"
        on:input={() => (suggestionsOpen = params.mode === 'multi-line')}
        on:focus={() => (suggestionsOpen = params.mode === 'multi-line')}
        on:keydown|stopPropagation={handleDurationKeydown}
        on:blur={() => commitDurationEdit(false)}
        bind:value={durationInputString}
        bind:this={durationInputElement}
        class="task-card-duration"
        placeholder="hh:mm"
        title="Enter to save · Esc to cancel"
      />
      {#if suggestionsOpen}
        <AttributeValueSuggestions
          bind:this={suggestionMenu}
          field="duration"
          query={durationInputString}
          on:choose={(event) => chooseDurationSuggestion(event.detail)}
          on:dismiss={() => (suggestionsOpen = false)}
        />
      {/if}
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
        display: flex;
        align-items: center;
    }

  .task-card-duration-prefix {
    display: flex;
    align-items: center;
    line-height: 1;
  }

  /* soft-tint chip (chip-polish, 2026-07-08): unified metrics — 21px tall,
     symmetric 10px sides, flex-centered; neutral fill (durations carry no
     date semantics), container owns the color */
  .task-card-duration-container {
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
    background-color: var(--background-modifier-hover);
    color: var(--text-muted);
  }

  .task-card-duration-container.suggestions-open {
    position: relative;
    overflow: visible;
  }

  .duration-display {
    display: flex;
    align-items: center;
  }

  .task-card-duration {
    display: flex;
    align-items: center;
    white-space: nowrap;
    line-height: 1;
  }

  .task-card-duration-container.mode-multi-line:hover {
    background-color: var(--background-modifier-active-hover);
    cursor: pointer;
  }

  input.task-card-duration {
    box-sizing: border-box;
    border: none;
    background: transparent;
    padding: 0;
    width: 50px;
    height: auto;
    white-space: nowrap;
    line-height: 1;
    font: inherit;
    color: inherit;
  }

  input.task-card-duration:focus {
    outline: none;
    box-shadow: none;
  }
</style>

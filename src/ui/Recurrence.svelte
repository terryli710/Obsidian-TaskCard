<script lang="ts">
  import { logger } from "../utils/log";
  import { ObsidianTask } from "../taskModule/task";
  import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";
  import TaskCardPlugin from "..";
  import { tick } from "svelte";
  import { TaskDisplayParams } from "../renderer/postProcessor";
  import { Notice } from "obsidian";
  import Repeat from "../components/icons/Repeat.svelte";
  import AttributeValueSuggestions from "./AttributeValueSuggestions.svelte";
  import type { AttributeValueSuggestion } from "../autoSuggestions/valueSuggestions";

  export let interactive: boolean = true;
  export let taskSyncManager: ObsidianTaskSyncManager = undefined;
  export let taskItem: ObsidianTask = undefined;
  export let plugin: TaskCardPlugin = undefined;
  export let params: TaskDisplayParams;
  export let displayRecurrence: boolean;

  let recurrence: string | null;
  let recurrenceString: string = "";
  let inputElement: HTMLInputElement;
  let suggestionMenu: AttributeValueSuggestions;
  let suggestionsOpen =
    interactive &&
    params?.mode === 'multi-line' &&
    taskSyncManager?.getTaskCardStatus('recurrenceStatus') === 'editing';
  let wasEditing = suggestionsOpen;

  if (interactive) {
    recurrence = taskSyncManager.obsidianTask.hasRecurrence() ? taskSyncManager.obsidianTask.recurrence : null;
  } else {
    recurrence = taskItem.recurrence;
  }

  recurrenceString = recurrence || '';

  async function toggleEditMode(event: KeyboardEvent | MouseEvent) {
    if (taskSyncManager.taskCardStatus.recurrenceStatus === 'done') {
      enableRecurrenceEditMode(event);
    } else {
      finishRecurrenceEditing(event);
    }
  }

  async function enableRecurrenceEditMode(event: KeyboardEvent | MouseEvent) {
    if (event instanceof KeyboardEvent) {
      if (event.key != 'Enter') {
        return;
      }
      event.preventDefault();
    }
    taskSyncManager.taskCardStatus.recurrenceStatus = 'editing';
    recurrenceString = recurrence || '';
    suggestionsOpen = params.mode === 'multi-line';
    await tick();
    inputElement.focus();
    inputElement.select();
  }

  // Uniform edit-mode contract (all card fields): Enter and focus loss both
  // commit; Escape is the only discard path. Unchanged or invalid values
  // close the editor without a file write (invalid ones revert with a
  // Notice); an emptied editor clears the field.
  function commitRecurrenceEdit() {
    if (taskSyncManager.taskCardStatus.recurrenceStatus !== 'editing') return;
    suggestionsOpen = false;
    taskSyncManager.taskCardStatus.recurrenceStatus = 'done';

    if (recurrenceString.trim() === (recurrence || '').trim()) {
      recurrenceString = recurrence || '';
      return;
    }

    if (recurrenceString.trim() === '') {
      recurrence = null;
    } else {
      try {
        const newRecurrence = plugin.taskParser.parseRecurrence(recurrenceString);
        if (newRecurrence) {
          recurrence = newRecurrence;
        } else {
          new Notice(`[TaskCard] Invalid recurrence rule: ${recurrenceString} (try e.g. "every week")`);
          recurrenceString = recurrence || '';
          return;
        }
      } catch (e) {
        logger.error(e);
        recurrenceString = recurrence || '';
        return;
      }
    }

    taskSyncManager.updateObsidianTaskAttribute('recurrence', recurrence);
    recurrenceString = recurrence || '';
  }

  function cancelRecurrenceEdit() {
    if (taskSyncManager.taskCardStatus.recurrenceStatus !== 'editing') return;
    suggestionsOpen = false;
    taskSyncManager.taskCardStatus.recurrenceStatus = 'done';
    recurrenceString = recurrence || '';
  }

  function finishRecurrenceEditing(event: KeyboardEvent | MouseEvent) {
    if (event instanceof MouseEvent) {
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      commitRecurrenceEdit();
    } else if (event.key === 'Escape') {
      cancelRecurrenceEdit();
    }
  }

  function handleRecurrenceKeydown(event: KeyboardEvent) {
    const clearing = event.key === 'Enter' && recurrenceString.trim() === '';
    if (!clearing && suggestionsOpen && suggestionMenu?.handleKeydown(event)) return;
    if (!suggestionsOpen && event.key === 'ArrowDown' && params.mode === 'multi-line') {
      event.preventDefault();
      suggestionsOpen = true;
      return;
    }
    finishRecurrenceEditing(event);
  }

  function chooseRecurrenceSuggestion(suggestion: AttributeValueSuggestion) {
    recurrenceString = suggestion.value;
    suggestionsOpen = false;
  }

  // While editing, a click on the chip around the input must not steal focus
  // (which would commit and close the editor mid-interaction).
  function keepEditFocus(event: MouseEvent) {
    if (
      taskSyncManager.taskCardStatus.recurrenceStatus === 'editing' &&
      event.target !== inputElement
    ) {
      event.preventDefault();
    }
  }

  $: {
    if (interactive) {
      displayRecurrence = taskSyncManager.obsidianTask.hasRecurrence() || taskSyncManager.taskCardStatus.recurrenceStatus === 'editing';
    } else {
      displayRecurrence = !!taskItem.recurrence;
    }
  }

  $: {
    const isEditing =
      interactive && taskSyncManager.getTaskCardStatus('recurrenceStatus') === 'editing';
    if (isEditing && !wasEditing) {
      recurrenceString = recurrence || '';
      suggestionsOpen = params.mode === 'multi-line';
      tick().then(() => {
        if (inputElement) {
          inputElement.focus();
          inputElement.select();
        }
      });
    }
    wasEditing = isEditing;
  }
</script>

{#if displayRecurrence}
  <div class="task-card-recurrence-container {params.mode === 'single-line' ? 'mode-single-line' : 'mode-multi-line'}"
    class:suggestions-open={suggestionsOpen}
    on:click={interactive ? toggleEditMode : null}
    on:keydown={interactive ? toggleEditMode : null}
    on:mousedown={interactive ? keepEditFocus : null}
    aria-label="Recurrence"
    role="button"
    tabindex="0"
  >
    <div class="task-card-recurrence-left-part">
      <span class="task-card-recurrence-prefix">
        <Repeat width={"12"} height={"12"} ariaLabel="Recurrence"/>
      </span>
    </div>
    {#if interactive && taskSyncManager.getTaskCardStatus('recurrenceStatus') === 'editing'}
      <input
        type="text"
        on:input={() => (suggestionsOpen = params.mode === 'multi-line')}
        on:focus={() => (suggestionsOpen = params.mode === 'multi-line')}
        on:keydown|stopPropagation={handleRecurrenceKeydown}
        on:blur={commitRecurrenceEdit}
        bind:value={recurrenceString}
        bind:this={inputElement}
        class="task-card-recurrence"
        placeholder="every week"
        title="Enter to save · Esc to cancel"
      />
      {#if suggestionsOpen}
        <AttributeValueSuggestions
          bind:this={suggestionMenu}
          field="repeat"
          query={recurrenceString}
          on:choose={(event) => chooseRecurrenceSuggestion(event.detail)}
          on:dismiss={() => (suggestionsOpen = false)}
        />
      {/if}
    {:else}
      <div class="task-card-recurrence">
        <div class="recurrence-display">
          {recurrence || ''}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* soft-tint chip (chip-polish, 2026-07-08): unified metrics — 21px tall,
     symmetric 10px sides, flex-centered; neutral fill (recurrence carries no
     date semantics), container owns the color */
  .task-card-recurrence-container {
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

  .task-card-recurrence-container.suggestions-open {
    position: relative;
    overflow: visible;
  }

  .task-card-recurrence-container.mode-multi-line:hover {
    background-color: var(--background-modifier-active-hover);
    cursor: pointer;
  }

  .task-card-recurrence-left-part {
    display: flex;
    align-items: center;
  }

  .task-card-recurrence-prefix {
    display: flex;
    align-items: center;
    line-height: 1;
  }

  .task-card-recurrence {
    display: flex;
    align-items: center;
    white-space: nowrap;
    line-height: 1;
  }

  .recurrence-display {
    display: flex;
    align-items: center;
  }

  input.task-card-recurrence {
    box-sizing: border-box;
    border: none;
    background: transparent;
    padding: 0;
    width: 11em;
    height: auto;
    white-space: nowrap;
    line-height: 1;
    font: inherit;
    color: inherit;
  }

  input.task-card-recurrence:focus {
    outline: none;
    box-shadow: none;
  }
</style>

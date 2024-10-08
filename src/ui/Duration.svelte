<script lang="ts">
  import { logger } from "../utils/log";
  import { Duration, ObsidianTask } from "../taskModule/task";
  import { ObsidianTaskSyncManager } from "../taskModule/taskSyncManager";
  import TaskCardPlugin from "..";
  import { tick } from "svelte";
  import { TaskDisplayParams } from "../renderer/postProcessor";
  import { Notice } from "obsidian";
  import History from "../components/icons/History.svelte";

  export let interactive: boolean = true;
  export let taskSyncManager: ObsidianTaskSyncManager = undefined;
  export let taskItem: ObsidianTask = undefined;
  export let plugin: TaskCardPlugin = undefined;
  export let params: TaskDisplayParams;

  let duration: Duration;
  let durationDisplay = "";
  let durationInputElement: HTMLInputElement;
  let durationInputString = "";
  let editMode = false;

  function updateDuration() {
    if (interactive) {
      duration = taskSyncManager.obsidianTask.hasDuration() ? taskSyncManager.obsidianTask.duration : null;
    } else {
      duration = taskItem.duration;
    }
    updateDurationDisplay();
  }

  function updateDurationDisplay(): void {
    if (!duration) {
      durationDisplay = '';
      return;
    }
    durationDisplay = customDurationHumanizer(duration);
  }

  function customDurationHumanizer(duration: Duration) {
    if (duration.hours === 0) {
      return duration.minutes + " min" + (duration.minutes === 1 ? '' : 's');
    } else if (duration.minutes === 0) {
      return duration.hours + " hour" + (duration.hours === 1 ? '' : 's');
    } else {
      return duration.hours + "h " + duration.minutes + "m";
    }
  }

  async function toggleDurationEditMode(event: MouseEvent | KeyboardEvent) {
    if (event instanceof KeyboardEvent && event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    editMode = true;
    durationInputString = duration ? pad(duration.hours, 2) + ":" + pad(duration.minutes, 2) : '';
    await tick();
    focusAndSelect(durationInputElement);
  }

  function finishDurationEditing(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      const parsedDuration = plugin.taskParser.parseDuration(durationInputString);
      if (parsedDuration || durationInputString.trim() === '') {
        duration = parsedDuration;
        taskSyncManager.updateObsidianTaskAttribute('duration', duration);
        updateDurationDisplay();
      } else {
        new Notice("[TaskCard] Invalid duration format: " + durationInputString);
      }
      editMode = false;
    } else if (event.key === 'Escape') {
      event.preventDefault();
      editMode = false;
      updateDurationDisplay();
    }
  }

  function pad(num: number, size: number): string {
    let s = num + "";
    while (s.length < size) s = "0" + s;
    return s;
  }

  function focusAndSelect(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  updateDuration();
</script>

<div class="task-card-duration-container {params.mode === 'single-line' ? 'mode-single-line' : 'mode-multi-line'} {duration ? '' : 'no-duration'} {editMode ? 'edit-mode' : ''}"
  on:click={interactive ? toggleDurationEditMode : null}
  on:keydown={interactive ? toggleDurationEditMode : null}
  role="button"
  tabindex="0"
  aria-label="Duration"
>
  <div class="task-card-duration-left-part" aria-hidden="true" title="Duration">
    <span class="task-card-duration-prefix" aria-hidden="true">
      <History width="14" height="14" ariaLabel="Duration"/>
    </span>
  </div>
  {#if interactive && editMode}
    <input
      type="text"
      bind:value={durationInputString}
      bind:this={durationInputElement}
      on:keydown={finishDurationEditing}
      on:blur={() => editMode = false}
      class="task-card-duration-input"
      placeholder="hh:mm"
    />
  {:else if duration}
    <div class="task-card-duration">
      <div class="duration-display">
        {durationDisplay}
      </div>
    </div>
  {/if}
</div>

<style>
  .task-card-duration-container {
    display: flex;
    align-items: center;
    border-radius: 2em;
    overflow: hidden;
    margin: 0 2px;
    font-size: var(--tag-size);
    border: var(--border-width) solid var(--text-accent);
    padding: 0;
    height: 22px;
  }

  .task-card-duration-container.no-duration {
    width: 25px;
    height: 22px;
  }

  .task-card-duration-container.no-duration.edit-mode {
    width: auto;
    /* height: auto; */
  }

  .task-card-duration-left-part {
    display: flex;
    align-items: center;
    padding: 3px 1px 3px 5px;
    height: 100%;
  }

  .task-card-duration-prefix {
    color: var(--text-accent);
    font-size: var(--tag-size);
    line-height: 1;
    display: flex;
    align-items: center;
  }

  .task-card-duration, .task-card-duration-input {
    padding: var(--tag-padding-y) var(--tag-padding-x) var(--tag-padding-y) calc(var(--tag-padding-x) / 2);
    padding-right: var(--tag-padding-x);
    color: var(--text-accent);
    white-space: nowrap;
    line-height: 1;
  }

  .task-card-duration-input {
    box-sizing: border-box;
    border: none;
    background-color: transparent;
    width: 50px;
    height: 100%;
    font-family: var(--font-text);
    font-size: var(--tag-size);
  }

  .task-card-duration-input:focus {
    outline: none;
    box-shadow: none;
  }

  .duration-display {
    display: flex;
    align-items: center;
    height: 100%;
    padding-top: 1.5px;
  }

  .task-card-duration-container:hover {
    background-color: var(--background-modifier-hover);
    color: var(--text-accent-hover);
    cursor: pointer;
  }

  .task-card-duration-container.mode-multi-line {
    margin-top: 2px;
  }

</style>
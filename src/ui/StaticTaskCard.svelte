<script lang="ts">
  import { Notice, OpenViewState, Platform, Workspace } from 'obsidian';
  import ChevronsDownUp from '../components/icons/ChevronsDownUp.svelte';
  import ChevronsUpDown from '../components/icons/ChevronsUpDown.svelte';
  import {
    TaskDisplayMode,
    TaskDisplayParams
  } from '../renderer/postProcessor';
  import { LabelModule } from '../taskModule/labels';
  import { DocPosition, PositionedObsidianTask } from '../taskModule/task';
  import TaskCardPlugin from '..';
  import { DescriptionParser } from '../taskModule/description';
  import CircularProgressBar from '../components/CircularProgressBar.svelte';
  import Schedule from './Schedule.svelte';
  import Content from './Content.svelte';
  import Duration from './Duration.svelte';
  import Due from './Due.svelte';
  import Recurrence from './Recurrence.svelte';
  import Repeat from '../components/icons/Repeat.svelte';
  import { completeRecurringTaskInFile } from '../taskModule/recurrence';
  import { taskIdToken } from '../taskModule/fieldSyntax';

  var md = require('markdown-it');
  var taskLists = require('markdown-it-task-lists');
  var mdParser = md().use(taskLists);

  export let taskItem: PositionedObsidianTask;
  export let plugin: TaskCardPlugin;

  let taskDisplayParams: TaskDisplayParams = { mode: 'single-line' };
  let task = taskItem;
  let docPosition = taskItem.docPosition;
  // let scheduleDisplay = '';
  let labelModule = new LabelModule();
  // let descriptionMarkdown = markdownToHTML(task.description);
  let descriptionProgress = DescriptionParser.progressOfDescription(
    task.description
  );

  labelModule.setLabels(task.labels);

  function handleCheckboxClick() {
    task.completed = !task.completed;
    toggleCompleteOfTask(task.completed, taskItem.docPosition);
  }

  // The docPosition snapshot goes stale when lines shift after the query ran
  // (known-issues #4): trust the cached line only while it still carries the
  // task's id token (v2 block id / legacy hidden-span id), otherwise search
  // the file for it.
  async function resolveTaskLine(docPosition: DocPosition): Promise<number | null> {
    const cachedLine = docPosition.start.line;
    if (!task.id) return cachedLine;
    const fileLines = await plugin.fileOperator.getFileLines(
      docPosition.filePath
    );
    if (!fileLines) return null;
    const idToken = taskIdToken(task.id);
    if (fileLines[cachedLine]?.includes(idToken)) return cachedLine;
    const matches: number[] = [];
    fileLines.forEach((line, index) => {
      if (line.includes(idToken)) matches.push(index);
    });
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) return null;
    // id not on disk yet (task not registered with a block id): trust the
    // cached line while it still looks like a task line
    return /^\s*- \[.\]/.test(fileLines[cachedLine] ?? '') ? cachedLine : null;
  }

  async function toggleCompleteOfTask(
    completed: boolean,
    docPosition: DocPosition
  ) {
    const taskLine = await resolveTaskLine(docPosition);
    if (taskLine === null) {
      task.completed = !completed; // revert the optimistic checkbox flip
      new Notice(
        'TaskCard: could not locate this task in its file, so it was not updated. The query results may be stale.'
      );
      return;
    }

    // Completing a recurring task inserts the next instance above the line
    if (completed && task.hasRecurrence()) {
      const handled = await completeRecurringTaskInFile(
        plugin,
        task,
        docPosition.filePath,
        taskLine
      );
      if (handled) return;
      // fall through to a plain toggle when the rule cannot be advanced
    }

    // Get the line from the file
    const line = await plugin.fileOperator.getLineFromFile(
      docPosition.filePath,
      taskLine + 1
    );
    if (line === null) return;

    // Determine the symbol to use based on the 'completed' flag
    const symbol = completed ? 'x' : ' ';

    // Use a regular expression to find the task's current completion symbol and replace it
    const updatedLine = line.replace(/- \[[^\]]\]/, `- [${symbol}]`);

    // Update the line in the file
    plugin.fileOperator.updateLineInFile(
      docPosition.filePath,
      taskLine + 1,
      updatedLine
    );
  }

  function switchMode(
    event: MouseEvent | KeyboardEvent | CustomEvent,
    newMode: TaskDisplayMode | null = null
  ) {
    event.stopPropagation();
    taskDisplayParams.mode = newMode;
  }

  function linkToTask(event: MouseEvent | KeyboardEvent) {
    event.stopPropagation();

    const selectionEState = {
      cursor: {
        from: { line: docPosition.start.line, ch: 0 },
        to: { line: docPosition.start.line + 1, ch: 0 }
      },
      line: docPosition.start.line
    };

    const currentWorkspaceDisplayMode =
      plugin.app.workspace.activeLeaf.view.getState();
    // console.log(currentWorkspaceDisplayMode);

    const openViewState: OpenViewState = {
      active: true,
      // mode should be the same as the current mode
      state: { mode: currentWorkspaceDisplayMode },
      eState: selectionEState
    };

    // const line: string = await getLineFromDocPosition(docPosition);

    plugin.app.workspace.openLinkText(
      docPosition.filePath,
      docPosition.filePath,
      event.ctrlKey || (event.metaKey && Platform.isMacOS), // Open in new pane if Ctrl or Cmd is pressed
      openViewState
    );
  }

  const displaySchedule = task.hasSchedule();
  const displayDuration = task.hasDuration();
  const displayDue = task.hasDue();
  const displayRecurrence = task.hasRecurrence();
  // const displayDescription = task.hasDescription();

  const taskDescriptionHTML = transformTaskDescriptionHTML(
    mdParser.render(task.description)
  );

  /**
   * Transforms the HTML generated by the markdown parser for task descriptions to match a specified structure.
   * It specifically adjusts <ul> and <li> elements within the task descriptions to ensure they have the correct
   * classes and attributes. This includes adding 'contains-task-list' class to <ul> elements, ensuring 'task-list-item'
   * class is present on relevant <li> elements, and adjusting <input> elements inside these list items to have the
   * appropriate attributes.
   *
   * @param {string} taskDescriptionHTML - The HTML string generated by the markdown parser for a task description.
   * @returns {string} The transformed HTML string with the updated structure.
   */
  function transformTaskDescriptionHTML(description) {
    let parser = new DOMParser();
    let doc = parser.parseFromString(description, 'text/html');

    // Create a wrapper div for the final output
    let wrapperDiv = document.createElement('div');
    wrapperDiv.setAttribute('class', 'task-card-description');
    wrapperDiv.setAttribute('role', 'button');
    wrapperDiv.setAttribute('tabindex', '0');
    wrapperDiv.setAttribute('aria-label', 'Description');

    let ulElement = document.createElement('ul');
    ulElement.classList.add('contains-task-list', 'has-list-bullet');
    wrapperDiv.appendChild(ulElement);

    let lis = doc.body.querySelectorAll('li');
    
    lis.forEach((li, index) => {
      let newLi = document.createElement('li');
      let lineIndex = index + 1;
      let input = li.querySelector('input[type="checkbox"]');

      newLi.setAttribute('data-line', lineIndex.toString());
      newLi.setAttribute('data-real-line', lineIndex.toString());

      if (input instanceof HTMLInputElement) {
        // Ensure input is an HTMLInputElement
        let clonedInput = input.cloneNode(true) as HTMLInputElement; // Cast the cloned node
        clonedInput.setAttribute('class', 'task-list-item-checkbox');
        clonedInput.setAttribute('data-line', lineIndex.toString());

        if (input.hasAttribute('checked')) {
          newLi.classList.add('is-checked');
          newLi.setAttribute('data-task', 'x');
          // newLi.setAttribute('style', 'color: var(--text-faint);');
          clonedInput.setAttribute('checked', ''); // Ensure clonedInput maintains the checked state
        } else {
          newLi.setAttribute('data-task', '');
          clonedInput.removeAttribute('checked');
        }

        let bulletDiv = document.createElement('div');
        bulletDiv.classList.add('list-bullet');
        newLi.appendChild(bulletDiv);
        newLi.appendChild(clonedInput); // Use clonedInput instead of input
        newLi.append(li.textContent.trim());
      } else {
        // Handle non-checkbox items
        let bulletDiv = document.createElement('div');
        bulletDiv.classList.add('list-bullet');
        newLi.appendChild(bulletDiv);
        newLi.append(li.textContent.trim());
      }

      ulElement.appendChild(newLi);
    });

    // Use XMLSerializer to convert the document back to a string
    let serializer = new XMLSerializer();
    let transformedHTML = serializer.serializeToString(wrapperDiv);

    return transformedHTML;
  }
</script>

{#if taskDisplayParams.mode === 'single-line'}
  <div class="task-card-single-line">
    <div class="static-task-card-container">
      <!-- Left Element: Checkbox -->
      <div class="static-task-card-left">
        <input
          type="checkbox"
          class={`task-card-checkbox priority-${task.priority}`}
          checked={task.completed}
          on:click|stopPropagation={handleCheckboxClick}
        />
      </div>

      <!-- Middle Element: Content and Project -->
      <div
        class="static-task-card-middle"
        role="button"
        tabindex="0"
        title={docPosition.filePath}
        on:click={linkToTask}
        on:keydown={linkToTask}
      >
        <div class="static-task-card-content">{task.content}</div>
        <div class="static-task-card-middle-right">
          {#if descriptionProgress[1] * descriptionProgress[0] > 0 && !task.completed}
            <CircularProgressBar
              value={descriptionProgress[0]}
              max={descriptionProgress[1]}
              showDigits={false}
            />
          {/if}
          {#if task.recurrence}
            <span class="single-line-recurrence" title={task.recurrence}>
              <Repeat width={"13"} height={"13"} ariaLabel="Recurring task" />
            </span>
          {/if}
          <!-- Schedule -->
          <Schedule
            interactive={false}
            {displaySchedule}
            params={{ mode: 'single-line' }}
            taskItem={task}
          />
          <div class="task-card-project">
            {#if task.hasProject()}
              <span
                class="project-color"
                style="background-color: {task.project.color};"
              />
            {/if}
          </div>
        </div>
      </div>

      <!-- Right Element: Button -->
      <div class="static-task-card-right">
        <button
          class="task-card-button mode-toggle-button"
          on:click={(event) => switchMode(event, 'multi-line')}
        >
          <ChevronsUpDown ariaLabel="Toggle Task Display Mode" />
        </button>
      </div>
    </div>
  </div>
{:else}
  <!-- mode = multi-line -->
  <div
    class="task-card-major-block"
    role="button"
    tabindex="0"
    title={docPosition.filePath}
    on:click={linkToTask}
    on:keydown={linkToTask}
  >
    <div class="task-card-checkbox-wrapper">
      <input
        type="checkbox"
        class={`task-card-checkbox priority-${task.priority}`}
        checked={task.completed}
        on:click|stopPropagation={handleCheckboxClick}
      />
    </div>
    <div class="task-card-content-project-line">
      <!-- Content -->
      <Content interactive={false} taskItem={task} />
      <!-- Project -->
      <div class="project-wrapper">
        {#if task.hasProject()}
          <div class="task-card-project">
            <a
              href="#{task.project.name}"
              class="tag"
              target="_blank"
              rel="noopener"
            >
              {task.project.name}
            </a>
            <span
              class="project-color clickable-icon"
              style="background-color: {task.project.color};"
            />
          </div>
        {/if}
      </div>
    </div>
    <!-- Description -->
    <div class="task-card-description-wrapper">
      {#if descriptionProgress[1] * descriptionProgress[0] > 0}
        <div class="task-card-progress-position">
          <CircularProgressBar
            value={descriptionProgress[0]}
            max={descriptionProgress[1]}
          />
        </div>
      {/if}
      {#if task.hasDescription()}
        <div class="task-card-description" role="button" tabindex="0">
          {@html taskDescriptionHTML}
        </div>
      {/if}
    </div>
  </div>

  <div class="task-card-attribute-bottom-bar">
    <div class="task-card-attribute-bottom-bar-left">
      <!-- Schedule/Duration/Due -->
      <Schedule
        interactive={false}
        displaySchedule={displaySchedule}
        params={{ mode: 'multi-line' }}
        taskItem={task}
      />
      <Duration
        interactive={false}
        params={{ mode: 'multi-line' }}
        taskItem={task}
        displayDuration={displayDuration}
      />
      <Due
        interactive={false}
        params={{ mode: 'multi-line' }}
        taskItem={task}
        displayDue={displayDue}
      />
      <Recurrence
        interactive={false}
        params={{ mode: 'multi-line' }}
        taskItem={task}
        displayRecurrence={displayRecurrence}
      />
      <!-- Labels -->
      <div class="task-card-labels">
        {#each labelModule.getLabels() as label}
          <div class="label-container">
            <a href={label} class="tag" target="_blank" rel="noopener">
              {label}
            </a>
          </div>
        {/each}
      </div>
    </div>
    <div class="task-card-attribute-bottom-bar-right">
      <button
        class="task-card-button mode-toggle-button"
        on:click={(event) => switchMode(event, 'single-line')}
      >
        <ChevronsDownUp ariaLabel="Toggle Task Display Mode" />
      </button>
    </div>
  </div>
{/if}

<style>
  .task-card-progress-position {
    position: absolute; /* Absolute positioning for the progress bar */
    top: 3px;
    right: 3px;
    /* background: linear-gradient(to right, transparent 0%, var(--background-primary) 30%, var(--background-primary) 100%); */
    background-color: var(--background-primary);
    border-radius: var(--radius-s);
    padding: 2px 5px 2px 5px;
    display: flex;
    align-items: center;
    /* height: 35px; */
  }

  .static-task-card-content {
    padding-left: 0.25em;
    padding-right: 0.25em;
    font-size: var(--font-text-size);
    flex-grow: 1; /* Make it take up all available space */
  }

  .static-task-card-container {
    display: flex;
    align-items: center;
    width: 100%; /* Ensure it takes up all available space */
  }

  .static-task-card-left {
    display: flex; /* Added */
    align-items: center; /* Center align items vertically */
  }

  .static-task-card-middle {
    display: flex;
    flex-direction: row;
    flex-grow: 1;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    border-radius: var(--radius-s);
  }

  .static-task-card-middle:hover {
    background-color: var(--background-modifier-hover);
  }

  /* .task-card-project, .schedule, .sync-logos {
    display: inline-block;
  } */

  .static-task-card-right {
    align-self: flex-end;
    display: flex; /* Added */
    align-items: center; /* Center align items vertically */
    margin-left: 4px;
  }

  .project-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .task-card-project {
    flex-shrink: 0;
    white-space: nowrap;
    display: flex;
    align-items: center;
    font-size: var(--font-ui-small);
  }

  .project-color {
    display: inline-block;
    width: 12px;
    height: 12px;
    padding: 4px;
    border-radius: 50%;
    margin: 4px;
    border: var(--border-width) solid var(--background-primary);
  }

  .task-card-schedule {
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

  .static-task-card-middle-right {
    display: flex;
    align-items: center;
  }

  .single-line-recurrence {
    display: flex;
    align-items: center;
    color: var(--text-muted);
    margin: 0 2px;
  }

  .task-card-checkbox {
    border: var(--border-width) solid;
    border-color: var(--checkbox-border-color);
  }

  /* Apply color to checkbox based on priority */
  .task-card-checkbox.priority-1 {
    border-color: var(--color-red);
  }

  .task-card-checkbox.priority-2 {
    border-color: var(--color-yellow);
  }

  .task-card-checkbox.priority-3 {
    border-color: var(--color-cyan);
  }

  /* Maintain border color on hover */
  .task-card-checkbox.priority-4:hover {
    border-color: var(--checkbox-border-color-hover);
  }

  .task-card-checkbox.priority-1:hover {
    background-color: rgba(var(--color-red-rgb), 0.1);
  }
  .task-card-checkbox.priority-2:hover {
    background-color: rgba(var(--color-yellow-rgb), 0.1);
  }
  .task-card-checkbox.priority-3:hover {
    background-color: rgba(var(--color-cyan-rgb), 0.1);
  }

  input[type='checkbox'].task-card-checkbox.priority-1:checked {
    background-color: rgba(var(--color-red-rgb), 0.7);
  }
  input[type='checkbox'].task-card-checkbox.priority-2:checked {
    background-color: rgba(var(--color-yellow-rgb), 0.7);
  }
  input[type='checkbox'].task-card-checkbox.priority-3:checked {
    background-color: rgba(var(--color-cyan-rgb), 0.7);
  }

  input[type='checkbox'].task-card-checkbox.priority-1:checked:hover {
    background-color: rgba(var(--color-red-rgb), 0.9);
  }
  input[type='checkbox'].task-card-checkbox.priority-2:checked:hover {
    background-color: rgba(var(--color-yellow-rgb), 0.9);
  }
  input[type='checkbox'].task-card-checkbox.priority-3:checked:hover {
    background-color: rgba(var(--color-cyan-rgb), 0.9);
  }

  .task-card-description-wrapper {
    position: relative; /* Relative positioning for the wrapper */
    grid-column: 2;
    grid-row: 2;
    width: 100%;
    height: 100%;
  }

  .task-card-description {
    font-size: var(--font-smallest);
    line-height: var(--line-height-tight);
    color: var(--text-faint);
    border-radius: var(--radius-s);
    border-radius: 5px; /* Rounded square */
    margin: 0.1em; /* Padding for the content */
    padding: 0.22em; /* Padding for the content */
    word-wrap: break-word; /* To break words if too long */
    white-space: normal; /* To auto change lines */
  }

  .task-card-labels {
    display: flex;
    padding: 2px 0;
    flex-wrap: nowrap; /* Prevents wrapping */
    overflow: scroll; /* Truncates any labels that don't fit */
    white-space: nowrap; /* Keeps labels on a single line */
    align-items: center;
    gap: 6px;
    flex-grow: 1; /* Make it take up all available space */
    font-size: var(--font-ui-small);
  }

  .task-card-labels a {
    text-decoration: none;
    flex-shrink: 0;
  }

  /* unified chip metrics (chip-polish, 2026-07-08): native tag colors, same
     height / side padding / text size as the attribute chips */
  .task-card-labels a.tag {
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    height: 21px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: var(--font-ui-smaller);
    line-height: 1;
  }

  .task-card-major-block {
    display: grid;
    grid-template-columns: auto 1fr; /* Checkbox takes only the space it needs, rest for content and description */
    grid-template-rows: auto auto; /* Two rows for content and description */
    width: 100%;
    align-items: center;
    margin: 0 -3px;
    padding: 0 3px;
  }

  .task-card-major-block:hover {
    background-color: var(--background-modifier-hover);
    border-radius: var(--radius-m);
    cursor: pointer;
  }

  button.mode-toggle-button {
    border-radius: var(--radius-m);
  }
</style>

<script lang="ts">
  import { Notice, OpenViewState, Platform, Workspace } from 'obsidian';
  import { createEventDispatcher } from 'svelte';
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
  import LucideIcon from '../components/icons/LucideIcon.svelte';
  import { completeRecurringTaskInFile, stripRecurrenceFromLine } from '../taskModule/recurrence';
  import { hasTaskIdentity } from '../taskModule/fieldSyntax';
  import { countTaskDescriptionLines, parseTaskLine } from '../utils/taskLine';
  import { markdownSourceContext } from '../utils/markdownSourceContext';
  import { truncatedTitle } from './truncatedTitle';
  import { isMarkdownControl, taskMarkdown } from './taskMarkdown';
  import Description from './Description.svelte';
  import QueryProject from './QueryProject.svelte';

  export let taskItem: PositionedObsidianTask;
  export let plugin: TaskCardPlugin;
  export let compact = false;

  const dispatch = createEventDispatcher<{ completionChange: void }>();

  let taskDisplayParams: TaskDisplayParams = { mode: 'single-line' };
  let task = taskItem;
  let docPosition = taskItem.docPosition;
  $: titleMarkdown = {app: plugin?.app, markdown: task.content, sourcePath: docPosition.filePath, inline: true};
  // let scheduleDisplay = '';
  let labelModule = new LabelModule();
  // let descriptionMarkdown = markdownToHTML(task.description);
  let descriptionProgress = DescriptionParser.progressOfDescription(
    task.description
  );

  labelModule.setLabels(task.labels);

  let savingCompletion = false;

  async function handleCheckboxClick(event: MouseEvent) {
    if (savingCompletion) {
      event.preventDefault();
      return;
    }
    savingCompletion = true;
    const previousCompleted = task.completed;
    task.completed = !previousCompleted;
    dispatch('completionChange');
    try {
      await toggleCompleteOfTask(task.completed, taskItem.docPosition);
    } catch {
      task.completed = previousCompleted;
      dispatch('completionChange');
      new Notice(
        'TaskCard: could not safely update this task because its source changed or could not be uniquely located. Refresh the query and try again.'
      );
    } finally {
      savingCompletion = false;
    }
  }

  // The same resolver runs before reading the source and inside vault.process.
  // Saved IDs must remain unique; an unregistered row requires its exact source
  // snapshot at the cached position instead of a task-looking replacement row.
  function resolveTaskLineInFile(fileLines: string[]): number | null {
    const context = markdownSourceContext(fileLines);
    const safeTask = (index: number) => context.taskLines.has(index) &&
      !Array.from({ length: 1 + countTaskDescriptionLines(fileLines, index) }, (_, offset) => index + offset)
        .some(line => context.unsafeRewriteLines.has(line));
    const cachedLine = docPosition.start.line;
    const sourceLine = task.metadata?.sourceMarkdown?.split('\n')[0];
    const id = task.metadata?.sourceBlockId ?? task.id;
    const hasIdentity = (line: string) => hasTaskIdentity(line, id);
    if (sourceLine !== undefined && !hasIdentity(sourceLine)) {
      return safeTask(cachedLine) && parseTaskLine(sourceLine) && fileLines[cachedLine] === sourceLine
        ? cachedLine : null;
    }
    if (!id) return null;
    const matches: number[] = [];
    fileLines.forEach((line, index) => {
      if (context.taskLines.has(index) && hasIdentity(line)) matches.push(index);
    });
    if (matches.length !== 1 || !safeTask(matches[0])) return null;
    return sourceLine === undefined || fileLines[matches[0]] === sourceLine ? matches[0] : null;
  }

  async function resolveTaskLine(docPosition: DocPosition): Promise<number | null> {
    const fileLines = await plugin.fileOperator.getFileLines(docPosition.filePath);
    return fileLines ? resolveTaskLineInFile(fileLines) : null;
  }

  async function toggleCompleteOfTask(
    completed: boolean,
    docPosition: DocPosition
  ) {
    const taskLine = await resolveTaskLine(docPosition);
    if (taskLine === null) throw new Error('Task source could not be uniquely located.');

    // The original completes in place; its rule moves to the next instance.
    if (completed && task.hasRecurrence()) {
      const lines = await plugin.fileOperator.getFileLines(docPosition.filePath);
      const currentLine = lines && resolveTaskLineInFile(lines);
      if (currentLine == null) throw new Error('Recurring source changed.');
      const source = lines.slice(currentLine, currentLine + 1 + countTaskDescriptionLines(lines, currentLine)).join('\n');
      const recurringTask = task.getCopy();
      recurringTask.metadata = { ...task.metadata, sourceMarkdown: task.metadata?.sourceMarkdown ?? source };
      const handled = await completeRecurringTaskInFile(plugin, recurringTask, docPosition.filePath, currentLine);
      if (handled) {
        const sourceLines = recurringTask.metadata.sourceMarkdown.split('\n');
        const parsed = parseTaskLine(sourceLines[0]);
        sourceLines[0] = stripRecurrenceFromLine(sourceLines[0].slice(0, parsed.statusOffset) + 'x' + sourceLines[0].slice(parsed.statusOffset + 1));
        task.recurrence = null;
        rememberSavedSource(sourceLines.join('\n'));
        return;
      }
      // Fall through only when the recurrence rule cannot advance.
    }

    // Get the line from the file
    const line = await plugin.fileOperator.getLineFromFile(
      docPosition.filePath,
      taskLine + 1
    );
    if (line === null) throw new Error('Task source is missing.');

    // Determine the symbol to use based on the 'completed' flag
    const symbol = completed ? 'x' : ' ';

    // Change only the status character, retaining native list/quote syntax.
    const parsedLine = parseTaskLine(line);
    if (!parsedLine) throw new Error('Task source is no longer a task.');
    const updatedLine = line.slice(0, parsedLine.statusOffset) + symbol +
      line.slice(parsedLine.statusOffset + 1);

    await plugin.fileOperator.updateFile(
      docPosition.filePath,
      updatedLine,
      taskLine,
      taskLine + 1,
      undefined,
      {
        source: line,
        resolveSpan(fileLines) {
          const currentLine = resolveTaskLineInFile(fileLines);
          return currentLine === null ? null : [currentLine, currentLine + 1];
        }
      }
    );
    const sourceLines = task.metadata?.sourceMarkdown?.split('\n') ?? [line];
    sourceLines[0] = updatedLine;
    rememberSavedSource(sourceLines.join('\n'));
  }

  function rememberSavedSource(source: string) {
    const lines = source.split('\n');
    const parsed = parseTaskLine(lines[0]);
    task.metadata = {
      ...task.metadata,
      sourceMarkdown: source,
      sourceTaskPrefix: parsed?.prefix,
      sourceTaskStatus: parsed?.status,
      sourceTaskCompleted: parsed ? /^[xX]$/.test(parsed.status) : undefined,
      sourceDescription: task.description,
      sourceDescriptionMarkdown: lines.slice(1).join('\n')
    };
  }

  function switchMode(
    event: MouseEvent | KeyboardEvent | CustomEvent,
    newMode: TaskDisplayMode | null = null
  ) {
    event.stopPropagation();
    taskDisplayParams.mode = newMode;
  }

  function linkToTask(event: MouseEvent | KeyboardEvent) {
    if (isMarkdownControl(event)) return;
    if (event.type === 'keydown') {
      const key = (event as KeyboardEvent).key;
      if (key !== 'Enter' && key !== ' ') return;
      event.preventDefault();
    }
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

  function openProjectSearch(event: CustomEvent<{ name: string }>) {
    const escapedName = event.detail.name
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
    // Same native search used by the project name on editable cards.
    // @ts-ignore Obsidian core Search is an internal API.
    plugin.app.internalPlugins.getPluginById('global-search')
      .instance.openGlobalSearch(`task:"project:: ${escapedName}"`);
  }

  const displaySchedule = task.hasSchedule();
  const displayDuration = task.hasDuration();
  const displayDue = task.hasDue();
  const displayRecurrence = task.hasRecurrence();
  // const displayDescription = task.hasDescription();


</script>

{#if taskDisplayParams.mode === 'single-line'}
  <div class="task-card-single-line">
    {#if compact}
      <div class="static-task-card-container compact-matrix-row">
        <div class="task-card-checkbox-wrapper">
          <input type="checkbox" class={`task-card-checkbox priority-${task.priority}`}
            checked={task.completed} on:click|stopPropagation={handleCheckboxClick} />
        </div>
        <div class="static-task-card-content matrix-title task-card-truncated-title" role="button" tabindex="0"
          use:taskMarkdown={titleMarkdown} use:truncatedTitle={titleMarkdown} on:click={linkToTask} on:keydown={linkToTask}>
        </div>
        <span class="matrix-project">
          {#if task.hasProject()}
            <QueryProject name={task.project.name} color={task.project.color}
              on:projectopen={openProjectSearch} />
          {/if}
        </span>
        <div class="matrix-expand-wrapper">
          <button class="task-card-button matrix-toggle" type="button"
            aria-label={`Expand ${task.content}`} aria-expanded="false"
            on:click={(event) => switchMode(event, 'multi-line')}>
            <LucideIcon width="14" height="14" svgPath={'<path d="m6 9 6 6 6-6"/>'} ariaLabel="Expand task" />
          </button>
        </div>
      </div>
    {:else}
    <div class="static-task-card-container">
      <!-- Left Element: Checkbox -->
      <div class="static-task-card-left task-card-checkbox-wrapper">
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
        on:click={linkToTask}
        on:keydown={linkToTask}
      >
        <div class="static-task-card-content task-card-truncated-title" use:taskMarkdown={titleMarkdown} use:truncatedTitle={titleMarkdown}></div>
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
    {/if}
  </div>
{:else}
  <!-- mode = multi-line -->
  <div
    class="task-card-major-block"
    class:compact-expanded={compact}
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
      <Content interactive={false} taskItem={task} {plugin} sourcePath={docPosition.filePath} />
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
        <Description interactive={false} taskItem={task} {plugin} sourcePath={docPosition.filePath} displayDescription={true} showProgress={false} />
      {/if}
    </div>
  </div>

  <div class="task-card-attribute-bottom-bar" class:compact-expanded={compact}>
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
        type="button"
        aria-label={`Collapse ${task.content}`}
        aria-expanded="true"
        on:click={(event) => switchMode(event, 'single-line')}
      >
        {#if compact}
          <LucideIcon width="14" height="14" svgPath={'<path d="m18 15-6-6-6 6"/>'} ariaLabel="Collapse task" />
        {:else}
          <ChevronsDownUp ariaLabel="Toggle Task Display Mode" />
        {/if}
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
    font-size: var(--font-preferred-size, var(--font-text-size));
    flex-grow: 1; /* Make it take up all available space */
  }

  .static-task-card-container {
    display: flex;
    align-items: center;
    width: 100%; /* Ensure it takes up all available space */
  }

  .static-task-card-container.compact-matrix-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) 10px 21px;
    gap: 6px;
    align-items: start;
  }

  .matrix-title {
    min-width: 0;
    padding: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }

  .matrix-title:hover {
    color: var(--text-accent);
  }

  /* This grid supplies the spacing. Native checkbox margins (Blue Topaz
     adds 2px at the bottom) would shift its center off the title axis. */
  .compact-matrix-row input.task-card-checkbox {
    margin: 0 !important;
  }

  .matrix-project,
  .matrix-expand-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    height: calc(var(--line-height-normal) * var(--font-preferred-size, var(--font-text-size)));
  }

  .compact-matrix-row .matrix-toggle {
    width: 21px;
    height: 21px;
    min-width: 21px;
    min-height: 21px;
    border: none;
    border-radius: 999px;
    color: var(--text-muted);
    background-color: transparent !important;
  }

  .compact-matrix-row .matrix-toggle:hover {
    background-color: var(--background-modifier-hover) !important;
    color: var(--text-normal);
  }

  /* Expanded query cards keep the same title, dot and control columns as
     their compact neighbors. Reserve the 21px control and its 6px gap. */
  .task-card-major-block.compact-expanded {
    grid-template-columns: auto minmax(0, 1fr);
    column-gap: 6px;
    margin: 0;
    padding: 0;
  }

  .compact-expanded input.task-card-checkbox {
    margin: 0 !important;
  }

  .compact-expanded .task-card-content-project-line {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px;
    min-width: 0;
    padding-right: 27px;
    align-items: start;
  }

  .compact-expanded .task-card-content-project-line :global(.task-card-content) {
    min-width: 0;
    padding: 0;
  }

  .compact-expanded .project-wrapper {
    height: calc(var(--line-height-normal) * var(--font-preferred-size, var(--font-text-size)));
  }

  .compact-expanded .task-card-project {
    gap: 6px;
  }

  .compact-expanded .project-color {
    margin: 0;
  }

  .compact-expanded .task-card-attribute-bottom-bar-right {
    margin-right: 0;
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
    /* a solid dot (issue #11): fixed size so a tight flex row can't squash
       it into an oval, and no resting border, which showed as a dark ring
       wherever the card surface isn't --background-primary. 10px + 5px
       margin keeps the old 20px footprint. */
    display: inline-block;
    flex: none;
    width: 10px;
    height: 10px;
    aspect-ratio: 1;
    padding: 0;
    margin: 5px;
    border: none;
    border-radius: 50%;
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
    padding: 0;
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

  /* single-line toggle only; the expanded footer's toggle is styled in styles.css */
  .task-card-single-line button.mode-toggle-button {
    border-radius: var(--radius-m);
  }
</style>

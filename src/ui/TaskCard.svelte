<script lang="ts">
    import Schedule from './Schedule.svelte';
    import Project from "./Project.svelte";
    import Labels from "./Labels.svelte";
    import { TaskDisplayParams, TaskDisplayMode } from "../renderer/postProcessor";
    import Description from './Description.svelte';
    import { createEventDispatcher } from 'svelte';
    import TaskCardPlugin from '../index';
    import { ObsidianTask } from '../taskModule/task';
    import { ObsidianTaskSyncManager } from '../taskModule/taskSyncManager';
    import Content from './Content.svelte';
    // import { ChevronsDownUp } from 'lucide-svelte'; // BUG: somehow doesn't work
    import ChevronsDownUp from '../components/icons/ChevronsDownUp.svelte';
    import MoreVertical from '../components/icons/MoreVertical.svelte';
    import { Menu } from 'obsidian';
    import { DescriptionParser } from '../taskModule/description';
    import Duration from './Duration.svelte';
    import Due from './Due.svelte';
    import Recurrence from './Recurrence.svelte';
    import Repeat from '../components/icons/Repeat.svelte';
    import AddAttributePopover from './AddAttributePopover.svelte';

    export let taskSyncManager: ObsidianTaskSyncManager;
    export let plugin: TaskCardPlugin;
    export let params: TaskDisplayParams;

    let task: ObsidianTask = taskSyncManager.obsidianTask;
    let descriptionProgress = DescriptionParser.progressOfDescription(task.description);

    const dispatch = createEventDispatcher();

    function switchMode(event: MouseEvent | KeyboardEvent | CustomEvent, newMode: TaskDisplayMode | null = null) {
      event.stopPropagation();
      // logger.debug(`Switching mode to ${newMode}`);
      dispatch('switchMode', { mode: newMode });
      for (let key in taskSyncManager.taskCardStatus) {
        taskSyncManager.taskCardStatus[key] = 'done';
      }
      refreshView();
    }

    function refreshView() {
      task = task;
    }

    async function updateTaskAttribute(key: string, value: any) {
      await taskSyncManager.updateObsidianTaskAttribute(key, value);
      task = taskSyncManager.obsidianTask;
    }

    function startInlineAttributeEdit(attribute: string) {
      if (attribute === 'scheduled') {
        taskSyncManager.taskCardStatus.scheduleStatus = 'editing';
        displaySchedule = true;
      } else if (attribute === 'due') {
        taskSyncManager.taskCardStatus.dueStatus = 'editing';
        displayDue = true;
      } else if (attribute === 'repeat') {
        taskSyncManager.taskCardStatus.recurrenceStatus = 'editing';
        displayRecurrence = true;
      } else if (attribute === 'duration') {
        taskSyncManager.taskCardStatus.durationStatus = 'editing';
        displayDuration = true;
      } else if (attribute === 'description') {
        taskSyncManager.taskCardStatus.descriptionStatus = 'editing';
        displayDescription = true;
      }
      refreshView();
    }

    let addLabelSignal = 0;

    function openAddLabelInput() {
      addLabelSignal += 1;
      refreshView();
    }

    function openProjectPicker() {
      taskSyncManager.taskCardStatus.projectStatus = 'selecting';
      refreshView();
    }

    function handleCheckboxClick() {
      // don't pre-mutate the shared task object: the sync manager diffs the
      // task against its pre-edit copy (external sync) and the recurring-
      // completion path needs the not-yet-completed state
      void updateTaskAttribute('completed', !task.completed);
    }

    function showPriorityMenu(event) {
      event.preventDefault();
      const priorityMenu = new Menu();
      priorityMenu.addItem((item) => {
          item.setTitle('1. High');
          item.setIcon('star');
          item.onClick((evt: MouseEvent | KeyboardEvent) => {
            void updateTaskAttribute('priority', 1);
          })
      })
      priorityMenu.addItem((item) => {
          item.setTitle('2. Medium');
          item.setIcon('star');
          item.onClick((evt: MouseEvent | KeyboardEvent) => {
            void updateTaskAttribute('priority', 2);
          })
      })
      priorityMenu.addItem((item) => {
          item.setTitle('3. Low');
          item.setIcon('star');
          item.onClick((evt: MouseEvent | KeyboardEvent) => {
            void updateTaskAttribute('priority', 3);
          })
      })
      priorityMenu.addItem((item) => {
          item.setTitle('4. Basic');
          item.setIcon('star');
          item.onClick((evt: MouseEvent | KeyboardEvent) => {
            void updateTaskAttribute('priority', 4);
          })
      })

      priorityMenu.showAtPosition({ x: event.clientX, y: event.clientY });

    }

    function showCardMenu(event) {
      event.preventDefault();
      const cardMenu = new Menu();

      // Group 0: Toggle single-line and multi-line mode
      cardMenu.addItem((item) => {
          item.setTitle('Switch to Preview Mode');
          item.setIcon('list');
          item.onClick((evt: MouseEvent | KeyboardEvent) => {
            switchMode(evt, 'single-line');
          });
        });

      // Separator
      cardMenu.addSeparator();

      // Group 1: Task Description and Schedule Date and Duration
      if (taskSyncManager.obsidianTask.hasDescription()) {
        cardMenu.addItem((item) => {
          item.setTitle('Delete Description');
          item.setIcon('trash');
          item.onClick((evt) => {
            displayDescription = false;
            void updateTaskAttribute('description', '');
          });
        });
      }

      if (taskSyncManager.obsidianTask.hasSchedule()) {
        cardMenu.addItem((item) => {
          item.setTitle('Delete Schedule');
          item.setIcon('trash');
          item.onClick((evt) => {
            displaySchedule = false;
            void updateTaskAttribute('schedule', null);
          });
        });
      }

      if (taskSyncManager.obsidianTask.hasDue()) {
        cardMenu.addItem((item) => {
          item.setTitle('Delete Due');
          item.setIcon('trash');
          item.onClick((evt) => {
            displayDue = false;
            void updateTaskAttribute('due', null);
          });
        });
      }

      if (taskSyncManager.obsidianTask.hasRecurrence()) {
        cardMenu.addItem((item) => {
          item.setTitle('Delete Recurrence');
          item.setIcon('trash');
          item.onClick((evt) => {
            displayRecurrence = false;
            void updateTaskAttribute('recurrence', null);
          });
        });
      }

      if (taskSyncManager.obsidianTask.hasDuration()) {
        cardMenu.addItem((item) => {
          item.setTitle('Delete Duration');
          item.setIcon('trash');
          item.onClick((evt) => {
            displayDuration = false;
            void updateTaskAttribute('duration', null);
          });
        });
      }

      // Separator
      cardMenu.addSeparator();

      // Group 2: Labels and Projects
      if (taskSyncManager.obsidianTask.hasAnyLabels()) {
        cardMenu.addItem((item) => {
          item.setTitle('Remove All Labels');
          item.setIcon('trash');
          item.onClick((evt) => {
            void updateTaskAttribute('labels', []);
          });
        });
      }

      if (taskSyncManager.obsidianTask.hasProject()) {
        cardMenu.addItem((item) => {
          item.setTitle('Remove Project');
          item.setIcon('trash');
          item.onClick((evt) => {
            void updateTaskAttribute('project', null);
          });
        });
      }

      // Separator
      cardMenu.addSeparator();

      // Group 3: Delete Task
      cardMenu.addItem((item) => {
        item.setTitle('Delete Task');
        item.setIcon('trash');
        item.onClick((evt) => {
          taskSyncManager.deleteTask();
        });
      });

      cardMenu.showAtPosition({ x: event.clientX, y: event.clientY });
    }

    let displaySchedule: boolean = taskSyncManager.obsidianTask.hasSchedule() || taskSyncManager.getTaskCardStatus('scheduleStatus') === 'editing';
    let displayDuration: boolean = taskSyncManager.obsidianTask.hasDuration() || taskSyncManager.getTaskCardStatus('durationStatus') === 'editing';
    let displayDue: boolean = taskSyncManager.obsidianTask.hasDue() || taskSyncManager.getTaskCardStatus('dueStatus') === 'editing';
    let displayRecurrence: boolean = taskSyncManager.obsidianTask.hasRecurrence() || taskSyncManager.getTaskCardStatus('recurrenceStatus') === 'editing';
    let displayDescription: boolean = taskSyncManager.obsidianTask.hasDescription() || taskSyncManager.getTaskCardStatus('descriptionStatus') === 'editing'

    $: descriptionProgress = DescriptionParser.progressOfDescription(task.description);

</script>


{#if params.mode === "single-line"}
  <div class="task-card-single-line">
    <div class="task-card-single-line-left-container">
      <input 
        type="checkbox" 
        class={`task-card-checkbox task-list-item-checkbox priority-${task.priority}`} 
        checked={task.completed} 
        on:click|stopPropagation={handleCheckboxClick}
      />
      <div class="task-card-content">{task.content}</div>
    </div>
    <div class="task-card-single-line-right-container">
      {#if descriptionProgress[1] > 0 && !task.completed }
        <span class="single-line-progress">{descriptionProgress[0]}/{descriptionProgress[1]}</span>
      {/if}
      {#if task.recurrence}
        <span class="single-line-recurrence" title={task.recurrence}>
          <Repeat width={"13"} height={"13"} ariaLabel="Recurring task"/>
        </span>
      {/if}
      <Schedule taskSyncManager={taskSyncManager} plugin={plugin} params={params} displaySchedule={displaySchedule} />
      <Project taskSyncManager={taskSyncManager} params={params} />
    </div>
  </div>
{:else}
<!-- mode = multi-line -->
  <div class="task-card-major-block">
    <div class="task-card-checkbox-wrapper">
      <input 
      type="checkbox" 
      class={`task-card-checkbox task-list-item-checkbox priority-${task.priority}`} 
      checked={task.completed} 
      on:click|stopPropagation={handleCheckboxClick}
      on:contextmenu={showPriorityMenu}
      />
    </div>
    <div class="task-card-content-project-line">
      <Content taskSyncManager={taskSyncManager} />
      <Project taskSyncManager={taskSyncManager} params={params} />
    </div>
    <Description taskSyncManager={taskSyncManager} displayDescription={displayDescription} />
    <button class="task-card-menu-button mode-multi-line" on:click={(event) => showCardMenu(event)} tabindex="0">
      <MoreVertical width={"18"} height={"18"} ariaLabel="Show Menu"/>
    </button>
  </div>

  <div class="task-card-attribute-bottom-bar">
    <div class="task-card-attribute-bottom-bar-left">
      <Schedule taskSyncManager={taskSyncManager} plugin={plugin} params={params} displaySchedule={displaySchedule} />
      <Duration taskSyncManager={taskSyncManager} params={params} displayDuration={displayDuration} />
      <Due taskSyncManager={taskSyncManager} plugin={plugin} params={params} displayDue={displayDue} />
      <Recurrence taskSyncManager={taskSyncManager} plugin={plugin} params={params} displayRecurrence={displayRecurrence} />
      <Labels
        taskSyncManager={taskSyncManager}
        showAddButton={false}
        {addLabelSignal}
        {plugin}
        enableSuggestions={true}
      />
      <AddAttributePopover
        task={task}
        onStartEditing={startInlineAttributeEdit}
        onSetPriority={(priority) => void updateTaskAttribute('priority', priority)}
        onOpenProjectPicker={openProjectPicker}
        onAddLabel={openAddLabelInput}
      />
    </div>
    <div class="task-card-attribute-bottom-bar-right">
      <button class="task-card-button mode-toggle-button" on:click={(event) => switchMode(event, 'single-line')}>
        <ChevronsDownUp ariaLabel="Toggle Task Display Mode"/>
      </button>
    </div>
  </div>
{/if}

<style>

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
  .task-card-checkbox.priority-1:hover {
    background-color: rgba(var(--color-red-rgb), 0.1);
  }
  .task-card-checkbox.priority-2:hover {
    background-color: rgba(var(--color-yellow-rgb), 0.1);
  }
  .task-card-checkbox.priority-3:hover {
    background-color: rgba(var(--color-cyan-rgb), 0.1);
  }

  input[type=checkbox].task-card-checkbox.priority-1:checked {
    background-color: rgba(var(--color-red-rgb), 0.7);
  }
  input[type=checkbox].task-card-checkbox.priority-2:checked {
    background-color: rgba(var(--color-yellow-rgb), 0.7);
  }
  input[type=checkbox].task-card-checkbox.priority-3:checked {
    background-color: rgba(var(--color-cyan-rgb), 0.7);
  }

  input[type=checkbox].task-card-checkbox.priority-1:checked:hover {
    background-color: rgba(var(--color-red-rgb), 0.9);
  }
  input[type=checkbox].task-card-checkbox.priority-2:checked:hover {
    background-color: rgba(var(--color-yellow-rgb), 0.9);
  }
  input[type=checkbox].task-card-checkbox.priority-3:checked:hover {
    background-color: rgba(var(--color-cyan-rgb), 0.9);
  }

  .single-line-recurrence {
    display: flex;
    align-items: center;
    color: var(--text-muted);
  }

  .single-line-progress {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    white-space: nowrap;
  }

  .task-card-menu-button {
    background: none !important;
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
    cursor: pointer;
    padding: 0 !important;
    /* -5px = (box - icon) / 2: overhang so the icon box, not the hitbox,
       aligns flush with the card's content edge (matches the bottom-bar
       toggle button's overhang in styles.css) */
    margin: 0 -5px 0 0 !important;
  }

  .task-card-menu-button:hover {
    background: none !important;
    box-shadow: none !important;
    color: var(--text-accent);
  }

  button.mode-toggle-button {
    border-radius: var(--radius-m);
  }

  .task-card-major-block {
    display: grid;
    grid-template-columns: auto 1fr; /* Checkbox takes only the space it needs, rest for content and description */
    grid-template-rows: auto auto; /* Two rows for content and description */
    width: 100%;
    /* start, not center: row-1 items (checkbox, menu button) are pinned to
       the first text line so the content never drifts down the row */
    align-items: start;
  }

</style>

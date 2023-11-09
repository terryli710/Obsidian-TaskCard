<script lang="ts">
    import Schedule from './Schedule.svelte';
    import Project from "./Project.svelte";
    import Labels from "./Labels.svelte";
    import { TaskDisplayParams, TaskDisplayMode } from "../renderer/postProcessor";
    import Description from './Description.svelte';
    import { logger } from '../utils/log';
    import { createEventDispatcher } from 'svelte';
    import TaskCardPlugin from '../index';
    import { ObsidianTask } from '../taskModule/task';
    import { ObsidianTaskSyncManager } from '../taskModule/taskSyncManager';
    import Content from './Content.svelte';
    // import { ChevronsDownUp } from 'lucide-svelte'; // BUG: somehow doesn't work
    import ChevronsDownUp from '../components/icons/ChevronsDownUp.svelte';
    import MoreVertical from '../components/icons/MoreVertical.svelte';
    import { Menu, Notice } from 'obsidian';
    import { SettingStore } from '../settings';
    import { DescriptionParser } from '../taskModule/description';
    import CircularProgressBar from '../components/CircularProgressBar.svelte';
    import Duration from './Duration.svelte';
    import SyncLogos from './SyncLogos.svelte';
    import Due from './Due.svelte';

    export let taskSyncManager: ObsidianTaskSyncManager;
    export let plugin: TaskCardPlugin;
    export let params: TaskDisplayParams;

    let task: ObsidianTask = taskSyncManager.obsidianTask;
    let descriptionProgress = DescriptionParser.progressOfDescription(taskSyncManager.obsidianTask.description);

    const dispatch = createEventDispatcher();

    function switchMode(event: MouseEvent | KeyboardEvent | CustomEvent, newMode: TaskDisplayMode | null = null) {
      event.stopPropagation();
      // logger.debug(`Switching mode to ${newMode}`);
      dispatch('switchMode', { mode: newMode });
      for (let key in taskSyncManager.taskCardStatus) {
        taskSyncManager.taskCardStatus[key] = 'done';
      }
    }

    function handleCheckboxClick() {
      task.completed = !task.completed;
      taskSyncManager.updateObsidianTaskAttribute('completed', task.completed);
    }

    function showPriorityMenu(event) {
      event.preventDefault();
      const priorityMenu = new Menu();
      priorityMenu.addItem((item) => {
          item.setTitle('1. High');
          item.setIcon('star');
          item.onClick((evt: MouseEvent | KeyboardEvent) => {
            taskSyncManager.updateObsidianTaskAttribute('priority', 1);
          })
      })
      priorityMenu.addItem((item) => {
          item.setTitle('2. Medium');
          item.setIcon('star');
          item.onClick((evt: MouseEvent | KeyboardEvent) => {
            taskSyncManager.updateObsidianTaskAttribute('priority', 2);
          })
      })
      priorityMenu.addItem((item) => {
          item.setTitle('3. Low');
          item.setIcon('star');
          item.onClick((evt: MouseEvent | KeyboardEvent) => {
            taskSyncManager.updateObsidianTaskAttribute('priority', 3);
          })
      })
      priorityMenu.addItem((item) => {
          item.setTitle('4. Basic');
          item.setIcon('star');
          item.onClick((evt: MouseEvent | KeyboardEvent) => {
            taskSyncManager.updateObsidianTaskAttribute('priority', 4);
          })
      })

      priorityMenu.showAtPosition({ x: event.clientX, y: event.clientY });

    }

    let projects: Project[];
    SettingStore.subscribe((settings) => {
        projects = settings.userMetadata.projects;
    })

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
      if (!taskSyncManager.obsidianTask.hasDescription()) {
        cardMenu.addItem((item) => {
          item.setTitle('Add Description');
          item.setIcon('plus');
          item.onClick((evt) => {
            taskSyncManager.taskCardStatus.descriptionStatus = 'editing';
          });
        });
      } else {
        cardMenu.addItem((item) => {
          item.setTitle('Delete Description');
          item.setIcon('trash');
          item.onClick((evt) => {
            taskSyncManager.updateObsidianTaskAttribute('description', '');
          });
        });
      }

      if (!taskSyncManager.obsidianTask.hasSchedule()) {
        cardMenu.addItem((item) => {
          item.setTitle('Add Schedule');
          item.setIcon('plus');
          item.onClick((evt) => {
            taskSyncManager.taskCardStatus.scheduleStatus = 'editing';
            displaySchedule = taskSyncManager.obsidianTask.hasSchedule() || taskSyncManager.getTaskCardStatus('scheduleStatus') === 'editing';
          });
        });
      } else {
        cardMenu.addItem((item) => {
          item.setTitle('Delete Schedule');
          item.setIcon('trash');
          item.onClick((evt) => {
            taskSyncManager.updateObsidianTaskAttribute('schedule', null);
          });
        });
      }

      if (!taskSyncManager.obsidianTask.hasDue()) {
        cardMenu.addItem((item) => {
          item.setTitle('Add Due');
          item.setIcon('plus');
          item.onClick((evt) => {
            taskSyncManager.taskCardStatus.dueStatus = 'editing';
            displayDue = taskSyncManager.obsidianTask.hasDue() || taskSyncManager.getTaskCardStatus('dueStatus') === 'editing';
          });
        });
      } else {
        cardMenu.addItem((item) => {
          item.setTitle('Delete Schedule');
          item.setIcon('trash');
          item.onClick((evt) => {
            taskSyncManager.updateObsidianTaskAttribute('schedule', null);
          });
        });
      }

      if (!taskSyncManager.obsidianTask.hasDuration()) {
        cardMenu.addItem((item) => {
          item.setTitle('Add Duration');
          item.setIcon('plus');
          item.onClick((evt) => {
            taskSyncManager.taskCardStatus.durationStatus = 'editing';
            displayDuration = taskSyncManager.obsidianTask.hasSchedule() || taskSyncManager.getTaskCardStatus('scheduleStatus') === 'editing';
          });
        });
      } else {
        cardMenu.addItem((item) => {
          item.setTitle('Delete Duration');
          item.setIcon('trash');
          item.onClick((evt) => {
            taskSyncManager.updateObsidianTaskAttribute('duration', null);
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
            taskSyncManager.updateObsidianTaskAttribute('labels', []);
          });
        });
      }

      if (taskSyncManager.obsidianTask.hasProject()) {
        cardMenu.addItem((item) => {
          item.setTitle('Remove Project');
          item.setIcon('trash');
          item.onClick((evt) => {
            taskSyncManager.updateObsidianTaskAttribute('project', null);
          });
        });
      } else {
        cardMenu.addItem((item) => {
          item.setTitle('Assign Project');
          item.setIcon('plus');
          item.onClick((evt) => {
            taskSyncManager.taskCardStatus.projectStatus = 'selecting';
            if (projects.length === 0) {
              logger.warn('No projects available');
              new Notice(`[TaskCard] No projects available. Add one in Settings Tab.`);
            }
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

</script>


{#if params.mode === "single-line"}
  <div class="task-card-single-line">
    <div class="task-card-single-line-left-container">
      <input 
        type="checkbox" 
        class={`task-card-checkbox priority-${task.priority}`} 
        checked={task.completed} 
        on:click|stopPropagation={handleCheckboxClick}
      />
      <div class="task-card-content">{task.content}</div>
    </div>
    <div class="task-card-single-line-right-container">
      <SyncLogos taskSyncManager={taskSyncManager} />
      {#if descriptionProgress[1] * descriptionProgress[0] > 0 && !task.completed }
        <CircularProgressBar value={descriptionProgress[0]} max={descriptionProgress[1]} showDigits={false} />
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
      class={`task-card-checkbox priority-${task.priority}`} 
      checked={task.completed} 
      on:click|stopPropagation={handleCheckboxClick}
      on:contextmenu={showPriorityMenu}
      />
    </div>
    <div class="task-card-content-project-line">
      <Content taskSyncManager={taskSyncManager} />
      <SyncLogos taskSyncManager={taskSyncManager} />
      <Project taskSyncManager={taskSyncManager} params={params} />
    </div>
    {#if taskSyncManager.obsidianTask.hasDescription() || taskSyncManager.getTaskCardStatus('descriptionStatus') === 'editing'}
      <Description taskSyncManager={taskSyncManager} />
    {/if}
    <button class="task-card-menu-button mode-multi-line" on:click={(event) => showCardMenu(event)} tabindex="0">
      <MoreVertical ariaLabel="Show Menu"/>
    </button>
  </div>

  <div class="task-card-attribute-bottom-bar">
    <div class="task-card-attribute-bottom-bar-left">
      <Due taskSyncManager={taskSyncManager} plugin={plugin} params={params} displayDue={displayDuration} />
      <Schedule taskSyncManager={taskSyncManager} plugin={plugin} params={params} displaySchedule={displaySchedule} />
      <Duration taskSyncManager={taskSyncManager} params={params} displayDuration={displayDuration} />
      {#if displaySchedule || displayDuration}
        <div class="task-card-attribute-separator"></div>
      {/if}
      <Labels taskSyncManager={taskSyncManager} />
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

  .task-card-menu-button {
    background: none !important;
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
    cursor: pointer;
    padding: 0 0.25em !important;
    margin: 0 0.15em !important;
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
    align-items: center;
  }

</style>
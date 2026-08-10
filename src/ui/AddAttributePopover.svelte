<script lang="ts">
  import { Notice } from 'obsidian';
  import CalendarClock from 'lucide-svelte/dist/svelte/icons/calendar-clock.svelte';
  import CalendarX from 'lucide-svelte/dist/svelte/icons/calendar-x.svelte';
  import Flag from 'lucide-svelte/dist/svelte/icons/flag.svelte';
  import Folder from 'lucide-svelte/dist/svelte/icons/folder.svelte';
  import Hourglass from 'lucide-svelte/dist/svelte/icons/hourglass.svelte';
  import Plus from 'lucide-svelte/dist/svelte/icons/plus.svelte';
  import Repeat from 'lucide-svelte/dist/svelte/icons/repeat.svelte';
  import Tag from 'lucide-svelte/dist/svelte/icons/tag.svelte';
  import Text from 'lucide-svelte/dist/svelte/icons/text.svelte';
  import { SettingStore } from '../settings';
  import type { ObsidianTask, Priority } from '../taskModule/task';

  export let task: ObsidianTask;
  export let onStartEditing: (attribute: string) => void;
  export let onSetPriority: (priority: Priority) => void;
  export let onOpenProjectPicker: () => void;
  export let onAddLabel: () => void;

  type AddableAttribute =
    | 'due'
    | 'scheduled'
    | 'repeat'
    | 'duration'
    | 'priority'
    | 'project'
    | 'label'
    | 'description';
  type Submenu = 'priority' | null;

  const ATTRIBUTE_LABELS: Record<AddableAttribute, string> = {
    due: 'Due',
    scheduled: 'Scheduled',
    repeat: 'Repeat',
    duration: 'Duration',
    priority: 'Priority',
    project: 'Project',
    label: 'Label',
    description: 'Description'
  };

  const ATTRIBUTE_ICONS = {
    due: CalendarX,
    scheduled: CalendarClock,
    repeat: Repeat,
    duration: Hourglass,
    priority: Flag,
    project: Folder,
    label: Tag,
    description: Text
  };

  const PRIORITY_OPTIONS: Array<{
    value: Priority;
    label: string;
    color: string;
  }> = [
    // spec scale (docs/format-spec.md): 1↔highest, 2↔high, 3↔medium, 4↔low/default
    { value: 1, label: 'Highest', color: 'var(--color-red)' },
    { value: 2, label: 'High', color: 'var(--color-yellow)' },
    { value: 3, label: 'Medium', color: 'var(--color-blue)' },
    { value: 4, label: 'Low', color: 'var(--text-muted)' }
  ];

  let open = false;
  let expandedSubmenu: Submenu = null;

  $: availableProjects = $SettingStore.userMetadata.projects ?? [];
  $: missingAttributes = computeMissingAttributes(task);

  function computeMissingAttributes(currentTask: ObsidianTask): AddableAttribute[] {
    return [
      !currentTask.hasDue() ? 'due' : null,
      !currentTask.hasSchedule() ? 'scheduled' : null,
      !currentTask.hasRecurrence() ? 'repeat' : null,
      !currentTask.hasDuration() ? 'duration' : null,
      currentTask.priority === 4 ? 'priority' : null,
      !currentTask.hasProject() ? 'project' : null,
      !currentTask.hasAnyLabels() ? 'label' : null,
      !currentTask.hasDescription() ? 'description' : null
    ].filter(Boolean) as AddableAttribute[];
  }

  function closePopover() {
    open = false;
    expandedSubmenu = null;
  }

  function togglePopover(event: MouseEvent) {
    event.stopPropagation();
    open = !open;
    if (!open) {
      expandedSubmenu = null;
    }
  }

  function dismissOnOutsideInteraction(node: HTMLElement) {
    const onDocumentMousedown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && node.contains(target)) {
        return;
      }
      closePopover();
    };
    const onDocumentKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePopover();
      }
    };
    document.addEventListener('mousedown', onDocumentMousedown, true);
    document.addEventListener('keydown', onDocumentKeydown, true);
    return {
      destroy() {
        document.removeEventListener('mousedown', onDocumentMousedown, true);
        document.removeEventListener('keydown', onDocumentKeydown, true);
      }
    };
  }

  function handleAttributeSelection(attribute: AddableAttribute) {
    if (attribute === 'priority') {
      expandedSubmenu = expandedSubmenu === 'priority' ? null : 'priority';
      return;
    }
    if (attribute === 'project') {
      if (availableProjects.length === 0) {
        new Notice('[TaskCard] No projects available. Add one in Settings Tab.');
        closePopover();
        return;
      }
      onOpenProjectPicker();
      closePopover();
      return;
    }
    if (attribute === 'label') {
      onAddLabel();
      closePopover();
      return;
    }
    onStartEditing(attribute);
    closePopover();
  }

  function choosePriority(priority: Priority) {
    onSetPriority(priority);
    closePopover();
  }
</script>

<div class="task-card-add-attribute">
  <button
    class="task-card-button task-card-plus-button task-card-add-attribute-button"
    aria-expanded={open}
    aria-label="Add attribute"
    on:click={togglePopover}
    type="button"
  >
    <Plus size={13} />
  </button>

  {#if open}
    <div
      class="task-card-add-attribute-popover"
      data-testid="add-attribute-popover"
      use:dismissOnOutsideInteraction
    >
      {#each missingAttributes as attribute (attribute)}
        <div class="task-card-add-attribute-item">
          <button
            class="task-card-add-attribute-row"
            on:click={() => handleAttributeSelection(attribute)}
            type="button"
          >
            <svelte:component
              this={ATTRIBUTE_ICONS[attribute]}
              class="task-card-add-attribute-icon"
              size={13}
            />
            <span>{ATTRIBUTE_LABELS[attribute]}</span>
          </button>

          {#if attribute === 'priority' && expandedSubmenu === 'priority'}
            <div class="task-card-add-attribute-submenu">
              {#each PRIORITY_OPTIONS as option (option.value)}
                <button
                  class="task-card-add-attribute-submenu-row"
                  on:click={() => choosePriority(option.value)}
                  type="button"
                >
                  <Flag color={option.color} size={13} />
                  <span>{option.label}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

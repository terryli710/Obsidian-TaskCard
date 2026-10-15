<script lang="ts">
    import type { PositionedObsidianTask } from '../taskModule/task';
    import StaticTaskItem from './StaticTaskItem.svelte';
    import type TaskCardPlugin from '..';
    import { organizeTaskList } from '../query/listPresentation';
    import type { ListPresentation } from '../query/listPresentation';

    export let taskList: PositionedObsidianTask[];
    export let plugin: TaskCardPlugin;
    export let presentation: Partial<ListPresentation> = {};

    $: groups = organizeTaskList(taskList, presentation);
</script>

<div class="static-task-list">
    {#each groups as group (group.key)}
        <section class="task-group">
            {#if group.label}
                <h4 class="group-heading"><span class="group-label">{group.label}</span><span class="group-count" title="Tasks in this category">{group.tasks.length}</span></h4>
            {/if}
            <ul class="task-rows contain-task-list has-list-bullet">
                {#each group.tasks as taskItem (taskItem.id)}
                    <StaticTaskItem {taskItem} {plugin} compact={true} on:completionChange />
                {/each}
            </ul>
        </section>
    {/each}
</div>

<style>
    .static-task-list,.task-group { min-width:0; }
    .task-group { margin:0; padding:0; border:0; }
    .task-group + .task-group { margin-top:18px; }
    .group-heading { display:flex; align-items:baseline; gap:8px; padding:0 2px 5px; margin:0!important; min-width:0; font-size:var(--font-ui-small); font-weight:600; color:var(--text-muted); line-height:1.4; }
    .group-label { overflow-wrap:anywhere; min-width:0; }
    .group-count { margin-left:auto; flex-shrink:0; font-size:var(--font-ui-smaller); font-variant-numeric:tabular-nums; font-weight:400; color:var(--text-faint); }
    .task-rows { list-style:none!important; padding:0!important; margin:0!important; min-width:0; }
    .task-rows > :global(li.obsidian-taskcard + li.obsidian-taskcard) { margin-top:0; border-top:1px solid var(--background-modifier-border); }
</style>

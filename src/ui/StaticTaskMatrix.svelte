<script lang="ts">
    import { PositionedObsidianTask } from "../taskModule/task";
    import StaticTaskItem from './StaticTaskItem.svelte';
    import TaskCardPlugin from "..";

    export let taskList: PositionedObsidianTask[];
    export let plugin: TaskCardPlugin;

    let counts = {
        do: { count: 0, completedTasks: 0 },
        plan: { count: 0, completedTasks: 0 },
        delegate: { count: 0, completedTasks: 0 },
        delete: { count: 0, completedTasks: 0 }
    };

    $: if(taskList) {
        // Reset counts object to start fresh on each reactive update
        counts = {
            do: { count: 0, completedTasks: 0 },
            plan: { count: 0, completedTasks: 0 },
            delegate: { count: 0, completedTasks: 0 },
            delete: { count: 0, completedTasks: 0 }
        };

        counts = taskList.reduce((acc, task) => {
            const category = categorizeTasks(task);
            acc[category].count += 1;
            if (task.completed) {
                acc[category].completedTasks += 1;
            }
            return acc;
        }, counts);
    }

    function categorizeTasks(task: PositionedObsidianTask): string {
        // spec scale (docs/format-spec.md): 1=highest, 2=high, 3=medium, 4=low/default
        const important = (task.priority ?? 4) <= 2;
        if (important && task.due) {
            return "do"; // important-urgent
        } else if (important && !task.due) {
            return "plan"; // important-not-urgent
        } else if (!important && task.due) {
            return "delegate"; // not-important-urgent
        } else {
            return "delete"; // not-important-not-urgent
        }
    }
</script>

<div class="static-task-matrix">
    <div class="matrix-container">
        <div class="category do">
            <div class="category-head">
                <div class="category-title">Do</div>
                <div class="category-count">{counts.do.completedTasks}/{counts.do.count}</div>
            </div>
            <div class="task-list">
                <ul class="contain-task-list has-list-bullet">
                {#each taskList as taskItem}
                    {#if categorizeTasks(taskItem) === "do"}
                    <StaticTaskItem {taskItem} {plugin} />
                    {/if}
                {/each}
                </ul>
            </div>
        </div>
        <div class="category plan">
            <div class="category-head">
                <div class="category-title">Plan</div>
                <div class="category-count">{counts.plan.completedTasks}/{counts.plan.count}</div>
            </div>
            <div class="task-list">
                <ul class="contain-task-list has-list-bullet">
                {#each taskList as taskItem}
                    {#if categorizeTasks(taskItem) === "plan"}
                    <StaticTaskItem {taskItem} {plugin} />
                    {/if}
                {/each}
                </ul>
            </div>
        </div>
        <div class="category delegate">
            <div class="category-head">
                <div class="category-title">Delegate</div>
                <div class="category-count">{counts.delegate.completedTasks}/{counts.delegate.count}</div>
            </div>
            <div class="task-list">
                <ul class="contain-task-list has-list-bullet">
                {#each taskList as taskItem}
                    {#if categorizeTasks(taskItem) === "delegate"}
                    <StaticTaskItem {taskItem} {plugin} />
                    {/if}
                {/each}
                </ul>
            </div>
        </div>
        <div class="category delete">
            <div class="category-head">
                <div class="category-title">Delete</div>
                <div class="category-count">{counts.delete.completedTasks}/{counts.delete.count}</div>
            </div>
            <div class="task-list">
                <ul class="contain-task-list has-list-bullet">
                {#each taskList as taskItem}
                    {#if categorizeTasks(taskItem) === "delete"}
                    <StaticTaskItem {taskItem} {plugin} />
                    {/if}
                {/each}
                </ul>
            </div>
        </div>
    </div>
</div>


<style>

    *, *::before, *::after {
        box-sizing: border-box;
    }

    .matrix-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0;
        max-width: 100%;
        overflow-x: hidden;
    }

    .category {
        min-width: 0;
        padding: 8px 10px;
        background: none;
        border: none;
        border-radius: 0;
    }

    .category.do,
    .category.plan {
        border-bottom: 1px solid var(--background-modifier-border);
    }

    .category.do,
    .category.delegate {
        border-right: 1px solid var(--background-modifier-border);
    }

    .category-head {
        display: flex;
        align-items: baseline;
        padding: 0 2px 4px;
    }

    .category-title {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
    }

    .category-count {
        margin-left: auto;
        color: var(--text-faint);
        font-size: var(--font-ui-smaller);
        font-variant-numeric: tabular-nums;
    }

    .category.do .category-title {
        color: var(--color-red);
    }

    .category.plan .category-title {
        color: var(--color-cyan);
    }

    .category.delegate .category-title {
        color: var(--color-orange);
    }

    .category.delete .category-title {
        color: var(--text-muted);
    }

    .task-list {
        width: 100%;
        max-height: 250px;
        overflow-x: hidden;
        overflow-y: auto;
    }

    .task-list :global(li.obsidian-taskcard + li.obsidian-taskcard) {
        margin-top: 0;
        border-top: 1px solid var(--background-modifier-border);
    }
</style>

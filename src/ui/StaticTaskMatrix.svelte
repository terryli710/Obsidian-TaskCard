<script lang="ts">
    import { ObsidianTask, PositionedObsidianTask } from "../taskModule/task";
    import StaticTaskItem from './StaticTaskItem.svelte';
    import TaskCardPlugin from "..";
    import { logger } from "../utils/log";
    import LinearProgressBar from "../components/LinearProgressBar.svelte";

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
        if (task.priority > 1 && task.due) {
            return "do"; // was "important-urgent"
        } else if (task.priority > 1 && !task.due) {
            return "plan"; // was "important-not-urgent"
        } else if (!(task.priority > 1) && task.due) {
            return "delegate"; // was "not-important-urgent"
        } else {
            return "delete"; // was "not-important-not-urgent"
        }
    }
</script>

<div class="static-task-matrix">
    <div class="matrix-container">
        <div class="category do">
            <div class="category-head">
                <div class="category-title">Do</div>
                <div class="category-count">
                    <LinearProgressBar value={counts.do.completedTasks} max={counts.do.count} />
                </div>
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
                <div class="category-count">
                    <LinearProgressBar value={counts.plan.completedTasks} max={counts.plan.count} />
                </div>
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
                <div class="category-count">
                    <LinearProgressBar value={counts.delegate.completedTasks} max={counts.delegate.count} />
                </div>
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
                <div class="category-count">
                    <LinearProgressBar value={counts.delete.completedTasks} max={counts.delete.count} />
                </div>
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

    *, *:before, *:after {
    box-sizing: border-box;
    }

    /* Add CSS for the 2x2 grid layout */
    .matrix-container {
        gap: 10px; /* Adjust the gap as needed */
        max-width: 100%; /* Set the maximum width to 100% */
        overflow-x: hidden; /* Disable horizontal scrolling for the whole grid */
    }

    /* Add styles for each category */
    .category {
        flex: 1 1 auto;
        background-color: transparent; /* Set a transparent background */
        padding: 10px; /* Add padding as needed */
        margin: 10px; /* Add margin as needed */
        border-radius: var(--radius-m); /* Add border radius as needed */
        max-height: 80vh; /* Allow vertical scrolling within each category */
        overflow-x: hidden; /* Disable horizontal scrolling for each category */
        overflow-y: auto; /* Enable vertical scrolling for each category */
        /* put element in the middle */
        display: flex;
        flex-direction: column;
        justify-content: center;
    }

    .category-head {
        display: flex;
        align-items: center;
        justify-content: center;
        /* some space between elements */
        gap: 10px;
        margin-bottom: 0.25em;
    }

    .category-title {
        font-size: 1.5em; /* Adjust the font size as needed */
        font-weight: bold; /* Add bold font weight */
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .category-count {
        font-size: 1.0em;
        font-weight: thin;
        margin: 0.25em;
        display: flex;
        justify-content: center;
        align-items: center;
    }


    /* Category-specific background and title colors for differentiation */
    .category.do {
        background-color: rgba(var(--color-purple-rgb), 0.05);
        border: 1px solid var(--color-purple);
    }

    .category.plan  {
        background-color: rgba(var(--color-cyan-rgb), 0.05);
        border: 1px solid var(--color-cyan);
    }

    .category.delegate {
        background-color: rgba(var(--color-orange-rgb), 0.05);
        border: 1px solid var(--color-orange);
    }

    .category.delete {
        background-color: rgba(var(--mono-rgb-100), 0.05);
        border: 1px solid var(--mono-rgb-0);
    }


    .task-list {
        width: 100%;
        max-height: 250px;
        overflow-x: hidden;
        overflow-y: auto;
    }
    
</style>

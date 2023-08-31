

<script lang="ts">
    import { MarkdownTaskMetadata } from "../renderer/staticTaskListRenderer";
    import { ObsidianTask } from "../taskModule/task";
    import StaticTaskItem from './StaticTaskItem.svelte';
    import TaskCardPlugin from "..";
    import { logger } from "../utils/log";

    export let taskListInfo: {task: ObsidianTask, markdownTaskMetadata: MarkdownTaskMetadata}[];
    export let plugin: TaskCardPlugin;
</script>

<ul class="contain-task-list has-list-bullet">
    {#each taskListInfo as taskItemInfo}
        <StaticTaskItem {taskItemInfo} {plugin} />
    {/each}
</ul>



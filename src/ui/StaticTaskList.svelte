

<script lang="ts">
    import { MarkdownTaskMetadata } from "../renderer/staticTaskListRenderer";
    import { ObsidianTask } from "../taskModule/task";
    import StaticTaskItem from './StaticTaskItem.svelte';

    export let taskListInfo: {task: ObsidianTask, markdownTaskMetadata: MarkdownTaskMetadata}[];


</script>

<ul class="contain-task-list has-list-bullet">
    {#each taskListInfo as taskItemInfo}
        <StaticTaskItem {taskItemInfo} />
    {/each}
</ul>



<script lang="ts">
    import { MarkdownTaskMetadata } from "../renderer/staticTaskListRenderer";
    import { TaskDisplayParams } from "../renderer/postProcessor";
    import { ObsidianTask } from "../taskModule/task";
    import StaticTaskCard from "./StaticTaskCard.svelte";

    export let taskItemInfo: {task: ObsidianTask, markdownTaskMetadata: MarkdownTaskMetadata};
</script>


<li class="obsidian-taskcard task-list-item mode-multi-line">
    <StaticTaskCard
        taskItemInfo={taskItemInfo}
    />
</li>
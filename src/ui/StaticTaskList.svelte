

<script lang="ts">
    import { MarkdownTaskMetadata } from "../renderer/StaticTaskListRenderer";
    import StaticTaskItem from './StaticTaskItem.svelte';

    export let mdTaskMetadataList: MarkdownTaskMetadata[];


</script>

<ul class="contain-task-list has-list-bullet">
    {#each mdTaskMetadataList as markdownTaskMetadata}
        <StaticTaskItem {markdownTaskMetadata} />
    {/each}
</ul>



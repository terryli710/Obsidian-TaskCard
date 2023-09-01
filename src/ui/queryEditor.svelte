<script lang="ts">
    import { MultipleAttributeTaskQuery } from "../query/cache";
    import { QuerySyncManager } from "../query/querySyncManager";

    export let options: Partial<MultipleAttributeTaskQuery>;
    export let query: MultipleAttributeTaskQuery = {
        priorityQuery: null,
        projectQuery: null,
        labelQuery: null,
        completedQuery: null,
        dueDateTimeQuery: null,
        filePathQuery: null,
    };
    export let querySyncManager: QuerySyncManager;

    const priorities = ['High', 'Medium', 'Low']; // Fixed number of priorities

    // Function to save the query
    function saveQuery() {
        querySyncManager.updateTaskQueryToFile(query);
    }
</script>
  
<div>
    <!-- Priority -->
    <label>Priority:</label>
    <select multiple bind:value={query.priorityQuery}>
        {#each priorities as priority}
        <option value={priority}>{priority}</option>
        {/each}
    </select>

    <!-- Project -->
    <label>Project:</label>
    <select multiple bind:value={query.projectQuery}>
        {#each options.projectQuery as project}
        <option value={project}>{project}</option>
        {/each}
    </select>

    <!-- Label -->
    <label>Label:</label>
    <select multiple bind:value={query.labelQuery}>
        {#each options.labelQuery as label}
        <option value={label}>{label}</option>
        {/each}
    </select>

    <!-- Due Date Time -->
    <label>Due Date Time:</label>
    <input type="text" placeholder="Time Picker Here" bind:value={query.dueDateTimeQuery} />

    <!-- File Path -->
    <label>File Path:</label>
    <input type="text" bind:value={query.filePathQuery} />

    <!-- Save Button -->
    <button on:click={saveQuery}>Save</button>
</div>
  